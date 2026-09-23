// State machine for the in-app updater, shared by the main process (which owns it)
// and the renderer (which only displays it and sends user intent back).
export type UpdateStatus =
  | 'disabled'        // running from source (npm run dev) — updates only apply to the installed app
  | 'idle'
  | 'checking'
  | 'not-available'
  | 'available'       // a newer release exists; nothing downloaded yet
  | 'downloading'
  | 'downloaded'      // ready to install on restart
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  version?: string    // the newer version, for available/downloading/downloaded
  percent?: number    // 0–100, while downloading
  message?: string    // error text, for status 'error'
}
