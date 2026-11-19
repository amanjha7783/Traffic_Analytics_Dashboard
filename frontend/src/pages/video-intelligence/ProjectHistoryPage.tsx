import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudioVideo, StudioProject } from '../../types/videoIntelligence';
import {
  fetchProjectDetails,
  fetchProjectVideos,
  deleteVideo,
  startProcessingJob,
  getAnnotatedVideoStreamUrl,
  getTrajectoriesCsvUrl,
} from '../../services/videoIntelligenceApi';

export const ProjectHistoryPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<StudioProject | null>(null);
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoToDelete, setVideoToDelete] = useState<StudioVideo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const loadData = async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const [projData, vidsData] = await Promise.all([
        fetchProjectDetails(projectId),
        fetchProjectVideos(projectId),
      ]);
      setProject(projData);
      setVideos(vidsData.videos);
    } catch (err: any) {
      console.error('Failed to load project history', err);
      setErrorMsg(err?.response?.data?.detail || 'Failed to load project history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleDeleteConfirm = async () => {
    if (!videoToDelete) return;
    setIsDeleting(true);
    try {
      await deleteVideo(videoToDelete.id);
      setVideoToDelete(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to delete video.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = async (video: StudioVideo) => {
    if (!projectId) return;
    setRetryingId(video.id);
    try {
      const res = await startProcessingJob(video.id, {
        confidence_threshold: 0.35,
        iou_threshold: 0.45,
        frame_step: 1,
        generate_annotated_video: true,
      });
      navigate(`/video-intelligence/projects/${projectId}/videos/${video.id}/processing/${res.job_id}`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to retry video processing.');
      setRetryingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-on-surface-variant">
        <span className="material-symbols-outlined animate-spin text-[36px] text-primary">progress_activity</span>
        <span className="mt-3 text-xs font-mono">Loading project history & videos...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col w-full max-w-[1440px] gap-6 py-4 px-4 pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-outline-variant pb-4 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/video-intelligence/projects/${projectId}`)}
            className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Back to Project Workspace"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <div className="text-[10px] font-mono uppercase text-primary font-bold">Project History</div>
            <h1 className="text-lg font-bold text-on-surface tracking-tight">
              {project?.name || 'Project Videos & Analysis Logs'}
            </h1>
          </div>
        </div>

        <button
          onClick={() => navigate(`/video-intelligence/projects/${projectId}`)}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">upload_file</span>
          <span>Upload Another Video</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-error-container/20 border border-error text-error text-xs rounded flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Video Table */}
      <div className="p-4 rounded-lg bg-surface border border-outline-variant flex flex-col gap-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-on-surface-variant">
                <th className="py-2.5 px-3 font-semibold">Video Name</th>
                <th className="py-2.5 px-3 font-semibold">Upload Date</th>
                <th className="py-2.5 px-3 font-semibold">Processing Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[36px] text-outline-variant block mb-2">videocam_off</span>
                    <span>No videos uploaded in this project yet.</span>
                  </td>
                </tr>
              ) : (
                videos.map((vid) => {
                  const isAnalyzed = vid.status?.toLowerCase() === 'analyzed' || vid.status === 'COMPLETED';
                  const isProcessing = vid.status === 'PROCESSING' || vid.status === 'RUNNING';
                  const isFailed = vid.status === 'FAILED';

                  return (
                    <tr
                      key={vid.id}
                      className="border-b border-outline-variant/40 hover:bg-surface-container-low transition-colors text-on-surface"
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-on-surface">{vid.title || vid.original_filename}</div>
                        {vid.title && vid.title !== vid.original_filename && (
                          <div className="text-[10px] text-on-surface-variant font-mono">{vid.original_filename}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-on-surface-variant">{formatDate(vid.created_at)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isAnalyzed
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isProcessing
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse'
                              : isFailed
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {isAnalyzed ? 'ANALYZED' : vid.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {isAnalyzed ? (
                            <>
                              {/* View Analytics Dashboard */}
                              <button
                                onClick={() =>
                                  navigate(`/video-intelligence/projects/${projectId}/videos/${vid.id}/analytics`)
                                }
                                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                                title="Open Full Analytics Dashboard"
                              >
                                <span className="material-symbols-outlined text-[16px]">analytics</span>
                                <span>Analytics Dashboard</span>
                              </button>

                              {/* Download Annotated Video */}
                              <a
                                href={getAnnotatedVideoStreamUrl(vid.id)}
                                download={`${vid.title || 'annotated_video'}.mp4`}
                                className="px-2.5 py-1.5 border border-outline-variant hover:bg-surface-container text-on-surface rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                title="Download Annotated Video"
                              >
                                <span className="material-symbols-outlined text-[16px]">videocam</span>
                                <span>Annotated Video</span>
                              </a>

                              {/* Download CSV */}
                              <a
                                href={getTrajectoriesCsvUrl(vid.id)}
                                download={`trajectories_${vid.title || vid.id}.csv`}
                                className="px-2.5 py-1.5 border border-outline-variant hover:bg-surface-container text-on-surface rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                title="Download Trajectories CSV"
                              >
                                <span className="material-symbols-outlined text-[16px]">table_view</span>
                                <span>Download CSV</span>
                              </a>
                            </>
                          ) : isProcessing ? (
                            /* Monitor Processing */
                            <button
                              onClick={() =>
                                navigate(`/video-intelligence/projects/${projectId}/videos/${vid.id}/processing/${vid.id}`)
                              }
                              className="px-3 py-1.5 border border-primary/50 bg-primary/10 hover:bg-primary/20 text-primary rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 animate-pulse"
                              title="Monitor Processing Progress"
                            >
                              <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                              <span>Monitor Progress</span>
                            </button>
                          ) : (
                            /* Setup Calibration */
                            <button
                              onClick={() =>
                                navigate(`/video-intelligence/projects/${projectId}/videos/${vid.id}/setup`)
                              }
                              className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                              title="Calibrate and Start Processing"
                            >
                              <span className="material-symbols-outlined text-[16px]">tune</span>
                              <span>Setup Calibration</span>
                            </button>
                          )}

                          {/* Retry (if failed) */}
                          {isFailed && (
                            <button
                              onClick={() => handleRetry(vid)}
                              disabled={retryingId === vid.id}
                              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-[16px]">replay</span>
                              <span>{retryingId === vid.id ? 'Retrying...' : 'Retry'}</span>
                            </button>
                          )}

                          {/* Delete Video */}
                          <button
                            onClick={() => setVideoToDelete(vid)}
                            className="p-1.5 text-on-surface-variant hover:text-error hover:bg-surface-container rounded transition-colors cursor-pointer ml-1"
                            title="Delete Video"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Delete */}
      {videoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg bg-surface border border-outline-variant p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h2 className="text-base font-bold text-on-surface">Confirm Video Deletion</h2>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-on-surface">{videoToDelete.title || videoToDelete.original_filename}</strong>? All
              extracted frames, calibration points, tracked trajectories, and generated videos will be removed from this project.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVideoToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs text-on-surface hover:bg-surface-container rounded border border-outline-variant transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold bg-error hover:bg-red-700 text-white rounded transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
