import React, { useState, useEffect } from 'react';
import { StudioVideo, ProcessingJob } from '../../types/videoIntelligence';
import {
  startProcessingJob,
  fetchProjectJobs,
  pauseJob,
  resumeJob,
  cancelJob,
} from '../../services/videoIntelligenceApi';

interface ProcessingCenterProps {
  projectId: string;
  videos: StudioVideo[];
  onRefresh: () => void;
  onNavigateToAnalysis: (videoId: string) => void;
}

export const ProcessingCenter: React.FC<ProcessingCenterProps> = ({
  projectId,
  videos,
  onRefresh,
  onNavigateToAnalysis,
}) => {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>(videos[0]?.id || '');
  const [isLoading, setIsLoading] = useState(true);

  // Job Config State
  const [confThreshold, setConfThreshold] = useState(0.35);
  const [iouThreshold, setIouThreshold] = useState(0.45);
  const [frameStep, setFrameStep] = useState(1);
  const [maxFrames, setMaxFrames] = useState<number | ''>('');
  const [genAnnotated, setGenAnnotated] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  // Poll jobs
  const loadJobs = async () => {
    try {
      const res = await fetchProjectJobs(projectId);
      setJobs(res.jobs || []);
    } catch (err) {
      console.error('Failed to load processing jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 2000); // 2-second real polling
    return () => clearInterval(interval);
  }, [projectId]);

  const handleStartJob = async () => {
    if (!selectedVideoId) return;
    setIsStarting(true);
    try {
      await startProcessingJob(selectedVideoId, {
        confidence_threshold: confThreshold,
        iou_threshold: iouThreshold,
        frame_step: frameStep,
        max_frames: maxFrames ? Number(maxFrames) : null,
        generate_annotated_video: genAnnotated,
      });
      loadJobs();
      onRefresh();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to start processing job.');
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async (jobId: string) => {
    await pauseJob(jobId);
    loadJobs();
  };

  const handleResume = async (jobId: string) => {
    await resumeJob(jobId);
    loadJobs();
  };

  const handleCancel = async (jobId: string) => {
    if (confirm('Cancel this processing job?')) {
      await cancelJob(jobId);
      loadJobs();
    }
  };

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="p-4 rounded bg-surface border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary/10 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[20px]">precision_manufacturing</span>
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold text-on-surface">Video Analytics Processing Center</h2>
            <span className="text-xs text-on-surface-variant font-mono">
              YOLOv8 Multi-Vehicle Detection • Kalman Tracking • Ground Projection • Trajectory Extraction
            </span>
          </div>
        </div>

        <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
          Active Jobs: {jobs.filter((j) => j.status === 'RUNNING').length}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Launch Job Config Panel (4 cols) */}
        <div className="lg:col-span-4 p-4 rounded bg-surface border border-outline-variant flex flex-col gap-4 shadow-subtle">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
            <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider">
              Configure New Processing Run
            </h3>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <label className="font-semibold text-on-surface">Target Camera / Video</label>
            <select
              value={selectedVideoId}
              onChange={(e) => setSelectedVideoId(e.target.value)}
              className="px-2.5 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary text-xs"
            >
              {videos.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.camera_id} • {v.title} ({v.duration_seconds}s)
                </option>
              ))}
            </select>
          </div>

          {selectedVideo && (
            <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/60 flex flex-col gap-1 text-[11px] font-mono text-on-surface-variant">
              <div className="flex justify-between">
                <span>Resolution:</span>
                <span className="font-semibold text-on-surface">{selectedVideo.width}x{selectedVideo.height}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Frames:</span>
                <span className="font-semibold text-on-surface">{selectedVideo.frame_count}</span>
              </div>
              <div className="flex justify-between">
                <span>Homography:</span>
                <span className={`font-semibold ${selectedVideo.is_calibrated ? 'text-success' : 'text-warning'}`}>
                  {selectedVideo.is_calibrated ? 'Committed' : 'Uncalibrated (Pixel Only)'}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <label className="font-semibold text-on-surface">Confidence Threshold</label>
                <span className="font-mono text-primary font-bold">{confThreshold}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                className="accent-primary"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px]">
                <label className="font-semibold text-on-surface">IoU Association Threshold</label>
                <span className="font-mono text-primary font-bold">{iouThreshold}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={iouThreshold}
                onChange={(e) => setIouThreshold(parseFloat(e.target.value))}
                className="accent-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface text-[11px]">Frame Step</label>
                <select
                  value={frameStep}
                  onChange={(e) => setFrameStep(parseInt(e.target.value) || 1)}
                  className="px-2 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface text-xs"
                >
                  <option value={1}>1 (All Frames)</option>
                  <option value={2}>2 (Skip 1 frame)</option>
                  <option value={3}>3 (Skip 2 frames)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface text-[11px]">Max Frames (Optional)</label>
                <input
                  type="number"
                  placeholder="Full Video"
                  value={maxFrames}
                  onChange={(e) => setMaxFrames(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="px-2 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface text-xs font-mono"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-[11px] font-medium text-on-surface cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={genAnnotated}
                onChange={(e) => setGenAnnotated(e.target.checked)}
                className="accent-primary"
              />
              <span>Generate Annotated Video Export (MP4)</span>
            </label>
          </div>

          <button
            onClick={handleStartJob}
            disabled={isStarting || !selectedVideoId}
            className="mt-2 flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-primary text-white font-semibold text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isStarting && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            <span>Launch Processing Pipeline</span>
          </button>
        </div>

        {/* Right: Active Processing Queue (8 cols) */}
        <div className="lg:col-span-8 p-4 rounded bg-surface border border-outline-variant flex flex-col gap-4 shadow-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-on-surface uppercase font-mono tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">queue</span>
              Active Processing Queue & History
            </h3>
            <span className="text-[10px] font-mono text-on-surface-variant">Live Real-Time Telemetry</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-on-surface-variant font-mono">Loading job monitor...</div>
          ) : jobs.length === 0 ? (
            <div className="p-12 rounded border border-dashed border-outline-variant bg-surface-container-low text-center flex flex-col items-center">
              <span className="material-symbols-outlined text-[36px] text-on-surface-variant">history_toggle_off</span>
              <span className="text-xs font-semibold text-on-surface mt-1">No jobs queued or processed</span>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Select a video and launch processing to extract trajectory datasets.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto">
              {jobs.map((job) => {
                const isRunning = job.status === 'RUNNING';
                const isCompleted = job.status === 'COMPLETED';
                const isPaused = job.status === 'PAUSED';
                const isFailed = job.status === 'FAILED';

                return (
                  <div
                    key={job.id}
                    className="p-3.5 rounded bg-surface-container-low border border-outline-variant flex flex-col gap-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                          {job.id}
                        </span>
                        <span className="font-semibold text-on-surface truncate">
                          {job.video_title || `Video ${job.video_id}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase ${
                            isRunning
                              ? 'bg-primary/10 text-primary border-primary/30 animate-pulse'
                              : isCompleted
                              ? 'bg-success/10 text-success border-success/30'
                              : isPaused
                              ? 'bg-warning/10 text-warning border-warning/30'
                              : isFailed
                              ? 'bg-danger/10 text-danger border-danger/30'
                              : 'bg-surface-container-high text-on-surface-variant border-outline-variant'
                          }`}
                        >
                          {job.status}
                        </span>

                        {isCompleted && (
                          <button
                            onClick={() => onNavigateToAnalysis(job.video_id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-white text-[11px] font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                          >
                            <span>Inspect Analysis</span>
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant">
                        <span>
                          Frames: <strong className="text-on-surface">{job.current_frame}</strong> / {job.total_frames || '—'}
                        </span>
                        <span className="font-bold text-on-surface">{job.progress_percent.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 rounded bg-surface-container-highest overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted ? 'bg-success' : isFailed ? 'bg-danger' : 'bg-primary'
                          }`}
                          style={{ width: `${job.progress_percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Telemetry Numbers & Controls */}
                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant/60 font-mono text-[11px] text-on-surface-variant">
                      <div className="flex items-center gap-3">
                        <span>Processing Speed: <strong className="text-on-surface">{job.processing_fps} FPS</strong></span>
                        {job.eta_seconds !== undefined && job.eta_seconds > 0 && isRunning && (
                          <span>ETA: <strong className="text-on-surface">{job.eta_seconds}s</strong></span>
                        )}
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1 font-sans">
                        {isRunning && (
                          <button
                            onClick={() => handlePause(job.id)}
                            className="px-2 py-0.5 rounded bg-surface border border-outline-variant text-[11px] hover:bg-surface-container"
                          >
                            Pause
                          </button>
                        )}
                        {isPaused && (
                          <button
                            onClick={() => handleResume(job.id)}
                            className="px-2 py-0.5 rounded bg-surface border border-outline-variant text-[11px] hover:bg-surface-container text-primary font-semibold"
                          >
                            Resume
                          </button>
                        )}
                        {(isRunning || isPaused) && (
                          <button
                            onClick={() => handleCancel(job.id)}
                            className="px-2 py-0.5 rounded bg-surface border border-outline-variant text-[11px] hover:bg-danger/10 text-danger"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {job.error_message && (
                      <div className="p-2 rounded bg-danger/10 border border-danger/30 text-danger text-[11px] font-mono">
                        {job.error_message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
