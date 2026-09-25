import { SVGProps } from "react";

// Extracted from Sidebar.tsx: presentational only, no sidebar state.

export function LogoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M9.3 4.6a4.6 4.6 0 0 1 5.63 1.17l.35.45.56-.08a4.58 4.58 0 0 1 4.84 6.24l-.24.52.37.41a4.6 4.6 0 0 1-4.14 7.61l-.57-.08-.29.49a4.59 4.59 0 0 1-7.96-.04l-.28-.46-.54.08a4.6 4.6 0 0 1-4.2-7.58l.37-.42-.24-.51a4.58 4.58 0 0 1 5.34-6.25Z" />
      <path d="M9.1 8.4 12 6.8l2.9 1.6v3.2L12 13.2 9.1 11.6Z" />
      <path d="M12 13.2v4.1" />
    </svg>
  );
}

export function PanelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="4.5" y="5" width="15" height="14" rx="3" />
      <path d="M11 5v14" />
    </svg>
  );
}

export function EditIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 20h4.2l9.7-9.7a2.1 2.1 0 0 0-3-3L5.2 17v3Z" />
      <path d="m13.8 7.2 3 3" />
    </svg>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function ImagesIcon(props: SVGProps<SVGSVGElement>) {
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

export function LibraryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5.5 5.5h3.2v13H5.5z" />
      <path d="M10.4 5.5h3.2v13h-3.2z" />
      <path d="M15.3 5.5h3.2l-.6 13h-3.2z" />
    </svg>
  );
}

export function AppsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="8" cy="8" r="2.1" />
      <circle cx="16" cy="8" r="2.1" />
      <circle cx="8" cy="16" r="2.1" />
      <circle cx="16" cy="16" r="2.1" />
    </svg>
  );
}

export function DeepResearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m6 16 5.3-5.3a2.7 2.7 0 0 1 3.8 0l1.2 1.2" />
      <path d="M13.6 6.2 18 4.8l-1.4 4.4" />
      <path d="M4.5 12.5 3 16.8l4.3-1.5" />
      <path d="m8.2 14.8 1 4.7" />
    </svg>
  );
}

export function CodexIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 4.8 5.6 6.7 4.8 10.5l1.9 3.4L10.5 15l3.4-1.9.8-3.8-1.9-3.4Z" />
      <path d="M14.3 9.2 19.2 8l-1.2 4.9-4.9 1.2" />
    </svg>
  );
}

export function GptsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 4.8 18.2 8v8L12 19.2 5.8 16V8Z" />
      <path d="M12 4.8v14.4" />
      <path d="M5.8 8 12 11.6 18.2 8" />
    </svg>
  );
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.9 1.9 0 0 1-2.7 2.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.9 1.9 0 0 1-3.8 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1 .2l-.2.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.9 1.9 0 0 1 0-3.8h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1L4.8 8a1.9 1.9 0 1 1 2.7-2.7l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a1.9 1.9 0 0 1 3.8 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1-.2l.2-.1A1.9 1.9 0 1 1 19.8 8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a1.9 1.9 0 0 1 0 3.8h-.2a1 1 0 0 0-.9.7Z" />
    </svg>
  );
}

export function HelpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.9 9.4a2.4 2.4 0 1 1 4 2c-.9.7-1.4 1.2-1.4 2.4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M12 15.5V4.8" />
      <path d="m8.6 8.2 3.4-3.4 3.4 3.4" />
      <path d="M5.2 12.6V17a2.2 2.2 0 0 0 2.2 2.2h9.2a2.2 2.2 0 0 0 2.2-2.2v-4.4" />
    </svg>
  );
}

export function GroupChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <circle cx="10" cy="8.2" r="2.7" />
      <path d="M5.3 17.5a4.7 4.7 0 0 1 9.4 0" />
      <path d="M18.2 8.5v5" />
      <path d="M15.7 11h5" />
    </svg>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5.5 18.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

export function PinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="m14.8 4.8 4.4 4.4-2.5 1.4-3.1 5.2-1.4-1.4-5.2 3.1 3.1-5.2-1.4-1.4 5.2-3.1Z" />
      <path d="M7.3 16.7 4.8 19.2" />
    </svg>
  );
}

export function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <rect x="4.8" y="6.2" width="14.4" height="12.8" rx="2.1" />
      <path d="M4.2 8.6h15.6" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M5.8 7.2h12.4" />
      <path d="M9.2 7.2V5.4h5.6v1.8" />
      <path d="M7.4 7.2 8.2 19a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.8-11.8" />
      <path d="M10.2 10.4v6.1M13.8 10.4v6.1" />
    </svg>
  );
}

export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4.8 8.2h5l1.5 1.7h7.9a1.8 1.8 0 0 1 1.8 1.8v6.5A1.8 1.8 0 0 1 19.2 20H4.8A1.8 1.8 0 0 1 3 18.2V10A1.8 1.8 0 0 1 4.8 8.2Z" />
    </svg>
  );
}

export function FolderPlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4.8 8.2h5l1.5 1.7h7.9a1.8 1.8 0 0 1 1.8 1.8v6.5A1.8 1.8 0 0 1 19.2 20H4.8A1.8 1.8 0 0 1 3 18.2V10A1.8 1.8 0 0 1 4.8 8.2Z" />
      <path d="M12 12.4v4.2M9.9 14.5h4.2" />
    </svg>
  );
}

export function MonitorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M14.7 9.5a2.4 2.4 0 0 0-4.8 0c0 3 4.8 1.2 4.8 4.2a2.4 2.4 0 0 1-4.8 0" />
      <path d="M12 8v8" />
    </svg>
  );
}

export function MoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <path d="M6 12h.01M12 12h.01M18 12h.01" />
    </svg>
  );
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
