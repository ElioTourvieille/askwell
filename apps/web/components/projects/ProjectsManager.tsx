"use client";

import type { Project } from "@askwell/shared";
import { useState } from "react";
import { deleteProjectRequest, submitCreate, submitRename, type FetchLike } from "../../lib/projects-ui/projects-api";
import { EmptyState } from "../states";
import { GlassPanel } from "../ui";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectItem } from "./ProjectItem";

type Props = { initialProjects: Project[]; fetcher?: FetchLike };

export function ProjectsManager({ initialProjects, fetcher }: Props) {
  const [projects, setProjects] = useState(initialProjects);
  const send: FetchLike = fetcher ?? ((input, init) => fetch(input, init));

  async function create(rawName: string): Promise<string | null> {
    const result = await submitCreate(send, rawName);
    if (!result.ok) return result.message;
    setProjects((current) => [...current, result.project]);
    return null;
  }

  async function rename(id: string, rawName: string): Promise<string | null> {
    const result = await submitRename(send, id, rawName);
    if (!result.ok) return result.message;
    setProjects((current) => current.map((p) => (p.id === id ? result.project : p)));
    return null;
  }

  async function remove(id: string): Promise<string | null> {
    const result = await deleteProjectRequest(send, id);
    if (!result.ok) return result.message;
    setProjects((current) => current.filter((p) => p.id !== id));
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <GlassPanel>
        <CreateProjectForm onCreate={create} />
      </GlassPanel>
      {projects.length === 0 ? (
        <EmptyState title="Aucun projet pour l'instant" text="Créez votre premier projet pour obtenir votre balise d'installation." />
      ) : (
        <ul className="flex flex-col gap-4">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectItem project={project} onRename={rename} onDelete={remove} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
