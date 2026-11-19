"""
GPU Hardware Resource Manager and Telemetry Monitor.
Monitors NVIDIA GPU utilization, VRAM allocation, and enforces concurrency limits
to prevent out-of-memory errors on consumer and workstation GPUs (e.g., RTX 3050 4GB).
"""
import os
import shutil
import subprocess
import threading
import logging
from typing import Dict, Any, Optional
import psutil

logger = logging.getLogger(__name__)


class GPUMonitor:
    """Queries NVIDIA GPU utilization and VRAM via nvidia-smi."""
    def __init__(self):
        self._nvidia_smi = shutil.which("nvidia-smi")
        self._has_gpu = self._nvidia_smi is not None
        self._cached_total_vram_mb: Optional[int] = None

    @property
    def has_gpu(self) -> bool:
        return self._has_gpu

    def get_telemetry(self) -> Dict[str, Any]:
        """Returns GPU utilization %, VRAM used/total MB, and system CPU/RAM stats."""
        stats: Dict[str, Any] = {
            "gpu_available": False,
            "gpu_name": "None",
            "gpu_utilization_percent": 0.0,
            "vram_used_mb": 0.0,
            "vram_total_mb": 0.0,
            "vram_free_mb": 0.0,
            "cpu_percent": psutil.cpu_percent(interval=None),
            "ram_used_mb": round(psutil.virtual_memory().used / (1024 * 1024), 1),
            "ram_total_mb": round(psutil.virtual_memory().total / (1024 * 1024), 1),
        }

        if not self._has_gpu:
            return stats

        try:
            # Query nvidia-smi for concise CSV output
            cmd = [
                self._nvidia_smi,
                "--query-gpu=name,utilization.gpu,memory.used,memory.total,memory.free",
                "--format=csv,noheader,nounits",
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.5)
            if res.returncode == 0 and res.stdout.strip():
                parts = [p.strip() for p in res.stdout.strip().split(",")]
                if len(parts) >= 5:
                    stats["gpu_available"] = True
                    stats["gpu_name"] = parts[0]
                    stats["gpu_utilization_percent"] = float(parts[1]) if parts[1].replace(".", "", 1).isdigit() else 0.0
                    stats["vram_used_mb"] = float(parts[2]) if parts[2].replace(".", "", 1).isdigit() else 0.0
                    stats["vram_total_mb"] = float(parts[3]) if parts[3].replace(".", "", 1).isdigit() else 0.0
                    stats["vram_free_mb"] = float(parts[4]) if parts[4].replace(".", "", 1).isdigit() else 0.0
        except Exception as e:
            logger.debug(f"GPU telemetry query exception: {e}")

        return stats


class GPUResourceManager:
    """
    Concurrency control and GPU memory safety gate.
    Restricts concurrent active heavy video processing jobs to avoid VRAM exhaustion.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, max_concurrent_jobs: int = 2):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._init_manager(max_concurrent_jobs)
            return cls._instance

    def _init_manager(self, max_concurrent_jobs: int):
        self.max_concurrent_jobs = max_concurrent_jobs
        self.semaphore = threading.Semaphore(max_concurrent_jobs)
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        self.active_lock = threading.Lock()
        self.monitor = GPUMonitor()

    def acquire(
        self,
        job_id: str,
        estimated_vram_mb: int = 800,
        stop_event: Optional[threading.Event] = None,
        timeout_s: float = 600.0,
    ) -> bool:
        """
        Acquire execution slot. Checks available VRAM if GPU is available.
        Supports cancellation via stop_event while waiting in queue.
        """
        logger.info(f"Acquiring execution slot for job {job_id}...")
        t_start = psutil.time.time()

        acquired = False
        while not acquired:
            if stop_event and stop_event.is_set():
                logger.info(f"Job {job_id} cancelled while waiting in queue.")
                return False

            if psutil.time.time() - t_start > timeout_s:
                logger.error(f"Timed out waiting for GPU/processing slot for job {job_id}.")
                return False

            acquired = self.semaphore.acquire(timeout=0.5)

        # Telemetry check
        stats = self.monitor.get_telemetry()
        if stats["gpu_available"] and stats["vram_free_mb"] < estimated_vram_mb:
            logger.warning(
                f"Low VRAM warning: {stats['vram_free_mb']:.1f}MB free, required ~{estimated_vram_mb}MB. "
                "Engine will adapt batch size or fallback gracefully."
            )

        with self.active_lock:
            self.active_jobs[job_id] = {
                "started_at": psutil.time.time(),
                "estimated_vram_mb": estimated_vram_mb,
            }
        return True

    def release(self, job_id: str):
        """Release execution slot safely and idempotently."""
        was_active = False
        with self.active_lock:
            if job_id in self.active_jobs:
                del self.active_jobs[job_id]
                was_active = True
        if was_active:
            self.semaphore.release()
            logger.info(f"Released execution slot for job {job_id}.")
        else:
            logger.debug(f"Job {job_id} was not active, skipping semaphore release.")


gpu_monitor = GPUMonitor()
gpu_resource_manager = GPUResourceManager(max_concurrent_jobs=2)
