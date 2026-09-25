import { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, useEffect, useState } from "react";
import { appConfig, NavItemConfig } from "@/app.config.ts";
import { Conversation, ProjectSummary } from "@/types.ts";
import { ChevronIcon, FolderPlusIcon, GptsIcon, HelpIcon, LogoIcon, MoreIcon, navIcons, PanelIcon, SettingsIcon, UserIcon } from "./icons";
import { AccountMenu, chatMenuSections, ItemMenu, MenuPosition, MOVE_TO_PROJECT, OverflowPosition, ProjectOverflowPanel, projectMenuSections } from "./sidebar/SidebarMenus";
import { ChatRow, ProjectRow } from "./sidebar/SidebarRows";

interface SidebarProps {
  activeNavKey: string;
  /** Already filtered by app.config.ts flags and backend capabilities. */
  navItems: NavItemConfig[];
  /** False when the backend has no projects capability: hides the section and "Move to project". */
  showProjects: boolean;
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

interface SidebarItemMenuState {
  kind: "project" | "chat";
  id: string;
}

export function Sidebar({
  activeNavKey,
  navItems,
  showProjects,
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
  const accountSecondaryLabel = appConfig.brand.workspaceLabel;
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
  const chatSections = showProjects
    ? chatMenuSections
    : chatMenuSections.map((section) => section.filter((item) => item.label !== MOVE_TO_PROJECT));

  const [areProjectsOpen, setAreProjectsOpen] = useState(true);
  const [areChatsOpen, setAreChatsOpen] = useState(true);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [openItemMenu, setOpenItemMenu] = useState<SidebarItemMenuState | null>(null);
  const [itemMenuPosition, setItemMenuPosition] = useState<MenuPosition | null>(null);
  const [isProjectOverflowOpen, setIsProjectOverflowOpen] = useState(false);
  const [projectOverflowPosition, setProjectOverflowPosition] = useState<OverflowPosition | null>(null);
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
      closeItemMenu();
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

    window.addEventListener("resize", closeProjectOverflow);
    return () => {
      window.removeEventListener("resize", closeProjectOverflow);
    };
  }, [isProjectOverflowOpen]);

  useEffect(() => {
    if (!openItemMenu) {
      return;
    }

    window.addEventListener("resize", closeItemMenu);
    return () => {
      window.removeEventListener("resize", closeItemMenu);
    };
  }, [openItemMenu]);

  function closeItemMenu() {
    setOpenItemMenu(null);
    setItemMenuPosition(null);
  }

  function closeProjectOverflow() {
    setIsProjectOverflowOpen(false);
    setProjectOverflowPosition(null);
    setDropTargetProjectId(null);
  }

  function closeMenus() {
    closeItemMenu();
    closeProjectOverflow();
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
    closeMenus();

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

  function handleItemAction(kind: "project" | "chat", itemId: string, label: string) {
    closeItemMenu();

    if (kind === "chat") {
      if (label === "Rename") {
        onRenameConversation(itemId);
      } else if (label === "Delete") {
        onDeleteConversation(itemId);
      } else {
        onChatAction?.(label, itemId);
      }
      return;
    }

    if (label === "Delete project") {
      onDeleteProject(itemId);
    } else if (label === "Rename project") {
      onRenameProject(itemId);
    }
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

  function clearDropTarget(projectId: string) {
    if (dropTargetProjectId === projectId) {
      setDropTargetProjectId(null);
    }
  }

  function itemMenu(kind: "project" | "chat", id: string) {
    if (openItemMenu?.kind !== kind || openItemMenu.id !== id) {
      return null;
    }

    return (
      <ItemMenu
        kind={kind}
        sections={kind === "chat" ? chatSections : projectMenuSections}
        position={itemMenuPosition}
        onAction={(label) => handleItemAction(kind, id, label)}
      />
    );
  }

  function renderProjectRow(project: ProjectSummary) {
    return (
      <ProjectRow
        key={project.id}
        project={project}
        active={activeProjectId === project.id}
        dropTarget={dropTargetProjectId === project.id}
        menu={itemMenu("project", project.id)}
        onSelect={() => {
          closeMenus();
          if (project.kind === "folder") {
            onSelectProject(project.id);
          }
        }}
        onMenuToggle={(event) => handleItemMenuToggle(event, "project", project.id)}
        onDragOver={() => setDropTargetProjectId(project.id)}
        onDragLeave={() => clearDropTarget(project.id)}
        onDrop={(event) => handleProjectDrop(project.id, event)}
      />
    );
  }

  function renderChatRow(conversation: Conversation) {
    return (
      <ChatRow
        key={conversation.id}
        conversation={conversation}
        active={conversation.id === activeConversationId}
        menu={itemMenu("chat", conversation.id)}
        onSelect={() => {
          closeMenus();
          onSelectConversation(conversation.id);
        }}
        onMenuToggle={(event) => handleItemMenuToggle(event, "chat", conversation.id)}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", conversation.id);
          setDraggedConversationId(conversation.id);
          closeItemMenu();
          setIsAccountMenuOpen(false);
        }}
        onDragEnd={() => {
          setDraggedConversationId(null);
          setDropTargetProjectId(null);
        }}
      />
    );
  }

  function renderAccountMenu(className?: string) {
    return (
      <AccountMenu
        items={accountMenuItems}
        className={className}
        onSelect={() => {
          setIsAccountMenuOpen(false);
          onAccount?.();
        }}
      />
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
            const Icon = navIcons[item.icon] ?? GptsIcon;
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
          <button className="icon-button brand-icon-button" type="button" aria-label={`${appConfig.brand.name} home`}>
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
            const Icon = navIcons[item.icon] ?? GptsIcon;
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
              closeItemMenu();
            }
          }}
        >

          {showProjects ? (
            <section className="sidebar-section">
              <button
                className="sidebar-section-toggle"
                type="button"
                aria-expanded={areProjectsOpen}
                onClick={() => {
                  closeMenus();
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
                      closeMenus();
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
                          closeItemMenu();
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

                      {isProjectOverflowOpen ? (
                        <ProjectOverflowPanel
                          projects={overflowProjects}
                          position={projectOverflowPosition}
                          activeProjectId={activeProjectId}
                          dropTargetProjectId={dropTargetProjectId}
                          onDragOver={setDropTargetProjectId}
                          onDragLeave={clearDropTarget}
                          onDrop={handleProjectDrop}
                          onSelect={(projectId) => {
                            closeProjectOverflow();
                            onSelectProject(projectId);
                          }}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="sidebar-section sidebar-chat-section">
            <button
              className="sidebar-section-toggle"
              type="button"
              aria-expanded={areChatsOpen}
              onClick={() => {
                closeMenus();
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
              closeMenus();
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
