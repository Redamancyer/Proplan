import { registerBootInfo } from './bootInfo'
import { registerFontsHandlers } from './fonts'
import { registerI18nHandlers } from './i18n'
import { registerLicenseHandlers } from './licenses'
import { registerProplanHandlers } from './proplan'
import { registerShellHandlers } from './shell'
import { registerWindowHandlers } from './window'

export const registerSandboxIpcHandlers = (): void => {
  registerBootInfo()
  registerFontsHandlers()
  registerI18nHandlers()
  registerLicenseHandlers()
  registerProplanHandlers()
  registerShellHandlers()
  registerWindowHandlers()
}
