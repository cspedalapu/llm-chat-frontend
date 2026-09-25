import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Conversation, ProjectSummary } from "@/types.ts";
import { FolderIcon, FolderPlusIcon, MonitorIcon, MoreIcon } from "../icons";

const iconByKind = {
  new: FolderPlusIcon,
  folder: FolderIcon,
  monitor: MonitorIcon,
  more: MoreIcon
} as const;

export function projectIcon(project: ProjectSummary) {
  return iconByKind[project.kind];
}

function MenuTrigger({ title, open, onToggle }: { title: string; open: boolean; onToggle: (event: ReactMouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button
      className={`sidebar-item-menu-trigger${open ? " visible" : ""}`}
      type="button"
      aria-label={`More actions for ${title}`}
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="sidebar-item-menu-dots" aria-hidden="true">
        ...
      </span>
    </button>
  );
}

export function ProjectRow({ project, active, dropTarget, menu, onSelect, onMenuToggle, onDragOver, onDragLeave, onDrop }: {
  project: ProjectSummary;
  active: boolean;
  dropTarget: boolean;
  /** The open item menu, or null when closed. */
  menu: ReactNode | null;
  onSelect: () => void;
  onMenuToggle: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (event: ReactDragEvent<HTMLElement>) => void;
}) {
  const Icon = projectIcon(project);
  const canShowMenu = project.kind === "folder";
  const isMenuOpen = Boolean(menu);

  return (
    <div className={`sidebar-item-shell sidebar-menu-root${isMenuOpen ? " menu-open" : ""}`}>
      <button
        className={`sidebar-section-item sidebar-project-item${canShowMenu ? " has-menu" : ""}${project.kind === "monitor" ? " monitor" : ""}${project.kind === "more" ? " more" : ""}${active ? " active" : ""}${dropTarget ? " drop-target" : ""}`}
        type="button"
        onDragOver={
          canShowMenu
            ? (event) => {
                event.preventDefault();
                onDragOver();
              }
            : undefined
        }
        onDragLeave={canShowMenu ? onDragLeave : undefined}
        onDrop={canShowMenu ? onDrop : undefined}
        onClick={onSelect}
      >
        <Icon className="sidebar-section-icon" />
        <span className="sidebar-section-item-copy">{project.title}</span>
      </button>

      {canShowMenu ? (
        <>
          <MenuTrigger title={project.title} open={isMenuOpen} onToggle={onMenuToggle} />
          {menu}
        </>
      ) : null}
    </div>
  );
}

export function ChatRow({ conversation, active, menu, onSelect, onMenuToggle, onDragStart, onDragEnd }: {
  conversation: Conversation;
  active: boolean;
  menu: ReactNode | null;
  onSelect: () => void;
  onMenuToggle: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onDragStart: (event: ReactDragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const isMenuOpen = Boolean(menu);

  return (
    <div className={`sidebar-item-shell sidebar-menu-root${isMenuOpen ? " menu-open" : ""}`}>
      <button
        className={`sidebar-section-item sidebar-chat-item has-menu${active ? " active" : ""}`}
        type="button"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onSelect}
      >
        <span className="sidebar-section-item-copy">{conversation.title}</span>
      </button>

      <MenuTrigger title={conversation.title} open={isMenuOpen} onToggle={onMenuToggle} />
      {menu}
    </div>
  );
}
