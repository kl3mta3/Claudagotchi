const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claudigotchi', {
  // Auth
  checkCLI:       ()      => ipcRenderer.invoke('check-cli'),
  installCLI:     ()      => ipcRenderer.invoke('install-cli'),
  checkAuth:      ()      => ipcRenderer.invoke('check-auth'),
  claudeLogin:    ()      => ipcRenderer.invoke('claude-login'),

  // Claude CLI
  claudeSend:     (opts)  => ipcRenderer.invoke('claude-send', opts),
  claudeSessions: (opts)  => ipcRenderer.invoke('claude-list-sessions', opts),
  claudeAbort:    (opts)  => ipcRenderer.invoke('claude-abort', opts),
  // canUseTool plumbing — main asks, renderer answers.
  onToolPermissionRequest: (cb) => {
    const l = (_e, payload) => cb(payload);
    ipcRenderer.on('tool-permission-request', l);
    return () => ipcRenderer.removeListener('tool-permission-request', l);
  },
  toolPermissionDecision:  (reqId, decision) => ipcRenderer.invoke('tool-permission-decision', { reqId, decision }),
  // Plan approval (ExitPlanMode → artifact-panel modal)
  onPlanApprovalRequest:   (cb) => {
    const l = (_e, payload) => cb(payload);
    ipcRenderer.on('plan-approval-request', l);
    return () => ipcRenderer.removeListener('plan-approval-request', l);
  },
  clearAlwaysAllow:        ()                  => ipcRenderer.invoke('clear-always-allow'),
  // Worktree management (per-session git isolation).
  gitCheckRepo:    (cwd)                  => ipcRenderer.invoke('git-check-repo', { cwd }),
  worktreeCreate:  (cwd, sessionId)       => ipcRenderer.invoke('worktree-create', { cwd, sessionId }),
  worktreeRemove:  (entry)                => ipcRenderer.invoke('worktree-remove', entry),
  worktreeList:    (repoRoot)             => ipcRenderer.invoke('worktree-list', { repoRoot }),
  gitStatus:       (cwd)                  => ipcRenderer.invoke('git-status', { cwd }),
  gitCommitAll:    (cwd, message)         => ipcRenderer.invoke('git-commit-all', { cwd, message }),
  gitDiscardAll:   (cwd)                  => ipcRenderer.invoke('git-discard-all', { cwd }),
  gitInit:         (cwd)                  => ipcRenderer.invoke('git-init', { cwd }),
  // Artifact window (pop-out + state sync — same pattern as the pet window).
  isArtifactWindow:   ()                 => new URLSearchParams(window.location.search).get('artifactWindow') === 'true',
  artifactPopOut:     ()                 => ipcRenderer.invoke('artifact-pop-out'),
  artifactDockIn:     ()                 => ipcRenderer.invoke('artifact-dock-in'),
  onArtifactDocked:   (cb) => { const l = () => cb(); ipcRenderer.on('artifact-window-closed', l); return () => ipcRenderer.removeListener('artifact-window-closed', l); },
  broadcastArtifactState: (state)       => ipcRenderer.invoke('broadcast-artifact-state', state),
  sendArtifactAction:     (action)      => ipcRenderer.invoke('send-artifact-action', action),
  requestArtifactState:   ()            => ipcRenderer.invoke('request-artifact-state'),
  onArtifactState:        (cb) => { const l = (_, s) => cb(s); ipcRenderer.on('artifact-state', l); return () => ipcRenderer.removeListener('artifact-state', l); },
  onArtifactAction:       (cb) => { const l = (_, a) => cb(a); ipcRenderer.on('artifact-action', l); return () => ipcRenderer.removeListener('artifact-action', l); },
  onArtifactStateRequested: (cb) => { const l = () => cb(); ipcRenderer.on('artifact-state-requested', l); return () => ipcRenderer.removeListener('artifact-state-requested', l); },
  // Per-file pop-out windows — each file tab can pop into its own window,
  // multiple concurrent windows allowed (one per absolute path).
  isFileWindow:       ()           => new URLSearchParams(window.location.search).get('fileWindow') === 'true',
  fileWindowPath:     ()           => new URLSearchParams(window.location.search).get('path') || '',
  fileWindowMode:     ()           => new URLSearchParams(window.location.search).get('mode') || 'edit',
  filePopOut:         (filePath, mode = 'edit') => ipcRenderer.invoke('file-pop-out', { path: filePath, mode }),
  fileDockIn:         (filePath)   => ipcRenderer.invoke('file-dock-in', { path: filePath }),
  fileWindowList:     ()           => ipcRenderer.invoke('file-window-list'),
  onFileWindowClosed: (cb) => { const l = (_, p) => cb(p); ipcRenderer.on('file-window-closed', l); return () => ipcRenderer.removeListener('file-window-closed', l); },
  revealInExplorer:   (filePath)   => ipcRenderer.invoke('reveal-in-explorer', { path: filePath }),
  deleteFile:         (filePath)   => ipcRenderer.invoke('delete-file', { path: filePath }),
  // Explorer / file tree
  listDir:         (p)                    => ipcRenderer.invoke('list-dir', p),
  readFileText:    (p)                    => ipcRenderer.invoke('read-file-text', p),
  writeFileText:   (path, content)        => ipcRenderer.invoke('write-file-text', { path, content }),
  claudeDeleteSession: (opts) => ipcRenderer.invoke('claude-delete-session', opts),
  claudeReadSession:   (opts) => ipcRenderer.invoke('claude-read-session', opts),

  // Usage / rate limits
  getUsage:         ()      => ipcRenderer.invoke('get-usage'),
  resetSessionUsage:()      => ipcRenderer.invoke('reset-session-usage'),
  resetWindowUsage: (t)     => ipcRenderer.invoke('reset-window-usage', t),
  setBlockOverage:  (v)     => ipcRenderer.invoke('set-block-overage', v),
  setLimitCaps:     (caps)  => ipcRenderer.invoke('set-limit-caps', caps),
  getLastSendDiagnostics: () => ipcRenderer.invoke('get-last-send-diagnostics'),
  onUsage:          (cb)    => { const l = (_, d) => cb(d); ipcRenderer.on('usage-update', l); return () => ipcRenderer.removeListener('usage-update', l); },
  // Per-callback listener so unsubscribing one (e.g. PetChat unmount) doesn't
  // kill the others (e.g. main chat's listener).
  onStream:       (cb)    => { const l = (_, d) => cb(d); ipcRenderer.on('claude-stream', l); return () => ipcRenderer.removeListener('claude-stream', l); },
  onError:        (cb)    => { const l = (_, d) => cb(d); ipcRenderer.on('claude-error',  l); return () => ipcRenderer.removeListener('claude-error',  l); },

  // File system
  pickFolder:     ()      => ipcRenderer.invoke('pick-folder'),
  pickFile:       ()      => ipcRenderer.invoke('pick-file'),
  readFile:       (p)     => ipcRenderer.invoke('read-file', p),
  readImageDataUrl:(p)    => ipcRenderer.invoke('read-image-data-url', p),
  saveTempImage:  (opts)  => ipcRenderer.invoke('save-temp-image', opts),

  // Save / Load
  saveData:       (d)     => ipcRenderer.invoke('save-data', d),
  loadData:       ()      => ipcRenderer.invoke('load-data'),
  saveMemory:     (opts)  => ipcRenderer.invoke('save-memory', opts),
  saveActiveChat: (opts)  => ipcRenderer.invoke('save-active-chat', opts),
  loadActiveChat: (opts)  => ipcRenderer.invoke('load-active-chat', opts),
  loadMemory:     (opts)  => ipcRenderer.invoke('load-memory', opts),

  // Window controls
  resizeDelta:    (dx)    => ipcRenderer.invoke('window-resize-delta', { dx }),
  minimize:       ()      => ipcRenderer.invoke('window-minimize'),
  maximize:       ()      => ipcRenderer.invoke('window-maximize'),
  close:          ()      => ipcRenderer.invoke('window-close'),
  quitApp:        ()      => ipcRenderer.invoke('window-quit'),
  setTrayTooltip: (tip)   => ipcRenderer.invoke('tray-tooltip', tip),
  petPopOut:      ()      => ipcRenderer.invoke('pet-pop-out'),
  petDockIn:      ()      => ipcRenderer.invoke('pet-dock-in'),
  getMainBounds:  ()      => ipcRenderer.invoke('get-main-bounds'),
  onPetDocked:    (cb)    => { const l = () => cb(); ipcRenderer.on('pet-window-closed', l); return () => ipcRenderer.removeListener('pet-window-closed', l); },

  // Pet-window state sync
  broadcastPetState: (state)  => ipcRenderer.invoke('broadcast-pet-state', state),
  sendPetAction:     (action) => ipcRenderer.invoke('send-pet-action', action),
  requestPetState:   ()       => ipcRenderer.invoke('request-pet-state'),
  onPetState:        (cb) => { const l = (_, s) => cb(s); ipcRenderer.on('pet-state', l); return () => ipcRenderer.removeListener('pet-state', l); },
  onPetAction:       (cb) => { const l = (_, a) => cb(a); ipcRenderer.on('pet-action', l); return () => ipcRenderer.removeListener('pet-action', l); },
  onPetStateRequested:(cb) => { const l = () => cb(); ipcRenderer.on('pet-state-requested', l); return () => ipcRenderer.removeListener('pet-state-requested', l); },

  // Env
  isPetWindow: () => new URLSearchParams(window.location.search).has('petWindow'),
});
