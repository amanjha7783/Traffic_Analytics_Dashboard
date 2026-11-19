"""
High-Performance Multi-Stage Asynchronous Pipelined Video Intelligence Engine.
Decouples video decoding, vectorized batch preprocessing, model inference,
chronological ByteTrack tracking, homography projection, hardware video encoding,
and bulk database writes across bounded producer-consumer queues.
"""
import os
import time
import math
import queue
import threading
import logging
from typing import Dict, Any, List, Tuple, Optional, Sequence
import numpy as np
import cv2

from app.database.database import get_db
from app.video_intelligence.gpu_manager import gpu_monitor, gpu_resource_manager
from app.video_intelligence.hardware_codec import VideoDecoder, VideoEncoder
from app.video_intelligence.fast_preprocessor import FastBatchPreprocessor
from app.video_intelligence.inference_engine import InferenceEngineFactory, BaseInferenceEngine
from app.vision.tracker import VehicleTracker
from app.vision.vehicle_classifier import refine_classification, get_vehicle_spec, COCO_CLASS_MAPPING
from app.video_intelligence.homography import transform_image_to_ground
from app.video_intelligence.geospatial import wgs84_to_utm, utm_to_wgs84
from app.video_intelligence.annotation_renderer import draw_frame_annotations
from app.video_intelligence.density_engine import (
    calculate_traffic_density,
    calculate_road_occupancy,
    classify_congestion_level,
)

logger = logging.getLogger(__name__)


