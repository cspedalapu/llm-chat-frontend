import { SVGProps, useEffect, useRef, useState } from "react";
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

function HealthIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m12 20-1.2-1C6.2 15 4 12.9 4 10.1A4.1 4.1 0 0 1 8.2 6a4.4 4.4 0 0 1 3.8 2.1A4.4 4.4 0 0 1 15.8 6 4.1 4.1 0 0 1 20 10.1c0 2.8-2.2 4.9-6.8 8.9Z" />
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

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 0 1-2.7 2.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.9 1.9 0 0 1-3.8 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1 .2l-.2.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.9 1.9 0 0 1 0-3.8h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1L4.8 8a1.9 1.9 0 1 1 2.7-2.7l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a1.9 1.9 0 0 1 3.8 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1-.2l.2-.1A1.9 1.9 0 1 1 19.8 8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a1.9 1.9 0 0 1 0 3.8h-.2a1 1 0 0 0-.9.7Z" />
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

interface SidebarProps {
  projects: ProjectSummary[];
  conversations: Conversation[];
  activeConversationId: string;
  accountName?: string | null;
  isCollapsed: boolean;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onToggleSidebar: () => void;
}

const mainItems = [
  { label: "Search chats", icon: SearchIcon },
  { label: "Images", icon: ImagesIcon },
  { label: "Apps", icon: AppsIcon },
  { label: "Deep research", icon: DeepResearchIcon },
  { label: "Health", icon: HealthIcon }
];

export function Sidebar({
  projects,
  conversations,
  activeConversationId,
  accountName,
  isCollapsed,
  onNewConversation,
  onSelectConversation,
  onToggleSidebar
}: SidebarProps) {
  const accountPrimaryLabel = accountName?.trim() || "Sign in";
  const accountSecondaryLabel = "Account";
  const accountButtonLabel = accountName ? `${accountPrimaryLabel} account` : "Sign in to your account";
  const accountMenuItems = [
    { label: "Settings", icon: SettingsIcon },
    { label: "Help", icon: HelpIcon },
    { label: accountPrimaryLabel, icon: UserIcon }
  ];
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    if (!isAccountMenuOpen) {
      return;
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isAccountMenuOpen]);

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

  if (isCollapsed) {
    return (
      <aside className="sidebar collapsed">
        <div className="sidebar-rail-top">
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
          <button
            className="sidebar-rail-button"
            type="button"
            onClick={onNewConversation}
            aria-label="New chat"
            title="New chat"
          >
            <EditIcon />
          </button>

          {mainItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className="sidebar-rail-button"
                type="button"
                aria-label={item.label}
                title={item.label}
              >
                <Icon />
              </button>
            );
          })}
        </div>

        <div className="sidebar-rail-spacer" />

        <div className="sidebar-rail-actions sidebar-rail-footer sidebar-account-menu-wrap" ref={accountMenuRef}>
          {isAccountMenuOpen ? renderAccountMenu("sidebar-account-menu-floating") : null}

          <button
            className="sidebar-rail-button"
            type="button"
            aria-label={accountButtonLabel}
            title={accountPrimaryLabel}
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
            onClick={() => setIsAccountMenuOpen((current) => !current)}
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

      <div className="sidebar-primary-actions">
        <button className="sidebar-nav-button primary" type="button" onClick={onNewConversation}>
          <EditIcon className="sidebar-nav-icon" />
          <span>New chat</span>
        </button>

        {mainItems.map((item) => {
          const Icon = item.icon;

          return (
            <button key={item.label} className="sidebar-nav-button" type="button">
              <Icon className="sidebar-nav-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="conversation-section-title">Projects</div>

      <div className="sidebar-section-list">
        {projects.map((project) => (
          <button key={project.id} className="conversation-card project-card" type="button">
            <strong>{project.title}</strong>
            <span>{project.preview}</span>
          </button>
        ))}
      </div>

      <div className="conversation-section-title">Your chats</div>

      <div className="conversation-list">
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId;

          return (
            <button
              key={conversation.id}
              className={`conversation-card${isActive ? " active" : ""}`}
              type="button"
              onClick={() => onSelectConversation(conversation.id)}
            >
              <strong>{conversation.title}</strong>
              <span>{conversation.preview}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer-nav sidebar-account-menu-wrap" ref={accountMenuRef}>
        {isAccountMenuOpen ? renderAccountMenu() : null}

        <button
          className="sidebar-account-button"
          type="button"
          aria-label={accountButtonLabel}
          aria-haspopup="menu"
          aria-expanded={isAccountMenuOpen}
          onClick={() => setIsAccountMenuOpen((current) => !current)}
        >
          <span className="sidebar-account-avatar" aria-hidden="true">
            <UserIcon className="sidebar-nav-icon" />
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
