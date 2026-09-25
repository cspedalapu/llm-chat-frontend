import { appConfig, CustomizeOption, NavItemConfig } from "@/app.config";
import { Preferences } from "@/hooks/usePreferences";
import { Modal } from "./Modal";

function Toggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return <label className="customize-row">
    <span className="customize-copy"><strong>{label}</strong>{description && <span className="muted">{description}</span>}</span>
    <input className="customize-switch" type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)} />
  </label>;
}

/**
 * Lets each user choose which optional features appear. Only features the backend
 * supports and the config enables are listed; fixed ones are shown as always on.
 */
export function CustomizePanel({ navItems, composerOptions, preferences, onClose }: {
  navItems: NavItemConfig[]; composerOptions: CustomizeOption[]; preferences: Preferences; onClose: () => void;
}) {
  const { isVisible, setVisible, reset } = preferences;
  const alwaysOn = [...navItems.filter(item => item.fixed).map(item => item.label), ...appConfig.customize.alwaysOn];
  const sidebar = navItems.filter(item => !item.fixed);
  return <Modal title="Customize" onClose={onClose}>
    <div className="workspace-modal-form">
      <p className="muted">Choose what you see. Hiding a feature only removes it from view: it keeps working, and nothing is deleted.</p>
      {sidebar.length > 0 && <section className="customize-group" aria-label="Sidebar">
        <h3>Sidebar</h3>
        {sidebar.map(item => <Toggle key={item.key} label={item.label} description={item.description}
          checked={isVisible("nav." + item.key, item.defaultOn)} onChange={on => setVisible("nav." + item.key, on)} />)}
      </section>}
      {composerOptions.length > 0 && <section className="customize-group" aria-label="Message box">
        <h3>Message box</h3>
        {composerOptions.map(option => <Toggle key={option.id} label={option.label} description={option.description}
          checked={isVisible("composer." + option.id, option.defaultOn)} onChange={on => setVisible("composer." + option.id, on)} />)}
      </section>}
      <section className="customize-group" aria-label="Always on">
        <h3>Always on</h3>
        <p className="muted">{alwaysOn.join(" · ")}</p>
      </section>
      <div className="workspace-modal-actions">
        <button type="button" onClick={reset}>Reset to defaults</button>
        <button type="button" className="workspace-modal-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  </Modal>;
}
