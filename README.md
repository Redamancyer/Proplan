# Proplan

Proplan 是一款本地优先的桌面项目管理工具，用于集中管理项目备忘、任务、时间轴与日程。它将项目管理、日历、待办列表和实时 Markdown 编辑器整合在一个桌面窗口中。

> Proplan 目前优先支持 macOS，同时保留 Windows 和 Linux 的跨平台打包配置。

## 功能特性

- 创建多个项目，并在可调整宽度的侧边栏中进行管理。
- 在每个项目中添加备忘、任务和时间轴记录。
- 使用所见即所得的实时 Markdown 编辑器编辑所有记录。
- 通过斜杠命令插入标题、列表、表格、链接、图片等内容块。
- 在项目日历中查看备忘、任务和时间轴记录。
- 在“我的待办”中通过“全部待办”和“今日待办”筛选未完成事项。
- 已完成的任务会自动从待办列表和日历中隐藏，同时保留历史数据。
- 导入本地图片，或将远程图片下载至应用管理的本地存储空间。
- 编辑器中的图片引用被删除后，同步清理对应的托管图片。
- 配置主题、编辑器宽度、Markdown 行为、图片行为和自动保存。
- 创建包含数据库、偏好设置及托管图片的完整备份，并支持原位恢复。
- 强制使用单主窗口运行，同时将偏好设置保留为独立的工具窗口。

Proplan 不再提供原 MarkText 的独立 Markdown 文件编辑功能，也不会注册为 Markdown 文件的默认处理程序。

## 技术栈

- [Electron](https://www.electronjs.org/)：桌面运行环境
- [Vue 3](https://vuejs.org/) 与 TypeScript：渲染进程界面
- [Pinia](https://pinia.vuejs.org/)：应用状态管理
- [Muya](https://github.com/marktext/muya)：实时 Markdown 编辑器
- [SQLite](https://www.sqlite.org/)：项目、备忘、任务和时间轴的本地持久化
- pnpm workspace：管理桌面端与编辑器软件包

## 环境要求

- Node.js 22.5 或更高版本（开发和测试使用内置 `node:sqlite`）
- pnpm 10 或更高版本
- 使用 macOS 打包时，需要安装 Xcode 和 Xcode Command Line Tools

可通过 Corepack 使用仓库指定的 pnpm 版本：

```bash
corepack enable
corepack pnpm install
```

## 本地开发

启动 Electron 开发环境：

```bash
corepack pnpm dev
```

常用检查命令：

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:unit
corepack pnpm build
```

运行 Proplan 启动与单实例端到端测试：

```bash
corepack pnpm --filter proplan exec playwright test test/e2e/launch.spec.ts
```

## 应用打包

构建 Apple Silicon 版 macOS 应用：

```bash
corepack pnpm build:mac:arm64
```

构建 Intel 版 macOS 应用：

```bash
corepack pnpm build:mac:x64
```

构建产物将写入 `dist/`。macOS 构建结果包括 `Proplan.app`、DMG 安装包和 ZIP 压缩包。除非另外提供 Apple 签名凭证，否则本地构建的应用不会签名。

## 本地数据

Proplan 采用本地优先设计，无需注册账号，也不依赖远程数据库。在 macOS 上，应用数据存储于：

```text
~/Library/Application Support/Proplan/
|-- proplan.sqlite          # 项目、备忘、任务和时间轴数据
|-- proplan-assets/         # 应用托管的图片
|-- preferences.json        # 应用偏好设置
|-- proplan-data.pre-sqlite.json # 首次迁移 SQLite 后保留的旧数据
`-- proplan-before-restore.proplan-backup
```

从使用 JSON 存储的旧版本升级时，Proplan 会在首次启动时通过事务将
`proplan-data.json` 导入 SQLite。迁移成功后，原文件会保留为
`proplan-data.pre-sqlite.json`，后续启动不会重复导入。

通过偏好设置创建的备份使用 `.proplan-backup` 扩展名，可保存至用户选择的任意位置。恢复操作替换本地数据前，应用会自动创建一份安全备份。

首次启动时，Proplan 可以从 `~/Library/Application Support/marktext` 迁移兼容数据，原目录不会被删除。

## 仓库结构

```text
packages/
|-- desktop/     # Electron 主进程、预加载脚本、Vue 界面、测试与打包配置
|-- muya/        # Proplan 使用的 Markdown 编辑器引擎
`-- muyajs/      # 共享的 Markdown 与编辑器兼容软件包
```

## 开源许可与来源说明

Proplan 基于 [MIT License](LICENSE) 发布。

本项目基于开源项目 [MarkText](https://github.com/marktext/marktext) 的桌面端架构进行二次开发，并使用 [Muya](https://github.com/marktext/muya) Markdown 编辑器。上游版权声明及第三方开源许可证均保留在源代码和应用打包生成的许可证报告中。
