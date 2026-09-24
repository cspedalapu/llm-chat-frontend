import { ReactNode, useEffect, useRef } from "react";
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="workspace-modal-card native-modal" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label={title}>
    <div className="workspace-modal-header"><h2 className="workspace-modal-title">{title}</h2><button className="workspace-modal-close" onClick={onClose} aria-label="Close dialog">×</button></div>
    {children}
  </dialog>;
}
