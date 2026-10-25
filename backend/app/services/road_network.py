"""
Road network graph management using NetworkX.

This module provides a local road network graph that can be used for
offline route analysis when the OSRM API is unavailable. It builds a 
simple graph from known road segments in the demo traffic dataset.

NOTE: This is a supplementary module. Primary routing uses the OSRM API.
"""
import logging
from typing import Dict, List, Optional, Tuple
import networkx as nx

logger = logging.getLogger(__name__)

# Module-level graph instance
_road_graph: Optional[nx.DiGraph] = None


# Demo road network nodes (intersections) for Lucknow
# These provide a fallback network when OSRM is unavailable
DEMO_INTERSECTIONS = {
    "hazratganj": {"lat": 26.8508, "lon": 80.9460, "name": "Hazratganj Crossing"},
    "charbagh": {"lat": 26.8467, "lon": 80.9462, "name": "Charbagh Station"},
    "aminabad": {"lat": 26.8523, "lon": 80.9341, "name": "Aminabad"},
    "gomti_nagar": {"lat": 26.8563, "lon": 80.9800, "name": "Gomti Nagar"},
    "alambagh": {"lat": 26.8170, "lon": 80.9190, "name": "Alambagh"},
    "indira_nagar": {"lat": 26.8748, "lon": 80.9920, "name": "Indira Nagar"},
    "aliganj": {"lat": 26.8900, "lon": 80.9420, "name": "Aliganj"},
    "husainabad": {"lat": 26.8680, "lon": 80.9140, "name": "Husainabad"},
    "rajajipuram": {"lat": 26.8530, "lon": 80.8950, "name": "Rajajipuram"},
    "mahanagar": {"lat": 26.8720, "lon": 80.9570, "name": "Mahanagar"},
}

# Demo road segments (edges) connecting the intersections
DEMO_ROAD_SEGMENTS = [
    ("charbagh", "hazratganj", {"road_name": "MG Road", "distance_km": 2.5, "speed_limit": 40}),
    ("hazratganj", "charbagh", {"road_name": "MG Road", "distance_km": 2.5, "speed_limit": 40}),
    ("hazratganj", "aminabad", {"road_name": "Aminabad Road", "distance_km": 1.8, "speed_limit": 30}),
    ("aminabad", "hazratganj", {"road_name": "Aminabad Road", "distance_km": 1.8, "speed_limit": 30}),
    ("hazratganj", "gomti_nagar", {"road_name": "Gomti Nagar Link Road", "distance_km": 4.2, "speed_limit": 50}),
    ("gomti_nagar", "hazratganj", {"road_name": "Gomti Nagar Link Road", "distance_km": 4.2, "speed_limit": 50}),
    ("gomti_nagar", "indira_nagar", {"road_name": "Faizabad Road", "distance_km": 3.0, "speed_limit": 50}),
    ("indira_nagar", "gomti_nagar", {"road_name": "Faizabad Road", "distance_km": 3.0, "speed_limit": 50}),
    ("charbagh", "alambagh", {"road_name": "Kanpur Road", "distance_km": 3.5, "speed_limit": 50}),
    ("alambagh", "charbagh", {"road_name": "Kanpur Road", "distance_km": 3.5, "speed_limit": 50}),
    ("hazratganj", "mahanagar", {"road_name": "Vidhan Sabha Marg", "distance_km": 2.8, "speed_limit": 40}),
    ("mahanagar", "hazratganj", {"road_name": "Vidhan Sabha Marg", "distance_km": 2.8, "speed_limit": 40}),
    ("mahanagar", "aliganj", {"road_name": "Kapoorthala Road", "distance_km": 2.2, "speed_limit": 40}),
    ("aliganj", "mahanagar", {"road_name": "Kapoorthala Road", "distance_km": 2.2, "speed_limit": 40}),
    ("hazratganj", "husainabad", {"road_name": "Husainabad Road", "distance_km": 2.0, "speed_limit": 30}),
    ("husainabad", "hazratganj", {"road_name": "Husainabad Road", "distance_km": 2.0, "speed_limit": 30}),
    ("husainabad", "rajajipuram", {"road_name": "Sitapur Road", "distance_km": 3.2, "speed_limit": 50}),
    ("rajajipuram", "husainabad", {"road_name": "Sitapur Road", "distance_km": 3.2, "speed_limit": 50}),
    ("alambagh", "rajajipuram", {"road_name": "Ring Road", "distance_km": 5.0, "speed_limit": 60}),
    ("rajajipuram", "alambagh", {"road_name": "Ring Road", "distance_km": 5.0, "speed_limit": 60}),
    ("indira_nagar", "aliganj", {"road_name": "Ring Road North", "distance_km": 6.5, "speed_limit": 60}),
    ("aliganj", "indira_nagar", {"road_name": "Ring Road North", "distance_km": 6.5, "speed_limit": 60}),
]


def get_road_graph() -> nx.DiGraph:
    """
    Get or create the road network graph.

    Returns:
        A NetworkX directed graph representing the road network.
    """
    global _road_graph
    if _road_graph is None:
        _road_graph = _build_demo_graph()
    return _road_graph


def _build_demo_graph() -> nx.DiGraph:
    """Build a demo road network graph from predefined data."""
    G = nx.DiGraph()

    # Add intersection nodes
    for node_id, attrs in DEMO_INTERSECTIONS.items():
        G.add_node(node_id, **attrs)

    # Add road segment edges
    for u, v, attrs in DEMO_ROAD_SEGMENTS:
        # Calculate travel time based on distance and speed limit
        travel_time_min = (attrs["distance_km"] / attrs["speed_limit"]) * 60
        G.add_edge(u, v, weight=attrs["distance_km"], travel_time=travel_time_min, **attrs)

    logger.info(f"Built demo road graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    return G


def find_shortest_path(
    graph: nx.DiGraph,
    source: str,
    target: str,
    weight: str = "weight",
) -> Optional[Tuple[List[str], float]]:
    """
    Find shortest path between two nodes in the graph.

    Args:
        graph: The road network graph.
        source: Source node ID.
        target: Target node ID.
        weight: Edge attribute to use as weight.

    Returns:
        Tuple of (path as list of node IDs, total weight), or None if no path.
    """
    try:
        path = nx.shortest_path(graph, source, target, weight=weight)
        total_weight = nx.shortest_path_length(graph, source, target, weight=weight)
        return path, total_weight
    except (nx.NetworkXNoPath, nx.NodeNotFound) as e:
        logger.warning(f"No path from {source} to {target}: {e}")
        return None


def get_all_road_segments_info() -> List[Dict]:
    """Get information about all road segments in the graph."""
    graph = get_road_graph()
    segments = []
    seen = set()

    for u, v, data in graph.edges(data=True):
        road_name = data.get("road_name", f"{u}-{v}")
        if road_name not in seen:
            seen.add(road_name)
            segments.append({
                "from": u,
                "to": v,
                "road_name": road_name,
                "distance_km": data.get("distance_km", 0),
                "speed_limit": data.get("speed_limit", 30),
            })

    return segments
