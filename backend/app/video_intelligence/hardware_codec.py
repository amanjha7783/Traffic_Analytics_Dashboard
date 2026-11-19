"""
Hardware-Accelerated Video Codecs (NVDEC Decoding & NVENC Encoding).
Offloads frame demuxing/decoding to NVIDIA NVDEC and video encoding to NVIDIA NVENC
via low-overhead asynchronous pipes with automatic OpenCV software fallback.
"""
import os
import subprocess
import logging
from typing import Optional, Tuple, Generator
import numpy as np
import cv2

logger = logging.getLogger(__name__)

# Locate FFmpeg binary with NVDEC/NVENC support
FFMPEG_BIN: Optional[str] = None
try:
    import imageio_ffmpeg
    FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    import shutil
    FFMPEG_BIN = shutil.which("ffmpeg")


def is_nvenc_available() -> bool:
    """Test if NVIDIA NVENC hardware encoder is functional on this GPU."""
    if not FFMPEG_BIN or not os.path.exists(FFMPEG_BIN):
        return False
    try:
        cmd = [
            FFMPEG_BIN,
            "-y",
            "-f", "lavfi",
            "-i", "nullsrc=s=64x64:d=0.1:r=30",
            "-c:v", "h264_nvenc",
            "-f", "null",
            "-",
        ]
        res = subprocess.run(cmd, capture_output=True, timeout=2.0)
        return res.returncode == 0
    except Exception:
        return False


def is_nvdec_available() -> bool:
    """Test if NVIDIA NVDEC hardware decoder is functional."""
    if not FFMPEG_BIN or not os.path.exists(FFMPEG_BIN):
        return False
    try:
        cmd = [
            FFMPEG_BIN,
            "-decoders",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.5)
        return "h264_cuvid" in res.stdout
    except Exception:
        return False


