import React, { useState, useEffect, useRef } from 'react';
import { StudioVideo, MeasurementRegion } from '../../types/videoIntelligence';
import { fetchRegions, createRegion, deleteRegion, getFirstFrameUrl } from '../../services/videoIntelligenceApi';

interface RegionMeasurementProps {
  video: StudioVideo;
}

export const RegionMeasurement: React.FC<RegionMeasurementProps> = ({ video }) => {
  const [regions, setRegions] = useState<MeasurementRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeVertices, setActiveVertices] = useState<[number, number][]>([]);

  // Form State
  const [regionName, setRegionName] = useState('');
  const [regionType, setRegionType] = useState('ROAD_SURFACE');
  const [colorHex, setColorHex] = useState('#315B8A');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [naturalSize, setNaturalSize] = useState({ width: 1280, height: 720 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const loadRegions = async () => {
    try {
      const res = await fetchRegions(video.id);
      setRegions(res.regions || []);
    } catch (err) {
      console.error('Failed to load regions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRegions();
  }, [video.id]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return;

    const img = canvasContainerRef.current?.querySelector('img');
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.round((clickX / rect.width) * naturalSize.width);
    const normY = Math.round((clickY / rect.height) * naturalSize.height);

    if (normX < 0 || normX > naturalSize.width || normY < 0 || normY > naturalSize.height) return;

    setActiveVertices((prev) => [...prev, [normX, normY]]);
  };

  const handleSaveRegion = async () => {
    if (activeVertices.length < 3) {
      setStatusMsg({ text: 'A polygon requires at least 3 vertices.', type: 'error' });
      return;
    }
    if (!regionName.trim()) {
      setStatusMsg({ text: 'Please enter a region name.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);
    try {
      const res = await createRegion(video.id, {
        name: regionName.trim(),
        region_type: regionType,
        vertices_pixel: activeVertices,
        color_hex: colorHex,
      });

      setStatusMsg({
        text: `Region '${res.name}' saved! Real-world area: ${res.area_sqm ? `${res.area_sqm} m²` : 'Calculated on commit'}.`,
        type: 'success',
      });
      setRegionName('');
      setActiveVertices([]);
      setIsDrawing(false);
      loadRegions();
    } catch (err: any) {
      setStatusMsg({ text: err?.response?.data?.detail || 'Failed to save region polygon.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRegion = async (regionId: string) => {
    if (confirm('Delete this monitored road region?')) {
      try {
        await deleteRegion(regionId);
        loadRegions();
      } catch (_err) {
        alert('Failed to delete region.');
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Info Banner */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">polyline</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-on-surface">Monitored Road Regions & Physical Metric Area Editor</h2>
            <span className="text-xs text-on-surface-variant font-mono">
              Camera: {video.camera_id} • {video.title} • {regions.length} Active Regions
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDrawing ? (
            <>
              <button
                onClick={() => { setActiveVertices([]); setIsDrawing(false); }}
                className="px-3 py-1.5 rounded border border-outline-variant text-on-surface hover:bg-surface-container text-xs cursor-pointer"
              >
                Cancel Drawing
              </button>
              <button
                onClick={handleSaveRegion}
                disabled={activeVertices.length < 3 || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                <span>Save Polygon ({activeVertices.length} pts)</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => { setIsDrawing(true); setActiveVertices([]); }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">draw</span>
              <span>Draw New Region</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className={`p-3 rounded text-xs flex items-center justify-between border ${
          statusMsg.type === 'success'
            ? 'bg-success/10 text-success border-success/30'
            : 'bg-danger/10 text-danger border-danger/30'
        }`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">
              {statusMsg.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="p-0.5 rounded hover:bg-white/10">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: First-Frame Interactive Polygon Canvas (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          <div className="p-2.5 rounded-t bg-surface-container-low border border-outline-variant flex items-center justify-between text-xs">
            <span className="font-semibold text-on-surface">Interactive Region Drawing Canvas</span>
            <span className="text-[11px] font-mono text-on-surface-variant">
              {isDrawing ? `Drawing Mode: Click image to add vertices (${activeVertices.length} added)` : 'Previewing Monitored Polygons'}
            </span>
          </div>

          <div
            ref={canvasContainerRef}
            onClick={handleCanvasClick}
            className="relative h-[480px] w-full rounded-b border-x border-b border-outline-variant bg-black overflow-hidden flex items-center justify-center select-none"
            style={{ cursor: isDrawing ? 'crosshair' : 'default' }}
          >
            <div className="relative inline-block max-w-full max-h-full">
              <img
                src={getFirstFrameUrl(video.id)}
                alt="Region Frame"
                onLoad={(e) => {
                  const nat = e.currentTarget;
                  setNaturalSize({ width: nat.naturalWidth || 1280, height: nat.naturalHeight || 720 });
                }}
                className="max-h-[460px] w-auto object-contain block"
              />

              {/* SVG Overlay for drawing and rendering polygons */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                preserveAspectRatio="none"
              >
                {/* Existing Saved Polygons */}
                {regions.map((reg) => {
                  if (!reg.vertices_pixel || reg.vertices_pixel.length < 3) return null;
                  const pointsStr = reg.vertices_pixel.map((p) => `${p[0]},${p[1]}`).join(' ');
                  return (
                    <g key={reg.id}>
                      <polygon
                        points={pointsStr}
                        fill={reg.color_hex || '#315B8A'}
                        fillOpacity={0.25}
                        stroke={reg.color_hex || '#315B8A'}
                        strokeWidth={3}
                      />
                      {/* Region Label */}
                      <text
                        x={reg.vertices_pixel[0][0]}
                        y={reg.vertices_pixel[0][1] - 8}
                        fill="#FFFFFF"
                        fontSize={14}
                        fontFamily="monospace"
                        fontWeight="bold"
                        filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))"
                      >
                        {reg.name} ({reg.area_sqm ? `${reg.area_sqm} m²` : ''})
                      </text>
                    </g>
                  );
                })}

                {/* Active Drawing Polygon */}
                {activeVertices.length > 0 && (
                  <g>
                    {activeVertices.length >= 3 && (
                      <polygon
                        points={activeVertices.map((p) => `${p[0]},${p[1]}`).join(' ')}
                        fill="#16845B"
                        fillOpacity={0.3}
                        stroke="#16845B"
                        strokeWidth={3}
                        strokeDasharray="4 4"
                      />
                    )}
                    {activeVertices.map((pt, idx) => (
                      <g key={idx}>
                        <circle cx={pt[0]} cy={pt[1]} r={6} fill="#FFFFFF" stroke="#16845B" strokeWidth={2} />
                        <text x={pt[0] + 8} y={pt[1] - 8} fill="#FFFFFF" fontSize={11} fontFamily="monospace">
                          V{idx + 1}
                        </text>
                      </g>
                    ))}
                  </g>
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* Right: Region Attributes Form & Saved Regions List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Create Region Panel */}
          {isDrawing && (
            <div className="p-4 rounded bg-surface border border-primary/40 flex flex-col gap-3 shadow-subtle animate-in fade-in duration-150">
              <span className="text-xs font-semibold text-primary uppercase font-mono tracking-wider">
                Configure New Monitored Region
              </span>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-on-surface">Region Name *</label>
                <input
                  type="text"
                  placeholder="e.g. North Approach Inbound Lane 1"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface">Region Classification</label>
                  <select
                    value={regionType}
                    onChange={(e) => setRegionType(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="ROAD_SURFACE">ROAD_SURFACE</option>
                    <option value="LANE">LANE</option>
                    <option value="INTERSECTION">INTERSECTION</option>
                    <option value="MONITORING_ZONE">MONITORING_ZONE</option>
                    <option value="VIRTUAL_GATE">VIRTUAL_GATE</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-on-surface">Display Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="w-8 h-8 rounded border border-outline-variant cursor-pointer p-0.5 bg-transparent"
                    />
                    <span className="font-mono text-xs text-on-surface">{colorHex}</span>
                  </div>
                </div>
              </div>

              <div className="p-2 rounded bg-surface-container-low border border-outline-variant/60 flex items-center justify-between text-xs font-mono">
                <span>Vertices Count:</span>
                <span className="font-bold text-primary">{activeVertices.length} Points</span>
              </div>
            </div>
          )}

          {/* Saved Regions Table */}
          <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[18px]">view_in_ar</span>
                Saved Measurement Polygons
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
                {regions.length} Regions
              </span>
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-xs text-on-surface-variant">Loading regions...</div>
            ) : regions.length === 0 ? (
              <div className="p-8 rounded border border-dashed border-outline-variant bg-surface-container-low text-center flex flex-col items-center">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">polyline</span>
                <span className="text-xs font-semibold text-on-surface mt-1">No regions configured yet</span>
                <p className="text-[11px] text-on-surface-variant mt-0.5 max-w-xs">
                  Click 'Draw New Region' above to delineate road areas and compute real-world $m^2$ metrics.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
                {regions.map((reg) => (
                  <div
                    key={reg.id}
                    className="p-3 rounded bg-surface-container-low border border-outline-variant flex flex-col gap-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-white/40 shrink-0"
                          style={{ backgroundColor: reg.color_hex || '#315B8A' }}
                        />
                        <span className="font-semibold text-on-surface">{reg.name}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteRegion(reg.id)}
                        className="p-1 rounded text-on-surface-variant hover:text-danger hover:bg-danger/10 transition-colors"
                        title="Delete Region"
                      >
                        <span className="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-outline-variant/60 font-mono text-[11px] text-on-surface-variant">
                      <div>
                        <span className="text-[9px] uppercase block">Area</span>
                        <span className="font-bold text-success">
                          {reg.area_sqm !== null && reg.area_sqm !== undefined ? `${reg.area_sqm} m²` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase block">Perimeter</span>
                        <span className="font-semibold text-on-surface">
                          {reg.perimeter_m !== null && reg.perimeter_m !== undefined ? `${reg.perimeter_m} m` : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase block">Road Width</span>
                        <span className="font-semibold text-on-surface">
                          {reg.road_width_m !== null && reg.road_width_m !== undefined ? `${reg.road_width_m} m` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
