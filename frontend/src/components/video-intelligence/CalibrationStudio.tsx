import React, { useState, useEffect, useRef } from 'react';
import { StudioVideo, StudioProject, GCPPoint, CalibrationData } from '../../types/videoIntelligence';
import { fetchCalibration, saveCalibration, getFirstFrameUrl } from '../../services/videoIntelligenceApi';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet marker icons
const gcpIcon = (id: string, isSelected: boolean) =>
  L.divIcon({
    className: 'custom-gcp-icon',
    html: `
      <div style="
        background: ${isSelected ? '#315B8A' : '#16845B'};
        color: white;
        font-family: monospace;
        font-weight: bold;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        white-space: nowrap;
        transform: translate(-50%, -50%);
      ">
        ${id}
      </div>
    `,
    iconSize: [30, 20],
    iconAnchor: [15, 10],
  });

interface CalibrationStudioProps {
  project: StudioProject;
  video: StudioVideo;
  onCalibrationSaved: () => void;
}

// Map click handler helper
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export const CalibrationStudio: React.FC<CalibrationStudioProps> = ({
  project,
  video,
  onCalibrationSaved,
}) => {
  const [calibration, setCalibration] = useState<CalibrationData | null>(null);
  const [gcps, setGcps] = useState<GCPPoint[]>([]);
  const [selectedGcpId, setSelectedGcpId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Zoom & Pan state for canvas
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan] = useState({ x: 0, y: 0 });
  const [pointMode, setPointMode] = useState<boolean>(true);

  // Image native dimensions
  const [naturalSize, setNaturalSize] = useState({ width: 1920, height: 1080 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Dragging a marker on image
  const [draggedGcpId, setDraggedGcpId] = useState<string | null>(null);

  // Load existing calibration
  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await fetchCalibration(video.id);
        if (!active) return;
        setCalibration(data);
        if (data.gcps && data.gcps.length > 0) {
          setGcps(data.gcps);
          setSelectedGcpId(data.gcps[0].id);
        } else {
          // Pre-populate 4 standard default GCPs around intersection
          const initGcps: GCPPoint[] = [
            { id: 'GCP-01', image_x: 250, image_y: 650, latitude: project.latitude - 0.0001, longitude: project.longitude - 0.00015 },
            { id: 'GCP-02', image_x: 520, image_y: 380, latitude: project.latitude + 0.00015, longitude: project.longitude - 0.00012 },
            { id: 'GCP-03', image_x: 880, image_y: 400, latitude: project.latitude + 0.0002, longitude: project.longitude + 0.00015 },
            { id: 'GCP-04', image_x: 1040, image_y: 670, latitude: project.latitude - 0.00008, longitude: project.longitude + 0.00018 },
          ];
          setGcps(initGcps);
          setSelectedGcpId('GCP-01');
        }
      } catch (err) {
        console.error('Failed to load calibration:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [video.id, project]);

  // Click on image to add GCP
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pointMode || isPanning || draggedGcpId) return;

    const img = imageContainerRef.current?.querySelector('img');
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.round((clickX / rect.width) * naturalSize.width);
    const normY = Math.round((clickY / rect.height) * naturalSize.height);

    if (normX < 0 || normX > naturalSize.width || normY < 0 || normY > naturalSize.height) return;

    const nextId = `GCP-0${gcps.length + 1}`;
    const newGcp: GCPPoint = {
      id: nextId,
      image_x: normX,
      image_y: normY,
      latitude: project.latitude,
      longitude: project.longitude,
    };

    setGcps((prev) => [...prev, newGcp]);
    setSelectedGcpId(nextId);
  };

  // Image marker dragging
  const handleMarkerDrag = (gcpId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedGcpId(gcpId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedGcpId) {
      const img = imageContainerRef.current?.querySelector('img');
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const normX = Math.round(((e.clientX - rect.left) / rect.width) * naturalSize.width);
      const normY = Math.round(((e.clientY - rect.top) / rect.height) * naturalSize.height);

      setGcps((prev) =>
        prev.map((g) => (g.id === draggedGcpId ? { ...g, image_x: Math.max(0, Math.min(naturalSize.width, normX)), image_y: Math.max(0, Math.min(naturalSize.height, normY)) } : g))
      );
    } else if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => {
    setDraggedGcpId(null);
    setIsPanning(false);
  };

  // Map click assignment
  const handleMapClick = (lat: number, lon: number) => {
    if (!selectedGcpId) return;
    setGcps((prev) =>
      prev.map((g) => (g.id === selectedGcpId ? { ...g, latitude: parseFloat(lat.toFixed(7)), longitude: parseFloat(lon.toFixed(7)) } : g))
    );
  };

  const handleDeleteGcp = (gcpId: string) => {
    setGcps((prev) => prev.filter((g) => g.id !== gcpId));
    if (selectedGcpId === gcpId) {
      setSelectedGcpId(null);
    }
  };

  // Commit and Save Calibration
  const handleSaveCalibration = async () => {
    if (gcps.length < 4) {
      setStatusMessage({ text: 'Planar homography requires at least 4 Ground Control Points.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await saveCalibration(video.id, gcps);
      setCalibration(res);
      setGcps(res.gcps);
      setStatusMessage({ text: res.message || 'Calibration saved successfully!', type: 'success' });
      onCalibrationSaved();
    } catch (err: any) {
      setStatusMessage({ text: err?.response?.data?.detail || 'Failed to save calibration.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Calibration Header */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-on-surface">Planar Homography Calibration Studio</h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase border ${
                calibration?.is_calibrated
                  ? 'bg-success/10 text-success border-success/30'
                  : 'bg-warning/10 text-warning border-warning/30'
              }`}>
                {calibration?.calibration_quality || (calibration?.is_calibrated ? 'CALIBRATED' : 'UNCALIBRATED')}
              </span>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">
              Target Camera: {video.camera_id} • {video.title} ({naturalSize.width}x{naturalSize.height})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="px-2.5 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-semibold cursor-pointer"
            title="Reset Pan & Zoom"
          >
            Reset View
          </button>
          <button
            onClick={handleSaveCalibration}
            disabled={isSaving || gcps.length < 4}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isSaving && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
            <span>Compute & Commit Homography</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded text-xs flex items-center justify-between border ${
          statusMessage.type === 'success'
            ? 'bg-success/10 text-success border-success/30'
            : 'bg-danger/10 text-danger border-danger/30'
        }`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">
              {statusMessage.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-0.5 rounded hover:bg-white/10">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Main Split Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT PANEL: Interactive First-Frame Canvas (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          <div className="p-2.5 rounded-t bg-surface-container-low border border-outline-variant flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-on-surface">First-Frame Ground-Control Canvas</span>
              <span className="text-[10px] font-mono text-on-surface-variant">
                Click to place GCP • Drag to adjust position
              </span>
            </div>

            {/* Canvas Controls */}
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                className="p-1 rounded bg-surface border border-outline-variant hover:bg-surface-container"
                title="Zoom Out"
              >
                <span className="material-symbols-outlined text-[14px]">zoom_out</span>
              </button>
              <span className="px-1 text-on-surface">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                className="p-1 rounded bg-surface border border-outline-variant hover:bg-surface-container"
                title="Zoom In"
              >
                <span className="material-symbols-outlined text-[14px]">zoom_in</span>
              </button>
              <button
                onClick={() => setPointMode(!pointMode)}
                className={`ml-2 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  pointMode ? 'bg-primary text-white border-primary' : 'bg-surface text-on-surface border-outline-variant'
                }`}
              >
                {pointMode ? 'Placement ON' : 'Placement OFF'}
              </button>
            </div>
          </div>

          <div
            ref={imageContainerRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative h-[480px] w-full rounded-b border-x border-b border-outline-variant bg-black overflow-hidden flex items-center justify-center select-none"
            style={{ cursor: pointMode ? 'crosshair' : isPanning ? 'grabbing' : 'default' }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center gap-2 text-white/70">
                <span className="material-symbols-outlined animate-spin text-[32px]">progress_activity</span>
                <span className="text-xs font-mono">Loading frame...</span>
              </div>
            ) : (
              <div
                onClick={handleImageClick}
                className="relative inline-block max-w-full max-h-full transition-transform duration-75 origin-center"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                }}
              >
                <img
                  src={getFirstFrameUrl(video.id)}
                  alt="First Frame"
                  onLoad={(e) => {
                    const nat = e.currentTarget;
                    setNaturalSize({ width: nat.naturalWidth || 1280, height: nat.naturalHeight || 720 });
                  }}
                  className="max-h-[460px] w-auto object-contain block pointer-events-auto"
                />

                {/* Render GCP Points Overlay */}
                {gcps.map((gcp) => {
                  const pctX = (gcp.image_x / naturalSize.width) * 100;
                  const pctY = (gcp.image_y / naturalSize.height) * 100;
                  const isSelected = gcp.id === selectedGcpId;

                  return (
                    <div
                      key={gcp.id}
                      onMouseDown={(e) => handleMarkerDrag(gcp.id, e)}
                      onClick={(e) => { e.stopPropagation(); setSelectedGcpId(gcp.id); }}
                      style={{
                        position: 'absolute',
                        left: `${pctX}%`,
                        top: `${pctY}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="group cursor-move z-10"
                    >
                      <div className={`relative flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all shadow-md ${
                        isSelected
                          ? 'bg-primary text-white border-white scale-110 ring-4 ring-primary/30'
                          : 'bg-success text-white border-white hover:scale-105'
                      }`}>
                        <span className="text-[10px] font-mono font-bold leading-none">
                          {gcp.id.replace('GCP-', '')}
                        </span>
                      </div>
                      <span className="absolute top-8 left-1/2 -translate-x-1/2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/80 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                        X:{gcp.image_x} Y:{gcp.image_y}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: GCP Table & Calibration Diagnostics (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Diagnostics Box */}
          <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col gap-2.5 shadow-subtle">
            <span className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant tracking-wider">
              Homography Quality Diagnostics
            </span>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-surface-container-low border border-outline-variant/60 flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase font-mono">RMSE Error</span>
                <span className="text-sm font-bold font-mono text-on-surface">
                  {calibration?.reprojection_rmse_m !== null && calibration?.reprojection_rmse_m !== undefined
                    ? `${calibration.reprojection_rmse_m.toFixed(2)} m`
                    : '—'}
                </span>
              </div>
              <div className="p-2 rounded bg-surface-container-low border border-outline-variant/60 flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase font-mono">Status</span>
                <span className="text-sm font-bold font-mono text-success">
                  {calibration?.calibration_quality || 'PENDING'}
                </span>
              </div>
              <div className="p-2 rounded bg-surface-container-low border border-outline-variant/60 flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase font-mono">GCP Count</span>
                <span className="text-sm font-bold font-mono text-primary">
                  {gcps.length} Points
                </span>
              </div>
            </div>
          </div>

          {/* GCP Coordinates Manager Table */}
          <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">format_list_bulleted</span>
                Ground Control Points (GCPs)
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant">Min 4 Points Required</span>
            </div>

            <div className="max-h-[220px] overflow-y-auto border border-outline-variant rounded">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-container-low border-b border-outline-variant text-[10px] uppercase text-on-surface-variant">
                  <tr>
                    <th className="p-2">ID</th>
                    <th className="p-2">Pixel (X, Y)</th>
                    <th className="p-2">Latitude</th>
                    <th className="p-2">Longitude</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {gcps.map((gcp) => {
                    const isSelected = gcp.id === selectedGcpId;
                    return (
                      <tr
                        key={gcp.id}
                        onClick={() => setSelectedGcpId(gcp.id)}
                        className={`hover:bg-surface-container-high/60 cursor-pointer ${
                          isSelected ? 'bg-primary/10 font-semibold' : ''
                        }`}
                      >
                        <td className="p-2 text-primary font-bold">{gcp.id}</td>
                        <td className="p-2">{gcp.image_x}, {gcp.image_y}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.00001"
                            value={gcp.latitude}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setGcps(gcps.map((g) => (g.id === gcp.id ? { ...g, latitude: val } : g)));
                            }}
                            className="w-20 px-1 py-0.5 bg-surface-container-low border border-outline-variant rounded text-[11px]"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.00001"
                            value={gcp.longitude}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setGcps(gcps.map((g) => (g.id === gcp.id ? { ...g, longitude: val } : g)));
                            }}
                            className="w-20 px-1 py-0.5 bg-surface-container-low border border-outline-variant rounded text-[11px]"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteGcp(gcp.id); }}
                            className="p-1 rounded text-on-surface-variant hover:text-danger hover:bg-danger/10"
                            title="Delete Point"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-1">
              <span>Selected Point: <strong className="text-on-surface">{selectedGcpId || 'None'}</strong></span>
              <span>Click on map below to assign Lat/Lon</span>
            </div>
          </div>

          {/* Synchronized Leaflet Map */}
          <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col gap-2 shadow-subtle">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">pin_drop</span>
                Synchronized Geographic Map
              </span>
              <span className="font-mono text-[10px] text-on-surface-variant">OSM Street Vector</span>
            </div>

            <div className="h-[210px] w-full rounded overflow-hidden border border-outline-variant relative">
              <MapContainer
                center={[project.latitude, project.longitude]}
                zoom={17}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onMapClick={handleMapClick} />
                {gcps.map((gcp) => (
                  <Marker
                    key={gcp.id}
                    position={[gcp.latitude, gcp.longitude]}
                    icon={gcpIcon(gcp.id, gcp.id === selectedGcpId)}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const marker = e.target;
                        const pos = marker.getLatLng();
                        setGcps((prev) =>
                          prev.map((g) => (g.id === gcp.id ? { ...g, latitude: parseFloat(pos.lat.toFixed(7)), longitude: parseFloat(pos.lng.toFixed(7)) } : g))
                        );
                      },
                      click: () => setSelectedGcpId(gcp.id),
                    }}
                  >
                    <Popup>
                      <div className="text-xs font-mono">
                        <strong className="text-primary">{gcp.id}</strong><br />
                        Lat: {gcp.latitude.toFixed(6)}<br />
                        Lon: {gcp.longitude.toFixed(6)}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
