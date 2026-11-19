import React, { useState, useEffect } from 'react';
import { StudioProject, StudioVideo } from '../types/videoIntelligence';
import { fetchProjects, fetchProjectVideos } from '../services/videoIntelligenceApi';

import { ProjectWorkspace } from '../components/video-intelligence/ProjectWorkspace';
import { ProjectOverview } from '../components/video-intelligence/ProjectOverview';
import { VideoLibrary } from '../components/video-intelligence/VideoLibrary';
import { CalibrationStudio } from '../components/video-intelligence/CalibrationStudio';
import { RegionMeasurement } from '../components/video-intelligence/RegionMeasurement';
import { ProcessingCenter } from '../components/video-intelligence/ProcessingCenter';
import { IndividualVideoAnalysis } from '../components/video-intelligence/IndividualVideoAnalysis';
import { MultiCameraComparison } from '../components/video-intelligence/MultiCameraComparison';
import { ExportCenter } from '../components/video-intelligence/ExportCenter';

export type StudioSection =
  | 'projects'
  | 'project-overview'
  | 'video-library'
  | 'calibration'
  | 'regions'
  | 'processing'
  | 'analysis'
  | 'compare'
  | 'exports';

interface WorkflowTab {
  id: StudioSection;
  label: string;
  icon: string;
  badge?: string;
  requiresProject?: boolean;
  requiresVideo?: boolean;
}

