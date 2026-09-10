import React, { useState } from 'react';
import { CameraStream, VehicleTrack } from '../types';

interface VideoPlayerFeedProps {
  currentCamera: CameraStream;
  vehicleTracks: VehicleTrack[];
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  onSnapshot?: () => void;
}

export const VideoPlayerFeed: React.FC<VideoPlayerFeedProps> = ({
  currentCamera,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  return (
    <div className={`flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-md ${isFullscreen ? 'fixed inset-4 z-50 bg-surface-container-lowest' : ''}`}>
      {/* Stream Utility Header */}
      <div className="px-space-md py-2.5 bg-surface-container flex flex-wrap items-center justify-between gap-space-sm border-b border-outline-variant/20">
        <div className="flex items-center gap-space-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-error animate-pulse"></div>
          <span className="font-label-caps text-label-caps text-on-surface uppercase tracking-wider font-bold">
            Live Traffic Feed
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-surface-container-high text-primary font-data-mono-sm text-data-mono-sm">
            RTSP Stream #01
          </span>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="px-2 py-0.5 rounded bg-surface-container-highest text-tertiary font-label-caps text-label-caps">
            YOLOv8x + ByteTrack
          </span>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-on-surface-variant hover:text-primary transition-colors p-1" 
            title={isFullscreen ? "Exit Fullscreen" : "Maximize View"}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div 
        id="video-viewport"
        className="relative w-full aspect-[16/9] bg-black overflow-hidden flex items-center justify-center select-none"
      >
        {!videoError ? (
          <video 
            src="/assets/video/annotated-junction-67.mp4" 
            controls
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-contain"
            onError={() => setVideoError(true)}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 bg-surface-container-low border border-error/20 rounded-lg max-w-sm mx-auto">
            <span className="material-symbols-outlined text-[48px] text-error mb-2">error</span>
            <span className="font-headline-sm text-on-surface mb-1">Unable to load traffic video</span>
            <span className="font-body-sm text-on-surface-variant">Check that the video asset exists in frontend/public/assets/video/</span>
          </div>
        )}

        {/* Top-Left CV Pipeline HUD Tag */}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-20 pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-lowest/85 backdrop-blur-md shadow-sm border border-outline-variant/20">
            <span className="h-2 w-2 rounded-full bg-tertiary animate-ping"></span>
            <span className="font-label-caps text-label-caps uppercase text-tertiary tracking-wider font-semibold">
              PROCESSING • 30.2 FPS
            </span>
          </div>
        </div>

        {/* Top-Right Resolution Badge */}
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          <div className="px-2.5 py-1 rounded bg-surface-container-lowest/85 backdrop-blur-md font-data-mono-sm text-data-mono-sm text-primary flex items-center gap-1.5 shadow-sm border border-outline-variant/20">
            <span className="material-symbols-outlined text-[14px]">videocam</span>
            1920x1080 • 1080p@30fps
          </div>
        </div>
      </div>

      {/* Subtitle Tag */}
      <div className="px-space-md py-2 bg-surface-container-low flex flex-wrap items-center justify-between text-on-surface-variant font-body-sm text-body-sm border-t border-outline-variant/10">
        <span className="flex items-center gap-1.5 text-primary">
          <span className="material-symbols-outlined text-[15px]">model_training</span>
          Annotated Computer Vision Output
        </span>
        <span className="font-data-mono-sm text-data-mono-sm text-on-surface-variant">
          Model latency: 18.2ms • GPU Load: 44%
        </span>
      </div>
    </div>
  );
};
