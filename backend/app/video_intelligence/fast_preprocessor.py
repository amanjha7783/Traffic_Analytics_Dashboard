"""
High-Performance Vectorized Batch Preprocessor.
Performs memory-aligned letterboxing, BGR-to-RGB conversion, normalization,
and HWC-to-CHW batch tensor layout transformations into reusable pre-allocated buffers.
"""
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import cv2


class FastBatchPreprocessor:
    """
    Vectorized batch preprocessor for YOLO models.
    Allocates contiguous memory buffers once and updates slices in place.
    """
    def __init__(
        self,
        batch_size: int = 4,
        input_size: Tuple[int, int] = (640, 640),
        dtype: type = np.float32,
    ):
        self.batch_size = batch_size
        self.input_size = input_size  # (height, width)
        self.dtype = dtype

        # Pre-allocate pinned contiguous batch buffer: (B, 3, H, W)
        self.batch_buffer = np.zeros(
            (batch_size, 3, input_size[0], input_size[1]),
            dtype=dtype,
        )

    def preprocess_batch(
        self,
        frames: List[np.ndarray],
    ) -> Tuple[np.ndarray, List[float], List[Tuple[float, float]]]:
        """
        Preprocess a list of frames into the contiguous batch tensor.
        Returns:
            - batch_tensor: ndarray of shape (actual_b, 3, H, W)
            - ratios: list of resize scale ratios
            - pads: list of (dw, dh) padding offsets
        """
        actual_b = len(frames)
        ratios = []
        pads = []

        target_h, target_w = self.input_size

        for i in range(actual_b):
            frame = frames[i]
            orig_h, orig_w = frame.shape[:2]
            r = min(target_h / orig_h, target_w / orig_w)
            new_unpad_w = int(round(orig_w * r))
            new_unpad_h = int(round(orig_h * r))

            dw = (target_w - new_unpad_w) / 2.0
            dh = (target_h - new_unpad_h) / 2.0

            # Fast resize
            if (orig_w, orig_h) != (new_unpad_w, new_unpad_h):
                resized = cv2.resize(frame, (new_unpad_w, new_unpad_h), interpolation=cv2.INTER_LINEAR)
            else:
                resized = frame

            top = int(round(dh - 0.1))
            bottom = int(round(dh + 0.1))
            left = int(round(dw - 0.1))
            right = int(round(dw + 0.1))

            # Letterbox with border
            padded = cv2.copyMakeBorder(
                resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114)
            )

            # Ensure exact target dimension match
            if padded.shape[0] != target_h or padded.shape[1] != target_w:
                padded = cv2.resize(padded, (target_w, target_h))

            # BGR to RGB and normalize into preallocated buffer slice
            # cv2.cvtColor operates in C++ speed
            rgb = cv2.cvtColor(padded, cv2.COLOR_BGR2RGB)

            # Transpose HWC (640, 640, 3) to CHW (3, 640, 640) directly into buffer
            np.divide(rgb.transpose(2, 0, 1), 255.0, out=self.batch_buffer[i, :, :, :], casting="unsafe")

            ratios.append(r)
            pads.append((dw, dh))

        # Return view of current active batch
        return self.batch_buffer[:actual_b], ratios, pads
