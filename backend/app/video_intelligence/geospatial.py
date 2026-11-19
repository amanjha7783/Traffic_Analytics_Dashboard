"""
Geospatial Coordinate Systems and Projected Metric Transformations.
Converts geographic WGS84 (latitude, longitude) coordinates to Universal Transverse Mercator (UTM)
projected metric coordinates (easting, northing in meters) and vice versa.
Enables physically accurate metric distance, area, and speed calculations without degree distortion.
"""
import math
from typing import Sequence, Tuple, List, Optional

# WGS84 Ellipsoid Constants
WGS84_A = 6378137.0          # Semi-major axis (meters)
WGS84_F = 1.0 / 298.257223563 # Flattening
WGS84_B = WGS84_A * (1.0 - WGS84_F) # Semi-minor axis (~6356752.3142 m)
WGS84_E2 = 2.0 * WGS84_F - WGS84_F ** 2 # First eccentricity squared (~0.00669438)
WGS84_E_PRIME2 = WGS84_E2 / (1.0 - WGS84_E2) # Second eccentricity squared
UTM_K0 = 0.9996              # Central meridian scale factor


def get_utm_zone(longitude: float) -> int:
    """Calculate the UTM longitude zone (1-60) from longitude in degrees."""
    zone = int((longitude + 180.0) / 6.0) + 1
    return max(1, min(60, zone))


def get_epsg_code(zone: int, latitude: float) -> str:
    """Return the standardized EPSG identifier for a given UTM zone and latitude hemisphere."""
    if latitude >= 0.0:
        return f"EPSG:{32600 + zone}"  # WGS 84 / UTM Northern Hemisphere
    else:
        return f"EPSG:{32700 + zone}"  # WGS 84 / UTM Southern Hemisphere


def wgs84_to_utm(
    latitude: float,
    longitude: float,
    forced_zone: Optional[int] = None
) -> Tuple[float, float, int, str]:
    """
    Convert WGS84 (latitude, longitude) in decimal degrees to UTM (Easting, Northing) in meters.
    Returns: (easting_m, northing_m, zone, epsg_code).
    Accurate to millimeter precision across the ellipsoid.
    """
    lat_rad = math.radians(latitude)
    lon_rad = math.radians(longitude)

    zone = forced_zone if forced_zone is not None else get_utm_zone(longitude)
    central_lon_deg = (zone - 1) * 6 - 180 + 3
    central_lon_rad = math.radians(central_lon_deg)

    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    tan_lat = math.tan(lat_rad)

    n = WGS84_A / math.sqrt(1.0 - WGS84_E2 * sin_lat ** 2)
    t = tan_lat ** 2
    c = WGS84_E_PRIME2 * (cos_lat ** 2)
    a_term = cos_lat * (lon_rad - central_lon_rad)

    # Meridional arc calculation
    e2 = WGS84_E2
    e4 = e2 ** 2
    e6 = e2 ** 3
    m = WGS84_A * (
        (1.0 - e2 / 4.0 - 3.0 * e4 / 64.0 - 5.0 * e6 / 256.0) * lat_rad
        - (3.0 * e2 / 8.0 + 3.0 * e4 / 32.0 + 45.0 * e6 / 1024.0) * math.sin(2.0 * lat_rad)
        + (15.0 * e4 / 256.0 + 45.0 * e6 / 1024.0) * math.sin(4.0 * lat_rad)
        - (35.0 * e6 / 3072.0) * math.sin(6.0 * lat_rad)
    )

    # Easting (meters) with 500,000m false easting
    easting = (
        UTM_K0 * n * (
            a_term
            + (1.0 - t + c) * (a_term ** 3) / 6.0
            + (5.0 - 18.0 * t + t ** 2 + 72.0 * c - 58.0 * WGS84_E_PRIME2) * (a_term ** 5) / 120.0
        )
        + 500000.0
    )

    # Northing (meters) with 10,000,000m false northing for Southern hemisphere
    northing = UTM_K0 * (
        m + n * tan_lat * (
            (a_term ** 2) / 2.0
            + (5.0 - t + 9.0 * c + 4.0 * (c ** 2)) * (a_term ** 4) / 24.0
            + (61.0 - 58.0 * t + t ** 2 + 600.0 * c - 330.0 * WGS84_E_PRIME2) * (a_term ** 6) / 720.0
        )
    )

    if latitude < 0.0:
        northing += 10000000.0

    epsg = get_epsg_code(zone, latitude)
    return easting, northing, zone, epsg


