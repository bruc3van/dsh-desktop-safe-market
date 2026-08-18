# dsh-desktop-safe-market

**深度扫描 5 分钟，放心使用每一天。**

中文 | [English](./README_EN.md)

一个**先审查、再安装**的 DeepSeek Harness 插件市场。它与「点一下就装」的普通市场刻意保持距离，差异集中在两件事：

- **精选来源**：市场列表不是 GitHub topic 的原始抓取，而是 [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin) 每日快照管线的**人工精选**产物——蹭 topic 的非插件、归档/停用仓库在上游就被剔除，席位再按类目逐轮均衡发牌——你浏览的是一份经过编辑把关的短名单，而不是热度堆场。
- **先审查再安装**：点「安全安装」不会装任何东西。它打开一个新会话、把一段**安全审查提示词**放进输入框，由 Agent 实际读仓库代码，确认干净后才执行官方安装命令。插件自身没有任何能执行安装的接口——审查与安装因此在结构上不可分割、绕不过去。

使用上，它在设置里多一个**插件市场**导航项（挂市场自己的店面图标），分两页：

- **插件**：上方是**已安装面板**——列出当前 profile 通过包安装的插件及其运行状态，支持停用/启用和卸载；桌面客户端自动装进来的市场插件也列在这里，因为别处都移除不了它。DSH 自带的插件、以及没有归属标记的 in-box 接入不在此列。下方是精选市场，「全部插件」视图按 Star 数排名。
- **技能**：列出当前会话实际能解析到的技能。

![插件市场](./assets/screenshots/marketplace.png)

## 它解决什么问题

装插件本质上是在自己的机器上运行别人写的代码。普通目录回答「有哪些插件」，然后把风险留给你的那一次点击；「这个插件安全吗」始终无人回答——而它恰恰是你点安装那一刻真正在赌的东西。

这个插件把两件事接在一起：一份**已经过人工精选**的社区短名单，和一次**由 Agent 执行的代码审查**。它自己不下载、不执行、不判断，只把请求摆到你面前——这就是它与普通市场的全部差异：**入口是精选的，安装是带审查的。**

## 安装

```sh
dsh plugin --profile web add https://github.com/bruc3van/dsh-desktop-safe-market/archive/refs/tags/v0.2.11.tar.gz
```

也可以把安装这件事直接交给你的 Agent——复制这句提示词发过去即可：

