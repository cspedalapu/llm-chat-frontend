import { DragEvent as ReactDragEvent, SVGProps } from "react";
import { ProjectSummary } from "@/types.ts";
import { ArchiveIcon, ChevronIcon, EditIcon, FolderIcon, PinIcon, ShareIcon, TrashIcon } from "../icons";
import { projectIcon } from "./SidebarRows";

export type Icon = (props: SVGProps<SVGSVGElement>) => JSX.Element;

export interface SidebarMenuAction {
  label: string;
  icon: Icon;
  tone?: "danger";
  hasChevron?: boolean;
}

export interface MenuPosition {
  top: number;
  left: number;
}

export interface OverflowPosition extends MenuPosition {
  maxHeight: number;
}

export const MOVE_TO_PROJECT = "Move to project";

export const chatMenuSections: SidebarMenuAction[][] = [
  [
    { label: "Export chat", icon: ShareIcon },
    { label: "Rename", icon: EditIcon },
    { label: MOVE_TO_PROJECT, icon: FolderIcon, hasChevron: true }
  ],
  [
    { label: "Pin chat", icon: PinIcon },
    { label: "Archive", icon: ArchiveIcon }
  ],
  [{ label: "Delete", icon: TrashIcon, tone: "danger" }]
];

export const projectMenuSections: SidebarMenuAction[][] = [
  [
    { label: "Rename project", icon: EditIcon }
  ],
  [{ label: "Delete project", icon: TrashIcon, tone: "danger" }]
];

export function AccountMenu({ items, className, onSelect }: {
  items: { label: string; icon: Icon }[];
  className?: string;
  onSelect: () => void;
}) {
  return (
    <div className={`sidebar-account-menu${className ? ` ${className}` : ""}`} role="menu" aria-label="Account menu">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button key={item.label} className="sidebar-account-menu-item" type="button" role="menuitem" onClick={onSelect}>
            <Icon className="sidebar-nav-icon" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ItemMenu({ kind, sections, position, onAction }: {
  kind: "project" | "chat";
  sections: SidebarMenuAction[][];
  position: MenuPosition | null;
  onAction: (label: string) => void;
}) {
  return (
    <div
      className={`sidebar-item-menu ${kind}`}
      role="menu"
      aria-label={kind === "chat" ? "Chat actions" : "Project actions"}
      style={position ? { top: `${position.top}px`, left: `${position.left}px` } : undefined}
    >
      {sections.map((section, sectionIndex) => (
        <div className="sidebar-item-menu-section" key={`${kind}-section-${sectionIndex}`}>
          {section.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`sidebar-item-menu-action${item.tone === "danger" ? " danger" : ""}`}
                type="button"
                role="menuitem"
                onClick={() => onAction(item.label)}
              >
                <Icon className="sidebar-item-menu-icon" />
                <span className="sidebar-item-menu-label">{item.label}</span>
                {item.hasChevron ? <ChevronIcon className="sidebar-item-menu-chevron" /> : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ProjectOverflowPanel({ projects, position, activeProjectId, dropTargetProjectId, onDragOver, onDragLeave, onDrop, onSelect }: {
  projects: ProjectSummary[];
  position: OverflowPosition | null;
  activeProjectId?: string | null;
  dropTargetProjectId: string | null;
  onDragOver: (projectId: string) => void;
  onDragLeave: (projectId: string) => void;
  onDrop: (projectId: string, event: ReactDragEvent<HTMLElement>) => void;
  onSelect: (projectId: string) => void;
}) {
  return (
    <div
      className="sidebar-project-overflow-panel"
      style={position ? { top: `${position.top}px`, left: `${position.left}px` } : undefined}
      role="menu"
      aria-label="More projects"
    >
      <div className="sidebar-project-overflow-list" style={position ? { maxHeight: `${position.maxHeight}px` } : undefined}>
        {projects.map((project) => {
          const Icon = projectIcon(project);

          return (
            <button
              key={project.id}
              className={`sidebar-project-overflow-item${project.kind === "monitor" ? " monitor" : ""}${project.kind === "more" ? " more" : ""}${activeProjectId === project.id ? " active" : ""}${dropTargetProjectId === project.id ? " drop-target" : ""}`}
              type="button"
              role="menuitem"
              onDragOver={(event) => {
                event.preventDefault();
                onDragOver(project.id);
              }}
              onDragLeave={() => onDragLeave(project.id)}
              onDrop={(event) => onDrop(project.id, event)}
              onClick={() => onSelect(project.id)}
            >
              <Icon className="sidebar-project-overflow-icon" />
              <span className="sidebar-project-overflow-copy">{project.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
