import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, SVGProps, useEffect, useState } from "react";
import { appName } from "@/lib/appConfig.ts";
import { Conversation, ProjectSummary } from "@/types.ts";
import { AppsIcon, ArchiveIcon, ChevronIcon, CodexIcon, DeepResearchIcon, EditIcon, FolderIcon, FolderPlusIcon, GptsIcon, GroupChatIcon, HelpIcon, ImagesIcon, LibraryIcon, LogoIcon, MonitorIcon, MoreIcon, PanelIcon, PinIcon, SearchIcon, SettingsIcon, ShareIcon, TrashIcon, UserIcon } from "./icons";

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
  onDeleteConversation: (conversationId: string) => void;
  onMoveConversationToProject: (conversationId: string, projectId: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (conversationId: string) => void;
  onSelectNav: (itemKey: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameProject: (projectId: string) => void;
  onToggleSidebar: () => void;
  onChatAction?: (action: string, id: string) => void;
  onAccount?: () => void;
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

interface ItemMenuPosition {
  top: number;
  left: number;
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
  { key: "deep_research", label: "Deep Research", icon: DeepResearchIcon },
  { key: "workspace", label: "Workspace", icon: CodexIcon },
  { key: "llms", label: "LLMs", icon: GptsIcon }
];

const chatMenuSections: SidebarMenuAction[][] = [
  [
    { label: "Export chat", icon: ShareIcon },
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
  onDeleteConversation,
  onMoveConversationToProject,
  onNewConversation,
  onRenameConversation,
  onSelectNav,
  onSelectProject,
  onSelectConversation,
  onRenameProject,
  onToggleSidebar,
  onChatAction,
  onAccount
}: SidebarProps) {
  const visibleProjectLimit = 7;
  const accountPrimaryLabel = accountName?.trim() || "Sign in";
  const accountSecondaryLabel = "Local workspace";
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
  const [itemMenuPosition, setItemMenuPosition] = useState<ItemMenuPosition | null>(null);
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
      setItemMenuPosition(null);
      closeProjectOverflow();
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

  useEffect(() => {
    if (!openItemMenu) {
      return;
    }

    function handleWindowResize() {
      setOpenItemMenu(null);
      setItemMenuPosition(null);
    }

    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [openItemMenu]);

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
    setItemMenuPosition(null);
    closeProjectOverflow();

    if (itemKey === "new_chat") {
      onNewConversation();
    }
  }

  function handleItemMenuToggle(event: ReactMouseEvent<HTMLButtonElement>, kind: "project" | "chat", id: string) {
    event.stopPropagation();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const panelWidth = kind === "chat" ? 221 : 179;
    const panelHeight = kind === "chat" ? 208 : 122;
    const left = Math.max(12, Math.min(buttonRect.right - panelWidth + 10, window.innerWidth - panelWidth - 12));
    const preferredTop = kind === "chat" ? buttonRect.top - panelHeight + buttonRect.height + 8 : buttonRect.bottom - 10;
    const top = Math.max(12, Math.min(preferredTop, window.innerHeight - panelHeight - 12));

    setIsAccountMenuOpen(false);
    closeProjectOverflow();
    setOpenItemMenu((current) => {
      const isSameMenu = current?.kind === kind && current.id === id;
      if (isSameMenu) {
        setItemMenuPosition(null);
        return null;
      }

      setItemMenuPosition({ top, left });
      return { kind, id };
    });
  }

  function handleChatDragStart(conversationId: string) {
    setDraggedConversationId(conversationId);
    setOpenItemMenu(null);
    setItemMenuPosition(null);
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
              onClick={() => { setIsAccountMenuOpen(false); onAccount?.(); }}
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
      <div
        className={`sidebar-item-menu ${kind}`}
        role="menu"
        aria-label={menuLabel}
        style={itemMenuPosition ? { top: `${itemMenuPosition.top}px`, left: `${itemMenuPosition.left}px` } : undefined}
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
                  onClick={() => {
                    setOpenItemMenu(null);
                    setItemMenuPosition(null);

                    if (kind !== "project") {
                      if (item.label === "Rename") {
                        onRenameConversation(itemId);
                      } else if (item.label === "Delete") {
                        onDeleteConversation(itemId);
                      } else {
                        onChatAction?.(item.label, itemId);
                      }
                      return;
                    }

                    if (item.label === "Delete project") {
                      onDeleteProject(itemId);
                    } else if (item.label === "Rename project") {
                      onRenameProject(itemId);
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
            setItemMenuPosition(null);
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
            setItemMenuPosition(null);
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

  function renderCollapsedSidebarLayout() {
    return (
      <>
        <div className="sidebar-rail-top sidebar-rail-top-collapsed">
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
      </>
    );
  }

  function renderExpandedSidebarLayout() {
    return (
      <>
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

        <div className="sidebar-nav-divider" aria-hidden="true" />

        <div
          className="sidebar-scroll-region sidebar-sections-region"
          onScroll={() => {
            if (isProjectOverflowOpen) {
              closeProjectOverflow();
            }
            if (openItemMenu) {
              setOpenItemMenu(null);
              setItemMenuPosition(null);
            }
          }}
        >

          <section className="sidebar-section">
            <button
              className="sidebar-section-toggle"
              type="button"
              aria-expanded={areProjectsOpen}
              onClick={() => {
                setOpenItemMenu(null);
                setItemMenuPosition(null);
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
                    setItemMenuPosition(null);
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
                        setItemMenuPosition(null);
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
                setItemMenuPosition(null);
                closeProjectOverflow();
                setAreChatsOpen((current) => !current);
              }}
            >
              <span>Your Chats</span>
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
              setItemMenuPosition(null);
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
      </>
    );
  }

  return (
    <aside className={`sidebar${isCollapsed ? " collapsed" : ""}`}>
      <div className={`sidebar-view sidebar-view-expanded${isCollapsed ? " is-hidden" : " is-visible"}`}>
        {renderExpandedSidebarLayout()}
      </div>

      <div className={`sidebar-view sidebar-view-collapsed${isCollapsed ? " is-visible" : " is-hidden"}`}>
        {renderCollapsedSidebarLayout()}
      </div>
    </aside>
  );
}
