import React, { useState, useEffect } from 'react';
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
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
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
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        border: 2px solid white;
      ">
        <span style="
          transform: rotate(45deg);
          font-weight: 700;
          font-size: 13px;
          font-family: sans-serif;
        ">${label}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const originIcon = createMarkerIcon('A', '#10b981'); // Emerald green
const destIcon = createMarkerIcon('B', '#ef4444');   // Red

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

  // Initial Route Fetch
  useEffect(() => {
    handleFindRoute();
  }, []);

  const handleFindRoute = async (e?: React.FormEvent) => {
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
  };

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
    <div className="flex flex-col gap-space-lg w-full pb-space-2xl">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low p-space-md lg:p-space-lg rounded-xl border border-outline-variant/20 shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface">
              Intelligent Route Planner
            </span>
            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-label-caps text-label-caps font-bold">
              OSM NETWORK ENGINE
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Real road-network routing with OpenStreetMap road geometry and predictive travel-time estimation
          </span>
        </div>
      </div>

      {/* Main Grid: Form Left, Map Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* LEFT COLUMN: Input Form & Results Card (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          {/* Routing Form */}
          <form
            onSubmit={handleFindRoute}
            className="bg-surface-container-low p-space-lg rounded-xl border border-outline-variant/20 shadow-sm flex flex-col gap-space-md"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-sm">
              <span className="font-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
                Route Parameters
              </span>
              <span className="text-xs text-on-surface-variant font-mono">Mode: {routingMode}</span>
            </div>

            {/* Starting Location */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Starting Location (Origin)
              </label>
              <input
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Charbagh Railway Station"
                required
                className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Destination */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                Destination
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. University of Lucknow"
                required
                className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* City Context */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant">
                City / Region
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Lucknow"
                required
                className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Departure Date & Time */}
            <div className="grid grid-cols-2 gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant">Departure Date</label>
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface-variant">Departure Time</label>
                <input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Routing Mode Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-on-surface-variant">Routing Objective</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-surface-container border border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setRoutingMode('baseline')}
                  className={`py-2 px-2.5 rounded text-xs font-semibold transition-all flex flex-col items-center justify-center text-center ${
                    routingMode === 'baseline'
                      ? 'bg-primary-container text-on-primary-container shadow-sm font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span>Baseline</span>
                  <span className="text-[10px] font-normal opacity-80">Shortest Road Distance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRoutingMode('traffic_aware')}
                  className={`py-2 px-2.5 rounded text-xs font-semibold transition-all flex flex-col items-center justify-center text-center ${
                    routingMode === 'traffic_aware'
                      ? 'bg-primary-container text-on-primary-container shadow-sm font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span>Traffic-Aware</span>
                  <span className="text-[10px] font-normal opacity-80">Predictive Delay Minimization</span>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full py-2.5 rounded-lg bg-primary text-on-primary font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition-all shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                  <span>Calculating Real Road Route...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">directions</span>
                  <span>Find Best Route</span>
                </>
              )}
            </button>
          </form>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-space-md rounded-xl bg-error/10 border border-error/30 text-error flex items-start gap-3">
              <span className="material-symbols-outlined text-[24px] mt-0.5 shrink-0">error</span>
              <div className="flex flex-col text-sm">
                <span className="font-semibold">Routing Error</span>
                <span className="text-xs opacity-90 mt-0.5">{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Route Summary KPI Card */}
          {activeRoute && (
            <div className="bg-surface-container-low p-space-md lg:p-space-lg rounded-xl border border-outline-variant/20 shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                <span className="font-headline-sm font-semibold text-on-surface">Route Metrics</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-tertiary-container/30 text-tertiary font-bold">
                  RECOMMENDED
                </span>
              </div>

              {/* KPI Badges */}
              <div className="grid grid-cols-3 gap-space-sm text-center">
                <div className="p-space-sm rounded-lg bg-surface-container border border-outline-variant/10 flex flex-col items-center">
                  <span className="text-[11px] text-on-surface-variant font-medium">Distance</span>
                  <span className="font-display-lg text-xl font-bold text-primary mt-0.5">
                    {activeRoute.distance_km} <span className="text-xs font-normal">km</span>
                  </span>
                </div>
                <div className="p-space-sm rounded-lg bg-surface-container border border-outline-variant/10 flex flex-col items-center">
                  <span className="text-[11px] text-on-surface-variant font-medium">Est. Duration</span>
                  <span className="font-display-lg text-xl font-bold text-on-surface mt-0.5">
                    {activeRoute.duration_minutes} <span className="text-xs font-normal">min</span>
                  </span>
                </div>
                <div className="p-space-sm rounded-lg bg-surface-container border border-outline-variant/10 flex flex-col items-center">
                  <span className="text-[11px] text-on-surface-variant font-medium">Expected Arrival</span>
                  <span className="font-display-lg text-xl font-bold text-tertiary mt-0.5">
                    {routeResult?.estimated_arrival_time || '--:--'}
                  </span>
                </div>
              </div>

              {/* Data Source & Provenance */}
              <div className="p-space-sm rounded-lg bg-surface-container-lowest border border-outline-variant/20 text-xs flex flex-col gap-1 font-mono">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Data Engine:</span>
                  <span className="text-on-surface font-semibold">{routeResult?.data_source}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Routing Mode:</span>
                  <span className="text-primary uppercase font-bold">{routingMode}</span>
                </div>
                {routeResult?.traffic_aware_note && (
                  <div className="mt-1 pt-1 border-t border-outline-variant/10 text-amber-500 text-[11px]">
                    ℹ️ {routeResult.traffic_aware_note}
                  </div>
                )}
              </div>

              {/* Alternative Routes Comparison */}
              {routeResult?.routes && routeResult.routes.length > 1 && (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/20">
                  <span className="text-xs font-semibold text-on-surface">Available Alternatives:</span>
                  <div className="flex flex-col gap-1">
                    {routeResult.routes.map((alt, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedRouteIdx(idx)}
                        className={`px-3 py-2 rounded-lg text-left text-xs font-mono flex items-center justify-between border transition-all ${
                          selectedRouteIdx === idx
                            ? 'bg-primary-container text-on-primary-container border-primary font-bold'
                            : 'bg-surface-container border-outline-variant/20 text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary"></span>
                          <span>{alt.summary || `Route ${idx + 1}`}</span>
                        </div>
                        <span>
                          {alt.distance_km} km • {alt.duration_minutes} min
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Collapsible Turn-by-turn Navigation Steps */}
              {activeRoute.steps && activeRoute.steps.length > 0 && (
                <div className="flex flex-col pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setShowSteps(!showSteps)}
                    className="flex items-center justify-between text-xs font-semibold text-primary hover:underline"
                  >
                    <span>Turn-by-turn Navigation ({activeRoute.steps.length} maneuvers)</span>
                    <span className="material-symbols-outlined text-[16px]">
                      {showSteps ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>

                  {showSteps && (
                    <div className="mt-2 max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1 font-body-sm text-xs">
                      {activeRoute.steps.map((st, i) => (
                        <div
                          key={i}
                          className="p-2 rounded bg-surface-container-lowest border border-outline-variant/10 flex items-start justify-between gap-2"
                        >
                          <span className="text-on-surface font-medium">{st.instruction}</span>
                          <span className="text-on-surface-variant font-mono text-[10px] shrink-0">
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

        {/* RIGHT COLUMN: Interactive Leaflet Map (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col bg-surface-container-low rounded-xl border border-outline-variant/20 overflow-hidden shadow-sm">
          <div className="p-space-md bg-surface-container flex items-center justify-between border-b border-outline-variant/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">map</span>
              <span className="font-headline-sm font-semibold text-on-surface">Interactive Road Geometry</span>
            </div>
            {activeRoute && (
              <span className="font-mono text-xs text-on-surface-variant">
                {activeRoute.geometry_coordinates.length} Road Vectors Rendered
              </span>
            )}
          </div>

          {/* Leaflet Map Container */}
          <div className="relative w-full h-[620px] bg-surface-container-lowest">
            <MapContainer
              center={originCoords || [26.8467, 80.9462]} // Default Lucknow center
              zoom={13}
              scrollWheelZoom={true}
              style={{ width: '100%', height: '100%', zIndex: 1 }}
            >
              {/* OpenStreetMap Tile Layer */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Fit Map to Route Bounds */}
              {activeRoute && <MapBoundsUpdater coordinates={activeRoute.geometry_coordinates} />}

              {/* Active Route Polyline */}
              {leafletPolyline.length > 0 && (
                <Polyline
                  positions={leafletPolyline}
                  pathOptions={{
                    color: routingMode === 'traffic_aware' ? '#06b6d4' : '#0284c7',
                    weight: 6,
                    opacity: 0.9,
                    lineJoin: 'round',
                  }}
                />
              )}

              {/* Alternative Routes in Muted Grays */}
              {routeResult?.routes &&
                routeResult.routes.map((alt, i) => {
                  if (i === selectedRouteIdx) return null;
                  const altCoords: [number, number][] = alt.geometry_coordinates.map(([lon, lat]) => [lat, lon]);
                  return (
                    <Polyline
                      key={i}
                      positions={altCoords}
                      pathOptions={{
                        color: '#94a3b8',
                        weight: 4,
                        opacity: 0.5,
                        dashArray: '5, 8',
                      }}
                    />
                  );
                })}

              {/* Origin Marker */}
              {originCoords && (
                <Marker position={originCoords} icon={originIcon}>
                  <Popup>
                    <div className="text-xs p-1">
                      <strong className="text-emerald-700 block">Origin:</strong>
                      <span>{routeResult?.origin.display_name}</span>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Destination Marker */}
              {destCoords && (
                <Marker position={destCoords} icon={destIcon}>
                  <Popup>
                    <div className="text-xs p-1">
                      <strong className="text-rose-700 block">Destination:</strong>
                      <span>{routeResult?.destination.display_name}</span>
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>

            {/* Map HUD Legend */}
            <div className="absolute bottom-4 left-4 z-[400] bg-surface-container-lowest/90 backdrop-blur-md p-space-sm rounded-lg border border-outline-variant/30 text-xs font-mono shadow-lg flex flex-col gap-1.5 pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="text-on-surface">A: Starting Location</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                <span className="text-on-surface">B: Destination</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-1 rounded bg-primary"></span>
                <span className="text-on-surface">Primary Road Geometry</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
