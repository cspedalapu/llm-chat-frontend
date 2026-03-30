import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, SVGProps, useEffect, useState } from "react";
import { appName } from "@/lib/appConfig.ts";
import { Conversation, ProjectSummary } from "@/types.ts";

function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M9.3 4.6a4.6 4.6 0 0 1 5.63 1.17l.35.45.56-.08a4.58 4.58 0 0 1 4.84 6.24l-.24.52.37.41a4.6 4.6 0 0 1-4.14 7.61l-.57-.08-.29.49a4.59 4.59 0 0 1-7.96-.04l-.28-.46-.54.08a4.6 4.6 0 0 1-4.2-7.58l.37-.42-.24-.51a4.58 4.58 0 0 1 5.34-6.25Z" />
      <path d="M9.1 8.4 12 6.8l2.9 1.6v3.2L12 13.2 9.1 11.6Z" />
      <path d="M12 13.2v4.1" />
    </svg>
  );
}

function PanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="4.5" y="5" width="15" height="14" rx="3" />
      <path d="M11 5v14" />
    </svg>
  );
}

function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 20h4.2l9.7-9.7a2.1 2.1 0 0 0-3-3L5.2 17v3Z" />
      <path d="m13.8 7.2 3 3" />
    </svg>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ImagesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="4.5" y="6" width="10" height="10" rx="2.2" />
      <path d="m7 13 2.2-2.2a1 1 0 0 1 1.4 0L14.5 14.7" />
      <path d="m11.6 12.6.9-.9a1 1 0 0 1 1.4 0l1.1 1.1" />
      <circle cx="10" cy="10" r="1.1" />
      <path d="M9.5 18H17a2.5 2.5 0 0 0 2.5-2.5V8" />
      <path d="M14.5 4.5H17A2.5 2.5 0 0 1 19.5 7" />
    </svg>
  );
}

function LibraryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5.5 5.5h3.2v13H5.5z" />
      <path d="M10.4 5.5h3.2v13h-3.2z" />
      <path d="M15.3 5.5h3.2l-.6 13h-3.2z" />
    </svg>
  );
}

function AppsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="8" cy="8" r="2.1" />
      <circle cx="16" cy="8" r="2.1" />
      <circle cx="8" cy="16" r="2.1" />
      <circle cx="16" cy="16" r="2.1" />
    </svg>
  );
}

function DeepResearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m6 16 5.3-5.3a2.7 2.7 0 0 1 3.8 0l1.2 1.2" />
      <path d="M13.6 6.2 18 4.8l-1.4 4.4" />
      <path d="M4.5 12.5 3 16.8l4.3-1.5" />
      <path d="m8.2 14.8 1 4.7" />
    </svg>
  );
}

function CodexIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 4.8 5.6 6.7 4.8 10.5l1.9 3.4L10.5 15l3.4-1.9.8-3.8-1.9-3.4Z" />
      <path d="M14.3 9.2 19.2 8l-1.2 4.9-4.9 1.2" />
    </svg>
  );
}

function GptsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 4.8 18.2 8v8L12 19.2 5.8 16V8Z" />
      <path d="M12 4.8v14.4" />
      <path d="M5.8 8 12 11.6 18.2 8" />
    </svg>
  );
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 0 1-2.7 2.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.9 1.9 0 0 1-3.8 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1 .2l-.2.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.9 1.9 0 0 1 0-3.8h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1L4.8 8a1.9 1.9 0 1 1 2.7-2.7l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a1.9 1.9 0 0 1 3.8 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1-.2l.2-.1A1.9 1.9 0 1 1 19.8 8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a1.9 1.9 0 0 1 0 3.8h-.2a1 1 0 0 0-.9.7Z" />
    </svg>
  );
}

function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.9 9.4a2.4 2.4 0 1 1 4 2c-.9.7-1.4 1.2-1.4 2.4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M12 15.5V4.8" />
      <path d="m8.6 8.2 3.4-3.4 3.4 3.4" />
      <path d="M5.2 12.6V17a2.2 2.2 0 0 0 2.2 2.2h9.2a2.2 2.2 0 0 0 2.2-2.2v-4.4" />
    </svg>
  );
}

function GroupChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <circle cx="10" cy="8.2" r="2.7" />
      <path d="M5.3 17.5a4.7 4.7 0 0 1 9.4 0" />
      <path d="M18.2 8.5v5" />
      <path d="M15.7 11h5" />
    </svg>
  );
}

function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5.5 18.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="m14.8 4.8 4.4 4.4-2.5 1.4-3.1 5.2-1.4-1.4-5.2 3.1 3.1-5.2-1.4-1.4 5.2-3.1Z" />
      <path d="M7.3 16.7 4.8 19.2" />
    </svg>
  );
}

function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <rect x="4.8" y="6.2" width="14.4" height="12.8" rx="2.1" />
      <path d="M4.2 8.6h15.6" />
      <path d="M10 12h4" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M5.8 7.2h12.4" />
      <path d="M9.2 7.2V5.4h5.6v1.8" />
      <path d="M7.4 7.2 8.2 19a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.8-11.8" />
      <path d="M10.2 10.4v6.1M13.8 10.4v6.1" />
    </svg>
  );
}

function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4.8 8.2h5l1.5 1.7h7.9a1.8 1.8 0 0 1 1.8 1.8v6.5A1.8 1.8 0 0 1 19.2 20H4.8A1.8 1.8 0 0 1 3 18.2V10A1.8 1.8 0 0 1 4.8 8.2Z" />
    </svg>
  );
}

function FolderPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4.8 8.2h5l1.5 1.7h7.9a1.8 1.8 0 0 1 1.8 1.8v6.5A1.8 1.8 0 0 1 19.2 20H4.8A1.8 1.8 0 0 1 3 18.2V10A1.8 1.8 0 0 1 4.8 8.2Z" />
      <path d="M12 12.4v4.2M9.9 14.5h4.2" />
    </svg>
  );
}

function MonitorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M14.7 9.5a2.4 2.4 0 0 0-4.8 0c0 3 4.8 1.2 4.8 4.2a2.4 2.4 0 0 1-4.8 0" />
      <path d="M12 8v8" />
    </svg>
  );
}

function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M6 12h.01M12 12h.01M18 12h.01" />
    </svg>
  );
}

function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

