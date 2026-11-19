import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { estimateRoute } from '../services/routeApi';
import type { RouteEstimateResponse, RouteAlternative } from '../types';

// Custom Map Bounds Updater
function MapBoundsUpdater({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates && coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates.map(([lon, lat]) => [lat, lon]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [coordinates, map]);
  return null;
}

// Custom DivIcons for clean SVG markers (avoids Leaflet PNG 404s)
const createMarkerIcon = (label: string, color: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="
        background: ${color};
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      ">
        <span style="
          font-weight: 700;
          font-size: 13px;
          font-family: monospace;
        ">${label}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const originIcon = createMarkerIcon('A', '#16845B');
const destIcon = createMarkerIcon('B', '#C44848');

export const RoutePlanner: React.FC = () => {
  // Form State
  const [origin, setOrigin] = useState('Charbagh Railway Station');
  const [destination, setDestination] = useState('University of Lucknow');
  const [city, setCity] = useState('Lucknow');
  const [departureDate, setDepartureDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [departureTime, setDepartureTime] = useState('18:30');
  const [routingMode, setRoutingMode] = useState<'baseline' | 'traffic_aware'>('baseline');

  // UI & Data State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<RouteEstimateResponse | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [showSteps, setShowSteps] = useState(false);

  const handleFindRoute = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!origin.trim() || !destination.trim() || !city.trim()) {
      setErrorMsg('Please specify Origin, Destination, and City.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await estimateRoute({
        origin: origin.trim(),
        destination: destination.trim(),
        city: city.trim(),
        departure_date: departureDate,
        departure_time: departureTime,
        mode: routingMode,
      });

      setRouteResult(data);
      setSelectedRouteIdx(data.best_route_index || 0);
    } catch (err: any) {
      console.error('Routing API error:', err);
      const detail = err.response?.data?.detail || 'Failed to calculate route. Please verify that the backend is running.';
      setErrorMsg(detail);
      setRouteResult(null);
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, city, departureDate, departureTime, routingMode]);

  useEffect(() => {
    void handleFindRoute();
  }, [handleFindRoute]);

  const activeRoute: RouteAlternative | null =
    routeResult?.routes && routeResult.routes[selectedRouteIdx]
      ? routeResult.routes[selectedRouteIdx]
      : null;

  // Convert GeoJSON [lon, lat] coordinates to Leaflet [lat, lon]
  const leafletPolyline: [number, number][] =
    activeRoute?.geometry_coordinates?.map(([lon, lat]) => [lat, lon]) || [];

  const originCoords: [number, number] | null = routeResult?.origin
    ? [routeResult.origin.latitude, routeResult.origin.longitude]
    : null;

  const destCoords: [number, number] | null = routeResult?.destination
    ? [routeResult.destination.latitude, routeResult.destination.longitude]
    : null;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Top Banner Toolbar */}
      <div className="p-3.5 rounded border border-outline-variant bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[18px]">alt_route</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-on-surface">
                GIS Road Network Route Planner
              </h1>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-surface-container-high text-on-surface-variant border border-outline-variant">
                OSM TOPOLOGY
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Multi-criteria pathfinding with OpenStreetMap network topology & turn-by-turn navigation
            </p>
          </div>
        </div>

        {routeResult?.data_source && (
          <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
            <span>Routing Engine:</span>
            <span className="text-on-surface font-semibold">{routeResult.data_source}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Form Left (5 cols), Map Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Input Form & Results */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Routing Form */}
          <form
            onSubmit={handleFindRoute}
            className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">tune</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                  Route Parameters
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-outline-variant bg-surface-container-low text-on-surface-variant">
                {routingMode === 'baseline' ? 'Shortest Distance' : 'Traffic-Aware'}
              </span>
            </div>

            {/* Starting Location */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono uppercase font-medium text-on-surface-variant flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-success"></span>
                Origin Endpoint (A)
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Charbagh Railway Station"
                required
                className="w-full px-3 py-2 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono uppercase font-medium text-on-surface-variant flex items-center gap-1.5">
                <span className="w-2 h-2 rounded bg-danger"></span>
                Destination Endpoint (B)
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. University of Lucknow"
                required
                className="w-full px-3 py-2 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* City Context */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono uppercase font-medium text-on-surface-variant">
                City / Metropolitan Corridor
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Lucknow"
                required
                className="w-full px-3 py-2 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Departure Date & Time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono uppercase font-medium text-on-surface-variant">
                  Departure Date
                </label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono uppercase font-medium text-on-surface-variant">
                  Departure Time
                </label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-surface-container-low border border-outline-variant text-on-surface text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Routing Objective Mode */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-mono uppercase font-medium text-on-surface-variant">
                Objective Weighting
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRoutingMode('baseline')}
                  className={`py-2 px-3 rounded text-xs font-medium border transition-colors cursor-pointer text-left ${
                    routingMode === 'baseline'
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <div>Shortest Path</div>
                  <div className="text-[10px] text-on-surface-variant/80 font-mono">Road Topology</div>
                </button>
                <button
                  type="button"
                  disabled
                  title="Requires calibrated traffic forecast segment matching."
                  className="py-2 px-3 rounded text-xs font-medium border border-outline-variant/50 bg-surface-container-low/50 text-on-surface-variant/40 cursor-not-allowed text-left"
                >
                  <div>Dynamic Traffic</div>
                  <div className="text-[10px] font-mono">Segment Sync</div>
                </button>
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 w-full py-2.5 px-4 rounded bg-primary text-white font-medium text-xs flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span>Calculating Optimal Route...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">alt_route</span>
                  <span>Compute Optimal Route</span>
                </>
              )}
            </button>
          </form>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 rounded border border-danger/40 bg-surface text-danger text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <div className="flex flex-col">
                <span className="font-semibold">Routing Calculation Error</span>
                <span className="text-on-surface-variant mt-0.5">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Route Summary KPI Card */}
          {activeRoute && (
            <div className="p-4 rounded border border-outline-variant bg-surface flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-outline-variant pb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-on-surface">
                  Route Assessment
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-success/15 text-success border border-success/30">
                  OPTIMAL PATH
                </span>
              </div>

              {/* KPI Badges */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
                  <span className="text-[10px] text-on-surface-variant font-mono uppercase">Distance</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-semibold font-mono text-primary">
                      {activeRoute.distance_km}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">km</span>
                  </div>
                </div>

                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
                  <span className="text-[10px] text-on-surface-variant font-mono uppercase">Duration</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-base font-semibold font-mono text-on-surface">
                      {activeRoute.duration_minutes}
                    </span>
                    <span className="text-[10px] text-on-surface-variant">min</span>
                  </div>
                </div>

                <div className="p-2.5 rounded border border-outline-variant bg-surface-container-low flex flex-col">
                  <span className="text-[10px] text-on-surface-variant font-mono uppercase">ETA</span>
                  <span className="text-base font-semibold font-mono text-success mt-1">
                    {routeResult?.estimated_arrival_time || '--:--'}
                  </span>
                </div>
              </div>

              {/* Alternative Routes Comparison */}
              {routeResult?.routes && routeResult.routes.length > 1 && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-outline-variant">
                  <span className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant">
                    Alternative Paths:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {routeResult.routes.map((alt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedRouteIdx(idx)}
                        className={`px-3 py-2 rounded text-left text-xs font-mono flex items-center justify-between border transition-colors cursor-pointer ${
                          selectedRouteIdx === idx
                            ? 'bg-primary/10 border-primary text-primary font-semibold'
                            : 'bg-surface-container-low border-outline-variant text-on-surface hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${selectedRouteIdx === idx ? 'bg-primary' : 'bg-outline'}`}></span>
                          <span className="truncate">{alt.summary || `Route Option ${idx + 1}`}</span>
                        </div>
                        <span className="text-on-surface-variant font-medium shrink-0 ml-2">
                          {alt.distance_km} km &bull; {alt.duration_minutes}m
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsible Turn-by-turn Navigation Steps */}
              {activeRoute.steps && activeRoute.steps.length > 0 && (
                <div className="flex flex-col pt-2 border-t border-outline-variant">
                  <button
                    type="button"
                    onClick={() => setShowSteps(!showSteps)}
                    className="flex items-center justify-between py-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">turn_right</span>
                      Turn-by-turn Navigation ({activeRoute.steps.length} maneuvers)
                    </span>
                    <span className="material-symbols-outlined text-[18px]">
                      {showSteps ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {showSteps && (
                    <div className="mt-2 max-h-56 overflow-y-auto flex flex-col gap-1 pr-1 text-xs">
                      {activeRoute.steps.map((st, i) => (
                        <div
                          key={i}
                          className="p-2 rounded border border-outline-variant bg-surface-container-low flex items-start justify-between gap-2"
                        >
                          <span className="text-on-surface font-medium leading-snug">{st.instruction}</span>
                          <span className="text-on-surface-variant font-mono text-[11px] shrink-0">
                            {st.distance_m > 1000
                              ? `${(st.distance_m / 1000).toFixed(1)} km`
                              : `${Math.round(st.distance_m)} m`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Leaflet Map (Dominant Element) */}
        <div className="lg:col-span-7 flex flex-col rounded border border-outline-variant bg-surface overflow-hidden">
          <div className="px-3.5 py-2.5 bg-surface-container-low border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">map</span>
              <span className="text-xs font-semibold text-on-surface">
                Geographic Information System Viewport
              </span>
            </div>
            {activeRoute && (
              <span className="font-mono text-[11px] text-on-surface-variant">
                {activeRoute.geometry_coordinates.length} Vector Coordinates
              </span>
            )}
          </div>

          {/* Leaflet Map Viewport */}
          <div className="relative w-full h-[640px] bg-surface-container-low">
            <MapContainer
              center={originCoords || [26.8467, 80.9462]} // Default Lucknow center
              zoom={13}
              scrollWheelZoom={true}
              style={{ width: '100%', height: '100%', zIndex: 1 }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {activeRoute && <MapBoundsUpdater coordinates={activeRoute.geometry_coordinates} />}

              {/* Active Route Polyline */}
              {leafletPolyline.length > 0 && (
                <Polyline
                  positions={leafletPolyline}
                  pathOptions={{
                    color: '#315B8A',
                    weight: 6,
                    opacity: 0.95,
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Alternative Routes */}
              {routeResult?.routes &&
                routeResult.routes.map((alt, i) => {
                  if (i === selectedRouteIdx) return null;
                  const altCoords: [number, number][] = alt.geometry_coordinates.map(([lon, lat]) => [lat, lon]);
                  return (
                    <Polyline
                      key={i}
                      positions={altCoords}
                      pathOptions={{
                        color: '#64748B',
                        weight: 4,
                        opacity: 0.6,
                        dashArray: '6, 8',
                      }}
                    />
                  );
                })}

              {/* Origin Marker */}
              {originCoords && (
                <Marker position={originCoords} icon={originIcon}>
                  <Popup>
                    <div className="text-xs p-1">
                      <strong className="text-success block font-bold">Origin (A):</strong>
                      <span className="text-slate-700">{routeResult?.origin.display_name}</span>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Destination Marker */}
              {destCoords && (
                <Marker position={destCoords} icon={destIcon}>
                  <Popup>
                    <div className="text-xs p-1">
                      <strong className="text-danger block font-bold">Destination (B):</strong>
                      <span className="text-slate-700">{routeResult?.destination.display_name}</span>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            {/* Map HUD Legend */}
            <div className="absolute bottom-4 left-4 z-[400] bg-surface/95 p-3 rounded border border-outline-variant text-[11px] font-mono shadow-sm flex flex-col gap-2 pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-success"></span>
                <span className="text-on-surface">Origin Endpoint (A)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded bg-danger"></span>
                <span className="text-on-surface">Destination Endpoint (B)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-1 bg-primary rounded"></span>
                <span className="text-on-surface">Calculated Trajectory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
