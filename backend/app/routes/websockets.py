from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import websocket_manager

router = APIRouter()


@router.websocket("/traffic")
async def traffic_updates(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
