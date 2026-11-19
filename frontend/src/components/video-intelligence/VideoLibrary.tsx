import React, { useState, useRef } from 'react';
import { StudioVideo } from '../../types/videoIntelligence';
import { uploadVideo, deleteVideo, getFirstFrameUrl, getThumbnailUrl } from '../../services/videoIntelligenceApi';

interface VideoLibraryProps {
  projectId: string;
  videos: StudioVideo[];
  onRefresh: () => void;
  onSelectVideo: (videoId: string, targetSection?: string) => void;
  isLoading: boolean;
}

export const VideoLibrary: React.FC<VideoLibraryProps> = ({
  projectId,
  videos,
  onRefresh,
  onSelectVideo,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraId, setCameraId] = useState('CAM-01');
  const [videoTitle, setVideoTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const validExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      setUploadError(`Invalid video format '${ext}'. Allowed: MP4, MOV, AVI, MKV`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('camera_id', cameraId || 'CAM-01');
    formData.append('title', videoTitle || file.name);

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      await uploadVideo(projectId, formData, (percent) => {
        setUploadProgress(percent);
      });
      setVideoTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onRefresh();
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || 'Failed to upload video.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    if (confirm('Delete this video feed and associated analysis?')) {
      try {
        await deleteVideo(videoId);
        onRefresh();
      } catch (err) {
        alert('Failed to delete video.');
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Upload Dropzone Section */}
      <div className="p-5 rounded bg-surface border border-outline-variant flex flex-col gap-4 shadow-subtle">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">cloud_upload</span>
              Multi-Video Ingestion & Camera Configuration
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Upload raw CCTV feeds (MP4, MOV, AVI, MKV). First frame is automatically extracted for planar homography calibration.
            </p>
          </div>
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
            Max 500 MB / Video
          </span>
        </div>

        {uploadError && (
          <div className="p-3 rounded bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{uploadError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-on-surface font-mono">Camera ID / Source Tag</label>
            <input
              type="text"
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              placeholder="e.g. CAM-01, NORTH-POLE-4"
              className="px-3 py-1.5 text-xs font-mono bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-on-surface">Feed Descriptive Title</label>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="e.g. Northbound Inbound Approach - Junction 67"
              className="px-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFileUpload(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`p-8 rounded border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-outline-variant bg-surface-container-low hover:border-primary/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            accept=".mp4,.mov,.avi,.mkv"
            className="hidden"
          />

          {isUploading ? (
            <div className="w-full max-w-md flex flex-col items-center gap-3">
              <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
              <div className="w-full flex justify-between text-xs font-mono text-on-surface-variant">
                <span>Ingesting Video Stream & Extracting First Frame...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">upload_file</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-on-surface">Click to browse or drop traffic video file here</span>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Supported containers: MP4, MOV, AVI, MKV (H.264 / HEVC)</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video Inventory Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">video_library</span>
            <h3 className="text-sm font-semibold text-on-surface">Project Video Sources</h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
              {videos.length} Registered
            </span>
          </div>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            <span>Refresh</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
            <span className="mt-3 text-xs font-mono">Loading camera video registry...</span>
          </div>
        ) : videos.length === 0 ? (
          <div className="p-12 rounded border border-dashed border-outline-variant bg-surface-container-low text-center flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant">videocam_off</span>
            <span className="text-xs font-semibold text-on-surface mt-2">No videos in this project</span>
            <p className="text-xs text-on-surface-variant mt-0.5 max-w-sm">
              Use the upload area above to register traffic camera recordings.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {videos.map((vid) => (
              <div
                key={vid.id}
                className="group rounded bg-surface border border-outline-variant hover:border-primary/60 transition-all flex flex-col justify-between overflow-hidden shadow-subtle hover:shadow-md"
              >
                {/* First-frame / Thumbnail Image Header */}
                <div className="relative h-44 bg-surface-container-highest overflow-hidden border-b border-outline-variant">
                  <img
                    src={getThumbnailUrl(vid.id)}
                    alt={vid.title}
                    onError={(e) => {
                      // Fallback to first-frame if thumbnail fails
                      (e.target as HTMLImageElement).src = getFirstFrameUrl(vid.id);
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Overlays */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-white px-2 py-0.5 rounded bg-black/70 backdrop-blur-xs border border-white/20">
                      {vid.camera_id}
                    </span>
                    <span className="text-[10px] font-mono text-white px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs">
                      {vid.duration_seconds}s
                    </span>
                  </div>

                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded backdrop-blur-xs border ${
                        vid.is_calibrated
                          ? 'bg-success/80 text-white border-success/40'
                          : 'bg-black/70 text-warning border-warning/40'
                      }`}
                    >
                      {vid.is_calibrated ? `CALIBRATED (${vid.calibration_quality || 'OK'})` : 'UNCALIBRATED'}
                    </span>
                  </div>

                  <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-mono text-white px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs">
                    <span>{vid.width}x{vid.height}</span>
                    <span>•</span>
                    <span>{vid.fps} FPS</span>
                  </div>
                </div>

                {/* Video Info Content */}
                <div className="p-4 flex flex-col gap-2.5">
                  <div className="flex flex-col">
                    <h4 className="text-sm font-semibold text-on-surface truncate">
                      {vid.title}
                    </h4>
                    <span className="text-xs font-mono text-on-surface-variant truncate">
                      {vid.original_filename}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-outline-variant/60 text-[11px] font-mono text-on-surface-variant">
                    <div>
                      <span className="text-[9px] uppercase block">Frames</span>
                      <span className="font-semibold text-on-surface">{vid.frame_count}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase block">Size</span>
                      <span className="font-semibold text-on-surface">{(vid.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase block">RMSE</span>
                      <span className="font-semibold text-on-surface">
                        {vid.reprojection_rmse_m !== null && vid.reprojection_rmse_m !== undefined
                          ? `${vid.reprojection_rmse_m}m`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <button
                      onClick={() => onSelectVideo(vid.id, 'calibration')}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-primary">tune</span>
                      <span>Calibrate GCP</span>
                    </button>

                    <button
                      onClick={() => onSelectVideo(vid.id, 'regions')}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-primary">polyline</span>
                      <span>Draw Regions</span>
                    </button>

                    <button
                      onClick={() => onSelectVideo(vid.id, 'processing')}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-primary text-white font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">play_arrow</span>
                      <span>Process Video</span>
                    </button>

                    <button
                      onClick={() => onSelectVideo(vid.id, 'analysis')}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-surface-container-high hover:bg-primary hover:text-white text-on-surface font-semibold transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">insights</span>
                      <span>View Analytics</span>
                    </button>
                  </div>
                </div>

                {/* Footer Delete Action */}
                <div className="px-4 py-2 bg-surface-container-low border-t border-outline-variant flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                  <span>ID: {vid.id}</span>
                  <button
                    onClick={(e) => handleDelete(e, vid.id)}
                    className="text-on-surface-variant hover:text-danger flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
