<template>
  <div class="pref-keybindings">
    <h4>{{ t('preferences.keybindings.title') }}</h4>
    <p class="description">
      {{ description }}
    </p>

    <section
      v-for="group in shortcutGroups"
      :key="group.title"
      class="shortcut-section"
    >
      <h6>{{ group.title }}</h6>
      <div class="shortcut-list">
        <div
          v-for="shortcut in group.items"
          :key="shortcut.label"
          class="shortcut-row"
        >
          <span>{{ shortcut.label }}</span>
          <span class="key-combination">
            <kbd
              v-for="key in shortcut.keys"
              :key="key"
            >{{ key }}</kbd>
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface ShortcutItem {
  label: string
  keys: string[]
}

const { locale, t } = useI18n()
const isMac = window.electron.process.platform === 'darwin'
const command = isMac ? '⌘' : 'Ctrl'
const shift = isMac ? '⇧' : 'Shift'

const description = computed(() =>
  locale.value.startsWith('zh')
    ? '这里展示 Proplan 当前可用的常用快捷键。快捷键采用固定配置。'
    : 'Common shortcuts currently available in Proplan. These bindings are fixed.'
)

const shortcutGroups = computed<Array<{ title: string; items: ShortcutItem[] }>>(() => {
  const zh = locale.value.startsWith('zh')
  return [
    {
      title: zh ? '常规' : 'General',
      items: [
        { label: zh ? '保存' : 'Save', keys: [command, 'S'] },
        { label: zh ? '打开偏好设置' : 'Open Preferences', keys: [command, ','] }
      ]
    },
    {
      title: zh ? '编辑' : 'Editing',
      items: [
        { label: zh ? '撤销' : 'Undo', keys: [command, 'Z'] },
        { label: zh ? '重做' : 'Redo', keys: isMac ? [shift, command, 'Z'] : [command, 'Y'] },
        { label: zh ? '剪切' : 'Cut', keys: [command, 'X'] },
        { label: zh ? '复制' : 'Copy', keys: [command, 'C'] },
        { label: zh ? '粘贴' : 'Paste', keys: [command, 'V'] },
        { label: zh ? '全选' : 'Select All', keys: [command, 'A'] }
      ]
    },
    {
      title: 'Markdown',
      items: [
        { label: zh ? '粗体' : 'Bold', keys: [command, 'B'] },
        { label: zh ? '斜体' : 'Italic', keys: [command, 'I'] },
        { label: zh ? '下划线' : 'Underline', keys: [command, 'U'] },
        { label: zh ? '删除线' : 'Strikethrough', keys: [command, 'D'] },
        { label: zh ? '高亮' : 'Highlight', keys: [shift, command, 'H'] },
        { label: zh ? '行内代码' : 'Inline Code', keys: [command, '`'] },
        { label: zh ? '行内公式' : 'Inline Math', keys: [shift, command, 'M'] },
        { label: zh ? '链接' : 'Link', keys: [command, 'L'] },
        { label: zh ? '图片' : 'Image', keys: [shift, command, 'I'] },
        { label: zh ? '清除格式' : 'Clear Formatting', keys: [shift, command, 'R'] }
      ]
    },
    {
      title: zh ? '窗口' : 'Window',
      items: [
        { label: zh ? '放大' : 'Zoom In', keys: [command, '+'] },
        { label: zh ? '缩小' : 'Zoom Out', keys: [command, '-'] },
        { label: zh ? '重置缩放' : 'Reset Zoom', keys: [command, '0'] },
        {
          label: zh ? '切换全屏' : 'Toggle Full Screen',
          keys: isMac ? [command, 'Ctrl', 'F'] : ['F11']
        }
      ]
    }
  ]
})
</script>

<style scoped>
.pref-keybindings {
  max-width: 760px;
  color: var(--editorColor);
}

.description {
  margin: 8px 0 28px;
  color: var(--editorColor60);
  font-size: 13px;
  line-height: 1.6;
}

.shortcut-section {
  margin: 0 0 28px;
}

.shortcut-section h6 {
  margin: 0 0 8px;
}

.shortcut-list {
  border-top: 1px solid var(--editorColor10);
}

.shortcut-row {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  border-bottom: 1px solid var(--editorColor10);
  font-size: 13px;
}

.key-combination {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

kbd {
  min-width: 25px;
  height: 24px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border: 1px solid var(--editorColor20);
  border-bottom-color: var(--editorColor30);
  border-radius: 5px;
  color: var(--editorColor80);
  font-family: inherit;
  font-size: 11px;
  line-height: 1;
  background: var(--editorColor04);
  box-shadow: 0 1px 0 var(--editorColor10);
}
</style>
