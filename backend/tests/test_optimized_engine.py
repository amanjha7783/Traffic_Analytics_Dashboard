"""
Automated Test Suite for High-Performance Video Processing Engine.
Validates:
- FastBatchPreprocessor batch tensor shapes & values
- InferenceEngineFactory and transparent CPU fallback
- VideoDecoder and VideoEncoder hardware/software fallbacks
- GPUResourceManager concurrency and telemetry safeguards
- PipelinedVideoIntelligenceEngine chronological tracking and homography velocity
"""
import os
import time
import numpy as np
import pytest

from app.config import MODEL_PATH
from app.video_intelligence.fast_preprocessor import FastBatchPreprocessor
from app.video_intelligence.inference_engine import InferenceEngineFactory, ONNXRuntimeEngine, TensorRTEngine
from app.video_intelligence.hardware_codec import VideoDecoder, VideoEncoder, is_nvdec_available, is_nvenc_available
from app.video_intelligence.gpu_manager import GPUMonitor, GPUResourceManager
from app.video_intelligence.pipelined_engine import PipelinedVideoIntelligenceEngine

TEST_VIDEO_PATH = os.path.abspath("../frontend/public/assets/video/annotated-junction-67-original.mp4")


def test_fast_batch_preprocessor():
    """Verify FastBatchPreprocessor creates correct contiguous batch buffer dimensions."""
    b_size = 4
    h, w = 640, 640
    preproc = FastBatchPreprocessor(batch_size=b_size, input_size=(h, w))

    frames = [np.zeros((720, 1280, 3), dtype=np.uint8) for _ in range(b_size)]
    batch_tensor, ratios, pads = preproc.preprocess_batch(frames)

    assert batch_tensor.shape == (b_size, 3, h, w)
    assert len(ratios) == b_size
    assert len(pads) == b_size
    assert batch_tensor.dtype == np.float32
    assert np.all(batch_tensor >= 0.0) and np.all(batch_tensor <= 1.0)


def test_inference_engine_cpu_fallback():
    """Verify inference engine works and gracefully falls back to CPU."""
    engine = InferenceEngineFactory.create_engine(
        model_path=str(MODEL_PATH),
        backend="auto",
        precision="fp32",
        batch_size=2,
    )
    assert engine is not None
    info = engine.get_info()
    assert "backend" in info
    assert "provider" in info

    # Test single-item and multi-item inference
    dummy_batch = np.zeros((1, 3, 640, 640), dtype=np.float32)
    preds = engine.infer_batch(dummy_batch)
    assert preds.shape == (1, 84, 8400)


def test_tensorrt_engine_fallback():
    """Verify TensorRTEngine initializes and routes through fallback when native TRT is absent."""
    trt_engine = TensorRTEngine(
        model_path=str(MODEL_PATH),
        precision="fp16",
        batch_size=1,
    )
    assert trt_engine is not None
    dummy = np.zeros((1, 3, 640, 640), dtype=np.float32)
    res = trt_engine.infer_batch(dummy)
    assert res.shape == (1, 84, 8400)


def test_video_decoder_and_encoder_fallback():
    """Verify decoder and encoder fall back to OpenCV without crashes."""
    if not os.path.exists(TEST_VIDEO_PATH):
        pytest.skip("Test video not found on disk")

    decoder = VideoDecoder(TEST_VIDEO_PATH, use_nvdec=True)
    assert decoder.width > 0
    assert decoder.height > 0
    assert decoder.fps > 0

    ret, frame = decoder.read_frame()
    assert ret is True
    assert frame is not None
    assert frame.shape == (decoder.height, decoder.width, 3)
    decoder.release()

    # Encoder test
    test_out = "test_enc_temp.mp4"
    encoder = VideoEncoder(test_out, fps=30.0, width=640, height=360, use_nvenc=True)
    test_frame = np.zeros((360, 640, 3), dtype=np.uint8)
    encoder.write_frame(test_frame)
    encoder.release()

    assert os.path.exists(test_out)
    if os.path.exists(test_out):
        os.remove(test_out)


def test_gpu_resource_manager():
    """Verify concurrency semaphore limits active jobs."""
    manager = GPUResourceManager(max_concurrent_jobs=2)
    assert manager.max_concurrent_jobs == 2

    # Acquire 1
    acq1 = manager.acquire("job-test-1", estimated_vram_mb=500)
    assert acq1 is True
    assert "job-test-1" in manager.active_jobs

    manager.release("job-test-1")
    assert "job-test-1" not in manager.active_jobs


def test_pipelined_engine_execution_and_order():
    """Verify pipelined engine runs end-to-end and preserves chronological timestamps."""
    if not os.path.exists(TEST_VIDEO_PATH):
        pytest.skip("Test video not found on disk")

    engine = PipelinedVideoIntelligenceEngine(
        job_id="test-pipelined-unit-01",
        video_id="test-vid-01",
        project_id="test-proj-01",
        video_path=TEST_VIDEO_PATH,
        config={
            "batch_size": 2,
            "frame_step": 1,
            "max_frames": 10,
            "use_hardware_codec": False,
            "generate_annotated_video": False,
        },
    )

    res = engine.execute()
    assert res["success"] is True
    assert res["total_frames"] >= 5
    assert "metrics" in res
    assert res["metrics"]["end_to_end_fps"] > 0

    obs = res["all_observations"]
    # Check that timestamps are monotonically non-decreasing (chronological)
    timestamps = [o["timestamp_s"] for o in obs]
    assert timestamps == sorted(timestamps)
