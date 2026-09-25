import { ReactNode, SVGProps, useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronIcon } from "./icons";

type Icon = (props: SVGProps<SVGSVGElement>) => JSX.Element;

/**
 * Button + popover menu used by the composer, message actions and chat header.
 * Closes on outside click, Escape, or when an item calls `close`.
 */
export function Menu({ label, trigger, triggerClassName = "icon-action", align = "start", placement = "bottom", disabled, title, children }: {
  /** Accessible name of the trigger button. */
  label: string;
  trigger: ReactNode;
  triggerClassName?: string;
  align?: "start" | "end";
  placement?: "top" | "bottom";
  disabled?: boolean;
  title?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onPointer); window.removeEventListener("keydown", onKey); };
  }, [open]);
  return <div className="menu-root" ref={root}>
    <button ref={button} type="button" className={triggerClassName + (open ? " open" : "")} aria-label={label} title={title ?? label}
      aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(value => !value)}>{trigger}</button>
    {open && <div role="menu" aria-label={label} className={`menu-panel menu-${align} menu-${placement}`}>{children(() => setOpen(false))}</div>}
  </div>;
}

export function MenuItem({ icon: Icon, children, onSelect, danger, disabled, checked, hint }: {
  icon?: Icon; children: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean;
  /** Renders a check-style item (radio or checkbox semantics) when defined. */
  checked?: boolean; hint?: string;
}) {
  const role = checked === undefined ? "menuitem" : "menuitemcheckbox";
  return <button type="button" role={role} aria-checked={checked} aria-disabled={disabled || undefined} title={hint}
    className={"menu-item" + (danger ? " danger" : "") + (disabled ? " disabled" : "")}
    onClick={event => { if (disabled) { event.preventDefault(); return; } onSelect(); }}>
    {Icon ? <Icon className="menu-item-icon" aria-hidden="true" /> : checked !== undefined ? <span className="menu-item-icon" /> : null}
    <span className="menu-item-label">{children}</span>
    {checked && <CheckIcon className="menu-item-check" aria-hidden="true" />}
  </button>;
}

/** An item that opens a nested menu to the side (hover or click). */
export function SubMenu({ icon: Icon, label, children }: { icon?: Icon; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="menu-sub" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
    <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={open} className={"menu-item" + (open ? " open" : "")}
      // Open only: with a mouse, hover has already opened it and a toggle would close it.
      onClick={() => setOpen(true)}>
      {Icon && <Icon className="menu-item-icon" aria-hidden="true" />}
      <span className="menu-item-label">{label}</span>
      <ChevronIcon className="menu-item-chevron" aria-hidden="true" />
    </button>
    {open && <div role="menu" aria-label={label} className="menu-panel menu-sub-panel">{children}</div>}
  </div>;
}

export function MenuDivider() {
  return <div className="menu-divider" role="separator" />;
}

export function MenuNote({ children }: { children: ReactNode }) {
  return <p className="menu-note">{children}</p>;
}
