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
    <div className={`flex flex-col bg-surface-container-low rounded-xl overflow-hidden shadow-md border border-outline-variant/20 ${isFullscreen ? 'fixed inset-4 z-50 bg-surface-container-lowest' : ''}`}>
      {/* Header */}
      <div className="px-space-md py-3 bg-surface-container flex flex-wrap items-center justify-between gap-space-sm border-b border-outline-variant/20">
        <span className="font-headline-sm text-on-surface font-semibold">
          Live Traffic Feed
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
      </div>

      {/* Subtitle Footer */}
      <div className="px-space-md py-2.5 bg-surface-container-low flex flex-wrap items-center text-on-surface-variant font-body-sm border-t border-outline-variant/10">
        <span className="flex items-center gap-1.5 text-primary">
          <span className="material-symbols-outlined text-[16px]">videocam</span>
          Annotated Computer Vision Output
        </span>
      </div>
    </div>
  );
};
