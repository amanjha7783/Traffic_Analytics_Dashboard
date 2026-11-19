import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProcessingJob, StudioVideo } from '../../types/videoIntelligence';
import {
  fetchJobStatus,
  cancelJob,
  startProcessingJob,
  fetchVideoDetails,
} from '../../services/videoIntelligenceApi';

export const VideoProcessingPage: React.FC = () => {
  const { projectId, videoId, jobId } = useParams<{
    projectId: string;
    videoId: string;
    jobId: string;
  }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [video, setVideo] = useState<StudioVideo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [autoRedirectCounter, setAutoRedirectCounter] = useState<number | null>(null);

  const pollIntervalRef = useRef<any>(null);

  // Load video details
  useEffect(() => {
    if (videoId) {
      fetchVideoDetails(videoId)
        .then(setVideo)
        .catch((_err) => console.error('Failed to load video details', _err));
    }
  }, [videoId]);

  // Poll job status every 1 second
  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const jobData = await fetchJobStatus(jobId);
        setJob(jobData);

        if (jobData.status === 'COMPLETED') {
          clearInterval(pollIntervalRef.current);
          setAutoRedirectCounter(2);
        } else if (jobData.status === 'FAILED' || jobData.status === 'CANCELLED') {
          clearInterval(pollIntervalRef.current);
        }
      } catch (err: any) {
        console.error('Error polling job status:', err);
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [jobId]);

  // Auto-redirect countdown once completed
  useEffect(() => {
    if (autoRedirectCounter === null) return;

    if (autoRedirectCounter <= 0) {
      navigate(`/video-intelligence/projects/${projectId}/videos/${videoId}/analytics`);
      return;
    }

    const timer = setTimeout(() => {
      setAutoRedirectCounter((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoRedirectCounter, projectId, videoId, navigate]);

  const handleCancel = async () => {
    if (!jobId) return;
    setIsCancelling(true);
    try {
      await cancelJob(jobId);
      const updated = await fetchJobStatus(jobId);
      setJob(updated);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to cancel job');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetry = async () => {
    if (!videoId || !projectId) return;
    setIsRetrying(true);
    setErrorMsg(null);
    try {
      const res = await startProcessingJob(videoId, {
        confidence_threshold: 0.35,
        iou_threshold: 0.45,
        frame_step: 1,
        generate_annotated_video: true,
      });
      navigate(`/video-intelligence/projects/${projectId}/videos/${videoId}/processing/${res.job_id}`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to restart processing');
      setIsRetrying(false);
    }
  };

  const progressPercent = job ? Math.min(100, Math.max(0, Math.round(job.progress_percent || 0))) : 0;
  const currentFrame = job?.current_frame || 0;
  const totalFrames = job?.total_frames || video?.total_frames || (video as any)?.frame_count || 0;
  const processingFps = job?.processing_fps || 0;
  const status = job?.status || 'PENDING';

  // Dynamic ETA calculation from FPS and remaining frames
  const remainingFrames = Math.max(0, totalFrames - currentFrame);
  const calculatedEta = processingFps > 0 && remainingFrames > 0 ? remainingFrames / processingFps : null;
  const etaSec = job?.eta_seconds !== undefined && job.eta_seconds > 0 ? job.eta_seconds : calculatedEta;

  // Determine stage description
  let currentStage = 'Initializing neural network & tracker...';
  if (status === 'PENDING' || job?.processing_stage === 'QUEUED') {
    currentStage = 'Waiting in queue for processing slot...';
  } else if (job?.processing_stage === 'INITIALIZING') {
    currentStage = 'Initializing neural network, codecs & tracker...';
  } else if (progressPercent > 0 && progressPercent < 70) {
    currentStage = 'YOLOv8 Object Detection & ByteTrack Kalman Filtering';
  } else if (progressPercent >= 70 && progressPercent < 90) {
    currentStage = 'Geospatial Homography Projection & Velocity Estimation';
  } else if (progressPercent >= 90 && progressPercent < 100) {
    currentStage = 'Annotated Video Rendering & Trajectory CSV Export';
  } else if (status === 'COMPLETED') {
    currentStage = 'All algorithms completed successfully.';
  } else if (status === 'CANCELLED') {
    currentStage = 'Processing cancelled.';
  } else if (status === 'FAILED') {
    currentStage = `Processing failed: ${job?.error_message || 'Unknown error'}`;
  }

  return (
    <div className="mx-auto flex flex-col w-full max-w-[1000px] gap-6 py-6 px-4">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between border-b border-outline-variant pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/video-intelligence/projects/${projectId}`)}
            className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Back to Project Workspace"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <div className="text-[10px] font-mono uppercase text-primary font-bold">Step 3: Background Intelligence Engine</div>
            <h1 className="text-lg font-bold text-on-surface tracking-tight">
              {video?.title || video?.original_filename || 'Video Processing'}
            </h1>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-mono text-on-surface-variant">Job ID: {jobId?.slice(0, 8)}...</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-error-container/20 border border-error text-error text-xs rounded flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Progress Card */}
      <div className="p-8 rounded-lg bg-surface border border-outline-variant shadow-sm flex flex-col gap-6">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {status === 'RUNNING' && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            )}
            {status === 'COMPLETED' && (
              <span className="material-symbols-outlined text-green-500 text-[22px]">check_circle</span>
            )}
            {status === 'FAILED' && (
              <span className="material-symbols-outlined text-error text-[22px]">error</span>
            )}
            {status === 'CANCELLED' && (
              <span className="material-symbols-outlined text-on-surface-variant text-[22px]">cancel</span>
            )}
            <span className="text-sm font-bold tracking-wider font-mono uppercase text-on-surface">
              {status === 'RUNNING' ? 'Processing Video' : status}
            </span>
          </div>

          <div className="text-right">
            <span className="text-3xl font-mono font-bold text-on-surface">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-container-highest rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              status === 'COMPLETED'
                ? 'bg-green-500'
                : status === 'FAILED'
                ? 'bg-error'
                : 'bg-primary'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Current Stage Indicator */}
        <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant bg-surface-container-low px-4 py-2.5 rounded border border-outline-variant">
          <span className="material-symbols-outlined text-[16px] text-primary animate-spin">
            sync
          </span>
          <span className="text-on-surface font-medium">Stage:</span>
          <span>{currentStage}</span>
        </div>

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="p-4 rounded bg-surface-container-low border border-outline-variant flex flex-col">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Frames</span>
            <span className="text-base font-bold font-mono text-on-surface mt-1">
              {currentFrame.toLocaleString()} / {totalFrames.toLocaleString()}
            </span>
          </div>

          <div className="p-4 rounded bg-surface-container-low border border-outline-variant flex flex-col">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Processing Speed</span>
            <span className="text-base font-bold font-mono text-on-surface mt-1">
              {processingFps.toFixed(1)} FPS
            </span>
          </div>

          <div className="p-4 rounded bg-surface-container-low border border-outline-variant flex flex-col">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">ETA Remaining</span>
            <span className="text-base font-bold font-mono text-on-surface mt-1">
              {etaSec !== null && etaSec > 0
                ? `${Math.floor(etaSec / 60)}m ${Math.floor(etaSec % 60)}s`
                : status === 'COMPLETED'
                ? '0s'
                : 'Calculating...'}
            </span>
          </div>

          <div className="p-4 rounded bg-surface-container-low border border-outline-variant flex flex-col">
            <span className="text-[10px] uppercase font-mono text-on-surface-variant">Algorithm</span>
            <span className="text-base font-bold font-mono text-primary mt-1">
              YOLOv8 + ByteTrack
            </span>
          </div>
        </div>

        {/* Failure Details */}
        {status === 'FAILED' && job?.error_message && (
          <div className="p-4 bg-error-container/20 border border-error text-error text-xs rounded-md">
            <div className="font-bold mb-1">Execution Error Details:</div>
            <pre className="font-mono whitespace-pre-wrap">{job.error_message}</pre>
          </div>
        )}

        {/* Auto Redirect Alert */}
        {autoRedirectCounter !== null && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded flex items-center justify-between text-xs text-green-400">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Processing complete! Redirecting to Analytics in {autoRedirectCounter}s...</span>
            </div>
            <button
              onClick={() =>
                navigate(`/video-intelligence/projects/${projectId}/videos/${videoId}/analytics`)
              }
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-xs transition-colors cursor-pointer"
            >
              Open Now
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-outline-variant">
          <div>
            {status === 'RUNNING' && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-4 py-2 border border-outline-variant text-on-surface-variant hover:text-error hover:border-error rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Processing'}
              </button>
            )}
            {(status === 'FAILED' || status === 'CANCELLED') && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">replay</span>
                <span>{isRetrying ? 'Starting Retry...' : 'Retry Processing'}</span>
              </button>
            )}
          </div>

          <div>
            {status === 'COMPLETED' && (
              <button
                onClick={() =>
                  navigate(`/video-intelligence/projects/${projectId}/videos/${videoId}/analytics`)
                }
                className="px-5 py-2 bg-primary hover:bg-primary-hover text-on-primary rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
              >
                <span>View Analytics</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
