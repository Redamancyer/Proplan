import { t } from '../../i18n'
import type { PrefSelectOption } from '../common/types'

export const getLanguageOptions = (): PrefSelectOption<string>[] => [
  { label: t('preferences.general.misc.language.english'), value: 'en' },
  { label: t('preferences.general.misc.language.chinese'), value: 'zh-CN' },
  { label: t('preferences.general.misc.language.traditionalChinese'), value: 'zh-TW' },
  { label: t('preferences.general.misc.language.spanish'), value: 'es' },
  { label: t('preferences.general.misc.language.french'), value: 'fr' },
  { label: t('preferences.general.misc.language.german'), value: 'de' },
  { label: t('preferences.general.misc.language.japanese'), value: 'ja' },
  { label: t('preferences.general.misc.language.korean'), value: 'ko' },
  { label: t('preferences.general.misc.language.portuguese'), value: 'pt' },
  { label: t('preferences.general.misc.language.turkish'), value: 'tr' }
]
