"""
Vehicle Classifier and Reference Specifications.
Standard IRC (Indian Road Congress) vehicle physical dimensions,
footprint areas, and Passenger Car Unit (PCU) equivalence factors.
"""
from typing import Dict, Any, Optional

# Standard IRC Vehicle Dimensions and Footprint Areas
IRC_VEHICLE_SPECS: Dict[str, Dict[str, Any]] = {
    "TWO-WHEELER": {
        "standard_length_m": 1.90,
        "standard_width_m": 0.75,
        "standard_height_m": 1.10,
        "footprint_area_sqm": 1.43,
        "pcu_factor": 0.50,
        "display_name": "Two-Wheeler (Motorcycle / Scooter)",
        "color_rgb": (255, 140, 0),     # Dark Orange (BGR: 0, 140, 255)
        "color_bgr": (0, 140, 255),
    },
    "THREE-WHEELER": {
        "standard_length_m": 2.60,
        "standard_width_m": 1.30,
        "standard_height_m": 1.70,
        "footprint_area_sqm": 3.38,
        "pcu_factor": 0.75,
        "display_name": "Three-Wheeler (Auto-Rickshaw)",
        "color_rgb": (255, 215, 0),     # Gold
        "color_bgr": (0, 215, 255),
    },
    "FOUR-WHEELER": {
        "standard_length_m": 4.00,
        "standard_width_m": 1.70,
        "standard_height_m": 1.50,
        "footprint_area_sqm": 6.80,
        "pcu_factor": 1.00,
        "display_name": "Four-Wheeler (Car / Jeep / Van)",
        "color_rgb": (30, 144, 255),    # Dodger Blue
        "color_bgr": (255, 144, 30),
    },
    "BUS": {
        "standard_length_m": 10.30,
        "standard_width_m": 2.50,
        "standard_height_m": 3.20,
        "footprint_area_sqm": 25.75,
        "pcu_factor": 3.00,
        "display_name": "Bus",
        "color_rgb": (50, 205, 50),     # Lime Green
        "color_bgr": (50, 205, 50),
    },
    "TRUCK": {
        "standard_length_m": 9.00,
        "standard_width_m": 2.50,
        "standard_height_m": 3.00,
        "footprint_area_sqm": 22.50,
        "pcu_factor": 3.00,
        "display_name": "Truck / Heavy Commercial Vehicle",
        "color_rgb": (220, 20, 60),     # Crimson
        "color_bgr": (60, 20, 220),
    },
    "BICYCLE": {
        "standard_length_m": 1.80,
        "standard_width_m": 0.60,
        "standard_height_m": 1.00,
        "footprint_area_sqm": 1.08,
        "pcu_factor": 0.40,
        "display_name": "Bicycle",
        "color_rgb": (0, 206, 209),     # Dark Turquoise
        "color_bgr": (209, 206, 0),
    },
    "OTHER": {
        "standard_length_m": 3.50,
        "standard_width_m": 1.60,
        "standard_height_m": 1.50,
        "footprint_area_sqm": 5.60,
        "pcu_factor": 1.00,
        "display_name": "Other Vehicle",
        "color_rgb": (147, 112, 219),   # Medium Purple
        "color_bgr": (219, 112, 147),
    },
    "PEDESTRIAN": {
        "standard_length_m": 0.50,
        "standard_width_m": 0.50,
        "standard_height_m": 1.70,
        "footprint_area_sqm": 0.25,
        "pcu_factor": 0.00,             # Tracked separately, not counted towards PCU volume
        "display_name": "Pedestrian",
        "color_rgb": (255, 105, 180),   # Hot Pink
        "color_bgr": (180, 105, 255),
    }
}

# COCO has no auto-rickshaw/three-wheeler category. Do not infer one from box shape.
COCO_CLASS_MAPPING: Dict[int, str] = {
    0: "PEDESTRIAN",
    1: "BICYCLE",
    2: "FOUR-WHEELER",
    3: "TWO-WHEELER",
    5: "BUS",
    7: "TRUCK",
}


def get_vehicle_spec(category: str) -> Dict[str, Any]:
    """Retrieve standard dimensions and properties for a vehicle category."""
    norm = category.upper().strip()
    if norm in IRC_VEHICLE_SPECS:
        return IRC_VEHICLE_SPECS[norm]
    # Fallback to OTHER
    return IRC_VEHICLE_SPECS["OTHER"]


def refine_classification(raw_class: str, bbox: tuple, aspect_ratio: float, area_px: float) -> str:
    """Normalize a detector category without guessing a class from image geometry."""
    cat = raw_class.upper().strip()
    aliases = {
        "CAR": "FOUR-WHEELER",
        "MOTORCYCLE": "TWO-WHEELER",
        "MOTORBIKE": "TWO-WHEELER",
        "PERSON": "PEDESTRIAN",
        "UNKNOWN": "OTHER",
        "OTHER / UNKNOWN VEHICLE": "OTHER",
    }
    normalized = aliases.get(cat, cat)
    if normalized in IRC_VEHICLE_SPECS:
        return normalized
    return "OTHER"