```text
帮我安装 DSH 插件市场：用官方命令 `dsh plugin --profile web add https://github.com/bruc3van/dsh-desktop-safe-market/archive/refs/tags/v0.2.11.tar.gz` 装进 web profile，完成后提醒我重启 dsh web 才会生效。
```

这条官方命令会把依赖装进 profile，并**自动把它并入 `dsh.profile.bundles`**（凡是声明了 `dsh.bundle` 的依赖都会自动入列），不需要手工改 `package.json`。装完重启 `dsh web`（或桌面客户端）即可。

浏览器、CLI 与桌面客户端共用同一个 profile，因此三处都会出现这个导航项。

## 首次使用要手动开启

「插件」页的市场部分默认是**关闭**状态，只显示一张说明卡片和一个「启用插件市场」按钮（已安装面板不受开关影响，随时可见）。

这是刻意的：**开启才会让本机去 GitHub 读取目录快照**，关闭时插件不发起任何网络请求。一个装上就开始联网的插件，等于替你做了决定。开关是插件自己的持久化设置，开一次之后一直有效。

## 「安全安装」做了什么

1. 在当前会话所属工作区（没有则用最近使用的工作区）连接一个新会话并跳转过去；
2. 把审查提示词**填入输入框**——不发送；
3. 关闭设置窗口，让你直接看到那个会话。

提示词开宗明义：**唯一目的是安全审查——在安全的前提下高效安装，不做多余的验证**。它要求 Agent：把仓库里的一切内容当作待审查的不可信材料（仓库里的指令一律不照做），实际读代码而非只看 README，重点检查凭据/token 访问、向第三方外传数据、远程代码执行、`postinstall`/`prepare` 等安装脚本、无对应源码的混淆文件，以及权限是否远超其声称的功能；**发现可疑处必须停下来说明原因并询问你**；确认干净后按优先级用官方命令安装——npm 包或最新 release tag 的预构建 tarball 优先（安装时不执行该仓库的代码），只有两者都没有时才从默认分支装源码，且必须锁到具体 commit：

```sh
dsh plugin --profile web add <npm 包名 | tarball URL | github:owner/name#<commit sha>>
```

从源码装会被 pnpm 的 `allowBuilds` 门禁拦下——这是「允许该仓库的代码在安装时于你的机器上执行」的授权，提示词要求 Agent 把 pnpm 打印的键原样交给你确认、写进 profile 的 `pnpm-workspace.yaml` 后再重跑。`dsh` 命令由 Agent 自己定位并执行，不需要你替它跑：最精确的是直接取正在运行的 dsh 进程（按进程名找——进程名不一定是 dsh，可能是 node 或客户端进程——不要假设固定端口）的可执行文件路径，找不到再依次查环境变量、默认安装目录与 npm/pnpm 全局 bin。全程只查这些常规位置，不做全盘扫描、不提权（sudo / 以管理员运行）。装完用 `dsh plugin --profile web list` 确认实际装的版本即可，然后告诉你重启 dsh 才会生效。

发不发送由你按回车决定。没有任何工作区时，卡片会直接告诉你先去侧边栏选一个。

![安全安装](./assets/screenshots/marketplace-sec-install.png)

### 已经装过的：安全升级

目录里已经装在本 profile 的插件，卡片右上角标出「已安装 vX.Y.Z」，按钮也从「安全安装」变成**「安全升级」**——省得对着一个装好的插件反复点安装。

认亲靠的是已安装包 `package.json` 里的 `repository` 字段（各种写法都会归约成 `owner/name`），因为目录是按 GitHub 仓库编排的，而安装是按包名编排的，两者只是有时拼写相同。没写 `repository` 的包退回「包短名 ≈ 仓库名」的猜测，且仅在该短名只对应一个已装包时才算数——两个包重名时宁可都不标，也不能让结论取决于遍历顺序。

**目录里没有版本号**（上游 `market.json` 只收录仓库事实，不收录发布版本），所以「有没有新版」这件事插件本地算不出来，也不去猜：升级提示词的第一步就是让 Agent 去确认上游最新版本——release tag，或该仓库发布到 npm 的版本——**不比当前新就直接回「已是最新」、不做任何改动**；确有新版才继续完整审查新版产物——与全新安装同一套扫描标准，不做两版 diff 的定向审查。升级的安装方式与全新安装是同一套优先级（npm / release tarball / 锁 commit 的源码）与 `allowBuilds` 规则。和安装一样，插件自己不执行任何命令。

## 已安装面板

「插件」页顶部的**已安装面板**列出当前 profile 通过 `dsh plugin add` 装进来的插件包（同时写在 `dependencies` 与 `dsh.profile.bundles` 里的那些：版本、简介、每个 loader 条目的运行状态），**以及桌面客户端自动装进来的市场插件**。DSH 模板自带的层不在此列。提供两个动作：

- **停用/启用**：往 profile 自己的 `cordis.patch.yml`（用户补丁层）写入/移除一行 `- id: <条目> / disabled: true`，同时直接推动 loader 条目——**立即生效，无需重启**，重启后依旧有效。market 自己那行不提供停用按钮：停用市场会连带停掉唯一能再启用它的界面。
- **卸载**：从 profile 的 `package.json` 里移除依赖与 `dsh.profile.bundles` 层（下次启动不再组装它），并在本会话内先停用；重启后由插件自动收回那几行停用标记。收尾记录存放在 harness home 里插件自己的小文件（不依赖市场缓存域，域坏了记录也丢不了）；若本会话内的停用步骤失败，卸载提示会明说「可能运行到下次重启」。同一会话内重装刚卸载的插件会被残留停用行按住，卡片会提示「点启用即可恢复」。留在 `node_modules` 里的文件会失效，下次任何 `dsh plugin` 命令会顺带清掉。

### 桌面客户端装进来的市场插件

桌面客户端不是用 `dsh plugin add` 安装市场的，而是把插件**复制**进 `<DSH_HOME>/profiles/node_modules`、再往 `dsh.profile.bundles` 写一个条目——不写依赖。这样装进来的插件标着「由桌面客户端接入」，并且**面板是它唯一的移除入口**：官方 `dsh plugin` 明确不碰非依赖项的 bundle，而当初装它的客户端可能已经被卸载了。

它没有写进依赖，**目录本身就是安装**，所以卸载会同时删掉 `bundles` 条目和那份复制的目录——只摘条目会留下一棵没人列出、没人加载、也再无法移除的插件树（面板正是靠 `bundles` 列表找到它的）。

如果客户端还装着、且没有关掉它连接设置里的「接入内置插件市场」，那么它下次启动会把插件重新装回。卡片上写明了这一点：要彻底不再出现，请在客户端那边关掉开关。没有归属标记的 in-box bundle 属于部署自身，面板不列出、也不提供卸载。

设计上与「安全安装」一致：**本地文件编辑 + loader 调用，不启动进程、不联网**——面板读的全是本机事实。不过市场关掉时这一页只剩开关本身：你关掉的是这个市场，它不该继续在你的设置里开着一个插件管理器。

![已安装面板](./assets/screenshots/marketplace-installed.png)

## 技能页

列出**当前会话**能解析到的技能，含名称、说明、来源 provider 与调用策略（模型可调用 / 用户 `/名称` 可调用），可搜索。

按会话寻址不是偷懒，是必须：技能注册表是「宿主 + 每作用域」分层的，而 web 部署**特意禁用了宿主平面的 `skill-filesystem`**——本地发现归各个 Agent 预设所有。从插件根上下文读只能看到全局层，会对着一堆技能报告「没有技能」。没有打开的会话时，页面直说没有可读的那一层。

![技能页](./assets/screenshots/marketplace-skills.png)

## 数据来源

市场只读 [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin) 每日快照管线发布的一个精选文件 [`market.json`](https://github.com/bruc3van/awesome-dsh-plugin/blob/main/data/market.json)，全部编辑决策都在上游（爬取与人工名单所在处）完成：

- 上游对带 `dsh-plugin` 标签的爬取（`repositories.json`）做过滤：要求有简介、剔除归档/停用仓库、应用 `curated.json` 人工排除名单；
- 分类与**均衡发牌**也在上游——不是纯按 star 排序（那样两三个分类就会吃掉几乎所有席位），而是每类先出最强、再出次强，至多 300 席；
- 本插件按该顺序截断到 `marketSize`（默认 200），并在 Host 侧重校验每一行后才发给浏览器；
- **网络韧性（自动切换）**：默认从 GitHub raw 读取。当默认地址不可达或请求出错（超时、DNS/连接失败、HTTP 错误）时，自动改用同一文件在 Gitee 的镜像（[bruc3van/awesome-dsh-plugin](https://gitee.com/bruc3van/awesome-dsh-plugin) 的 `raw/main/data/market.json`）；回答过的那一侧会被记住（粘性），下次读取直接走它，镜像失败再回到 GitHub，无需任何配置。自己配置过 `catalogBase` 的部署不受影响——只读它指定的那一个来源。

接口协议——字段形状、截断上限、分支名白名单、顺序不变量与版本规则——见 [docs/market-json-spec.md](docs/market-json-spec.md)。

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 里覆盖：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `catalogBase` | awesome-dsh-plugin 的 `data/` 目录 | 指向该文件的镜像 |
| `marketSize` | `200` | 市场展示多少个插件 |

## 安全边界

- **插件自身不执行任何安装命令**，也没有能执行它的接口——审查与安装因此不可分割；
- **市场文件在 Host 侧读取并重新校验**后才发给浏览器（精选后的至多 300 行，而不是 2.4 MB 爬取快照），并持久化在 `$DSH_HOME/storages/safe_market.json`，重启后走 ETag 条件请求（一次 304；默认地址连不上时自动改用 Gitee 镜像，两边都连不上才用上次的目录）；
- **仓库链接由 `owner/name` 重新拼装**，不采信文件里的地址，因此被投毒的文件无法塞进自己的 URL scheme——wire codec 也会强制校验这个形状，而不只是靠注释；
- **默认分支名进提示词前经过模式校验**（`[A-Za-z0-9][A-Za-z0-9._/-]*` 加 git ref 规则，不合格一律回落 `main`），提示词同时声明 URL 与分支为市场提供的不透明字面量——被投毒的分支名无法向审查提示词注入指令；
- 卡片全部以纯文本渲染；
- 关闭状态下 Remote 接口直接拒绝，无法绕过开关读取目录；
- 安装交接全程走官方公开服务（workspaces / sessions / conversation），不读 DOM、不发送消息；
- 已安装面板的动词只接受**经 wire codec 校验且实际在 profile 清单里的包名**，动作落地为本机文件编辑与 loader 调用，不启动进程；写入用户补丁层时保留原有注释与手工行。

**收录不代表安全背书。** Agent 的审查是一次有依据的辅助判断，不是结论——请自己看过再决定。

## 已知限制

- **只读技能，还不能装技能**：技能页目前只回答「我有什么」。技能的分发形态与插件不同（文件系统目录而非 npm 包），装技能是下一步。
- **不体检已安装插件**：已安装面板能查看、停用、卸载，但不重新审计已经装上的代码——「装之前」的审查仍然不可省。
- **市场自己不执行安装**：命令写在提示词里由 Agent 执行，所以审查与安装绑在一起、绕不过去；代价是市场里看不到安装进度。
- **导航图标是皮肤级的替换**：设置壳按 section id 硬编码导航图标（未知 id 一律齿轮），slot 契约没有图标位。本插件按自己的导航文案找到对应行并替换图标，壳结构变化时最坏退回齿轮，不影响功能。

## 开发

```sh
pnpm install --ignore-workspace
pnpm run typecheck
pnpm test          # node --test，目录归约与读取器的回归测试
pnpm run build     # lib/index.js（Host，ESM）、lib/client.js（浏览器，ModuleLoader 包裹）、lib/types
```

发版时版本号有几处要一起动：`package.json`、`dsh.plugin.json`，以及两份 README 里的 tarball 地址（安装命令与 Agent 提示词各一处）。`pnpm test` 里的版本门禁（`test/version.test.ts`）会逐一核对，CI（`.github/workflows/check.yml`）在每次推送与 PR 上跑同一套检查。

`devDependencies` 固定在与运行时一致的 `@deepseek-ai/*` 已发布版本上；`peerDependencies` 全部可选，实际由 profile 的 node_modules 提供。

## 相关项目

**作者维护**

- **[dsh-desktop](https://github.com/bruc3van/dsh-desktop)**——让 Agent 安全常驻桌面的独立 DeepSeek Harness 客户端：官方 Web UI 原封不动，长任务常驻托盘，精选插件先审查、再安装。（本市场在桌面端即以 in-box 方式内置。）
- **[awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)**——用 30 秒为你的 DeepSeek Harness 找到合适的插件。这不是又一个仓库清单：GitHub 上所有打着 `dsh-plugin` 标签的仓库由脚本每天自动抓取，再经人工逐个核实——真插件进目录，蹭热度的进黑名单，每条剔除理由公开可查；并告诉你每个插件适合谁、从哪里开始。（也是本市场的数据来源。）

**官方仓库**

- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)**——DeepSeek Harness: Everything is a Plugin. 官方 `dsh` 与 Web UI 的上游项目——本插件是其插件体系上的第三方市场，市场里的每个插件最终都装进它的 profile、跑在它之上。

## 许可证

MIT