class PipelinedVideoIntelligenceEngine:
    """
    High-Throughput Pipelined Video Processing Engine.
    Executes Decoding, Inference, Tracking, Encoding, and DB Writes concurrently.
    """
    def __init__(
        self,
        job_id: str,
        video_id: str,
        project_id: str,
        video_path: str,
        annotated_output_path: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        homography_matrix: Optional[Sequence[Sequence[float]]] = None,
        project_coords: Optional[Tuple[float, float]] = None,
        measurement_regions: Optional[List[Dict[str, Any]]] = None,
        progress_callback: Optional[Any] = None,
    ):
        self.job_id = job_id
        self.video_id = video_id
        self.project_id = project_id
        self.video_path = video_path
        self.annotated_output_path = annotated_output_path
        self.config = config or {}
        self.homography = homography_matrix
        self.project_coords = project_coords
        self.measurement_regions = measurement_regions or []
        self.progress_callback = progress_callback

        # Configuration options
        self.backend = self.config.get("backend", "auto")
        self.precision = self.config.get("precision", "fp32")
        self.batch_size = max(1, min(16, int(self.config.get("batch_size", 4))))
        self.frame_step = max(1, int(self.config.get("frame_step", 1)))
        self.max_frames = self.config.get("max_frames")
        self.conf_threshold = float(self.config.get("confidence_threshold", 0.35))
        self.iou_threshold = float(self.config.get("iou_threshold", 0.45))
        self.use_hardware_codec = bool(self.config.get("use_hardware_codec", True))
        self.generate_annotated_video = bool(self.config.get("generate_annotated_video", True))

        # Control primitives
        self.stop_event = threading.Event()
        self.pause_event = threading.Event()
        self.pause_event.set()

        # Bounded stage queues to prevent RAM explosion
        QUEUE_CAPACITY = max(8, self.batch_size * 4)
        self.decode_queue: queue.Queue = queue.Queue(maxsize=QUEUE_CAPACITY)
        self.batch_queue: queue.Queue = queue.Queue(maxsize=QUEUE_CAPACITY // self.batch_size + 2)
        self.inference_queue: queue.Queue = queue.Queue(maxsize=QUEUE_CAPACITY // self.batch_size + 2)
        self.encode_queue: queue.Queue = queue.Queue(maxsize=QUEUE_CAPACITY)
        self.db_queue: queue.Queue = queue.Queue(maxsize=2000)

        # Telemetry metrics
        self.total_frames_processed = 0
        self.video_fps = 30.0
        self.metrics = {
            "decode_fps": 0.0,
            "inference_fps": 0.0,
            "tracking_fps": 0.0,
            "encoding_fps": 0.0,
            "end_to_end_fps": 0.0,
            "gpu_utilization_percent": 0.0,
            "vram_used_mb": 0.0,
            "cpu_percent": 0.0,
            "realtime_ratio": 0.0,
            "total_duration_s": 0.0,
            "processed_video_duration_s": 0.0,
        }

        # Geospatial UTM anchor
        self.origin_easting = 0.0
        self.origin_northing = 0.0
        self.utm_zone = None
        if project_coords and project_coords[0] and project_coords[1]:
            e, n, z, _ = wgs84_to_utm(project_coords[0], project_coords[1])
            self.origin_easting = e
            self.origin_northing = n
            self.utm_zone = z

        self.class_mapping = dict(COCO_CLASS_MAPPING)

    def pause(self):
        self.pause_event.clear()

    def resume(self):
        self.pause_event.set()

    def cancel(self):
        self.stop_event.set()
        self.pause_event.set()

    def _decoder_worker(self, decoder: VideoDecoder):
        """Stage 1: Read video frames using NVDEC/OpenCV and enqueue raw frames."""
        frame_idx = 0
        t0 = time.perf_counter()
        count = 0

        try:
            while not self.stop_event.is_set():
                self.pause_event.wait()
                if self.stop_event.is_set():
                    break

                ret, frame = decoder.read_frame()
                if not ret or frame is None:
                    break

                frame_idx += 1
                if self.max_frames and frame_idx > self.max_frames:
                    break

                # Frame step sampling
                if (frame_idx - 1) % self.frame_step != 0:
                    continue

                count += 1
                timestamp_s = frame_idx / max(1.0, decoder.fps)
                self.decode_queue.put((frame_idx, timestamp_s, frame))

        except Exception as e:
            logger.error(f"Decoder worker error: {e}", exc_info=True)
        finally:
            self.decode_queue.put(None)  # Sentinel
            elapsed = time.perf_counter() - t0
            if elapsed > 0 and count > 0:
                self.metrics["decode_fps"] = round(count / elapsed, 1)
            logger.info(f"Decoder worker finished. Frames: {count}, FPS: {self.metrics['decode_fps']}")

    def _batch_preprocessor_worker(self, preprocessor: FastBatchPreprocessor):
        """Stage 2: Accumulate frames into batches and vectorize letterboxing."""
        current_batch_frames = []
        current_batch_meta = []
        t0 = time.perf_counter()
        batch_count = 0

        try:
            while not self.stop_event.is_set():
                item = self.decode_queue.get()
                if item is None:
                    # Flush remaining batch
                    if current_batch_frames:
                        tensor, ratios, pads = preprocessor.preprocess_batch(current_batch_frames)
                        self.batch_queue.put((tensor.copy(), current_batch_meta, ratios, pads))
                    break

                frame_idx, timestamp_s, frame = item
                current_batch_frames.append(frame)
                current_batch_meta.append((frame_idx, timestamp_s, frame))

                if len(current_batch_frames) == self.batch_size:
                    tensor, ratios, pads = preprocessor.preprocess_batch(current_batch_frames)
                    self.batch_queue.put((tensor.copy(), current_batch_meta, ratios, pads))
                    batch_count += len(current_batch_frames)
                    current_batch_frames = []
                    current_batch_meta = []

        except Exception as e:
            logger.error(f"Batch preprocessor worker error: {e}", exc_info=True)
        finally:
            self.batch_queue.put(None)
            logger.info("Batch preprocessor finished.")

    def _inference_worker(self, engine: BaseInferenceEngine):
        """Stage 3: Run batched model inference on TensorRT / ONNX Runtime."""
        t0 = time.perf_counter()
        total_inferences = 0

        try:
            while not self.stop_event.is_set():
                item = self.batch_queue.get()
                if item is None:
                    break

                batch_tensor, batch_meta, ratios, pads = item
                # Run inference
                t_infer_start = time.perf_counter()
                preds = engine.infer_batch(batch_tensor)  # (B, 84, 8400)
                total_inferences += len(batch_meta)

                # Post-process each frame in batch
                parsed_batch_detections = []
                for b_idx in range(len(batch_meta)):
                    frame_idx, timestamp_s, frame = batch_meta[b_idx]
                    orig_h, orig_w = frame.shape[:2]
                    ratio = ratios[b_idx]
                    dw, dh = pads[b_idx]

                    frame_preds = preds[b_idx]
                    if frame_preds.shape[0] <= 128 and frame_preds.shape[1] > frame_preds.shape[0]:
                        frame_preds = frame_preds.T

                    coords = frame_preds[:, 0:4]
                    class_scores = frame_preds[:, 4:]
                    max_scores = np.max(class_scores, axis=1)
                    max_classes = np.argmax(class_scores, axis=1)

                    mask = max_scores >= self.conf_threshold
                    filtered_coords = coords[mask]
                    filtered_scores = max_scores[mask]
                    filtered_classes = max_classes[mask]

                    boxes = []
                    confidences = []
                    class_ids = []

                    for i in range(len(filtered_scores)):
                        cid = int(filtered_classes[i])
                        if cid not in self.class_mapping:
                            continue
                        score = float(filtered_scores[i])
                        cx, cy, w, h = filtered_coords[i]

                        orig_cx = (cx - dw) / ratio
                        orig_cy = (cy - dh) / ratio
                        orig_bw = w / ratio
                        orig_bh = h / ratio

                        x1 = max(0, int(orig_cx - orig_bw / 2))
                        y1 = max(0, int(orig_cy - orig_bh / 2))
                        x2 = min(orig_w - 1, int(orig_cx + orig_bw / 2))
                        y2 = min(orig_h - 1, int(orig_cy + orig_bh / 2))

                        boxes.append([x1, y1, max(1, x2 - x1), max(1, y2 - y1)])
                        confidences.append(score)
                        class_ids.append(cid)

                    # NMS
                    detections = []
                    if boxes:
                        indices = cv2.dnn.NMSBoxes(boxes, confidences, self.conf_threshold, self.iou_threshold)
                        if len(indices) > 0:
                            for idx in indices.flatten():
                                box = boxes[idx]
                                cid = class_ids[idx]
                                conf = confidences[idx]
                                x1, y1, bw, bh = box
                                x2, y2 = x1 + bw, y1 + bh

                                raw_class = self.class_mapping.get(cid, "OTHER")
                                refined_class = refine_classification(raw_class, (x1, y1, x2, y2), bh / max(1.0, bw), bw * bh)
                                specs = get_vehicle_spec(refined_class)

                                from app.vision.detector import Detection
                                detections.append(
                                    Detection(
                                        bbox=(x1, y1, x2, y2),
                                        confidence=round(conf, 3),
                                        class_name=refined_class,
                                        class_id=cid,
                                        footprint_area=specs["footprint_area_sqm"],
                                        color_bgr=specs["color_bgr"],
                                    )
                                )

                    parsed_batch_detections.append(detections)

                self.inference_queue.put((parsed_batch_detections, batch_meta))

        except Exception as e:
            logger.error(f"Inference worker error: {e}", exc_info=True)
        finally:
            self.inference_queue.put(None)
            elapsed = time.perf_counter() - t0
            if elapsed > 0 and total_inferences > 0:
                self.metrics["inference_fps"] = round(total_inferences / elapsed, 1)
            logger.info(f"Inference worker finished. Throughput: {self.metrics['inference_fps']} FPS")

    def _tracking_projection_worker(self, tracker: VehicleTracker):
        """Stage 4: Sequential ByteTrack Multi-Object Tracking & Homography Projection."""
        t0 = time.perf_counter()
        tracked_frames = 0
        last_progress_update = time.perf_counter()
        track_ground_history: Dict[int, Dict[str, Any]] = {}

        try:
            while not self.stop_event.is_set():
                item = self.inference_queue.get()
                if item is None:
                    break

                parsed_batch_detections, batch_meta = item

                # CRITICAL: Preserve strictly chronological order frame by frame
                for i in range(len(batch_meta)):
                    frame_idx, timestamp_s, frame = batch_meta[i]
                    dets = parsed_batch_detections[i]

                    # 1. Update ByteTrack
                    tracks = tracker.update(dets, timestamp_s)
                    tracked_frames += 1

                    # 2. Homography Ground Projection
                    frame_observations = []
                    for trk in tracks:
                        bbox = trk.bbox
                        cx = (bbox[0] + bbox[2]) / 2.0
                        cy = float(bbox[3])  # bottom-center ground contact point

                        ground_x = None
                        ground_y = None
                        lat = None
                        lon = None
                        speed_kmh = None
                        vclass = getattr(trk, "class_name", getattr(trk, "vehicle_class", "FOUR-WHEELER"))

                        if self.homography:
                            try:
                                gx, gy = transform_image_to_ground((cx, cy), self.homography)
                                ground_x = round(gx, 3)
                                ground_y = round(gy, 3)

                                hist = track_ground_history.get(trk.track_id)
                                if hist is not None:
                                    dt = timestamp_s - hist["prev_ts"]
                                    if dt > 0.001:
                                        disp_m = math.hypot(gx - hist["prev_gx"], gy - hist["prev_gy"])
                                        # Stationary filter: ignore sub-pixel detector jitter under 0.08m
                                        if disp_m < 0.08:
                                            raw_spd = 0.0
                                        else:
                                            raw_spd = (disp_m / dt) * 3.6

                                        # Exponential moving average filter for smooth dynamic response
                                        prev_spd = hist.get("smoothed_speed")
                                        if prev_spd is None:
                                            smoothed_spd = raw_spd
                                        else:
                                            smoothed_spd = 0.7 * prev_spd + 0.3 * raw_spd

                                        # Physical plausibility validation
                                        if vclass == "PEDESTRIAN":
                                            if smoothed_spd > 25.0:
                                                speed_kmh = None
                                            else:
                                                speed_kmh = round(smoothed_spd, 1)
                                        elif smoothed_spd > 160.0:
                                            speed_kmh = None
                                        else:
                                            speed_kmh = round(smoothed_spd, 1)

                                        hist["smoothed_speed"] = smoothed_spd
                                        hist["prev_gx"] = gx
                                        hist["prev_gy"] = gy
                                        hist["prev_ts"] = timestamp_s
                                else:
                                    track_ground_history[trk.track_id] = {
                                        "prev_gx": gx,
                                        "prev_gy": gy,
                                        "prev_ts": timestamp_s,
                                        "smoothed_speed": None,
                                    }

                                if self.project_coords and self.origin_easting:
                                    abs_e = self.origin_easting + gx
                                    abs_n = self.origin_northing + gy
                                    w_lat, w_lon = utm_to_wgs84(abs_e, abs_n, self.utm_zone or 43)
                                    lat = round(w_lat, 6)
                                    lon = round(w_lon, 6)
                            except Exception as err:
                                logger.debug(f"Homography ground mapping error: {err}")

                        obs = {
                            "track_id": trk.track_id,
                            "frame_idx": frame_idx,
                            "timestamp_s": round(timestamp_s, 2),
                            "vehicle_class": vclass,
                            "confidence": round(trk.confidence, 3),
                            "bbox": bbox,
                            "image_x": round(cx, 1),
                            "image_y": round(cy, 1),
                            "ground_x_m": ground_x,
                            "ground_y_m": ground_y,
                            "latitude": lat,
                            "longitude": lon,
                            "speed_kmh": speed_kmh,
                        }
                        frame_observations.append(obs)

                    # Send to DB worker queue
                    self.db_queue.put(("observations", frame_observations))

                    # Send to video encoder queue
                    if self.generate_annotated_video:
                        self.encode_queue.put((frame, frame_observations, timestamp_s, frame_idx))

                    # Update progress telemetry
                    self.total_frames_processed = tracked_frames
                    now = time.perf_counter()
                    if now - last_progress_update >= 0.5:
                        last_progress_update = now
                        elapsed = now - t0
                        if elapsed > 0:
                            self.metrics["tracking_fps"] = round(tracked_frames / elapsed, 1)
                        if self.progress_callback:
                            self.progress_callback(frame_idx, self.metrics)

        except Exception as e:
            logger.error(f"Tracking projection worker error: {e}", exc_info=True)
        finally:
            self.encode_queue.put(None)
            self.db_queue.put(None)
            elapsed = time.perf_counter() - t0
            if elapsed > 0 and tracked_frames > 0:
                self.metrics["tracking_fps"] = round(tracked_frames / elapsed, 1)
            logger.info(f"Tracking worker finished. Frames: {tracked_frames}, FPS: {self.metrics['tracking_fps']}")

    def _encoder_worker(self, encoder: Optional[VideoEncoder]):
        """Stage 5: Render annotations and encode output video via NVENC/OpenCV."""
        if not encoder or not self.generate_annotated_video:
            return

        t0 = time.perf_counter()
        count = 0

        try:
            while not self.stop_event.is_set():
                item = self.encode_queue.get()
                if item is None:
                    break

                frame, observations, timestamp_s, frame_idx = item
                ann_frame = draw_frame_annotations(
                    frame=frame,
                    observations=observations,
                    measurement_regions=self.measurement_regions,
                    timestamp_s=timestamp_s,
                )
                encoder.write_frame(ann_frame)
                count += 1

        except Exception as e:
            logger.error(f"Encoder worker error: {e}", exc_info=True)
        finally:
            encoder.release()
            elapsed = time.perf_counter() - t0
            if elapsed > 0 and count > 0:
                self.metrics["encoding_fps"] = round(count / elapsed, 1)
            logger.info(f"Encoder worker finished. Encoded: {count}, FPS: {self.metrics['encoding_fps']}")

    def _db_writer_worker(self):
        """Stage 6: Bulk insert trajectory points and measurements in batched transactions."""
        batch_records = []
        all_obs_for_summary = []

        try:
            while True:
                item = self.db_queue.get()
                if item is None:
                    # Flush remaining
                    if batch_records:
                        self._flush_trajectories_batch(batch_records)
                    break

                msg_type, data = item
                if msg_type == "observations":
                    for obs in data:
                        batch_records.append((
                            self.job_id,
                            self.video_id,
                            self.project_id,
                            obs["track_id"],
                            obs["frame_idx"],
                            obs["timestamp_s"],
                            obs["vehicle_class"],
                            obs["confidence"],
                            obs["bbox"][0],
                            obs["bbox"][1],
                            obs["bbox"][2],
                            obs["bbox"][3],
                            obs["image_x"],
                            obs["image_y"],
                            obs["ground_x_m"],
                            obs["ground_y_m"],
                            obs["latitude"],
                            obs["longitude"],
                            obs["speed_kmh"],
                        ))
                        all_obs_for_summary.append(obs)

                    if len(batch_records) >= 500:
                        self._flush_trajectories_batch(batch_records)
                        batch_records = []

        except Exception as e:
            logger.error(f"DB writer worker error: {e}", exc_info=True)

        return all_obs_for_summary

    def _flush_trajectories_batch(self, records: List[Tuple]):
        """Execute fast batch executemany inside transaction."""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.executemany(
                    """
                    INSERT INTO studio_trajectories (
                        job_id, video_id, project_id, track_id, frame_idx, timestamp_s,
                        vehicle_class, confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2,
                        image_x, image_y, ground_x_m, ground_y_m, latitude, longitude, speed_kmh
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    records,
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to flush trajectories batch: {e}")

    def execute(self) -> Dict[str, Any]:
        """
        Run the complete pipelined processing job end-to-end.
        Acquires GPU slot, launches threads, tracks telemetry, and aggregates outputs.
        """
        t_global_start = time.perf_counter()
        acquired = gpu_resource_manager.acquire(
            self.job_id,
            estimated_vram_mb=700,
            stop_event=self.stop_event,
        )
        if not acquired:
            logger.info(f"Engine execute aborted (could not acquire slot or cancelled) for job {self.job_id}")
            return {
                "success": False,
                "total_frames": 0,
                "metrics": {},
                "engine_info": {},
                "all_observations": [],
            }

        decoder = None
        encoder = None

        try:
            # 1. Initialize Codecs
            decoder = VideoDecoder(self.video_path, use_nvdec=self.use_hardware_codec)
            self.video_fps = decoder.fps

            if self.generate_annotated_video and self.annotated_output_path:
                encoder_fps = decoder.fps / self.frame_step
                encoder = VideoEncoder(
                    self.annotated_output_path,
                    fps=encoder_fps,
                    width=decoder.width,
                    height=decoder.height,
                    use_nvenc=self.use_hardware_codec,
                )

            # 2. Initialize Preprocessor & Inference Engine
            preprocessor = FastBatchPreprocessor(batch_size=self.batch_size, input_size=(640, 640))
            from app.config import MODEL_PATH
            engine = InferenceEngineFactory.create_engine(
                model_path=str(MODEL_PATH),
                backend=self.backend,
                precision=self.precision,
                batch_size=self.batch_size,
            )

            # 3. Initialize ByteTrack Tracker
            tracker = VehicleTracker(max_age=30, min_hits=3, iou_threshold=self.iou_threshold)

            # 4. Launch Worker Threads
            t_decoder = threading.Thread(target=self._decoder_worker, args=(decoder,), name=f"Dec-{self.job_id}")
            t_preproc = threading.Thread(target=self._batch_preprocessor_worker, args=(preprocessor,), name=f"Pre-{self.job_id}")
            t_infer = threading.Thread(target=self._inference_worker, args=(engine,), name=f"Inf-{self.job_id}")
            t_track = threading.Thread(target=self._tracking_projection_worker, args=(tracker,), name=f"Trk-{self.job_id}")
            t_encode = threading.Thread(target=self._encoder_worker, args=(encoder,), name=f"Enc-{self.job_id}")

            # Start pipeline stages
            t_decoder.start()
            t_preproc.start()
            t_infer.start()
            t_track.start()
            t_encode.start()

            # Run DB writer in current thread or wait for completion
            all_observations = self._db_writer_worker()

            # Join all worker threads
            t_decoder.join()
            t_preproc.join()
            t_infer.join()
            t_track.join()
            t_encode.join()

            t_global_end = time.perf_counter()
            total_time = max(0.001, t_global_end - t_global_start)
            total_frames = max(1, self.total_frames_processed)

            # Record final performance telemetry
            telemetry = gpu_monitor.get_telemetry()
            self.metrics["end_to_end_fps"] = round(total_frames / total_time, 1)
            self.metrics["total_duration_s"] = round(total_time, 2)
            self.metrics["processed_video_duration_s"] = round(total_frames / max(1.0, decoder.fps), 2)
            self.metrics["realtime_ratio"] = round(self.metrics["end_to_end_fps"] / max(1.0, decoder.fps), 2)
            self.metrics["gpu_utilization_percent"] = telemetry.get("gpu_utilization_percent", 0.0)
            self.metrics["vram_used_mb"] = telemetry.get("vram_used_mb", 0.0)
            self.metrics["cpu_percent"] = telemetry.get("cpu_percent", 0.0)

            logger.info(
                f"Pipelined Engine Finished in {total_time:.2f}s! "
                f"Throughput: {self.metrics['end_to_end_fps']} FPS ({self.metrics['realtime_ratio']}x real-time)"
            )

            return {
                "success": not self.stop_event.is_set(),
                "total_frames": total_frames,
                "metrics": self.metrics,
                "engine_info": engine.get_info(),
                "all_observations": all_observations,
            }

        finally:
            if decoder:
                decoder.release()
            if encoder:
                encoder.release()
            gpu_resource_manager.release(self.job_id)
