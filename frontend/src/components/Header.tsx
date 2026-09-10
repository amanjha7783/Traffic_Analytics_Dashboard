import React, { useState, useEffect } from 'react';
import { CameraStream } from '../types';

interface HeaderProps {
  currentCamera: CameraStream;
  allCameras: CameraStream[];
  onSelectCamera: (cam: CameraStream) => void;
  onToggleMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCamera,
  allCameras,
  onSelectCamera,
  onToggleMobileMenu,
}) => {
  const [showCamDropdown, setShowCamDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState('10:42:15 UTC');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setCurrentTime(`${h}:${m}:${s} UTC`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/85 backdrop-blur-xl border-b border-outline-variant/30 z-40 px-space-md lg:px-space-lg flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg bg-surface-container-high"
          aria-label="Open navigation menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-space-sm">
            <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-bold">
              Traffic Analytics
            </span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container-high border border-outline-variant/40 font-label-caps text-label-caps text-on-surface-variant uppercase">
              Demo Prototype
            </span>
          </div>
          <span className="hidden sm:inline-block font-body-sm text-body-sm text-on-surface-variant">
            Computer Vision Based Traffic & Collision Risk Analysis
          </span>
        </div>
      </div>

      {/* Right Utility Badges */}
      <div className="flex items-center gap-space-md">
        {/* Live Status Pill */}
        <div className="flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container border border-outline-variant/30 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-tertiary"></span>
          </span>
          <span className="font-label-caps text-label-caps text-tertiary uppercase font-bold tracking-wider">
            LIVE / READY
          </span>
        </div>

        {/* Camera Selector Dropdown */}
        <div className="relative hidden xl:block">
          <button
            onClick={() => setShowCamDropdown(!showCamDropdown)}
            className="flex items-center gap-space-xs text-on-surface-variant hover:text-on-surface font-data-mono-sm text-data-mono-sm bg-surface-container-low px-2.5 py-1 rounded border border-outline-variant/20 hover:border-outline-variant/40 transition-colors"
          >
            <span className="material-symbols-outlined text-primary text-[16px]">videocam</span>
            <span>{currentCamera.name.split('(')[0].trim()}</span>
            <span className="text-primary font-semibold">({currentCamera.code})</span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>

          {showCamDropdown && (
            <div className="absolute top-full right-0 mt-1.5 w-72 bg-surface-container-low rounded-xl border border-outline-variant/40 shadow-xl p-1.5 z-50 flex flex-col gap-1">
              <div className="px-2 py-1 text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider">
                Select Active Junction Camera
              </div>
              {allCameras.map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => {
                    onSelectCamera(cam);
                    setShowCamDropdown(false);
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                    cam.id === currentCamera.id
                      ? 'bg-primary-container/20 text-primary font-semibold border border-primary/30'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-on-surface">{cam.name}</span>
                    <span className="text-[10px] text-on-surface-variant font-mono">{cam.resolution} • {cam.fps} FPS</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[10px] text-tertiary">
                    {cam.latencyMs}ms
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* UTC Clock */}
        <div className="hidden lg:flex items-center gap-space-xs text-on-surface-variant font-data-mono-sm text-data-mono-sm bg-surface-container-lowest/50 px-2 py-1 rounded border border-outline-variant/20">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          <span>{currentTime}</span>
        </div>

        {/* Resolution & Length Pill */}
        <div className="hidden 2xl:flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container-low border border-outline-variant/30 font-data-mono-sm text-data-mono-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">cloud_download</span>
          <span>1080p@30fps • 00:04:12</span>
        </div>

        {/* Operator Profile */}
        <div className="flex items-center gap-space-sm pl-space-sm border-l border-outline-variant/30">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="font-body-sm text-body-sm font-medium text-on-surface">
              Operator #04
            </span>
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
              Faculty Demo
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_8px_rgba(6,182,212,0.3)]">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
