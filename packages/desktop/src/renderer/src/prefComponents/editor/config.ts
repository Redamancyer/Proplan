import { t } from '../../i18n'
import type { PrefSelectOption } from '../common/types'

export const tabSizeOptions: PrefSelectOption<number>[] = [1, 2, 3, 4].map((value) => ({
  label: String(value),
  value
}))

export const getTextDirectionOptions = (): PrefSelectOption<string>[] => [
  { label: t('preferences.editor.misc.textDirection.ltr'), value: 'ltr' },
  { label: t('preferences.editor.misc.textDirection.rtl'), value: 'rtl' }
]
