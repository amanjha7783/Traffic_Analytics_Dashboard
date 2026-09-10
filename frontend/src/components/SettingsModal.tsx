import React, { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [confidence, setConfidence] = useState<number>(0.85);
  const [iouThresh, setIouThresh] = useState<number>(0.45);
  const [maxAge, setMaxAge] = useState<number>(30);
  const [homographyPreset, setHomographyPreset] = useState<string>('Junction 67 Standard (WGS84)');
  const [saveToast, setSaveToast] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setSaveToast(true);
    setTimeout(() => {
      setSaveToast(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-space-lg py-4 bg-surface-container flex items-center justify-between border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
            <span className="font-headline-sm text-base font-bold text-on-surface">
              CV Pipeline & Homography Configuration
            </span>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface p-1">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-space-lg flex flex-col gap-4 text-xs font-body-sm">
          {/* Section: YOLO Detection */}
          <div className="flex flex-col gap-2">
            <span className="font-label-caps text-primary uppercase font-bold tracking-wider">
              YOLOv8x Inference Parameters
            </span>
            <div className="flex items-center justify-between">
              <span className="text-on-surface">Confidence Threshold:</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="0.99"
                  step="0.01"
                  value={confidence}
                  onChange={(e) => setConfidence(parseFloat(e.target.value))}
                  className="w-28 accent-cyan-400"
                />
                <span className="font-mono text-primary w-10 text-right">{confidence.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-on-surface">NMS IoU Threshold:</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.05"
                  value={iouThresh}
                  onChange={(e) => setIouThresh(parseFloat(e.target.value))}
                  className="w-28 accent-cyan-400"
                />
                <span className="font-mono text-primary w-10 text-right">{iouThresh.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-outline-variant/20"></div>

          {/* Section: ByteTrack Multi-Object Tracker */}
          <div className="flex flex-col gap-2">
            <span className="font-label-caps text-tertiary uppercase font-bold tracking-wider">
              ByteTrack Kalman Filter
            </span>
            <div className="flex items-center justify-between">
              <span className="text-on-surface">Max Lost Track Age (Frames):</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="90"
                  value={maxAge}
                  onChange={(e) => setMaxAge(parseInt(e.target.value) || 30)}
                  className="w-16 bg-surface-container px-2 py-1 rounded border border-outline-variant/30 text-right font-mono text-primary"
                />
                <span className="text-on-surface-variant font-mono">frames</span>
              </div>
            </div>
          </div>

          <div className="h-px bg-outline-variant/20"></div>

          {/* Section: Homography Calibration Matrix */}
          <div className="flex flex-col gap-2">
            <span className="font-label-caps text-secondary uppercase font-bold tracking-wider">
              Pixel-To-World Homography (H-Matrix)
            </span>
            <select
              value={homographyPreset}
              onChange={(e) => setHomographyPreset(e.target.value)}
              className="w-full bg-surface-container px-3 py-2 rounded-lg border border-outline-variant/30 text-on-surface text-xs font-mono"
            >
              <option>Junction 67 Standard (WGS84)</option>
              <option>Junction 67 East Quad Orthogonal (5.0m/grid)</option>
              <option>Tokyo Shibuya Orthophoto Calibrated</option>
            </select>
            <div className="p-2 bg-surface-container-lowest rounded font-mono text-[10px] text-on-surface-variant leading-relaxed">
              H = [ [ 1.42e-3, -8.11e-4, 0.42 ], [ 3.12e-4, 1.89e-3, -0.68 ], [ 1.20e-6, 4.41e-6, 1.00 ] ]
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-space-lg py-3 bg-surface-container flex items-center justify-between border-t border-outline-variant/20">
          <span className="text-[11px] font-mono text-tertiary">
            {saveToast ? 'Pipeline parameters hot-reloaded!' : 'Ready for runtime tuning'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold shadow-sm hover:brightness-105"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
