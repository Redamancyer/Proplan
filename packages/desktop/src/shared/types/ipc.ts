import type {
  ProplanBackupResult,
  ProplanDatabase,
  ProplanImageImportResult,
  ProplanImageSource,
  ProplanRestoreRequest,
  ProplanRestoreResult
} from './proplan'
import type { LicenseDocumentKind } from './licenses'

export interface IpcInvokeChannels {
  'mt::clipboard::guess-file-path': { args: []; ret: string | null }
  'mt::clipboard::read-text': { args: []; ret: string }
  'mt::fonts::list': { args: []; ret: string[] }
  'mt::i18n::load': { args: [language: string]; ret: Record<string, unknown> }
  'mt::licenses::read': { args: [kind: LicenseDocumentKind]; ret: string }
  'mt::proplan::backup': { args: []; ret: ProplanBackupResult }
  'mt::proplan::assets-path': { args: []; ret: string }
  'mt::proplan::load': { args: []; ret: ProplanDatabase }
  'mt::proplan::open-assets-folder': { args: []; ret: string }
  'mt::proplan::import-image': {
    args: [source: ProplanImageSource]
    ret: ProplanImageImportResult | null
  }
  'mt::proplan::restore': { args: [request: ProplanRestoreRequest]; ret: ProplanRestoreResult }
  'mt::proplan::save': { args: [database: ProplanDatabase]; ret: void }
  'mt::shell::open-external': { args: [url: string]; ret: boolean }
  'mt::shell::open-path': { args: [fullPath: string]; ret: string }
  'mt::spellchecker-get-available-dictionaries': { args: []; ret: string[] }
  'mt::spellchecker-get-custom-dictionary-words': { args: []; ret: string[] }
  'mt::spellchecker-remove-word': { args: [word: string]; ret: boolean }
  'mt::spellchecker-set-enabled': { args: [enabled: boolean]; ret: boolean }
  'mt::spellchecker-switch-language': { args: [language: string]; ret: null }
  'mt::win::is-fullscreen': { args: []; ret: boolean }
  'mt::win::is-maximized': { args: []; ret: boolean }
}

export interface IpcSendChannels {
  'mt::INSTALL_UPDATE': []
  'mt::NEED_UPDATE': [payload: { needUpdate: boolean }]
  'mt::ask-for-user-preference': []
  'mt::check-for-update': []
  'mt::clipboard::write-text': [text: string]
  'mt::close-setting-window': []
  'mt::close-window': []
  'mt::get-current-language': []
  'mt::handle-renderer-error': [error: unknown]
  'mt::open-setting-window': [category?: string]
  'mt::proplan::flush-before-backup-complete': [requestId: string, error?: string]
  'mt::set-user-preference': [partial: Record<string, unknown>]
  'mt::shell::show-item': [fullPath: string]
  'mt::win::close': []
  'mt::win::maximize': []
  'mt::win::minimize': []
  'mt::win::set-fullscreen': [flag: boolean]
  'mt::win::toggle-fullscreen': []
  'mt::win::toggle-maximize': []
  'mt::win::unmaximize': []
}

export interface IpcSyncChannels {
  'mt::boot-info': { args: []; ret: BootInfo }
}

export interface IpcMainEventChannels {
  'language-changed': [language: string]
  'mt::UPDATE_CHECKING': [message: string]
  'mt::UPDATE_DOWNLOADING': [message: string]
  'mt::UPDATE_AVAILABLE': [message: string]
  'mt::UPDATE_DOWNLOADED': [message: string]
  'mt::UPDATE_ERROR': [message: string]
  'mt::UPDATE_NOT_AVAILABLE': [message: string]
  'mt::about-dialog': [license?: LicenseDocumentKind]
  'mt::ask-for-close': []
  'mt::current-language': [language: string]
  'mt::proplan::flush-before-backup': [requestId: string]
  'mt::proplan::editor-command': [command: 'undo' | 'redo']
  'mt::proplan::restored': []
  'mt::settings-window-visibility': [visible: boolean]
  'mt::user-preference': [partial: Record<string, unknown>]
  'settings::change-tab': [category?: string]
}

export interface BootInfo {
  platform: NodeJS.Platform
  arch: string
  versions: Record<string, string>
  env: Record<string, string>
  paths: {
    resources: string
    userData: string
    cwd: string
  }
  isUpdatable: boolean
}
