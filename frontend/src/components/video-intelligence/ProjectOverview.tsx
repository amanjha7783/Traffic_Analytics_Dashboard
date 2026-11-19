import React from 'react';
import { StudioProject, StudioVideo } from '../../types/videoIntelligence';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons in Vite/React
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface ProjectOverviewProps {
  project: StudioProject;
  videos: StudioVideo[];
  onNavigateTab: (tab: string) => void;
  onSelectVideo: (videoId: string) => void;
}

export const ProjectOverview: React.FC<ProjectOverviewProps> = ({
  project,
  videos,
  onNavigateTab,
  onSelectVideo,
}) => {
  const centerLat = project.latitude || 22.3072;
  const centerLon = project.longitude || 73.1812;

  const calibratedCount = videos.filter((v) => v.is_calibrated).length;
  const analyzedCount = videos.filter((v) => v.status === 'analyzed').length;

  return (
    <div className="flex flex-col gap-6">
      {/* Project Banner & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Details Box */}
        <div className="lg:col-span-3 p-5 rounded bg-surface border border-outline-variant flex flex-col justify-between gap-4 shadow-subtle">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase font-bold text-primary tracking-wider px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                  {project.id}
                </span>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
                  {project.crs}
                </span>
              </div>
              <span className="text-xs font-mono text-on-surface-variant">
                Created: {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>

            <h1 className="text-lg font-bold text-on-surface tracking-tight mt-1">
              {project.name}
            </h1>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {project.description || 'Multimodal traffic video survey testbed with physical measurement and trajectory analysis.'}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-outline-variant/60 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase font-mono">Location</span>
              <span className="font-semibold text-on-surface truncate">{project.location}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase font-mono">Road Arterial</span>
              <span className="font-semibold text-on-surface truncate">{project.road_name}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase font-mono">City & State</span>
              <span className="font-semibold text-on-surface truncate">{project.city}, {project.state}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-on-surface-variant uppercase font-mono">Coordinates</span>
              <span className="font-mono text-[11px] font-semibold text-on-surface truncate">
                {project.latitude.toFixed(4)}°, {project.longitude.toFixed(4)}°
              </span>
            </div>
          </div>
        </div>

        {/* Quick Operational Telemetry KPIs */}
        <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col justify-between gap-3 shadow-subtle">
          <span className="text-[11px] font-mono uppercase font-semibold text-on-surface-variant tracking-wider">
            Workspace Inventory
          </span>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">videocam</span>
                <span className="text-xs text-on-surface">Video Feeds</span>
              </div>
              <span className="font-mono text-sm font-bold text-on-surface">{videos.length}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-success text-[18px]">tune</span>
                <span className="text-xs text-on-surface">Calibrated</span>
              </div>
              <span className="font-mono text-sm font-bold text-success">
                {calibratedCount} / {videos.length}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">analytics</span>
                <span className="text-xs text-on-surface">Analyzed</span>
              </div>
              <span className="font-mono text-sm font-bold text-primary">{analyzedCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
            <button
              onClick={() => onNavigateTab('video-library')}
              className="flex-1 py-1.5 px-2 rounded bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer text-center"
            >
              Add Video
            </button>
            <button
              onClick={() => onNavigateTab('compare')}
              className="flex-1 py-1.5 px-2 rounded bg-surface-container-high text-on-surface text-xs font-semibold hover:bg-surface-container-highest transition-colors cursor-pointer text-center"
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {/* Geospatial Road Network Map & Camera Pinning */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-3 shadow-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">map</span>
            <h3 className="text-sm font-semibold text-on-surface">Geospatial Camera Network & Testbed Location</h3>
          </div>
          <span className="text-xs font-mono text-on-surface-variant">
            WGS84 Ellipsoid / Metric Ground Plane
          </span>
        </div>

        <div className="h-[280px] w-full rounded overflow-hidden border border-outline-variant relative">
          <MapContainer
            center={[centerLat, centerLon]}
            zoom={16}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Project Center Circle */}
            <Circle
              center={[centerLat, centerLon]}
              radius={120}
              pathOptions={{ color: '#315B8A', fillColor: '#315B8A', fillOpacity: 0.15, weight: 2 }}
            />
            <Marker position={[centerLat, centerLon]} icon={defaultIcon}>
              <Popup>
                <div className="text-xs flex flex-col gap-1">
                  <span className="font-bold text-primary">{project.name}</span>
                  <span>{project.road_name}</span>
                  <span className="font-mono text-[10px] text-gray-600">
                    {centerLat.toFixed(6)}, {centerLon.toFixed(6)}
                  </span>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      </div>

      {/* Camera Video Feeds Grid */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">video_library</span>
            <h3 className="text-sm font-semibold text-on-surface">Registered Camera Feeds</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
              {videos.length} Sources
            </span>
          </div>

          <button
            onClick={() => onNavigateTab('video-library')}
            className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold cursor-pointer"
          >
            <span>Manage All Videos</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {videos.length === 0 ? (
          <div className="p-8 rounded border border-dashed border-outline-variant bg-surface-container-low text-center flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">videocam_off</span>
            <span className="text-xs font-semibold text-on-surface mt-1">No CCTV videos uploaded yet</span>
            <p className="text-[11px] text-on-surface-variant max-w-xs mt-0.5">
              Upload raw traffic videos (MP4, MOV, AVI) to calibrate planar homography and monitor road occupancy.
            </p>
            <button
              onClick={() => onNavigateTab('video-library')}
              className="mt-3 px-3 py-1.5 rounded bg-primary text-white text-xs font-semibold hover:bg-primary/90 cursor-pointer"
            >
              Upload First Video
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((vid) => (
              <div
                key={vid.id}
                onClick={() => onSelectVideo(vid.id)}
                className="group p-3.5 rounded bg-surface border border-outline-variant hover:border-primary/60 transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-subtle hover:shadow-md"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                      {vid.camera_id}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                        vid.status === 'analyzed'
                          ? 'bg-success/10 text-success border-success/30'
                          : vid.status === 'PROCESSING'
                          ? 'bg-primary/10 text-primary border-primary/30 animate-pulse'
                          : 'bg-surface-container-high text-on-surface-variant border-outline-variant'
                      }`}
                    >
                      {vid.status}
                    </span>
                  </div>

                  <h4 className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                    {vid.title}
                  </h4>
                  <span className="text-[11px] font-mono text-on-surface-variant truncate">
                    {vid.original_filename}
                  </span>

                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-outline-variant/60 text-[11px] font-mono text-on-surface-variant">
                    <div>
                      <span className="text-[9px] uppercase block">Res</span>
                      <span className="font-semibold text-on-surface">{vid.width}x{vid.height}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase block">FPS</span>
                      <span className="font-semibold text-on-surface">{vid.fps}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase block">Duration</span>
                      <span className="font-semibold text-on-surface">{vid.duration_seconds}s</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-outline-variant text-[11px]">
                  <span className={`font-mono text-[10px] font-semibold ${vid.is_calibrated ? 'text-success' : 'text-on-surface-variant'}`}>
                    {vid.is_calibrated ? '● Calibrated' : '○ Uncalibrated'}
                  </span>
                  <div className="flex items-center gap-1.5 text-primary group-hover:translate-x-0.5 transition-transform font-semibold text-[11px]">
                    <span>Inspect</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
