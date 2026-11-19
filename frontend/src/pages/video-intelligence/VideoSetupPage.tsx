import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudioVideo, GCPPoint, CalibrationData, MeasurementRegion } from '../../types/videoIntelligence';
import {
  fetchVideoDetails,
  updateVideoName,
  fetchCalibration,
  saveCalibration,
  fetchRegions,
  createRegion,
  previewRegion,
  startProcessingJob,
  getFirstFrameUrl,
} from '../../services/videoIntelligenceApi';

export const VideoSetupPage: React.FC = () => {
  const { projectId, videoId } = useParams<{ projectId: string; videoId: string }>();
  const navigate = useNavigate();

  const [video, setVideo] = useState<StudioVideo | null>(null);
  const [videoName, setVideoName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Setup Mode: 'GCP' (Ground Control Points) or 'ROAD_AREA' (Polygon Tool)
  const [activeMode, setActiveMode] = useState<'GCP' | 'ROAD_AREA'>('GCP');

  // Ground-Control Points State: Starts EMPTY by default (no default points placed)
  const [points, setPoints] = useState<GCPPoint[]>([]);
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState<number | null>(null);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationData | null>(null);

  // Road Measurement Area (Polygon) State
  const [polygonVertices, setPolygonVertices] = useState<[number, number][]>([]);
  const [isPolygonClosed, setIsPolygonClosed] = useState(false);
  const [activeVertexIndex, setActiveVertexIndex] = useState<number | null>(null);
  const [draggedVertexIndex, setDraggedVertexIndex] = useState<number | null>(null);
  const [regionMetrics, setRegionMetrics] = useState<{
    area_m2: number | null;
    perimeter_m: number | null;
    road_width_m: number | null;
    is_valid: boolean;
    error?: string;
  } | null>(null);
  const [isSavingRegion, setIsSavingRegion] = useState(false);
  const [savedRegionId, setSavedRegionId] = useState<string | null>(null);

  // Pan & Zoom controls
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 1280, height: 720 });

  // Debounced polygon metric calculator
  const triggerPolygonMetrics = useCallback(
    async (verts: [number, number][]) => {
      if (!videoId || verts.length < 3) {
        setRegionMetrics(null);
        return;
      }
      try {
        const metrics = await previewRegion(videoId, verts);
        setRegionMetrics(metrics);
      } catch (err: any) {
        // Fallback calculation or preview failure
        setRegionMetrics(null);
      }
    },
    [videoId]
  );

  useEffect(() => {
    if (!videoId) return;
    Promise.all([
      fetchVideoDetails(videoId),
      fetchCalibration(videoId),
      fetchRegions(videoId),
    ])
      .then(([vData, cData, rData]) => {
        setVideo(vData);
        setVideoName(vData.title || vData.original_filename);
        if (vData.width && vData.height) {
          setNaturalSize({ width: vData.width, height: vData.height });
        }

        // 1. Restore Calibration Points
        if (cData && cData.gcps && cData.gcps.length > 0) {
          setPoints(
            cData.gcps.map((g, idx) => ({
              ...g,
              id: `Point ${idx + 1}`,
            }))
          );
          setCalibrationResult(cData);
          setActivePointIndex(0);
        } else {
          setPoints([]);
          setActivePointIndex(null);
        }

        // 2. Restore Road Measurement Area Polygon if already created
        if (rData && rData.regions && rData.regions.length > 0) {
          const roadReg = rData.regions.find(
            (r) => r.region_type === 'ROAD_SURFACE' || r.region_type === 'MONITORED_ROAD'
          ) || rData.regions[0];

          if (roadReg && roadReg.vertices_pixel && roadReg.vertices_pixel.length >= 3) {
            setPolygonVertices(roadReg.vertices_pixel);
            setIsPolygonClosed(true);
            setSavedRegionId(roadReg.id);
            setRegionMetrics({
              area_m2: roadReg.area_sqm,
              perimeter_m: roadReg.perimeter_m,
              road_width_m: roadReg.road_width_m,
              is_valid: true,
            });
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load video setup:', err);
        setErrorMsg('Failed to load video setup metadata.');
      })
      .finally(() => setIsLoading(false));
  }, [videoId]);

  // Click on canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggedPointIndex !== null || draggedVertexIndex !== null || isPanning) return;

    const img = containerRef.current?.querySelector('img');
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const imgX = Math.round((clickX / rect.width) * naturalSize.width);
    const imgY = Math.round((clickY / rect.height) * naturalSize.height);

    if (imgX < 0 || imgX > naturalSize.width || imgY < 0 || imgY > naturalSize.height) return;

    if (activeMode === 'GCP') {
      // Add a new GCP point with non-collinear 2D ground coordinates
      const newIdx = points.length;
      const baseLat = points.length > 0 && points[0].latitude ? points[0].latitude : 22.3072;
      const baseLon = points.length > 0 && points[0].longitude ? points[0].longitude : 73.1812;

      // 4 corners of a 2D quadrangle in ground space (never collinear)
      const offsets = [
        { dLat: 0, dLon: 0 },
        { dLat: 0.0004, dLon: 0 },
        { dLat: 0.0004, dLon: 0.0005 },
        { dLat: 0, dLon: 0.0005 },
      ];
      const off = offsets[newIdx % offsets.length];

      const newPt: GCPPoint = {
        id: `Point ${newIdx + 1}`,
        image_x: imgX,
        image_y: imgY,
        latitude: Number((baseLat + off.dLat).toFixed(6)),
        longitude: Number((baseLon + off.dLon).toFixed(6)),
      };

      setPoints((prev) => [...prev, newPt]);
      setActivePointIndex(newIdx);
      setErrorMsg(null);
    } else {
      // ROAD_AREA Mode
      if (isPolygonClosed) {
        // If already closed, don't add more vertices on canvas click unless reset
        return;
      }

      // Check if user clicked near the first vertex to close polygon
      if (polygonVertices.length >= 3) {
        const first = polygonVertices[0];
        const dist = Math.hypot(imgX - first[0], imgY - first[1]);
        if (dist < Math.max(25, naturalSize.width * 0.03)) {
          // Close polygon!
          setIsPolygonClosed(true);
          triggerPolygonMetrics(polygonVertices);
          return;
        }
      }

      const updated = [...polygonVertices, [imgX, imgY] as [number, number]];
      setPolygonVertices(updated);
      setActiveVertexIndex(updated.length - 1);
      setErrorMsg(null);
      if (updated.length >= 3) {
        triggerPolygonMetrics(updated);
      }
    }
  };

  // Dragging handlers
  const handleMarkerMouseDown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedPointIndex(idx);
    setActivePointIndex(idx);
  };

  const handleVertexMouseDown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedVertexIndex(idx);
    setActiveVertexIndex(idx);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const img = containerRef.current?.querySelector('img');
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const normX = Math.round(((e.clientX - rect.left) / rect.width) * naturalSize.width);
    const normY = Math.round(((e.clientY - rect.top) / rect.height) * naturalSize.height);
    const boundedX = Math.max(0, Math.min(naturalSize.width, normX));
    const boundedY = Math.max(0, Math.min(naturalSize.height, normY));

    if (draggedPointIndex !== null) {
      setPoints((prev) =>
        prev.map((pt, idx) =>
          idx === draggedPointIndex
            ? {
                ...pt,
                image_x: boundedX,
                image_y: boundedY,
              }
            : pt
        )
      );
    } else if (draggedVertexIndex !== null) {
      const updated = polygonVertices.map((v, idx) =>
        idx === draggedVertexIndex ? ([boundedX, boundedY] as [number, number]) : v
      );
      setPolygonVertices(updated);
    } else if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    if (draggedVertexIndex !== null && polygonVertices.length >= 3) {
      triggerPolygonMetrics(polygonVertices);
    }
    setDraggedPointIndex(null);
    setDraggedVertexIndex(null);
    setIsPanning(false);
  };

  // Delete GCP point
  const handleDeletePoint = (indexToDelete: number) => {
    setPoints((prev) => {
      const filtered = prev.filter((_, idx) => idx !== indexToDelete);
      return filtered.map((pt, idx) => ({
        ...pt,
        id: `Point ${idx + 1}`,
      }));
    });
    if (activePointIndex === indexToDelete) {
      setActivePointIndex(null);
    } else if (activePointIndex !== null && activePointIndex > indexToDelete) {
      setActivePointIndex(activePointIndex - 1);
    }
    setCalibrationResult(null);
  };

  const handleClearAllPoints = () => {
    setPoints([]);
    setActivePointIndex(null);
    setCalibrationResult(null);
    setErrorMsg(null);
  };

  // Polygon actions
  const handleClosePolygon = () => {
    if (polygonVertices.length < 3) {
      setErrorMsg('A closed road polygon requires at least 3 vertices.');
      return;
    }
    setIsPolygonClosed(true);
    triggerPolygonMetrics(polygonVertices);
    setErrorMsg(null);
  };

  const handleUndoVertex = () => {
    if (polygonVertices.length === 0) return;
    const updated = polygonVertices.slice(0, -1);
    setPolygonVertices(updated);
    setIsPolygonClosed(false);
    if (updated.length >= 3) {
      triggerPolygonMetrics(updated);
    } else {
      setRegionMetrics(null);
    }
  };

  const handleClearPolygon = () => {
    setPolygonVertices([]);
    setIsPolygonClosed(false);
    setActiveVertexIndex(null);
    setRegionMetrics(null);
    setErrorMsg(null);
  };

  const handleDeleteVertex = (idxToDelete: number) => {
    const updated = polygonVertices.filter((_, idx) => idx !== idxToDelete);
    setPolygonVertices(updated);
    if (updated.length < 3) {
      setIsPolygonClosed(false);
      setRegionMetrics(null);
    } else {
      triggerPolygonMetrics(updated);
    }
  };

  // Save road region to backend
  const handleSaveRoadRegion = async () => {
    if (!videoId) return;
    if (polygonVertices.length < 3) {
      setErrorMsg('Draw at least 3 vertices to form a road measurement region.');
      return;
    }
    if (!isPolygonClosed) {
      setIsPolygonClosed(true);
    }

    setIsSavingRegion(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await createRegion(videoId, {
        name: 'Main Roadway Section',
        region_type: 'MONITORED_ROAD',
        vertices_pixel: polygonVertices,
        color_hex: '#06b6d4',
      });
      setSavedRegionId(res.region_id);
      setRegionMetrics({
        area_m2: res.area_sqm,
        perimeter_m: res.perimeter_m,
        road_width_m: res.road_width_m,
        is_valid: true,
      });
      setSuccessMsg(`Road measurement area saved (${res.area_sqm.toFixed(1)} m²).`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to save road measurement region.');
    } finally {
      setIsSavingRegion(false);
    }
  };

  // Validate calibration calculation
  const handleValidateCalibration = async () => {
    if (!videoId) return;
    if (points.length < 4) {
      setErrorMsg(`Planar homography requires at least 4 points to form a closed calibration shape (currently ${points.length} marked).`);
      return;
    }
    for (const pt of points) {
      if (!pt.latitude || !pt.longitude) {
        setErrorMsg(`Latitude and Longitude are mandatory for ${pt.id}.`);
        return;
      }
    }
    setErrorMsg(null);
    try {
      const res = await saveCalibration(videoId, points);
      setCalibrationResult(res);
      setSuccessMsg(`Calibration computed: Quality ${res.calibration_quality}, RMSE: ${res.reprojection_rmse_m?.toFixed(2)}m.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      // Re-trigger polygon metrics with new calibration if polygon exists
      if (polygonVertices.length >= 3) {
        triggerPolygonMetrics(polygonVertices);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Calibration validation failed.');
    }
  };

  // Final Submit: Save everything and start background processing
  const handleFinalSubmit = async () => {
    if (!videoId || !projectId) return;

    if (points.length < 4) {
      setErrorMsg(`At least 4 Ground Control Points forming a closed shape are required for homography calibration (currently ${points.length} placed).`);
      return;
    }

    for (const pt of points) {
      if (!pt.latitude || !pt.longitude) {
        setErrorMsg(`Latitude and Longitude are mandatory for ${pt.id}.`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Rename video if changed
      if (videoName.trim() && videoName.trim() !== video?.title) {
        await updateVideoName(videoId, videoName.trim());
      }

      // 2. Compute and commit calibration
      await saveCalibration(videoId, points);

      // 3. Automatically ensure road region is saved if drawn
      if (polygonVertices.length >= 3) {
        try {
          await createRegion(videoId, {
            name: 'Main Roadway Section',
            region_type: 'MONITORED_ROAD',
            vertices_pixel: polygonVertices,
            color_hex: '#06b6d4',
          });
        } catch (rErr) {
          console.warn('Road region auto-save notice:', rErr);
        }
      }

      // 4. Launch background processing
      const jobRes = await startProcessingJob(videoId, {
        confidence_threshold: 0.35,
        iou_threshold: 0.45,
        frame_step: 1,
        generate_annotated_video: true,
      });

      // Redirect to processing view
      navigate(`/video-intelligence/projects/${projectId}/videos/${videoId}/processing/${jobRes.job_id}`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to submit video setup.');
      setIsSubmitting(false);
    }
  };

  // Centroids for overlay labels
  const gcpCentroid = points.length >= 3 ? {
    x: points.reduce((sum, p) => sum + p.image_x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.image_y, 0) / points.length,
  } : null;

  const polyCentroid = polygonVertices.length >= 3 ? {
    x: polygonVertices.reduce((sum, p) => sum + p[0], 0) / polygonVertices.length,
    y: polygonVertices.reduce((sum, p) => sum + p[1], 0) / polygonVertices.length,
  } : null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-[36px] text-primary">progress_activity</span>
        <span className="mt-3 text-xs font-mono">Extracting first frame & loading setup...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col w-full max-w-[1440px] gap-6 pb-12">
      {/* Top Banner & Video Rename */}
      <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/video-intelligence/projects/${projectId}`)}
            className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Back to Workspace"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase text-primary font-bold">Step 2: Video Setup, Calibration & Road Measurement</span>
            <h1 className="text-base font-bold text-on-surface tracking-tight">
              {video?.original_filename}
            </h1>
          </div>
        </div>

        {/* Video Rename Field */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-on-surface shrink-0">Video Name:</label>
          <input
            type="text"
            value={videoName}
            onChange={(e) => setVideoName(e.target.value)}
            placeholder="Optional video rename..."
            className="px-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:border-primary w-full sm:w-64 font-medium"
          />
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Split Grid: Left Canvas & Right Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: First-Frame Interactive Canvas (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          {/* Canvas Mode Header & Controls */}
          <div className="p-2.5 rounded-t-xl bg-surface-container-low border border-outline-variant flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-surface p-1 rounded-lg border border-outline-variant/70">
              <button
                type="button"
                onClick={() => setActiveMode('GCP')}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeMode === 'GCP'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">location_on</span>
                <span>Mode 1: Calibration GCPs</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20">
                  {points.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('ROAD_AREA')}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeMode === 'ROAD_AREA'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">polyline</span>
                <span>Mode 2: Road Measurement Area</span>
                {savedRegionId && (
                  <span className="material-symbols-outlined text-[14px] text-emerald-400" title="Saved">
                    check_circle
                  </span>
                )}
              </button>
            </div>

            {/* Zoom & Pan Controls */}
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                className="p-1 rounded bg-surface border border-outline-variant hover:bg-surface-container cursor-pointer"
                title="Zoom Out"
              >
                <span className="material-symbols-outlined text-[15px]">zoom_out</span>
              </button>
              <span className="px-1 text-on-surface">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                className="p-1 rounded bg-surface border border-outline-variant hover:bg-surface-container cursor-pointer"
                title="Zoom In"
              >
                <span className="material-symbols-outlined text-[15px]">zoom_in</span>
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="ml-1 px-2 py-0.5 rounded bg-surface border border-outline-variant hover:bg-surface-container text-on-surface cursor-pointer text-[10px] font-sans"
              >
                Reset View
              </button>
            </div>
          </div>

          {/* Interactive Image Frame & Canvas Overlay */}
          <div
            ref={containerRef}
            onMouseDown={(e) => {
              if (e.button === 1 || e.altKey) {
                setIsPanning(true);
                setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              }
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative h-[490px] w-full rounded-b-xl border-x border-b border-outline-variant bg-black overflow-hidden flex items-center justify-center select-none cursor-crosshair"
          >
            <div
              onClick={handleCanvasClick}
              className="relative inline-block max-w-full max-h-full transition-transform duration-75 origin-center"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              }}
            >
              {videoId && (
                <img
                  src={getFirstFrameUrl(videoId)}
                  alt="Extracted First Frame"
                  onLoad={(e) => {
                    const nat = e.currentTarget;
                    setNaturalSize({ width: nat.naturalWidth || 1280, height: nat.naturalHeight || 720 });
                  }}
                  className="max-h-[470px] w-auto object-contain block pointer-events-auto"
                />
              )}

              {/* SVG OVERLAY: Renders Calibration Shape & Road Measurement Polygon */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                preserveAspectRatio="none"
              >
                {/* 1. Ground Control Points Shape */}
                {points.length >= 3 && (
                  <>
                    <polygon
                      points={points.map((p) => `${p.image_x},${p.image_y}`).join(' ')}
                      fill={activeMode === 'GCP' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(16, 185, 129, 0.06)'}
                      stroke="#10b981"
                      strokeWidth={activeMode === 'GCP' ? '2.5' : '1.5'}
                      strokeDasharray={activeMode === 'GCP' ? 'none' : '4 4'}
                      strokeLinejoin="round"
                    />
                    {gcpCentroid && activeMode === 'GCP' && (
                      <text
                        x={gcpCentroid.x}
                        y={gcpCentroid.y}
                        fill="#34d399"
                        fontSize="13"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="font-mono select-none drop-shadow-md"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                      >
                        CALIBRATION BOUNDS ({points.length} GCPs)
                      </text>
                    )}
                  </>
                )}
                {points.length === 2 && activeMode === 'GCP' && (
                  <line
                    x1={points[0].image_x}
                    y1={points[0].image_y}
                    x2={points[1].image_x}
                    y2={points[1].image_y}
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                  />
                )}

                {/* 2. Road Measurement Area Polygon */}
                {polygonVertices.length >= 3 && isPolygonClosed && (
                  <>
                    <polygon
                      points={polygonVertices.map((v) => `${v[0]},${v[1]}`).join(' ')}
                      fill="rgba(6, 182, 212, 0.25)"
                      stroke="#06b6d4"
                      strokeWidth="3"
                      strokeLinejoin="round"
                    />
                    <polygon
                      points={polygonVertices.map((v) => `${v[0]},${v[1]}`).join(' ')}
                      fill="none"
                      stroke="#67e8f9"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                    />
                    {polyCentroid && (
                      <g>
                        <rect
                          x={polyCentroid.x - 90}
                          y={polyCentroid.y - 12}
                          width="180"
                          height="24"
                          rx="4"
                          fill="rgba(15, 23, 42, 0.85)"
                          stroke="#06b6d4"
                          strokeWidth="1"
                        />
                        <text
                          x={polyCentroid.x}
                          y={polyCentroid.y}
                          fill="#38bdf8"
                          fontSize="11"
                          fontWeight="bold"
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="font-mono select-none"
                        >
                          {regionMetrics?.area_m2 ? `${regionMetrics.area_m2.toFixed(1)} m²` : 'ROAD AREA'}
                        </text>
                      </g>
                    )}
                  </>
                )}

                {/* Road Area Polyline when not yet closed */}
                {polygonVertices.length >= 2 && !isPolygonClosed && (
                  <polyline
                    points={polygonVertices.map((v) => `${v[0]},${v[1]}`).join(' ')}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                  />
                )}
              </svg>

              {/* GCP Point Markers */}
              {points.map((pt, idx) => {
                const pctX = (pt.image_x / naturalSize.width) * 100;
                const pctY = (pt.image_y / naturalSize.height) * 100;
                const isActive = activeMode === 'GCP' && idx === activePointIndex;

                return (
                  <div
                    key={pt.id || idx}
                    onMouseDown={(e) => handleMarkerMouseDown(idx, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMode('GCP');
                      setActivePointIndex(idx);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${pctX}%`,
                      top: `${pctY}%`,
                      transform: 'translate(-50%, -50%)',
                      opacity: activeMode === 'GCP' ? 1 : 0.45,
                    }}
                    className="cursor-move z-10 group select-none"
                  >
                    <div
                      className={`relative flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all shadow-lg font-mono font-bold text-xs ${
                        isActive
                          ? 'bg-primary text-white border-white scale-110 ring-4 ring-primary/40'
                          : 'bg-emerald-600 text-white border-white hover:scale-105'
                      }`}
                    >
                      <span>{idx + 1}</span>
                    </div>
                    <span className="absolute top-8 left-1/2 -translate-x-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/90 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                      GCP {idx + 1}: ({pt.image_x}, {pt.image_y})
                    </span>
                  </div>
                );
              })}

              {/* Road Polygon Vertex Markers */}
              {polygonVertices.map((v, idx) => {
                const pctX = (v[0] / naturalSize.width) * 100;
                const pctY = (v[1] / naturalSize.height) * 100;
                const isActive = activeMode === 'ROAD_AREA' && idx === activeVertexIndex;

                return (
                  <div
                    key={`v-${idx}`}
                    onMouseDown={(e) => handleVertexMouseDown(idx, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMode('ROAD_AREA');
                      setActiveVertexIndex(idx);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${pctX}%`,
                      top: `${pctY}%`,
                      transform: 'translate(-50%, -50%)',
                      opacity: activeMode === 'ROAD_AREA' ? 1 : 0.45,
                    }}
                    className="cursor-move z-20 group select-none"
                  >
                    <div
                      className={`relative flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all shadow-md font-mono font-bold text-[11px] ${
                        isActive
                          ? 'bg-cyan-500 text-slate-950 border-white scale-110 ring-4 ring-cyan-500/40'
                          : 'bg-cyan-700 text-white border-cyan-300 hover:scale-105'
                      }`}
                    >
                      <span>V{idx + 1}</span>
                    </div>
                    <span className="absolute top-7 left-1/2 -translate-x-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/90 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                      Vertex {idx + 1}: ({v[0]}, {v[1]})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick instructions bar below canvas */}
          <div className="px-3 py-2 rounded-lg bg-surface border border-outline-variant flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
            <span>
              {activeMode === 'GCP' ? (
                <>
                  <strong className="text-emerald-400">Calibration Mode:</strong> Click canvas to add GCPs. Drag to reposition. Minimum 4 points required.
                </>
              ) : (
                <>
                  <strong className="text-cyan-400">Road Measurement Mode:</strong> Click on roadway to draw polygon vertices. Click Close Polygon when complete.
                </>
              )}
            </span>
            <span className="text-on-surface-variant/70">Pan: Alt+Drag • Zoom: Mouse Wheel</span>
          </div>
        </div>

        {/* RIGHT: Contextual Configuration Panels (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* MODE 1 PANEL: Ground-Control Points */}
          {activeMode === 'GCP' ? (
            <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col gap-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px]">location_on</span>
                  Ground-Control Points ({points.length} Marked)
                </h2>
                {points.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllPoints}
                    className="text-[11px] font-mono text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              {points.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-[32px] text-emerald-500 mb-2">add_location_alt</span>
                  <p className="text-xs font-bold text-on-surface">No Calibration Points Marked</p>
                  <p className="text-[11px] text-on-surface-variant mt-1 max-w-xs leading-relaxed">
                    Click anywhere on the video frame on the left to place Point 1. Place at least 4 points to form a closed calibration shape.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {points.map((pt, idx) => {
                    const isActive = idx === activePointIndex;
                    return (
                      <div
                        key={pt.id || idx}
                        onClick={() => setActivePointIndex(idx)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-emerald-500/10 border-emerald-500 shadow-xs'
                            : 'bg-surface-container-low border-outline-variant/70 hover:border-outline-variant'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono font-bold text-white ${
                                isActive ? 'bg-primary' : 'bg-emerald-600'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-bold text-xs text-on-surface">{pt.id}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-on-surface-variant bg-surface px-1.5 py-0.5 rounded border border-outline-variant/60">
                              X: <strong className="text-on-surface">{pt.image_x}</strong>, Y:{' '}
                              <strong className="text-on-surface">{pt.image_y}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePoint(idx);
                              }}
                              className="p-1 rounded text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Delete this point"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                          <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] text-on-surface-variant">Latitude (°N) *</label>
                            <input
                              type="number"
                              step="0.000001"
                              required
                              value={pt.latitude}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setPoints(points.map((p, i) => (i === idx ? { ...p, latitude: val } : p)));
                              }}
                              className="px-2 py-1 bg-surface border border-outline-variant rounded-md text-on-surface text-xs focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <label className="text-[10px] text-on-surface-variant">Longitude (°E) *</label>
                            <input
                              type="number"
                              step="0.000001"
                              required
                              value={pt.longitude}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setPoints(points.map((p, i) => (i === idx ? { ...p, longitude: val } : p)));
                              }}
                              className="px-2 py-1 bg-surface border border-outline-variant rounded-md text-on-surface text-xs focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Calibration Status Box */}
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase block">Reprojection RMSE</span>
                  <span className="font-bold text-sm text-on-surface">
                    {calibrationResult?.reprojection_rmse_m !== null && calibrationResult?.reprojection_rmse_m !== undefined
                      ? `${calibrationResult.reprojection_rmse_m.toFixed(2)} m`
                      : 'Uncalculated'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase block">Status</span>
                  <span
                    className={`font-bold text-xs uppercase ${
                      calibrationResult?.calibration_quality === 'EXCELLENT' || calibrationResult?.calibration_quality === 'GOOD'
                        ? 'text-emerald-400'
                        : points.length < 4
                        ? 'text-on-surface-variant'
                        : 'text-amber-400'
                    }`}
                  >
                    {calibrationResult?.calibration_quality || (points.length < 4 ? `Need ${4 - points.length} more` : 'Pending')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleValidateCalibration}
                  disabled={points.length < 4}
                  className="px-2.5 py-1 rounded bg-surface border border-outline-variant text-[11px] font-semibold hover:bg-surface-container cursor-pointer font-sans disabled:opacity-40"
                >
                  Test Calibration
                </button>
              </div>

              {/* Switch to Road Area Mode helper */}
              <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-between text-xs">
                <span className="text-cyan-300 font-medium">Ready to define road density area?</span>
                <button
                  type="button"
                  onClick={() => setActiveMode('ROAD_AREA')}
                  className="px-2.5 py-1 rounded bg-cyan-600 text-white font-semibold hover:bg-cyan-500 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Go to Road Polygon Tool</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ) : (
            /* MODE 2 PANEL: Road Measurement Area */
            <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col gap-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-cyan-400 text-[18px]">polyline</span>
                    Road Measurement Area
                  </h2>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    Encloses the road surface for density (veh/km²) and road occupancy (%) calculation.
                  </p>
                </div>
                {polygonVertices.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearPolygon}
                    className="text-[11px] font-mono text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Geometry Metrics Live Card */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant font-mono">
                <div className="flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase">Physical Road Area</span>
                  <span className="text-base font-bold text-cyan-400">
                    {regionMetrics?.area_m2 ? `${regionMetrics.area_m2.toFixed(1)} m²` : '—'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase">Perimeter</span>
                  <span className="text-sm font-bold text-on-surface">
                    {regionMetrics?.perimeter_m ? `${regionMetrics.perimeter_m.toFixed(1)} m` : '—'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase">Est. Roadway Width</span>
                  <span className="text-sm font-bold text-on-surface">
                    {regionMetrics?.road_width_m ? `${regionMetrics.road_width_m.toFixed(1)} m` : '—'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-on-surface-variant uppercase">Calibration Status</span>
                  <span
                    className={`text-xs font-bold ${
                      calibrationResult ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {calibrationResult ? 'CALIBRATED' : 'UNCALIBRATED'}
                  </span>
                </div>
              </div>

              {/* Polygon Actions Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleClosePolygon}
                  disabled={polygonVertices.length < 3 || isPolygonClosed}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-xs font-semibold hover:bg-surface-container disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px] text-cyan-400">lock</span>
                  <span>{isPolygonClosed ? 'Shape Closed' : 'Close Polygon'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleUndoVertex}
                  disabled={polygonVertices.length === 0}
                  className="px-2.5 py-1.5 rounded-lg bg-surface border border-outline-variant text-xs font-semibold hover:bg-surface-container disabled:opacity-40 cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">undo</span>
                  <span>Undo</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveRoadRegion}
                  disabled={polygonVertices.length < 3 || isSavingRegion}
                  className="ml-auto px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-500 disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  {isSavingRegion ? (
                    <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[15px]">save</span>
                  )}
                  <span>Save Road Region</span>
                </button>
              </div>

              {/* Vertices List */}
              {polygonVertices.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-[32px] text-cyan-400 mb-2">draw</span>
                  <p className="text-xs font-bold text-on-surface">No Vertices Placed</p>
                  <p className="text-[11px] text-on-surface-variant mt-1 max-w-xs leading-relaxed">
                    Click anywhere on the road image on the left to add vertices outlining the monitored roadway surface.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {polygonVertices.map((v, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveVertexIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg border flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                        idx === activeVertexIndex
                          ? 'bg-cyan-500/10 border-cyan-500'
                          : 'bg-surface-container-low border-outline-variant/60 hover:border-outline-variant'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-on-surface">Vertex {idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-on-surface-variant">
                          X: {v[0]}, Y: {v[1]}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteVertex(idx);
                          }}
                          className="p-1 rounded text-on-surface-variant hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete vertex"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FINAL SUBMIT BUTTON */}
          <div className="p-4 rounded-xl bg-surface border border-outline-variant flex flex-col gap-2 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono text-on-surface-variant">
              <span>Calibration: {points.length >= 4 ? '✓ Ready (4+ GCPs)' : `Pending (${points.length}/4)`}</span>
              <span>Road Polygon: {polygonVertices.length >= 3 ? '✓ Defined' : 'Optional (Recommended)'}</span>
            </div>

            <button
              type="button"
              id="btn-final-submit"
              onClick={handleFinalSubmit}
              disabled={isSubmitting || points.length < 4}
              className="mt-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
              <span>
                {points.length < 4
                  ? `Mark at least 4 GCPs to calibrate (${points.length}/4)`
                  : 'Final Submit & Start Processing'}
              </span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
