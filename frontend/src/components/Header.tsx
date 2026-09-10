import React, { useState } from 'react';
import { CameraStream } from '../types';

interface HeaderProps {
  currentCamera: CameraStream;
  allCameras: CameraStream[];
  onSelectCamera: (cam: CameraStream) => void;
  onToggleMobileMenu: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCamera,
  allCameras,
  onSelectCamera,
  onToggleMobileMenu,
  theme,
  onToggleTheme
}) => {
  const [showCamDropdown, setShowCamDropdown] = useState(false);

  return (
    <header className="sticky top-0 w-full h-16 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 z-40 px-space-md lg:px-space-lg flex items-center justify-between shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg bg-surface-container-high transition-colors"
          aria-label="Open navigation menu"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-space-sm">
            <span className="font-headline-sm tracking-tight text-on-surface font-bold">
              Traffic Analytics
            </span>
          </div>
          <span className="hidden sm:inline-block font-body-sm text-on-surface-variant">
            Intersection traffic and collision-risk monitoring
          </span>
        </div>
      </div>

      {/* Right Utility Actions */}
      <div className="flex items-center gap-space-md">
        
        {/* Theme Toggle Button */}
        <button 
          onClick={onToggleTheme}
          className="flex items-center justify-center p-2 rounded-full bg-surface-container-low border border-outline-variant/20 hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-all shadow-sm"
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === 'dark' ? (
            <span className="material-symbols-outlined text-[20px]">light_mode</span>
          ) : (
            <span className="material-symbols-outlined text-[20px]">dark_mode</span>
          )}
        </button>

        {/* Camera Selector Dropdown */}
        <div className="relative hidden xl:block">
          <button
            onClick={() => setShowCamDropdown(!showCamDropdown)}
            className="flex items-center gap-space-xs text-on-surface-variant hover:text-on-surface font-body-sm bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/20 hover:border-outline-variant/40 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-primary text-[18px]">videocam</span>
            <span className="font-medium">{currentCamera.name.split('(')[0].trim()}</span>
            <span className="material-symbols-outlined text-[16px] ml-1">expand_more</span>
          </button>

          {showCamDropdown && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-surface-container-low rounded-xl border border-outline-variant/20 shadow-xl p-2 z-50 flex flex-col gap-1">
              <div className="px-2 py-1 text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Select Active Junction
              </div>
              {allCameras.map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => {
                    onSelectCamera(cam);
                    setShowCamDropdown(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    cam.id === currentCamera.id
                      ? 'bg-primary-container text-on-primary-container font-semibold shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <span className="font-medium text-sm">{cam.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