export const VideoIntelligenceStudio: React.FC = () => {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('proj-gsv-pilot-01');
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string>('');
  const [currentSection, setCurrentSection] = useState<StudioSection>('project-overview');
  const [isLoading, setIsLoading] = useState(true);

  // Load projects
  const loadProjects = async () => {
    try {
      const res = await fetchProjects();
      setProjects(res.projects || []);
      if (!activeProjectId && res.projects && res.projects.length > 0) {
        setActiveProjectId(res.projects[0].id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load project videos
  const loadVideos = async (pId: string) => {
    if (!pId) return;
    try {
      const res = await fetchProjectVideos(pId);
      setVideos(res.videos || []);
      if (!activeVideoId && res.videos && res.videos.length > 0) {
        setActiveVideoId(res.videos[0].id);
      } else if (res.videos && !res.videos.some((v) => v.id === activeVideoId)) {
        setActiveVideoId(res.videos[0]?.id || '');
      }
    } catch (err) {
      console.error('Failed to load project videos:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      loadVideos(activeProjectId);
    }
  }, [activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeVideo = videos.find((v) => v.id === activeVideoId) || videos[0];

  const workflowTabs: WorkflowTab[] = [
    { id: 'projects', label: 'Projects Workspace', icon: 'folder_special' },
    { id: 'project-overview', label: 'Project Details', icon: 'dashboard', requiresProject: true },
    { id: 'video-library', label: 'Video Library', icon: 'video_library', requiresProject: true },
    { id: 'calibration', label: 'Video Calibration', icon: 'tune', requiresProject: true, requiresVideo: true },
    { id: 'regions', label: 'Region Measurement', icon: 'polyline', requiresProject: true, requiresVideo: true },
    { id: 'processing', label: 'Processing Center', icon: 'precision_manufacturing', requiresProject: true },
    { id: 'analysis', label: 'Individual Analysis', icon: 'insights', requiresProject: true, requiresVideo: true },
    { id: 'compare', label: 'Multi-Camera Compare', icon: 'view_column', requiresProject: true },
    { id: 'exports', label: 'Export Center', icon: 'download_for_offline', requiresProject: true },
  ];

  return (
    <div className="mx-auto flex flex-col w-full max-w-[1720px] gap-5 pb-12">
      {/* Top Studio Operational Bar */}
      <div className="p-3.5 rounded bg-surface border border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary text-white flex items-center justify-center font-bold shrink-0">
            <span className="material-symbols-outlined text-[20px]">smart_display</span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-on-surface tracking-tight">Video Intelligence Studio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant font-semibold">
                GSV Core
              </span>
            </div>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono">
              <span
                onClick={() => setCurrentSection('projects')}
                className="hover:text-primary cursor-pointer hover:underline"
              >
                Projects
              </span>
              <span>/</span>
              {activeProject ? (
                <span
                  onClick={() => setCurrentSection('project-overview')}
                  className="hover:text-primary cursor-pointer hover:underline text-on-surface font-semibold truncate max-w-[200px]"
                >
                  {activeProject.name}
                </span>
              ) : (
                <span>No Project</span>
              )}
              {activeVideo && ['calibration', 'regions', 'analysis'].includes(currentSection) && (
                <>
                  <span>/</span>
                  <span className="text-primary font-bold">{activeVideo.camera_id}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Global Selectors */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project Switcher */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-on-surface-variant">Project:</span>
            <select
              value={activeProjectId}
              onChange={(e) => {
                setActiveProjectId(e.target.value);
                setCurrentSection('project-overview');
              }}
              className="px-2.5 py-1 text-xs bg-surface-container-low border border-outline-variant rounded font-mono text-on-surface font-semibold max-w-[220px] truncate"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Active Camera Video Switcher */}
          {videos.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-on-surface-variant">Camera:</span>
              <select
                value={activeVideoId}
                onChange={(e) => setActiveVideoId(e.target.value)}
                className="px-2.5 py-1 text-xs bg-surface-container-low border border-outline-variant rounded font-mono text-on-surface font-semibold"
              >
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.camera_id} ({v.title.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Primary Workflow Horizontal Step Bar */}
      <div className="flex items-center gap-1 border-b border-outline-variant overflow-x-auto pb-1">
        {workflowTabs.map((tab) => {
          const isActive = currentSection === tab.id;
          const isDisabled = (tab.requiresProject && !activeProject) || (tab.requiresVideo && !activeVideo);

          return (
            <button
              key={tab.id}
              disabled={isDisabled}
              onClick={() => setCurrentSection(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-white shadow-xs'
                  : isDisabled
                  ? 'opacity-40 cursor-not-allowed text-on-surface-variant'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[9px] font-mono px-1 rounded uppercase ${isActive ? 'bg-white/20 text-white' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Render Active View Component */}
      <div>
        {currentSection === 'projects' && (
          <ProjectWorkspace
            projects={projects}
            onSelectProject={(pId) => {
              setActiveProjectId(pId);
              setCurrentSection('project-overview');
            }}
            onRefresh={loadProjects}
            isLoading={isLoading}
          />
        )}

        {currentSection === 'project-overview' && activeProject && (
          <ProjectOverview
            project={activeProject}
            videos={videos}
            onNavigateTab={(tab) => setCurrentSection(tab as StudioSection)}
            onSelectVideo={(vId) => {
              setActiveVideoId(vId);
              setCurrentSection('analysis');
            }}
          />
        )}

        {currentSection === 'video-library' && activeProject && (
          <VideoLibrary
            projectId={activeProject.id}
            videos={videos}
            onRefresh={() => loadVideos(activeProject.id)}
            onSelectVideo={(vId, targetSection) => {
              setActiveVideoId(vId);
              if (targetSection) {
                setCurrentSection(targetSection as StudioSection);
              } else {
                setCurrentSection('analysis');
              }
            }}
            isLoading={isLoading}
          />
        )}

        {currentSection === 'calibration' && activeProject && activeVideo && (
          <CalibrationStudio
            project={activeProject}
            video={activeVideo}
            onCalibrationSaved={() => loadVideos(activeProject.id)}
          />
        )}

        {currentSection === 'regions' && activeVideo && (
          <RegionMeasurement video={activeVideo} />
        )}

        {currentSection === 'processing' && activeProject && (
          <ProcessingCenter
            projectId={activeProject.id}
            videos={videos}
            onRefresh={() => loadVideos(activeProject.id)}
            onNavigateToAnalysis={(vId) => {
              setActiveVideoId(vId);
              setCurrentSection('analysis');
            }}
          />
        )}

        {currentSection === 'analysis' && activeProject && activeVideo && (
          <IndividualVideoAnalysis
            project={activeProject}
            video={activeVideo}
            onBack={() => setCurrentSection('video-library')}
          />
        )}

        {currentSection === 'compare' && activeProject && (
          <MultiCameraComparison
            project={activeProject}
            videos={videos}
          />
        )}

        {currentSection === 'exports' && activeProject && (
          <ExportCenter
            project={activeProject}
            videos={videos}
            onRefresh={() => loadVideos(activeProject.id)}
          />
        )}
      </div>
    </div>
  );
};
