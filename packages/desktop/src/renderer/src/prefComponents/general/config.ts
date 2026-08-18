import { t } from '../../i18n'
import type { PrefSelectOption } from '../common/types'

export const getLanguageOptions = (): PrefSelectOption<string>[] => [
  { label: t('preferences.general.misc.language.english'), value: 'en' },
  { label: t('preferences.general.misc.language.chinese'), value: 'zh-CN' }
]
