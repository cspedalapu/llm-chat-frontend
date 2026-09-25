import { Conversation, ProjectSummary, Provider } from "@/types";
import { ArchiveIcon, CopyIcon, DotsIcon, DownloadIcon, EditIcon, FileIcon, FolderIcon, InfoIcon, PanelIcon, PinIcon, ShareIcon, TrashIcon } from "./icons";
import { Menu, MenuDivider, MenuItem, SubMenu } from "./Menu";

export interface ChatHeaderActions {
  copyMarkdown: () => Promise<void>;
  downloadMarkdown: () => void;
  viewFiles?: () => void;
  rename: () => void;
  editContext: () => void;
  togglePin: () => void;
  toggleArchive: () => void;
  remove: () => void;
  /** Present only when the backend supports projects. */
  moveTo?: (projectId: string | null) => void;
}

export function ChatHeader({ models, modelId, onModel, canManageModels, onAddModel, project, onOpenProject, conversation, projects, busy, actions, onOpenSidebar }: {
  models: Provider[]; modelId: string; onModel: (id: string) => void; canManageModels: boolean; onAddModel: () => void;
  project?: ProjectSummary; onOpenProject: (id: string) => void;
  conversation?: Conversation; projects: ProjectSummary[]; busy: boolean; actions?: ChatHeaderActions;
  /** Phone layout only (hidden by CSS elsewhere): opens the sidebar drawer. */
  onOpenSidebar: () => void;
}) {
  return <header className="chat-header">
    <div className="chat-header-start">
      <button type="button" className="header-icon sidebar-open-button" aria-label="Open sidebar" title="Open sidebar" onClick={onOpenSidebar}><PanelIcon /></button>
      <label className="model-picker">
        <select aria-label="Model" value={modelId} onChange={e => e.target.value === "__add" ? onAddModel() : onModel(e.target.value)}>
          {!models.length && <option value="">Choose a model</option>}
          {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          {canManageModels && <option value="__add">+ Add your model</option>}
        </select>
      </label>
      {project && <button type="button" className="header-crumb" onClick={() => onOpenProject(project.id)}><FolderIcon aria-hidden="true" />{project.title}</button>}
    </div>
    {conversation && actions && <div className="chat-header-end">
      <Menu label="Share" align="end" triggerClassName="header-button" trigger={<><ShareIcon aria-hidden="true" /><span>Share</span></>}>{close => <>
        <MenuItem icon={CopyIcon} onSelect={() => { close(); void actions.copyMarkdown(); }}>Copy as Markdown</MenuItem>
        <MenuItem icon={DownloadIcon} onSelect={() => { close(); actions.downloadMarkdown(); }}>Download Markdown</MenuItem>
      </>}</Menu>
      <Menu label="Chat options" align="end" triggerClassName="header-icon" trigger={<DotsIcon />}>{close => <>
        {actions.viewFiles && <MenuItem icon={FileIcon} onSelect={() => { close(); actions.viewFiles!(); }}>View files in chat</MenuItem>}
        <MenuItem icon={EditIcon} disabled={busy} onSelect={() => { close(); actions.rename(); }}>Rename</MenuItem>
        <MenuItem icon={InfoIcon} disabled={busy} onSelect={() => { close(); actions.editContext(); }}>Conversation context</MenuItem>
        <MenuItem icon={PinIcon} disabled={busy} onSelect={() => { close(); actions.togglePin(); }}>{conversation.pinned ? "Unpin chat" : "Pin chat"}</MenuItem>
        <MenuItem icon={ArchiveIcon} disabled={busy} onSelect={() => { close(); actions.toggleArchive(); }}>{conversation.archived ? "Restore chat" : "Archive"}</MenuItem>
        <MenuItem icon={TrashIcon} danger disabled={busy} onSelect={() => { close(); actions.remove(); }}>Delete</MenuItem>
        {actions.moveTo && <>
          <MenuDivider />
          <SubMenu icon={FolderIcon} label="Move to project">
            <MenuItem checked={!conversation.projectId} onSelect={() => { close(); actions.moveTo!(null); }}>No project</MenuItem>
            {projects.map(p => <MenuItem key={p.id} checked={conversation.projectId === p.id} onSelect={() => { close(); actions.moveTo!(p.id); }}>{p.title}</MenuItem>)}
          </SubMenu>
        </>}
      </>}</Menu>
    </div>}
  </header>;
}
