import React, { useState } from 'react';
import { StudioProject } from '../../types/videoIntelligence';
import { createProject, deleteProject } from '../../services/videoIntelligenceApi';

interface ProjectWorkspaceProps {
  projects: StudioProject[];
  onSelectProject: (projectId: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  projects,
  onSelectProject,
  onRefresh,
  isLoading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: 'GSV Campus Gateway Corridor',
    city: 'Vadodara',
    state: 'Gujarat',
    country: 'India',
    road_name: 'Lalbaug Main Arterial Road',
    latitude: 22.3072,
    longitude: 73.1812,
    crs: 'EPSG:32643 (WGS 84 / UTM Zone 43N)',
  });

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.road_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createProject(formData);
      setIsModalOpen(false);
      setFormData({
        name: '',
        description: '',
        location: 'GSV Campus Gateway Corridor',
        city: 'Vadodara',
        state: 'Gujarat',
        country: 'India',
        road_name: 'Lalbaug Main Arterial Road',
        latitude: 22.3072,
        longitude: 73.1812,
        crs: 'EPSG:32643 (WGS 84 / UTM Zone 43N)',
      });
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project? All associated video calibration and analytics data will be removed.')) {
      try {
        await deleteProject(projectId);
        onRefresh();
      } catch (_err) {
        alert('Failed to delete project.');
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded bg-surface border border-outline-variant">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">folder_special</span>
            <h2 className="text-base font-semibold text-on-surface">Traffic Video Analysis Projects</h2>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant border border-outline-variant">
              {projects.length} Workspaces
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Geospatial project environments containing calibrated CCTV camera feeds, measurement regions, and trajectory datasets.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Filter by name, road, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Create Project
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
          <span className="mt-3 text-xs font-mono">Loading studio workspaces...</span>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded border border-dashed border-outline-variant text-center bg-surface-container-low">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant">folder_off</span>
          <h3 className="text-sm font-semibold text-on-surface mt-2">No projects found</h3>
          <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
            {searchQuery ? 'No projects match your search query.' : 'Create your first project to start calibrating traffic video cameras.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-white text-xs font-semibold hover:bg-primary/90 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Create New Project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="group p-4 rounded bg-surface border border-outline-variant hover:border-primary/60 transition-all duration-150 cursor-pointer flex flex-col justify-between gap-4 shadow-subtle hover:shadow-md"
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-mono uppercase font-semibold text-primary tracking-wider">
                      {project.id}
                    </span>
                    <h3 className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/30 font-semibold shrink-0">
                    {project.status}
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                  {project.description || 'Multimodal traffic video survey and road density analysis testbed.'}
                </p>

                <div className="flex flex-col gap-1 text-[11px] text-on-surface-variant pt-2 border-t border-outline-variant/60">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-primary">pin_drop</span>
                    <span className="truncate text-on-surface font-medium">{project.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">edit_road</span>
                    <span className="truncate">{project.road_name}, {project.city}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="material-symbols-outlined text-[14px]">public</span>
                    <span>{project.latitude.toFixed(4)}° N, {project.longitude.toFixed(4)}° E ({project.crs})</span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-mono text-[11px] text-on-surface">
                    <span className="material-symbols-outlined text-[15px] text-primary">videocam</span>
                    {project.video_count} {project.video_count === 1 ? 'Camera' : 'Cameras'}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-success font-medium">
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    {project.analyzed_count} Analyzed
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="p-1 rounded text-on-surface-variant hover:text-danger hover:bg-danger/10 transition-colors"
                    title="Delete Project"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                  <button
                    onClick={() => onSelectProject(project.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-high hover:bg-primary hover:text-white text-on-surface text-[11px] font-semibold transition-colors"
                  >
                    <span>Open</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl bg-surface border border-outline-variant rounded shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-12 px-5 flex items-center justify-between border-b border-outline-variant bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">create_new_folder</span>
                <h3 className="text-sm font-semibold text-on-surface">Create Traffic Analysis Project</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 text-xs">
              {errorMessage && (
                <div className="p-2.5 rounded bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GSV Central Junction Video Intelligence"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Description</label>
                <textarea
                  rows={2}
                  placeholder="Multimodal traffic monitoring testbed..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface">Location / Intersection</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface">Road / Highway Name</label>
                  <input
                    type="text"
                    value={formData.road_name}
                    onChange={(e) => setFormData({ ...formData, road_name: e.target.value })}
                    className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface font-mono text-[11px]">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-1.5 font-mono bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface font-mono text-[11px]">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-1.5 font-mono bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Spatial Coordinate Reference System (CRS)</label>
                <input
                  type="text"
                  value={formData.crs}
                  onChange={(e) => setFormData({ ...formData, crs: e.target.value })}
                  className="px-3 py-1.5 font-mono bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-outline-variant text-on-surface hover:bg-surface-container cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                  <span>Initialize Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
