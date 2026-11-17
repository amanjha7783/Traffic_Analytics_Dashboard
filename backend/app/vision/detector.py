"""
YOLOv8 ONNX Object Detector for Traffic Analysis.
High-speed inference on CPU/GPU via ONNX Runtime and OpenCV DNN.
Detects and maps vehicles and pedestrians into standardized classes.
"""
import os
import json
import cv2
import numpy as np
import logging
from typing import List, Tuple, Dict, Any, Optional
from dataclasses import dataclass

from app.vision.vehicle_classifier import (
    COCO_CLASS_MAPPING,
    IRC_VEHICLE_SPECS,
    refine_classification,
    get_vehicle_spec
)
from app.config import MODEL_PATH, DETECTION_CONFIDENCE, DETECTION_IOU

logger = logging.getLogger(__name__)

DEFAULT_MODEL_PATH = str(MODEL_PATH)


@dataclass
class Detection:
    bbox: Tuple[int, int, int, int]  # (x1, y1, x2, y2) in original frame pixels
    confidence: float
    class_name: str                  # Standardized: TWO-WHEELER, FOUR-WHEELER, etc.
    class_id: int
    footprint_area: float            # Physical m^2 from reference specs
    color_bgr: Tuple[int, int, int]  # BGR color for visualization


class YOLOv8Detector:
    def __init__(
        self,
        model_path: str = DEFAULT_MODEL_PATH,
        conf_threshold: float = DETECTION_CONFIDENCE,
        iou_threshold: float = DETECTION_IOU,
        input_size: Tuple[int, int] = (640, 640)
    ):
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.input_size = input_size
        self.session = None
        self.input_name = None
        self.output_names = None
        self.load_error: Optional[str] = None
        self.class_mapping = dict(COCO_CLASS_MAPPING)
        mapping_json = os.getenv("TRAFFIC_CLASS_MAPPING_JSON")
        if mapping_json:
            try:
                configured_mapping = json.loads(mapping_json)
                if not isinstance(configured_mapping, dict):
                    raise ValueError("class mapping must be a JSON object")
                allowed_classes = set(IRC_VEHICLE_SPECS)
                for class_id, category in configured_mapping.items():
                    normalized = str(category).upper().strip()
                    if normalized not in allowed_classes:
                        raise ValueError(f"unsupported category for class {class_id}: {category}")
                    self.class_mapping[int(class_id)] = normalized
            except (TypeError, ValueError, json.JSONDecodeError) as exc:
                raise ValueError(f"Invalid TRAFFIC_CLASS_MAPPING_JSON: {exc}") from exc
        self._init_session()

    def _init_session(self):
        """Initialize the ONNX Runtime inference session."""
        if not os.path.exists(self.model_path):
            self.load_error = f"YOLOv8 ONNX model not found at {self.model_path}"
            logger.warning(self.load_error)
            return

        try:
            import onnxruntime as ort
            providers = ['CPUExecutionProvider']
            # If CUDA is available, use CUDAExecutionProvider
            available = ort.get_available_providers()
            if 'CUDAExecutionProvider' in available:
                providers.insert(0, 'CUDAExecutionProvider')

            self.session = ort.InferenceSession(self.model_path, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [o.name for o in self.session.get_outputs()]
            logger.info(f"YOLOv8 detector initialized from {self.model_path} with providers {providers}")
        except Exception as e:
            logger.error(f"Failed to load ONNX session: {e}")
            self.load_error = str(e)
            self.session = None

    def is_ready(self) -> bool:
        return self.session is not None

    def _letterbox(
        self,
        img: np.ndarray,
        new_shape: Tuple[int, int] = (640, 640),
        color: Tuple[int, int, int] = (114, 114, 114)
    ) -> Tuple[np.ndarray, float, Tuple[float, float]]:
        """Resize and pad image while meeting stride-multiple constraints."""
        shape = img.shape[:2]  # current shape [height, width]
        r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])

        # Compute padding
        new_unpad = int(round(shape[1] * r)), int(round(shape[0] * r))
        dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]
        dw /= 2  # divide padding into 2 sides
        dh /= 2

        if shape[::-1] != new_unpad:
            img = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)

        top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
        left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
        img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
        return img, r, (dw, dh)

    def detect(self, frame: np.ndarray) -> List[Detection]:
        """
        Run inference on a single BGR frame.
        Returns list of Detection objects.
        """
        if self.session is None:
            raise RuntimeError(self.load_error or "YOLO detector is not ready")
        if frame is None or frame.size == 0:
            return []

        orig_h, orig_w = frame.shape[:2]

        # 1. Preprocess: Letterbox and format
        letterbox_img, ratio, (dw, dh) = self._letterbox(frame, self.input_size)
        rgb_img = cv2.cvtColor(letterbox_img, cv2.COLOR_BGR2RGB)
        input_tensor = rgb_img.astype(np.float32) / 255.0
        input_tensor = input_tensor.transpose(2, 0, 1)  # HWC to CHW
        input_tensor = np.expand_dims(input_tensor, axis=0)  # Add batch dim [1, 3, 640, 640]

        # 2. Run ONNX Inference
        outputs = self.session.run(self.output_names, {self.input_name: input_tensor})
        predictions = outputs[0]  # shape: [1, 84, 8400]

        # 3. Postprocess
        # Transpose to [8400, 84] -> [num_boxes, (cx, cy, w, h, class_0 ... class_79)]
        preds = np.squeeze(predictions, axis=0)
        if preds.ndim != 2:
            raise RuntimeError(f"Unexpected YOLO output shape: {predictions.shape}")
        if preds.shape[0] <= 128 and preds.shape[1] > preds.shape[0]:
            preds = preds.T

        boxes = []
        confidences = []
        class_ids = []

        # Extract box coords and scores
        coords = preds[:, 0:4]  # cx, cy, w, h
        class_scores = preds[:, 4:]  # 80 class scores

        max_scores = np.max(class_scores, axis=1)
        max_classes = np.argmax(class_scores, axis=1)

        # Filter by confidence threshold
        mask = max_scores >= self.conf_threshold
        filtered_coords = coords[mask]
        filtered_scores = max_scores[mask]
        filtered_classes = max_classes[mask]

        if len(filtered_scores) == 0:
            return []

        # Convert cx, cy, w, h on 640x640 back to original frame coordinates
        for i in range(len(filtered_scores)):
            cid = int(filtered_classes[i])
            # Only process relevant classes (vehicles + pedestrians)
            if cid not in self.class_mapping:
                continue

            score = float(filtered_scores[i])
            cx, cy, w, h = filtered_coords[i]

            # Remove padding
            x_pad = cx - dw
            y_pad = cy - dh

            # Rescale to original
            orig_cx = x_pad / ratio
            orig_cy = y_pad / ratio
            orig_bw = w / ratio
            orig_bh = h / ratio

            x1 = max(0, int(orig_cx - orig_bw / 2))
            y1 = max(0, int(orig_cy - orig_bh / 2))
            x2 = min(orig_w - 1, int(orig_cx + orig_bw / 2))
            y2 = min(orig_h - 1, int(orig_cy + orig_bh / 2))

            bw = max(1, x2 - x1)
            bh = max(1, y2 - y1)

            boxes.append([x1, y1, bw, bh])
            confidences.append(score)
            class_ids.append(cid)

        if not boxes:
            return []

        # 4. Non-Maximum Suppression
        indices = cv2.dnn.NMSBoxes(boxes, confidences, self.conf_threshold, self.iou_threshold)

        results: List[Detection] = []
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

                results.append(
                    Detection(
                        bbox=(x1, y1, x2, y2),
                        confidence=round(conf, 3),
                        class_name=refined_class,
                        class_id=cid,
                        footprint_area=specs["footprint_area_sqm"],
                        color_bgr=specs["color_bgr"]
                    )
                )

        return results