def utm_to_wgs84(
    easting: float,
    northing: float,
    zone: int,
    northern_hemisphere: bool = True
) -> Tuple[float, float]:
    """
    Convert UTM (Easting, Northing) in meters back to WGS84 (latitude, longitude) in decimal degrees.
    """
    x = easting - 500000.0
    y = northing if northern_hemisphere else northing - 10000000.0

    central_lon_deg = (zone - 1) * 6 - 180 + 3
    central_lon_rad = math.radians(central_lon_deg)

    e1 = (1.0 - math.sqrt(1.0 - WGS84_E2)) / (1.0 + math.sqrt(1.0 - WGS84_E2))
    m = y / UTM_K0
    mu = m / (WGS84_A * (1.0 - WGS84_E2 / 4.0 - 3.0 * (WGS84_E2 ** 2) / 64.0 - 5.0 * (WGS84_E2 ** 3) / 256.0))

    phi1_rad = (
        mu
        + (3.0 * e1 / 2.0 - 27.0 * (e1 ** 3) / 32.0) * math.sin(2.0 * mu)
        + (21.0 * (e1 ** 2) / 16.0 - 55.0 * (e1 ** 4) / 32.0) * math.sin(4.0 * mu)
        + (151.0 * (e1 ** 3) / 96.0) * math.sin(6.0 * mu)
        + (1097.0 * (e1 ** 4) / 512.0) * math.sin(8.0 * mu)
    )

    sin_phi1 = math.sin(phi1_rad)
    cos_phi1 = math.cos(phi1_rad)
    tan_phi1 = math.tan(phi1_rad)

    n1 = WGS84_A / math.sqrt(1.0 - WGS84_E2 * (sin_phi1 ** 2))
    t1 = tan_phi1 ** 2
    c1 = WGS84_E_PRIME2 * (cos_phi1 ** 2)
    r1 = WGS84_A * (1.0 - WGS84_E2) / ((1.0 - WGS84_E2 * (sin_phi1 ** 2)) ** 1.5)
    d = x / (n1 * UTM_K0)

    lat_rad = phi1_rad - (n1 * tan_phi1 / r1) * (
        (d ** 2) / 2.0
        - (5.0 + 3.0 * t1 + 10.0 * c1 - 4.0 * (c1 ** 2) - 9.0 * WGS84_E_PRIME2) * (d ** 4) / 24.0
        + (61.0 + 90.0 * t1 + 298.0 * c1 + 45.0 * (t1 ** 2) - 252.0 * WGS84_E_PRIME2 - 3.0 * (c1 ** 2)) * (d ** 6) / 720.0
    )

    lon_rad = central_lon_rad + (
        d
        - (1.0 + 2.0 * t1 + c1) * (d ** 3) / 6.0
        + (5.0 - 2.0 * c1 + 28.0 * t1 - 3.0 * (c1 ** 2) + 8.0 * WGS84_E_PRIME2 + 24.0 * (t1 ** 2)) * (d ** 5) / 120.0
    ) / cos_phi1

    return math.degrees(lat_rad), math.degrees(lon_rad)


def calculate_polygon_area_m2(vertices_m: Sequence[Sequence[float]]) -> float:
    """
    Calculate area in square meters (m^2) using the Shoelace formula on metric vertices [[x1,y1], [x2,y2], ...].
    """
    if len(vertices_m) < 3:
        return 0.0
    area = 0.0
    n = len(vertices_m)
    for i in range(n):
        x1, y1 = vertices_m[i][0], vertices_m[i][1]
        x2, y2 = vertices_m[(i + 1) % n][0], vertices_m[(i + 1) % n][1]
        area += (x1 * y2) - (x2 * y1)
    return abs(area) * 0.5


def calculate_polygon_perimeter_m(vertices_m: Sequence[Sequence[float]]) -> float:
    """Calculate perimeter in meters of closed polygon metric vertices."""
    if len(vertices_m) < 2:
        return 0.0
    perimeter = 0.0
    n = len(vertices_m)
    for i in range(n):
        x1, y1 = vertices_m[i][0], vertices_m[i][1]
        x2, y2 = vertices_m[(i + 1) % n][0], vertices_m[(i + 1) % n][1]
        perimeter += math.hypot(x2 - x1, y2 - y1)
    return perimeter