interface SidebarProps {
  activeNavKey: string;
  projects: ProjectSummary[];
  conversations: Conversation[];
  activeConversationId: string | null;
  activeProjectId?: string | null;
  accountName?: string | null;
  isCollapsed: boolean;
  onCreateProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onMoveConversationToProject: (conversationId: string, projectId: string) => void;
  onNewConversation: () => void;
  onSelectNav: (itemKey: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameProject: (projectId: string) => void;
  onToggleSidebar: () => void;
}

interface NavItem {
  key: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  shortcut?: string;
}

interface SidebarMenuAction {
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  tone?: "danger";
  hasChevron?: boolean;
}

interface SidebarItemMenuState {
  kind: "project" | "chat";
  id: string;
}

interface ProjectOverflowPosition {
  top: number;
  left: number;
  maxHeight: number;
}

const navItems: NavItem[] = [
  { key: "new_chat", label: "New chat", icon: EditIcon, shortcut: "Ctrl + Shift + O" },
  { key: "search_chats", label: "Search chats", icon: SearchIcon },
  { key: "images", label: "Images", icon: ImagesIcon },
  { key: "library", label: "Library", icon: LibraryIcon },
  { key: "apps", label: "Apps", icon: AppsIcon },
  { key: "deep_research", label: "Deep research", icon: DeepResearchIcon },
  { key: "workspace", label: "Workspace", icon: CodexIcon },
  { key: "llms", label: "LLMs", icon: GptsIcon }
];

const chatMenuSections: SidebarMenuAction[][] = [
  [
    { label: "Share", icon: ShareIcon },
    { label: "Start a group chat", icon: GroupChatIcon },
    { label: "Rename", icon: EditIcon },
    { label: "Move to project", icon: FolderIcon, hasChevron: true }
  ],
  [
    { label: "Pin chat", icon: PinIcon },
    { label: "Archive", icon: ArchiveIcon }
  ],
  [{ label: "Delete", icon: TrashIcon, tone: "danger" }]
];

const projectMenuSections: SidebarMenuAction[][] = [
  [
    { label: "Share", icon: ShareIcon },
    { label: "Rename project", icon: EditIcon }
  ],
  [{ label: "Delete project", icon: TrashIcon, tone: "danger" }]
];

export function Sidebar({
  activeNavKey,
  projects,
  conversations,
  activeConversationId,
  activeProjectId,
  accountName,
  isCollapsed,
  onCreateProject,
  onDeleteProject,
  onMoveConversationToProject,
  onNewConversation,
  onSelectNav,
  onSelectProject,
  onSelectConversation,
  onRenameProject,
  onToggleSidebar
}: SidebarProps) {
  const visibleProjectLimit = 7;
  const accountPrimaryLabel = accountName?.trim() || "Sign in";
  const accountSecondaryLabel = accountName ? "Plus" : "Account";
  const accountAvatarLabel =
    accountName
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "SI";
  const accountButtonLabel = accountName ? `${accountPrimaryLabel} account` : "Sign in to your account";
  const accountMenuItems = [
    { label: "Settings", icon: SettingsIcon },
    { label: "Help", icon: HelpIcon },
    { label: accountPrimaryLabel, icon: UserIcon }
  ];

  const [areProjectsOpen, setAreProjectsOpen] = useState(true);
  const [areChatsOpen, setAreChatsOpen] = useState(true);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [openItemMenu, setOpenItemMenu] = useState<SidebarItemMenuState | null>(null);
  const [isProjectOverflowOpen, setIsProjectOverflowOpen] = useState(false);
  const [projectOverflowPosition, setProjectOverflowPosition] = useState<ProjectOverflowPosition | null>(null);
  const [draggedConversationId, setDraggedConversationId] = useState<string | null>(null);
  const [dropTargetProjectId, setDropTargetProjectId] = useState<string | null>(null);
  const visibleProjects = projects.slice(0, visibleProjectLimit);
  const overflowProjects = projects.slice(visibleProjectLimit);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".sidebar-menu-root")) {
        return;
      }

      setIsAccountMenuOpen(false);
      setOpenItemMenu(null);
      setIsProjectOverflowOpen(false);
    }

    if (!isAccountMenuOpen && !openItemMenu && !isProjectOverflowOpen) {
      return;
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isAccountMenuOpen, isProjectOverflowOpen, openItemMenu]);

  useEffect(() => {
    if (overflowProjects.length === 0 && isProjectOverflowOpen) {
      closeProjectOverflow();
    }
  }, [isProjectOverflowOpen, overflowProjects.length]);

  useEffect(() => {
    if (!isProjectOverflowOpen) {
      return;
    }

    function handleWindowResize() {
      closeProjectOverflow();
    }

    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [isProjectOverflowOpen]);

  function closeProjectOverflow() {
    setIsProjectOverflowOpen(false);
    setProjectOverflowPosition(null);
    setDropTargetProjectId(null);
  }

  function openProjectOverflow(event: ReactMouseEvent<HTMLButtonElement>) {
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const panelWidth = 272;
    const left = Math.max(12, Math.min(buttonRect.right + 10, window.innerWidth - panelWidth - 12));
    const top = Math.max(12, Math.min(buttonRect.top - 8, window.innerHeight - 220));
    const maxHeight = Math.max(180, window.innerHeight - top - 16);

    setProjectOverflowPosition({ top, left, maxHeight });
    setIsProjectOverflowOpen(true);
  }

  function handleNavClick(itemKey: string) {
    onSelectNav(itemKey);
    setIsAccountMenuOpen(false);
    setOpenItemMenu(null);
    closeProjectOverflow();

    if (itemKey === "new_chat") {
      onNewConversation();
    }
  }

  function handleItemMenuToggle(event: ReactMouseEvent<HTMLButtonElement>, kind: "project" | "chat", id: string) {
    event.stopPropagation();
    setIsAccountMenuOpen(false);
    closeProjectOverflow();
    setOpenItemMenu((current) => (current?.kind === kind && current.id === id ? null : { kind, id }));
  }

  function handleChatDragStart(conversationId: string) {
    setDraggedConversationId(conversationId);
    setOpenItemMenu(null);
    setIsAccountMenuOpen(false);
  }

  function handleProjectDrop(projectId: string, event: ReactDragEvent<HTMLElement>) {
    event.preventDefault();
    const droppedConversationId = event.dataTransfer.getData("text/plain") || draggedConversationId;
    if (!droppedConversationId) {
      setDropTargetProjectId(null);
      return;
    }

    onMoveConversationToProject(droppedConversationId, projectId);
    setDraggedConversationId(null);
    setDropTargetProjectId(null);
  }

  function getProjectIcon(project: ProjectSummary) {
    const iconByKind = {
      new: FolderPlusIcon,
      folder: FolderIcon,
      monitor: MonitorIcon,
      more: MoreIcon
    } as const;

    return iconByKind[project.kind];
  }

  function renderAccountMenu(menuClassName?: string) {
    return (
      <div className={`sidebar-account-menu${menuClassName ? ` ${menuClassName}` : ""}`} role="menu" aria-label="Account menu">
        {accountMenuItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              className="sidebar-account-menu-item"
              type="button"
              role="menuitem"
              onClick={() => setIsAccountMenuOpen(false)}
            >
              <Icon className="sidebar-nav-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderItemMenu(kind: "project" | "chat", itemId: string) {
    const sections = kind === "chat" ? chatMenuSections : projectMenuSections;
    const menuLabel = kind === "chat" ? "Chat actions" : "Project actions";

    return (
      <div className={`sidebar-item-menu ${kind}`} role="menu" aria-label={menuLabel}>
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
                  onClick={() => {
                    setOpenItemMenu(null);

                    if (kind !== "project") {
                      return;
                    }

                    if (item.label === "Rename project") {
                      onRenameProject(itemId);
                      return;
                    }

                    if (item.label === "Delete project") {
                      onDeleteProject(itemId);
                    }
                  }}
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

  function renderProjectRow(project: ProjectSummary) {
    const Icon = getProjectIcon(project);
    const canShowMenu = project.kind === "folder";
    const isMenuOpen = openItemMenu?.kind === "project" && openItemMenu.id === project.id;
    const isActiveProject = activeProjectId === project.id;
    const isDropTarget = dropTargetProjectId === project.id;

    return (
      <div key={project.id} className={`sidebar-item-shell sidebar-menu-root${isMenuOpen ? " menu-open" : ""}`}>
        <button
          className={`sidebar-section-item sidebar-project-item${canShowMenu ? " has-menu" : ""}${project.kind === "monitor" ? " monitor" : ""}${project.kind === "more" ? " more" : ""}${isActiveProject ? " active" : ""}${isDropTarget ? " drop-target" : ""}`}
          type="button"
          onDragOver={
            canShowMenu
              ? (event) => {
                  event.preventDefault();
                  setDropTargetProjectId(project.id);
                }
              : undefined
          }
          onDragLeave={
            canShowMenu
              ? () => {
                  if (dropTargetProjectId === project.id) {
                    setDropTargetProjectId(null);
                  }
                }
              : undefined
          }
          onDrop={canShowMenu ? (event) => handleProjectDrop(project.id, event) : undefined}
          onClick={() => {
            setOpenItemMenu(null);
            closeProjectOverflow();
            if (canShowMenu) {
              onSelectProject(project.id);
            }
          }}
        >
          <Icon className="sidebar-section-icon" />
          <span className="sidebar-section-item-copy">{project.title}</span>
        </button>

        {canShowMenu ? (
          <>
            <button
              className={`sidebar-item-menu-trigger${isMenuOpen ? " visible" : ""}`}
              type="button"
              aria-label={`More actions for ${project.title}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={(event) => handleItemMenuToggle(event, "project", project.id)}
            >
              <span className="sidebar-item-menu-dots" aria-hidden="true">
                ...
              </span>
            </button>

            {isMenuOpen ? renderItemMenu("project", project.id) : null}
          </>
        ) : null}
      </div>
    );
  }

  function renderProjectOverflowPanel() {
    return (
      <div
        className="sidebar-project-overflow-panel"
        style={
          projectOverflowPosition
            ? {
                top: `${projectOverflowPosition.top}px`,
                left: `${projectOverflowPosition.left}px`
              }
            : undefined
        }
        role="menu"
        aria-label="More projects"
      >
        <div
          className="sidebar-project-overflow-list"
          style={projectOverflowPosition ? { maxHeight: `${projectOverflowPosition.maxHeight}px` } : undefined}
        >
          {overflowProjects.map((project) => {
            const Icon = getProjectIcon(project);

            return (
              <button
                key={project.id}
                className={`sidebar-project-overflow-item${project.kind === "monitor" ? " monitor" : ""}${project.kind === "more" ? " more" : ""}${activeProjectId === project.id ? " active" : ""}${dropTargetProjectId === project.id ? " drop-target" : ""}`}
                type="button"
                role="menuitem"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTargetProjectId(project.id);
                }}
                onDragLeave={() => {
                  if (dropTargetProjectId === project.id) {
                    setDropTargetProjectId(null);
                  }
                }}
                onDrop={(event) => handleProjectDrop(project.id, event)}
                onClick={() => {
                  closeProjectOverflow();
                  onSelectProject(project.id);
                }}
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

  function renderChatRow(conversation: Conversation) {
    const isActiveConversation = conversation.id === activeConversationId;
    const isMenuOpen = openItemMenu?.kind === "chat" && openItemMenu.id === conversation.id;

    return (
      <div key={conversation.id} className={`sidebar-item-shell sidebar-menu-root${isMenuOpen ? " menu-open" : ""}`}>
        <button
          className={`sidebar-section-item sidebar-chat-item has-menu${isActiveConversation ? " active" : ""}`}
          type="button"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", conversation.id);
            handleChatDragStart(conversation.id);
          }}
          onDragEnd={() => {
            setDraggedConversationId(null);
            setDropTargetProjectId(null);
          }}
          onClick={() => {
            setOpenItemMenu(null);
            closeProjectOverflow();
            onSelectConversation(conversation.id);
          }}
        >
          <span className="sidebar-section-item-copy">{conversation.title}</span>
        </button>

        <button
          className={`sidebar-item-menu-trigger${isMenuOpen ? " visible" : ""}`}
          type="button"
          aria-label={`More actions for ${conversation.title}`}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          onClick={(event) => handleItemMenuToggle(event, "chat", conversation.id)}
        >
          <span className="sidebar-item-menu-dots" aria-hidden="true">
            ...
          </span>
        </button>

        {isMenuOpen ? renderItemMenu("chat", conversation.id) : null}
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <aside className="sidebar collapsed">
        <div className="sidebar-rail-top">
          <button className="icon-button brand-icon-button" type="button" aria-label={`${appName} home`}>
            <LogoIcon />
          </button>

          <button
            className="icon-button sidebar-collapse-button"
            type="button"
            onClick={onToggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelIcon />
          </button>
        </div>

        <div className="sidebar-rail-actions">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavKey === item.key;

            return (
              <button
                key={item.key}
                className={`sidebar-rail-button${isActive ? " active" : ""}`}
                type="button"
                aria-label={item.label}
                title={item.label}
                onClick={() => handleNavClick(item.key)}
              >
                <Icon />
              </button>
            );
          })}
        </div>

        <div className="sidebar-rail-spacer" />

        <div className="sidebar-rail-actions sidebar-rail-footer sidebar-account-menu-wrap sidebar-menu-root">
          {isAccountMenuOpen ? renderAccountMenu("sidebar-account-menu-floating") : null}

          <button
            className="sidebar-rail-button"
            type="button"
            aria-label={accountButtonLabel}
            title={accountPrimaryLabel}
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
            onClick={() => {
              setOpenItemMenu(null);
              setIsAccountMenuOpen((current) => !current);
            }}
          >
            <UserIcon />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="icon-button brand-icon-button" type="button" aria-label={`${appName} home`}>
          <LogoIcon />
        </button>

        <button
          className="icon-button sidebar-collapse-button"
          type="button"
          onClick={onToggleSidebar}
          aria-label="Collapse sidebar"
        >
          <PanelIcon />
        </button>
      </div>

      <div
        className="sidebar-scroll-region"
        onScroll={() => {
          if (isProjectOverflowOpen) {
            closeProjectOverflow();
          }
        }}
      >
        <div className="sidebar-primary-actions">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavKey === item.key;

            return (
              <button
                key={item.key}
                className={`sidebar-nav-button${isActive ? " active" : ""}${item.key === "new_chat" ? " primary" : ""}`}
                type="button"
                onClick={() => handleNavClick(item.key)}
              >
                <Icon className="sidebar-nav-icon" />
                <span>{item.label}</span>
                {item.shortcut ? <span className="sidebar-nav-shortcut">{item.shortcut}</span> : null}
              </button>
            );
          })}
        </div>

        <section className="sidebar-section">
          <button
            className="sidebar-section-toggle"
            type="button"
            aria-expanded={areProjectsOpen}
            onClick={() => {
              setOpenItemMenu(null);
              closeProjectOverflow();
              setAreProjectsOpen((current) => !current);
            }}
          >
            <span>Projects</span>
            <ChevronIcon className={`sidebar-section-chevron${areProjectsOpen ? " open" : ""}`} />
          </button>

          {areProjectsOpen ? (
            <div className="sidebar-section-list sidebar-project-list">
              <button
                className="sidebar-section-item sidebar-project-item"
                type="button"
                onClick={() => {
                  setOpenItemMenu(null);
                  closeProjectOverflow();
                  onCreateProject();
                }}
              >
                <FolderPlusIcon className="sidebar-section-icon" />
                <span className="sidebar-section-item-copy">New project</span>
              </button>

              {visibleProjects.map(renderProjectRow)}

              {overflowProjects.length > 0 ? (
                <div className={`sidebar-item-shell sidebar-menu-root${isProjectOverflowOpen ? " menu-open" : ""}`}>
                  <button
                    className="sidebar-section-item sidebar-project-item more"
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isProjectOverflowOpen}
                    onClick={(event) => {
                      setIsAccountMenuOpen(false);
                      setOpenItemMenu(null);
                      if (isProjectOverflowOpen) {
                        closeProjectOverflow();
                        return;
                      }

                      openProjectOverflow(event);
                    }}
                  >
                    <MoreIcon className="sidebar-section-icon" />
                    <span className="sidebar-section-item-copy">More</span>
                  </button>

                  {isProjectOverflowOpen ? renderProjectOverflowPanel() : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="sidebar-section sidebar-chat-section">
          <button
            className="sidebar-section-toggle"
            type="button"
            aria-expanded={areChatsOpen}
            onClick={() => {
              setOpenItemMenu(null);
              closeProjectOverflow();
              setAreChatsOpen((current) => !current);
            }}
          >
            <span>Your chats</span>
            <ChevronIcon className={`sidebar-section-chevron${areChatsOpen ? " open" : ""}`} />
          </button>

          {areChatsOpen ? <div className="sidebar-section-list sidebar-chat-list">{conversations.map(renderChatRow)}</div> : null}
        </section>
      </div>

      <div className="sidebar-footer-nav sidebar-account-menu-wrap sidebar-menu-root">
        {isAccountMenuOpen ? renderAccountMenu() : null}

        <button
          className="sidebar-account-button"
          type="button"
          aria-label={accountButtonLabel}
          aria-haspopup="menu"
          aria-expanded={isAccountMenuOpen}
          onClick={() => {
            setOpenItemMenu(null);
            closeProjectOverflow();
            setIsAccountMenuOpen((current) => !current);
          }}
        >
          <span className="sidebar-account-avatar" aria-hidden="true">
            {accountAvatarLabel}
          </span>

          <span className="sidebar-account-copy">
            <strong>{accountPrimaryLabel}</strong>
            <span>{accountSecondaryLabel}</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
