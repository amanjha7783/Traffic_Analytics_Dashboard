import React from 'react';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  theme,
  onToggleTheme,
}) => {
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
            Annotated traffic video and vehicle counts
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

      </div>
    </header>
  );
};
