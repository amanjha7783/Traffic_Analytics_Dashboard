import os
import time
import json
import sqlite3
import numpy as np
import cv2
import psutil

from app.vision.detector import YOLOv8Detector
from app.vision.tracker import VehicleTracker
from app.config import MODEL_PATH

VIDEO_PATH = os.path.abspath("../frontend/public/assets/video/annotated-junction-67-original.mp4")
NUM_BENCHMARK_FRAMES = 100

def get_system_stats():
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    return {"cpu_percent": cpu, "ram_used_mb": ram.used / (1024 * 1024)}

def benchmark_pipeline():
    print("=" * 70)
    print("TRAFFICOPS VIDEO PROCESSING ENGINE - BASELINE BOTTLENECK BENCHMARK")
    print(f"Target Video: {VIDEO_PATH}")
    print(f"Benchmark Frame Count: {NUM_BENCHMARK_FRAMES}")
    print("=" * 70)

    # 1. Benchmark Decoding
    cap = cv2.VideoCapture(VIDEO_PATH)
    t0 = time.perf_counter()
    raw_frames = []
    for _ in range(NUM_BENCHMARK_FRAMES):
        ret, frame = cap.read()
        if not ret:
            break
        raw_frames.append(frame)
    t_decode = time.perf_counter() - t0
    cap.release()
    decode_fps = len(raw_frames) / max(0.0001, t_decode)
    print(f"\n[1] Video Decoding (OpenCV Software CPU):")
    print(f"    - Processed {len(raw_frames)} frames in {t_decode:.3f}s")
    print(f"    - Decoder Throughput: {decode_fps:.2f} FPS")
    print(f"    - Average latency per frame: {(t_decode / len(raw_frames)) * 1000:.2f} ms")

    # 2. Benchmark Preprocessing
    detector = YOLOv8Detector(model_path=str(MODEL_PATH))
    t0 = time.perf_counter()
    preprocessed_tensors = []
    for frame in raw_frames:
        letterbox_img, ratio, (dw, dh) = detector._letterbox(frame, detector.input_size)
        rgb_img = cv2.cvtColor(letterbox_img, cv2.COLOR_BGR2RGB)
        input_tensor = rgb_img.astype(np.float32) / 255.0
        input_tensor = input_tensor.transpose(2, 0, 1)
        input_tensor = np.expand_dims(input_tensor, axis=0)
        preprocessed_tensors.append(input_tensor)
    t_preprocess = time.perf_counter() - t0
    preprocess_fps = len(raw_frames) / max(0.0001, t_preprocess)
    print(f"\n[2] Preprocessing (Letterbox + Normalize + Transpose):")
    print(f"    - Processed {len(raw_frames)} frames in {t_preprocess:.3f}s")
    print(f"    - Preprocessing Throughput: {preprocess_fps:.2f} FPS")
    print(f"    - Average latency per frame: {(t_preprocess / len(raw_frames)) * 1000:.2f} ms")

    # 3. Benchmark Inference (ONNX Runtime)
    t0 = time.perf_counter()
    all_detections = []
    for tensor in preprocessed_tensors:
        outputs = detector.session.run(detector.output_names, {detector.input_name: tensor})
        all_detections.append(outputs)
    t_infer = time.perf_counter() - t0
    infer_fps = len(raw_frames) / max(0.0001, t_infer)
    print(f"\n[3] Model Inference (ONNX Runtime Default):")
    print(f"    - Executed {len(raw_frames)} inferences in {t_infer:.3f}s")
    print(f"    - Inference Throughput: {infer_fps:.2f} FPS")
    print(f"    - Average latency per frame: {(t_infer / len(raw_frames)) * 1000:.2f} ms")

    # 4. Benchmark Detection Parsing + Tracking
    t0 = time.perf_counter()
    parsed_detections = []
    for frame in raw_frames:
        dets = detector.detect(frame)
        parsed_detections.append(dets)
    t_detect_full = time.perf_counter() - t0

    tracker = VehicleTracker(max_age=30, min_hits=3, iou_threshold=0.45)
    t0 = time.perf_counter()
    tracks_count = 0
    for idx, dets in enumerate(parsed_detections):
        ts = idx / 30.0
        active_tracks = tracker.update(dets, ts)
        tracks_count += len(active_tracks)
    t_track = time.perf_counter() - t0
    track_fps = len(raw_frames) / max(0.0001, t_track)
    print(f"\n[4] Object Tracking (ByteTrack Kalman Filter):")
    print(f"    - Tracked {tracks_count} vehicle instances across {len(raw_frames)} frames in {t_track:.3f}s")
    print(f"    - Tracking Throughput: {track_fps:.2f} FPS")
    print(f"    - Average latency per frame: {(t_track / len(raw_frames)) * 1000:.2f} ms")

    # 5. Benchmark Output Video Encoding (OpenCV VideoWriter mp4v)
    out_video_path = "benchmark_baseline_out.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(out_video_path, fourcc, 30.0, (1280, 720))
    t0 = time.perf_counter()
    for frame in raw_frames:
        writer.write(frame)
    writer.release()
    t_encode = time.perf_counter() - t0
    if os.path.exists(out_video_path):
        os.remove(out_video_path)
    encode_fps = len(raw_frames) / max(0.0001, t_encode)
    print(f"\n[5] Video Encoding (OpenCV VideoWriter mp4v Software):")
    print(f"    - Encoded {len(raw_frames)} frames in {t_encode:.3f}s")
    print(f"    - Encoding Throughput: {encode_fps:.2f} FPS")
    print(f"    - Average latency per frame: {(t_encode / len(raw_frames)) * 1000:.2f} ms")

    # 6. Benchmark Database Operations (Single row inserts vs Batch inserts)
    db_conn = sqlite3.connect(":memory:")
    db_conn.execute("""
        CREATE TABLE test_trajectories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id INT, frame_idx INT, timestamp_s REAL,
            vehicle_class TEXT, x REAL, y REAL, speed REAL
        )
    """)
    db_conn.commit()

    sample_rows = [
        (101 + (i % 10), i, i * 0.033, "FOUR-WHEELER", 450.0 + i, 320.0 + i, 45.5)
        for i in range(1000)
    ]

    # Single inserts
    t0 = time.perf_counter()
    cursor = db_conn.cursor()
    for r in sample_rows:
        cursor.execute("INSERT INTO test_trajectories (track_id, frame_idx, timestamp_s, vehicle_class, x, y, speed) VALUES (?, ?, ?, ?, ?, ?, ?)", r)
        db_conn.commit()
    t_db_single = time.perf_counter() - t0

    # Batch insert
    cursor.execute("DELETE FROM test_trajectories")
    db_conn.commit()
    t0 = time.perf_counter()
    cursor.executemany("INSERT INTO test_trajectories (track_id, frame_idx, timestamp_s, vehicle_class, x, y, speed) VALUES (?, ?, ?, ?, ?, ?, ?)", sample_rows)
    db_conn.commit()
    t_db_batch = time.perf_counter() - t0
    print(f"\n[6] Database Write Throughput:")
    print(f"    - 1,000 Single Row Commits: {t_db_single:.3f}s ({(1000/t_db_single):.1f} rows/s)")
    print(f"    - 1,000 Batch executemany: {t_db_batch:.4f}s ({(1000/t_db_batch):.1f} rows/s)")
    print(f"    - Database Speedup Factor: {t_db_single / max(0.0001, t_db_batch):.1f}x faster with batching")

    # 7. Summary Latency Breakdown
    total_time_per_frame = (t_decode + t_preprocess + t_infer + t_track + t_encode) / len(raw_frames)
    pipeline_fps = 1.0 / total_time_per_frame
    print("\n" + "=" * 70)
    print("BASELINE STAGE LATENCY BREAKDOWN (PER FRAME):")
    print(f"  • Video Decoding:     {(t_decode / len(raw_frames)) * 1000:6.2f} ms ({((t_decode / len(raw_frames)) / total_time_per_frame) * 100:4.1f}%)")
    print(f"  • Preprocessing:      {(t_preprocess / len(raw_frames)) * 1000:6.2f} ms ({((t_preprocess / len(raw_frames)) / total_time_per_frame) * 100:4.1f}%)")
    print(f"  • Model Inference:    {(t_infer / len(raw_frames)) * 1000:6.2f} ms ({((t_infer / len(raw_frames)) / total_time_per_frame) * 100:4.1f}%)")
    print(f"  • Object Tracking:    {(t_track / len(raw_frames)) * 1000:6.2f} ms ({((t_track / len(raw_frames)) / total_time_per_frame) * 100:4.1f}%)")
    print(f"  • Output Encoding:    {(t_encode / len(raw_frames)) * 1000:6.2f} ms ({((t_encode / len(raw_frames)) / total_time_per_frame) * 100:4.1f}%)")
    print(f"  -------------------------------------------------------------")
    print(f"  • Total Serial Latency: {total_time_per_frame * 1000:6.2f} ms per frame")
    print(f"  • Baseline Serial Throughput: {pipeline_fps:.2f} FPS")
    print(f"  • Real-time Ratio (vs 30fps): {pipeline_fps / 30.0:.2f}x")
    print("=" * 70)

    # Save benchmark JSON for artifact report
    results = {
        "num_frames": len(raw_frames),
        "decode_fps": round(decode_fps, 2),
        "decode_ms": round((t_decode / len(raw_frames)) * 1000, 2),
        "preprocess_fps": round(preprocess_fps, 2),
        "preprocess_ms": round((t_preprocess / len(raw_frames)) * 1000, 2),
        "infer_fps": round(infer_fps, 2),
        "infer_ms": round((t_infer / len(raw_frames)) * 1000, 2),
        "track_fps": round(track_fps, 2),
        "track_ms": round((t_track / len(raw_frames)) * 1000, 2),
        "encode_fps": round(encode_fps, 2),
        "encode_ms": round((t_encode / len(raw_frames)) * 1000, 2),
        "db_single_ms": round(t_db_single * 1000, 2),
        "db_batch_ms": round(t_db_batch * 1000, 2),
        "baseline_fps": round(pipeline_fps, 2),
        "baseline_total_ms": round(total_time_per_frame * 1000, 2),
        "realtime_ratio": round(pipeline_fps / 30.0, 2),
    }
    with open("baseline_benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("Saved baseline benchmark to backend/baseline_benchmark_results.json")

if __name__ == "__main__":
    benchmark_pipeline()
