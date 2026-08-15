# dsh-desktop-safe-market

[English](./README.md) | 中文

给 DeepSeek Harness Web UI 加一个**先审查、再安装**的插件市场：在「设置 → 插件」里多一个**插件市场**标签页，按分类均衡列出社区精选的 100 个插件；点「安全安装」不会替你装任何东西，而是打开一个新会话并把一段**安全审查提示词**填进输入框，由你按回车让 Agent 先读代码再决定。

![插件市场](./assets/screenshots/market.png)

## 它解决什么问题

装插件本质上是在自己的机器上运行别人写的代码。社区目录能告诉你「有哪些插件」，但回答不了「这个插件安全吗」——而后者恰恰是你点安装那一刻真正在赌的东西。

这个插件把两件事接在一起：一份**已经过人工排除**的社区精选清单，和一次**由 Agent 执行的代码审查**。它自己不下载、不执行、不判断，只把请求摆到你面前。

## 安装

编辑 `~/.dsh/profiles/web/package.json`，加一条依赖，并把它加进 `dsh.profile.bundles`：

```jsonc
{
  "dependencies": {
    "dsh-desktop-safe-market": "https://github.com/bruc3van/dsh-desktop-safe-market/archive/refs/tags/v0.1.0.tar.gz"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-desktop-safe-market"
      ]
    }
  }
}
```

重启 `dsh web`（或桌面客户端）即可。浏览器、CLI 与桌面客户端共用同一个 profile，因此三处都会出现这个标签页。

## 首次使用要手动开启

标签页默认是**关闭**状态，只显示一张说明卡片和一个「启用插件市场」按钮。

这是刻意的：**开启才会让本机去 GitHub 读取目录快照**，关闭时插件不发起任何网络请求。一个装上就开始联网的插件，等于替你做了决定。开关是插件自己的持久化设置，开一次之后一直有效。

## 「安全安装」做了什么

1. 在当前会话所属工作区（没有则用最近使用的工作区）连接一个新会话并跳转过去；
2. 把审查提示词**填入输入框**——不发送；
3. 卡片上显示「已在新会话填入审查提示词」。

提示词要求 Agent：实际读仓库代码而非只看 README，重点检查凭据/token 访问、向第三方外传数据、远程代码执行、`postinstall` 等安装脚本、无对应源码的混淆文件，以及权限是否远超其声称的功能；**发现可疑处必须停下来说明原因并询问你**，确认干净后才按插件自己的文档安装。

发不发送由你按回车决定。没有任何工作区时，卡片会直接告诉你先去侧边栏选一个。

## 数据来源

[awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin) 的每日快照：

- `repositories.json` —— 带 `dsh-plugin` 标签的仓库爬取结果（含分类、star、许可证、最近推送时间）；
- `curated.json` —— 人工排除名单（竞品目录站、star 不属于该插件的产品仓库等）。

**两份必须一起读**：爬取结果里没有应用排除名单，只读第一份会让一个竞品目录站排在你的市场首位。归档仓库同样被剔除。

选人规则不是纯按 star 排序——那样两三个分类就会吃掉几乎所有席位。这里按分类**轮流发牌**：每个分类先放出自己最强的一个，再放第二个，直到 100 席满；最终展示时再按 star 排序，所以列表读起来仍然像一张榜单。

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 里覆盖：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `catalogBase` | awesome-dsh-plugin 的 `data/` 目录 | 换成你自己的目录来源 |
| `marketSize` | `100` | 市场展示多少个插件 |

## 安全边界

- **目录在 Host 侧读取并裁剪**后才发给浏览器（约 100 行，而不是 2.4 MB 快照）；
- **仓库链接由 `owner/name` 重新拼装**，不采信快照里的地址，因此被投毒的快照无法塞进自己的 URL scheme；
- 卡片全部以纯文本渲染；
- 关闭状态下 Remote 接口直接拒绝，无法绕过开关读取目录；
- 安装交接全程走官方公开服务（workspaces / sessions / conversation），不读 DOM、不发送消息。

**收录不代表安全背书。** Agent 的审查是一次有依据的辅助判断，不是结论——请自己看过再决定。

## 已知限制

- **目录缓存只在内存里**：Host 重启后第一次读取会重新拉取完整快照（约 2.4 MB）；同一次运行内走 ETag 条件请求，重开标签页只花两个 304。
- **不会替你关闭设置窗口**：官方的「插件」分区不向标签页传递关闭回调，所以会话已经切好、提示词已经填好，但设置窗口需要你自己关。
- **不检查已安装插件**：这里只处理「装之前」，不体检已经装上的东西。

## 开发

```sh
pnpm install --ignore-workspace
pnpm run typecheck
pnpm run build      # lib/index.js（Host，ESM）、lib/client.js（浏览器，ModuleLoader 包裹）、lib/types
```

`devDependencies` 固定在与运行时一致的 `@deepseek-ai/*` 已发布版本上；`peerDependencies` 全部可选，实际由 profile 的 node_modules 提供。

## 许可证

MIT