class VideoDecoder:
    """Unified video frame decoder with automatic NVDEC GPU acceleration and OpenCV fallback."""
    def __init__(self, video_path: str, use_nvdec: bool = True):
        self.video_path = video_path
        self.use_nvdec = use_nvdec and is_nvdec_available()
        self.proc: Optional[subprocess.Popen] = None
        self.cap: Optional[cv2.VideoCapture] = None

        # Probe video dimensions & FPS
        probe = cv2.VideoCapture(video_path)
        self.fps = probe.get(cv2.CAP_PROP_FPS) or 30.0
        self.width = int(probe.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
        self.height = int(probe.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
        self.total_frames = int(probe.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        probe.release()

        self.frame_size = self.width * self.height * 3
        self.is_hw_accelerated = False
        self._init_decoder()

    def _init_decoder(self):
        if self.use_nvdec and FFMPEG_BIN:
            try:
                cmd = [
                    FFMPEG_BIN,
                    "-hwaccel", "cuda",
                    "-i", self.video_path,
                    "-f", "rawvideo",
                    "-pix_fmt", "bgr24",
                    "-vsync", "0",
                    "-loglevel", "error",
                    "-",
                ]
                self.proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=self.frame_size * 4,
                )
                raw_bytes = self.proc.stdout.read(self.frame_size)
                if len(raw_bytes) == self.frame_size:
                    self.first_frame = np.frombuffer(raw_bytes, dtype=np.uint8).reshape((self.height, self.width, 3))
                    self.is_hw_accelerated = True
                    logger.info(f"Initialized hardware decoder for {self.video_path}")
                    return
                else:
                    logger.warning("Hardware decoder test read failed, falling back to OpenCV.")
                    try:
                        self.proc.terminate()
                    except Exception:
                        pass
                    self.proc = None
            except Exception as e:
                logger.warning(f"Hardware decoder init failed, falling back to OpenCV: {e}")
                if self.proc:
                    try:
                        self.proc.terminate()
                    except Exception:
                        pass
                    self.proc = None

        # Fallback to OpenCV
        self.cap = cv2.VideoCapture(self.video_path)
        self.is_hw_accelerated = False
        logger.info(f"Initialized OpenCV CPU video capture for {self.video_path}")

    def read_frame(self) -> Tuple[bool, Optional[np.ndarray]]:
        """Read a single frame as BGR numpy array."""
        if hasattr(self, "first_frame") and self.first_frame is not None:
            f = self.first_frame
            self.first_frame = None
            return True, f

        if self.proc and self.proc.stdout:
            raw_bytes = self.proc.stdout.read(self.frame_size)
            if len(raw_bytes) == self.frame_size:
                frame = np.frombuffer(raw_bytes, dtype=np.uint8).reshape((self.height, self.width, 3))
                return True, frame
            # End of stream or error
            return False, None

        if self.cap:
            ret, frame = self.cap.read()
            return ret, frame

        return False, None

    def release(self):
        """Release underlying decoder resources."""
        if self.proc:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=1.0)
            except Exception:
                pass
            self.proc = None
        if self.cap:
            self.cap.release()
            self.cap = None


class VideoEncoder:
    """Unified video encoder with automatic NVENC GPU acceleration and OpenCV fallback."""
    def __init__(
        self,
        output_path: str,
        fps: float,
        width: int,
        height: int,
        use_nvenc: bool = True,
        bitrate_kbps: int = 4000,
    ):
        self.output_path = output_path
        self.fps = fps
        self.width = width
        self.height = height
        self.use_nvenc = use_nvenc and is_nvenc_available()
        self.proc: Optional[subprocess.Popen] = None
        self.writer: Optional[cv2.VideoWriter] = None
        self.is_hw_accelerated = False
        self._init_encoder(bitrate_kbps)

    def _init_encoder(self, bitrate_kbps: int):
        if self.use_nvenc and FFMPEG_BIN:
            try:
                cmd = [
                    FFMPEG_BIN,
                    "-y",
                    "-f", "rawvideo",
                    "-vcodec", "rawvideo",
                    "-s", f"{self.width}x{self.height}",
                    "-pix_fmt", "bgr24",
                    "-r", str(self.fps),
                    "-i", "-",
                    "-c:v", "h264_nvenc",
                    "-preset", "p4",  # Balanced NVENC preset
                    "-tune", "ll",    # Low latency
                    "-b:v", f"{bitrate_kbps}k",
                    "-pix_fmt", "yuv420p",
                    "-loglevel", "error",
                    self.output_path,
                ]
                self.proc = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=self.width * self.height * 3 * 4,
                )
                self.is_hw_accelerated = True
                logger.info(f"Initialized NVENC hardware encoder for {self.output_path}")
                return
            except Exception as e:
                logger.warning(f"NVENC initialization failed, falling back to FFmpeg libx264: {e}")

        # Priority 2: FFmpeg libx264 (H.264 CPU encoder - 100% web browser compatible)
        if FFMPEG_BIN:
            try:
                cmd = [
                    FFMPEG_BIN,
                    "-y",
                    "-f", "rawvideo",
                    "-vcodec", "rawvideo",
                    "-s", f"{self.width}x{self.height}",
                    "-pix_fmt", "bgr24",
                    "-r", str(self.fps),
                    "-i", "-",
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-tune", "zerolatency",
                    "-pix_fmt", "yuv420p",
                    "-b:v", f"{bitrate_kbps}k",
                    "-loglevel", "error",
                    self.output_path,
                ]
                self.proc = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=self.width * self.height * 3 * 4,
                )
                self.is_hw_accelerated = False
                logger.info(f"Initialized FFmpeg libx264 web-compatible H.264 encoder for {self.output_path}")
                return
            except Exception as e:
                logger.warning(f"FFmpeg libx264 initialization failed: {e}")

        # Priority 3: OpenCV VideoWriter fallback
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        self.writer = cv2.VideoWriter(self.output_path, fourcc, self.fps, (self.width, self.height))
        self.is_hw_accelerated = False
        logger.info(f"Initialized OpenCV CPU VideoWriter for {self.output_path}")

    def write_frame(self, frame: np.ndarray):
        """Write a BGR frame to output stream."""
        if self.proc and self.proc.stdin:
            try:
                self.proc.stdin.write(frame.tobytes())
                return
            except Exception as e:
                logger.error(f"Error writing to video encoder pipe: {e}")

        if self.writer:
            self.writer.write(frame)

    def release(self):
        """Flush and finalize encoder."""
        if self.proc:
            try:
                if self.proc.stdin:
                    self.proc.stdin.close()
                self.proc.wait(timeout=5.0)
            except Exception:
                pass
            self.proc = None

        if self.writer:
            self.writer.release()
            self.writer = None
            # If OpenCV wrote mp4v, remux to H.264 so web browsers can play it
            if FFMPEG_BIN and os.path.exists(self.output_path):
                temp_h264 = self.output_path + ".h264.mp4"
                try:
                    cmd = [
                        FFMPEG_BIN, "-y", "-i", self.output_path,
                        "-c:v", "libx264", "-preset", "ultrafast",
                        "-pix_fmt", "yuv420p", "-loglevel", "error", temp_h264
                    ]
                    r = subprocess.run(cmd, timeout=30)
                    if r.returncode == 0 and os.path.exists(temp_h264):
                        os.replace(temp_h264, self.output_path)
                except Exception:
                    if os.path.exists(temp_h264):
                        try:
                            os.remove(temp_h264)
                        except Exception:
                            pass
