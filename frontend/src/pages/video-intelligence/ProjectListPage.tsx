import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StudioProject } from '../../types/videoIntelligence';
import { fetchProjects, createProject, deleteProject } from '../../services/videoIntelligenceApi';

export const ProjectListPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal form state: ONLY Project name and Description as required
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');

  // Project Delete Confirmation State
  const [projectToDelete, setProjectToDelete] = useState<StudioProject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetchProjects();
      setProjects(res.projects || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await createProject({
        name: projectName.trim(),
        description: description.trim(),
      });
      setIsModalOpen(false);
      setProjectName('');
      setDescription('');
      // Redirect directly to its workspace
      navigate(`/video-intelligence/projects/${res.project_id}`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to create project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProjectConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setProjectToDelete(null);
      await loadProjects();
    } catch (err: any) {
      console.error('Failed to delete project', err);
      setErrorMsg(err?.response?.data?.detail || 'Failed to delete project.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto flex flex-col w-full max-w-[1400px] gap-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded bg-surface border border-outline-variant shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded bg-primary text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[24px]">folder_special</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-on-surface tracking-tight">Video Intelligence Projects</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Select an existing traffic surveillance project or initialize a new analysis workspace.
            </p>
          </div>
        </div>

        {/* Large Prominent Create New Project Button */}
        <button
          id="btn-create-new-project"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all shadow-sm hover:shadow cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Create New Project</span>
        </button>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-[36px] text-primary">progress_activity</span>
          <span className="mt-3 text-xs font-mono">Loading projects...</span>
        </div>
      ) : projects.length === 0 ? (
        /* Clean Empty State */
        <div className="flex flex-col items-center justify-center p-16 rounded border-2 border-dashed border-outline-variant bg-surface-container-low text-center">
          <div className="w-14 h-14 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[32px]">folder_open</span>
          </div>
          <h2 className="text-sm font-semibold text-on-surface">No Projects Available</h2>
          <p className="text-xs text-on-surface-variant mt-1 max-w-sm">
            You have not created any traffic video intelligence projects yet. Get started by creating your first project.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create New Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <div
              key={project.id}
              className="p-5 rounded bg-surface border border-outline-variant hover:border-primary/50 transition-all flex flex-col justify-between gap-4 shadow-subtle hover:shadow-md"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-on-surface tracking-tight line-clamp-1">
                    {project.name}
                  </h3>
                </div>

                <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed min-h-[32px]">
                  {project.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-on-surface-variant pt-2 border-t border-outline-variant/60">
                  <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                  <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Actions: Delete Project and Open Project Buttons */}
              <div className="pt-3 border-t border-outline-variant flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setProjectToDelete(project);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-error hover:bg-error-container/20 text-xs font-medium transition-colors cursor-pointer"
                  title={`Delete ${project.name}`}
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Delete</span>
                </button>

                <button
                  onClick={() => navigate(`/video-intelligence/projects/${project.id}`)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded bg-surface-container-high hover:bg-primary hover:text-white text-on-surface text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Open Project</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Project Deletion */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-lg bg-surface border border-outline-variant p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h2 className="text-base font-bold text-on-surface">Confirm Project Deletion</h2>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to permanently delete project{' '}
              <strong className="text-on-surface font-semibold">{projectToDelete.name}</strong>? All associated videos,
              calibrations, trajectories, and analytical records will be permanently removed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs text-on-surface hover:bg-surface-container rounded border border-outline-variant transition-colors cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProjectConfirm}
                disabled={isDeleting}
                className="px-4 py-1.5 text-xs font-bold bg-error hover:bg-red-700 text-white rounded transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Delete Project</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small Create Project Modal - Exactly 2 Fields */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-surface border border-outline-variant rounded shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="h-12 px-5 flex items-center justify-between border-b border-outline-variant bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">create_new_folder</span>
                <h3 className="text-sm font-semibold text-on-surface">Create Project</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-5 flex flex-col gap-4 text-xs">
              {errorMsg && (
                <div className="p-2.5 rounded bg-danger/10 border border-danger/30 text-danger flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Field 1: Project Name (Required) */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter project name..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary text-xs"
                />
              </div>

              {/* Field 2: Description (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-on-surface">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Enter project description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="px-3 py-2 bg-surface-container-low border border-outline-variant rounded text-on-surface focus:outline-none focus:border-primary text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-outline-variant mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-outline-variant text-on-surface hover:bg-surface-container cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !projectName.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-primary text-white font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                  <span>Create Project</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
