import React, { useState } from 'react';
import { CameraStream, VehicleTrack } from '../types';

interface TrafficMonitorViewProps {
  cameras: CameraStream[];
  currentCamera: CameraStream;
  onSelectCamera: (cam: CameraStream) => void;
  vehicleTracks: VehicleTrack[];
}

export const TrafficMonitorView: React.FC<TrafficMonitorViewProps> = ({
  cameras,
  currentCamera,
  onSelectCamera,
}) => {
  const [layoutMode, setLayoutMode] = useState<'quad' | 'single'>('quad');
  const [activeCamId, setActiveCamId] = useState<string>(currentCamera.id);

  return (
    <div className="flex flex-col gap-space-lg">
      {/* Header and Layout Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low p-space-md rounded-xl border border-outline-variant/10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-headline-md text-headline-md font-bold text-on-surface">
              Multi-Camera Surveillance Matrix
            </span>
            <span className="px-2 py-0.5 rounded bg-tertiary/20 text-tertiary font-label-caps text-label-caps font-bold">
              4 CHANNELS SYNCED
            </span>
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Low-latency RTSP edge ingest with simultaneous YOLO inference across junction approaches
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLayoutMode('quad')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              layoutMode === 'quad'
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">grid_view</span>
            Quad View (2x2)
          </button>
          <button
            onClick={() => setLayoutMode('single')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              layoutMode === 'single'
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">crop_free</span>
            Focused View (1x1)
          </button>
        </div>
      </div>

      {/* Grid of Cameras */}
      {layoutMode === 'quad' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {cameras.map((cam) => {
            const isSelected = cam.id === activeCamId;
            return (
              <div
                key={cam.id}
                onClick={() => {
                  setActiveCamId(cam.id);
                  onSelectCamera(cam);
                }}
                className={`flex flex-col bg-surface-container-low rounded-xl overflow-hidden border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary shadow-[0_0_16px_rgba(6,182,212,0.25)]'
                    : 'border-outline-variant/20 hover:border-outline-variant/50'
                }`}
              >
                {/* Header */}
                <div className="px-space-md py-2 bg-surface-container flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                    <span className="font-label-caps text-xs text-on-surface font-semibold">
                      {cam.name}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-primary">{cam.fps} FPS</span>
                </div>

                {/* Video Image */}
                <div className="relative aspect-[16/9] bg-surface-container-lowest overflow-hidden group">
                  <img
                    src={cam.imageUrl}
                    alt={cam.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none"></div>

                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-surface-container-lowest/80 text-[10px] font-mono text-tertiary">
                    {cam.status} • {cam.latencyMs}ms
                  </div>

                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-surface-container-lowest/80 text-[10px] font-mono text-on-surface-variant">
                    {cam.resolution}
                  </div>
                </div>

                {/* Footer specs */}
                <div className="px-space-md py-2 bg-surface-container flex items-center justify-between text-xs text-on-surface-variant">
                  <span>Stream: {cam.rtspUrl.split('/').pop()}</span>
                  <span className="text-primary hover:underline">Inspect Channel →</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col bg-surface-container-low rounded-xl overflow-hidden border border-primary/40 shadow-lg">
          <div className="px-space-md py-3 bg-surface-container flex items-center justify-between">
            <span className="font-headline-sm text-on-surface font-bold">
              {currentCamera.name} • Master Inspection
            </span>
            <span className="font-mono text-xs text-tertiary">
              {currentCamera.fps} FPS • {currentCamera.latencyMs}ms
            </span>
          </div>
          <div className="relative aspect-[21/9] bg-surface-container-lowest overflow-hidden">
            <img
              src={currentCamera.imageUrl}
              alt={currentCamera.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 p-3 rounded-lg bg-surface-container-lowest/90 border border-outline-variant/30 text-xs font-mono flex flex-col gap-1">
              <span className="text-primary font-bold">EDGE STREAM TELEMETRY</span>
              <span>RTSP Ingest: {currentCamera.rtspUrl}</span>
              <span>Bitrate: 8.4 Mbps (H.265 CBR)</span>
              <span>GOP Length: 30 Frames</span>
              <span>Hardware Acceleration: NVDEC / TensorRT</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
