import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { projectService } from '../services/projectService.js';

const STORAGE_KEY = 'kizumai_current_project_id';
const ProjectContext = createContext(null);

function readStoredId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeStoredId(id) {
  try {
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // ignore
  }
}

export function ProjectProvider({ children }) {
  const { isAuthenticated, isPaid } = useAuth();
  const [projects, setProjects] = useState([]);
  const [currentProjectId, setCurrentProjectIdState] = useState(readStoredId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setCurrentProjectId = useCallback((id) => {
    const next = id != null ? Number(id) : null;
    setCurrentProjectIdState(next);
    writeStoredId(next);
  }, []);

  const refreshProjects = useCallback(async () => {
    if (!isAuthenticated || !isPaid) {
      setProjects([]);
      setError('');
      return [];
    }
    setLoading(true);
    setError('');
    try {
      const data = await projectService.getMine();
      const list = Array.isArray(data) ? data : [];
      setProjects(list);

      const stored = readStoredId();
      const stillValid = stored && list.some((p) => Number(p.id) === Number(stored));
      if (stillValid) {
        setCurrentProjectIdState(stored);
      } else if (list[0]?.id) {
        setCurrentProjectId(list[0].id);
      } else {
        setCurrentProjectId(null);
      }
      return list;
    } catch (err) {
      setError(err.message || 'Impossible de charger les projets');
      setProjects([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isPaid, setCurrentProjectId]);

  useEffect(() => {
    if (!isAuthenticated || !isPaid) {
      setProjects([]);
      setCurrentProjectIdState(null);
      return;
    }
    refreshProjects();
  }, [isAuthenticated, isPaid, refreshProjects]);

  const currentProject = useMemo(() => {
    if (!projects.length) return null;
    return projects.find((p) => Number(p.id) === Number(currentProjectId)) || projects[0] || null;
  }, [projects, currentProjectId]);

  const value = useMemo(
    () => ({
      projects,
      currentProject,
      currentProjectId: currentProject?.id ?? null,
      setCurrentProjectId,
      refreshProjects,
      loading,
      error,
      hasProject: Boolean(currentProject?.id),
    }),
    [
      projects,
      currentProject,
      setCurrentProjectId,
      refreshProjects,
      loading,
      error,
    ]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject doit être utilisé dans ProjectProvider');
  }
  return ctx;
}
