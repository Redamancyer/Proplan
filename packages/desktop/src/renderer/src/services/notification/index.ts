import template from './index.html?raw'
import DOMPurify from 'dompurify'
import './index.css'

export type NotificationType = 'primary' | 'success' | 'error' | 'warning' | 'info'

const ICON_HASH: Record<NotificationType, string> = {
  primary: '<circle cx="8" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>',
  success: '<path d="m5 12 4 4L19 6"/>',
  error: '<path d="m7 7 10 10M17 7 7 17"/>',
  warning: '<path d="M12 6v7M12 17h.01"/>',
  info: '<path d="M12 11v6M12 7h.01"/>'
}
const TYPE_HASH: Record<NotificationType, string> = {
  primary: 'mt-primary',
  success: 'mt-success',
  error: 'mt-error',
  warning: 'mt-warn',
  info: 'mt-info'
}
let notificationId = 0
const getUniqueId = (): string => `proplan-notification-${++notificationId}`

const fillTemplate = (type: NotificationType, title: string, message: string): string => {
  return template
    .replace(/\{\{icon\}\}/, ICON_HASH[type])
    .replace(/\{\{title\}\}/, DOMPurify.sanitize(title))
    .replace(/\{\{message\}\}/, DOMPurify.sanitize(message))
}

export interface NotifyOptions {
  time?: number
  title?: string
  message?: string
  type?: NotificationType
  showConfirm?: boolean
}

interface NoticeCacheEntry {
  remove: () => void
}

interface NotificationService {
  name: string
  noticeCache: Record<string, NoticeCacheEntry>
  clear(): void
  notify(opts: NotifyOptions): Promise<void>
}

const notification: NotificationService = {
  name: 'notify',
  noticeCache: {} as Record<string, NoticeCacheEntry>,
  clear() {
    Object.keys(this.noticeCache).forEach((key) => {
      this.noticeCache[key].remove()
    })
  },
  notify({
    time = 10000,
    title = '',
    message = '',
    type = 'primary',
    showConfirm = false
  }: NotifyOptions): Promise<void> {
    let rs: (() => void) | undefined
    let rj: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout> | null = null
    const id = getUniqueId()

    const fragment = document.createElement('div')
    fragment.innerHTML = fillTemplate(type, title, message)

    const noticeContainer = fragment.querySelector('.mt-notification') as HTMLElement
    const bgNotice = noticeContainer.querySelector('.notice-bg') as HTMLElement
    const contentContainer = noticeContainer.querySelector('.content') as HTMLElement
    const fluent = noticeContainer.querySelector('.fluent') as HTMLElement
    const close = noticeContainer.querySelector('.close') as HTMLElement
    const { offsetHeight } = noticeContainer
    let target: HTMLElement = noticeContainer

    if (showConfirm) {
      noticeContainer.classList.add('mt-confirm')
      target = noticeContainer.querySelector('.confirm') as HTMLElement
    }

    noticeContainer.classList.add(TYPE_HASH[type])
    contentContainer.classList.add(TYPE_HASH[type])
    bgNotice.classList.add(TYPE_HASH[type])

    fluent.style.height = offsetHeight * 2 + 'px'
    fluent.style.width = offsetHeight * 2 + 'px'

    const setCloseTimer = (): void => {
      if (typeof time === 'number' && time > 0) {
        timer = setTimeout(() => {
          remove()
        }, time)
      }
    }

    const mousemoveHandler = (event: MouseEvent): void => {
      const { left, top } = noticeContainer.getBoundingClientRect()
      const x = event.pageX
      const y = event.pageY
      fluent.style.left = x - left + 'px'
      fluent.style.top = y - top + 'px'
      fluent.style.opacity = '1'
      fluent.style.height = noticeContainer.offsetHeight * 2 + 'px'
      fluent.style.width = noticeContainer.offsetHeight * 2 + 'px'

      if (timer) clearTimeout(timer)
    }

    const mouseleaveHandler = (_event: MouseEvent): void => {
      fluent.style.opacity = '0'
      fluent.style.height = noticeContainer.offsetHeight * 4 + 'px'
      fluent.style.width = noticeContainer.offsetHeight * 4 + 'px'

      if (timer) clearTimeout(timer)
      setCloseTimer()
    }

    const clickHandler = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      remove()
      if (rs) rs()
    }

    const closeHandler = (event: MouseEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      remove()
      if (rj) rj()
    }

    const rePositionNotices = (): void => {
      const notices = document.querySelectorAll('.mt-notification')
      let i
      let hx = 0
      const len = notices.length
      for (i = 0; i < len; i++) {
        const el = notices[i] as HTMLElement
        el.style.transform = `translate(0, -${hx}px)`
        el.style.zIndex = String(10000 - i)
        hx += el.offsetHeight + 10
      }
    }

    const remove = (): void => {
      fluent.style.filter = 'blur(10px)'
      fluent.style.opacity = '0'
      fluent.style.height = noticeContainer.offsetHeight * 5 + 'px'
      fluent.style.width = noticeContainer.offsetHeight * 5 + 'px'

      noticeContainer.style.opacity = '0'
      noticeContainer.style.right = '-400px'

      setTimeout(() => {
        noticeContainer.removeEventListener('mousemove', mousemoveHandler)
        noticeContainer.removeEventListener('mouseleave', mouseleaveHandler)
        target.removeEventListener('click', clickHandler)
        close.removeEventListener('click', closeHandler)
        noticeContainer.remove()
        rePositionNotices()
        if (notification.noticeCache[id]) {
          delete notification.noticeCache[id]
        }
      }, 100)
    }

    notification.noticeCache[id] = { remove }

    noticeContainer.addEventListener('mousemove', mousemoveHandler)
    noticeContainer.addEventListener('mouseleave', mouseleaveHandler)
    target.addEventListener('click', clickHandler)
    close.addEventListener('click', closeHandler)

    setTimeout(() => {
      bgNotice.style.width = noticeContainer.offsetWidth * 3.5 + 'px'
      bgNotice.style.height = noticeContainer.offsetWidth * 3.5 + 'px'
      rePositionNotices()
    }, 50)

    setCloseTimer()

    document.body.prepend(noticeContainer, document.body.firstChild as Node)

    return new Promise<void>((resolve, reject) => {
      rs = resolve
      rj = reject
    })
  }
}

export default notification
