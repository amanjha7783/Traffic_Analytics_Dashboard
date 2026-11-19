import React, { useState, useEffect, useRef } from 'react';
import { StudioProject, StudioVideo, ExportArtifact } from '../../types/videoIntelligence';
import { fetchExports, getExportDownloadUrl, importDataFromSky } from '../../services/videoIntelligenceApi';

interface ExportCenterProps {
  project: StudioProject;
  videos: StudioVideo[];
  onRefresh: () => void;
}

export const ExportCenter: React.FC<ExportCenterProps> = ({
  project,
  videos,
  onRefresh,
}) => {
  const [selectedVideoId, setSelectedVideoId] = useState<string>(videos[0]?.id || '');
  const [exportsList, setExportsList] = useState<ExportArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // DataFromSky Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [targetVideoId, setTargetVideoId] = useState<string>(videos[0]?.id || '');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadExports = async () => {
    if (!selectedVideoId) return;
    setIsLoading(true);
    try {
      const res = await fetchExports(selectedVideoId);
      setExportsList(res.exports || []);
    } catch (err) {
      console.error('Failed to load exports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExports();
  }, [selectedVideoId]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !targetVideoId) return;
    const file = files[0];

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const res = await importDataFromSky(project.id, targetVideoId, file);
      setImportResult(res.summary);
      onRefresh();
      loadExports();
    } catch (err: any) {
      setImportError(err?.response?.data?.detail || 'Failed to import DataFromSky CSV.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">download_for_offline</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-on-surface">Data Export & External Telemetry Ingestion Center</h2>
            <span className="text-xs text-on-surface-variant font-mono">
              Download standard research datasets or ingest DataFromSky FLOW / TrafficSurvey CSV logs
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">file_upload</span>
          <span>Import DataFromSky CSV</span>
        </button>
      </div>

      {/* Video Selector */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col gap-4 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-on-surface">Select Video Source:</span>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="px-2.5 py-1 text-xs bg-surface-container-low border border-outline-variant rounded font-mono text-on-surface"
            >
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.camera_id} • {v.title}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] font-mono text-on-surface-variant">
            {exportsList.length} Generated Datasets Available
          </span>
        </div>

        {/* Exports Table */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-on-surface-variant">Loading export registry...</div>
        ) : exportsList.length === 0 ? (
          <div className="p-12 rounded border border-dashed border-outline-variant bg-surface-container-low text-center flex flex-col items-center">
            <span className="material-symbols-outlined text-[36px] text-on-surface-variant">folder_zip</span>
            <span className="text-xs font-semibold text-on-surface mt-1">No exports for this video</span>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Launch video processing in the Processing Center to automatically generate structured CSV and GeoJSON datasets.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {exportsList.map((exp) => (
              <div
                key={exp.id}
                className="p-3.5 rounded bg-surface-container-low border border-outline-variant flex items-center justify-between text-xs"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface font-mono">{exp.filename}</span>
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    Format: {exp.export_type} • {(exp.file_size_bytes / 1024).toFixed(1)} KB
                  </span>
                </div>

                <a
                  href={getExportDownloadUrl(exp.id)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  <span>Download</span>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DataFromSky CSV Ingestion Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-surface border border-outline-variant rounded shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-12 px-5 flex items-center justify-between border-b border-outline-variant bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">transform</span>
                <h3 className="text-sm font-semibold text-on-surface">DataFromSky FLOW CSV Telemetry Ingestion</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Import drone aerial survey or DataFromSky FLOW trajectory CSV logs. The adapter maps vehicle taxonomy, validates timestamps, and normalizes telemetry into the TrafficOps schema.
              </p>

              {importError && (
                <div className="p-2.5 rounded bg-danger/10 border border-danger/30 text-danger flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{importError}</span>
                </div>
              )}

              {importResult && (
                <div className="p-3 rounded bg-success/10 border border-success/30 text-success flex flex-col gap-1 font-mono text-[11px]">
                  <span className="font-bold">✓ Successfully Imported DataFromSky Log:</span>
                  <span>• Total Records: {importResult.total_records}</span>
                  <span>• Unique Tracked Vehicles: {importResult.unique_vehicles}</span>
                  <span>• Average Speed: {importResult.avg_speed_kmh} km/h</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Target Project Video / Camera</label>
                <select
                  value={targetVideoId}
                  onChange={(e) => setTargetVideoId(e.target.value)}
                  className="px-2.5 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface font-mono"
                >
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.camera_id} • {v.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload Drop Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 rounded border-2 border-dashed border-outline-variant bg-surface-container-low hover:border-primary/60 transition-colors flex flex-col items-center justify-center text-center cursor-pointer"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e.target.files)}
                  accept=".csv,.txt"
                  className="hidden"
                />

                {isImporting ? (
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-[28px] text-primary">progress_activity</span>
                    <span className="font-mono text-xs">Parsing & Normalizing Telemetry Observations...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="material-symbols-outlined text-[32px] text-primary">upload_file</span>
                    <span className="font-semibold text-on-surface">Click to select DataFromSky CSV</span>
                    <span className="text-[11px] text-on-surface-variant font-mono">Compatible with FLOW & TrafficSurvey</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-outline-variant">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
