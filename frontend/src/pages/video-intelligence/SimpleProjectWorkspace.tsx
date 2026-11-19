import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudioProject } from '../../types/videoIntelligence';
import { fetchProjectDetails, uploadVideo } from '../../services/videoIntelligenceApi';

export const SimpleProjectWorkspace: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<StudioProject | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetchProjectDetails(projectId)
      .then((data) => setProject(data))
      .catch((err) => {
        console.error('Failed to load project:', err);
        setErrorMsg('Failed to load project details.');
      })
      .finally(() => setIsLoading(false));
  }, [projectId]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const validExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(ext)) {
      setErrorMsg(`Invalid format '${ext}'. Supported formats: MP4, MOV, AVI, MKV`);
      return;
    }

    setSelectedFile(file);
    setErrorMsg(null);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !projectId) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('camera_id', 'CAM-01');
    formData.append('title', selectedFile.name);

    try {
      const res = await uploadVideo(projectId, formData, (percent) => {
        setUploadProgress(percent);
      });
      // Redirect to Video Setup Page
      const uploadedVideoId = res.video.id;
      navigate(`/video-intelligence/projects/${projectId}/videos/${uploadedVideoId}/setup`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to upload video stream.');
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-[36px] text-primary">progress_activity</span>
        <span className="mt-3 text-xs font-mono">Loading project workspace...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col w-full max-w-[1200px] gap-6 pb-12">
      {/* Top Bar: Project Name & History Button ONLY */}
      <div className="flex items-center justify-between p-4 rounded bg-surface border border-outline-variant shadow-subtle">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/video-intelligence')}
            className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Back to Projects"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <span className="text-[10px] font-mono uppercase text-on-surface-variant block">Active Project</span>
            <h1 className="text-base font-bold text-on-surface tracking-tight">
              {project?.name || 'Traffic Video Workspace'}
            </h1>
          </div>
        </div>

        {/* History Button on the Right Side */}
        <button
          id="btn-project-history"
          onClick={() => navigate(`/video-intelligence/projects/${projectId}/history`)}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold transition-all shadow-xs cursor-pointer border border-outline-variant"
        >
          <span className="material-symbols-outlined text-[16px] text-primary">history</span>
          <span>History</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Large Drag-and-Drop Video Upload Area */}
      <div className="p-8 rounded bg-surface border border-outline-variant flex flex-col gap-6 shadow-subtle">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFileSelect(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`p-12 rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[340px] ${
            isDragOver
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-outline-variant bg-surface-container-low hover:border-primary/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileSelect(e.target.files)}
            accept=".mp4,.mov,.avi,.mkv"
            className="hidden"
          />

          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[36px]">video_file</span>
          </div>

          <h3 className="text-base font-bold text-on-surface">Drag & Drop Traffic Video Here</h3>
          <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
            Supports CCTV recording files in MP4, MOV, AVI, or MKV format.
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold border border-outline-variant transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">folder_open</span>
            <span>Select Video</span>
          </button>
        </div>

        {/* Selected Video Info & Progress */}
        {selectedFile && (
          <div className="p-4 rounded bg-surface-container-low border border-outline-variant flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">movie</span>
                <span className="font-bold text-on-surface font-mono">{selectedFile.name}</span>
                <span className="text-on-surface-variant font-mono">
                  ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </span>
              </div>
              <span className="font-semibold text-success font-mono">
                {isUploading ? `Uploading ${uploadProgress}%` : 'Ready to Submit'}
              </span>
            </div>

            {isUploading && (
              <div className="w-full h-2 rounded bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
                className="px-4 py-2 rounded text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                Clear
              </button>

              <button
                type="button"
                id="btn-submit-video"
                onClick={handleSubmit}
                disabled={isUploading}
                className="flex items-center gap-2 px-6 py-2.5 rounded bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isUploading && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                <span>Submit Video</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
