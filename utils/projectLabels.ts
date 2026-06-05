import { Project } from "../types";

export const getProjectDisplayLabel = (
  projects: Project[],
  projectId?: number,
) => {
  if (!projectId) return "";

  const project = projects.find((item) => item.id === projectId);
  return project?.title?.trim() || (project ? "Untitled" : "");
};
