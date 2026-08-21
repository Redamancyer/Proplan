// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import notice, { type NotificationType } from '@/services/notification'

const notificationTypes: { type: NotificationType; className: string }[] = [
  { type: 'primary', className: 'mt-primary' },
  { type: 'success', className: 'mt-success' },
  { type: 'error', className: 'mt-error' },
  { type: 'warning', className: 'mt-warn' },
  { type: 'info', className: 'mt-info' }
]

describe('notification icons', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = '<div id="app"></div>'
  })

  afterEach(() => {
    notice.clear()
    vi.runAllTimers()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it.each(notificationTypes)(
    'renders a visible inline icon for $type messages',
    ({ type, className }) => {
      notice.notify({ type, title: type, message: 'message', time: 0 }).catch(() => undefined)

      const notification = document.querySelector(`.mt-notification.${className}`)
      const icon = notification?.querySelector('.notification-icon')
      expect(notification).not.toBeNull()
      expect(icon?.querySelectorAll('path, circle').length).toBeGreaterThan(0)
      expect(icon?.querySelector('use')).toBeNull()
    }
  )
})
