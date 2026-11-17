import asyncio
import logging
from typing import Any, Dict, Set

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class WebSocketManager:
    def __init__(self):
        self.connections: Set[WebSocket] = set()
        self.loop: asyncio.AbstractEventLoop | None = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.loop = asyncio.get_running_loop()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        stale = []
        for connection in tuple(self.connections):
            try:
                await connection.send_json(message)
            except (RuntimeError, WebSocketDisconnect):
                logger.debug("Removing an unavailable traffic WebSocket connection")
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)

    def publish_from_thread(self, message: Dict[str, Any]) -> None:
        loop = self.loop
        if loop is None or loop.is_closed():
            return
        loop.call_soon_threadsafe(
            lambda: asyncio.create_task(self.broadcast(message))
        )


websocket_manager = WebSocketManager()
