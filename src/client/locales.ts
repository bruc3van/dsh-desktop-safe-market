/**
 * `settings.safeMarket` locale namespace: the market tab's copy.
 * Chinese is the product copy; English mirrors it.
 */

/**
 * Simplified Chinese dictionary (the key-set source of truth).
 *
 * Two keys are not display text. `lang` is how the tab learns which language
 * it is being rendered in — the slot props carry a translate function, not a
 * locale tag — and `prompt` is the security-review request staged into the
 * composer, which is user-facing copy like any other and belongs where the
 * rest of the copy is translated.
 */
export const zh = {
  'lang': 'zh',
  'prompt': `请你帮我审查一下这个 DSH 插件的安全性：{url}

请实际读仓库代码，不要只看 README。重点关注：是否读取凭据或 token、是否向第三方地址外传数据、是否存在远程代码执行或下载后执行的逻辑、安装脚本（postinstall 等）里做了什么、是否有无对应源码的混淆/压缩文件，以及申请的权限是否远超它声称的功能。

如果发现可疑问题，请停下来，说明你发现了什么、为什么可疑，并询问我是否继续，不要擅自安装。

如果没有问题，请先简要说明这个插件做什么、会碰到哪些东西，然后用官方命令帮我安装：

    dsh plugin --profile {profile} add <该仓库的 tarball 地址>

tarball 地址优先用最新 release tag 的（形如 {url}/archive/refs/tags/<tag>.tar.gz）；没有 release 就用默认分支 {branch}（形如 {url}/archive/refs/heads/{branch}.tar.gz）。该命令会自动把插件并入 profile 的 bundles，装完需要重启 dsh 才会生效——请告诉我这一点，以及如何启用和验证它。`,

  'nav': '插件市场',
  'tab.plugins': '插件',
  'tab.skills': '技能',
  'tabs.aria': '插件市场分区',

  'intro.title': '社区插件市场',
  'intro.body': '按分类均衡列出社区精选插件，数据来自 awesome-dsh-plugin 每日刷新的目录。'
    + '开启后本机会从 GitHub 读取该目录快照；关闭时不会发起任何网络请求。',
  'intro.enable': '启用插件市场',
  'intro.enabling': '正在启用…',
  'intro.disable': '停用插件市场',
  'intro.disclaimer': '收录不代表安全背书。安装前请用「安全审查」让 Agent 读一遍代码，并自己看过结论再决定。',

  'search': '搜索插件名称、简介或分类',
  'all': '全部',
  'refresh': '刷新',
  'refreshing': '刷新中…',
  'loading': '正在读取社区插件目录…',
  'empty': '没有符合当前筛选的插件',
  'failed': '读取插件目录失败：{reason}',
  'retry': '重试',
  'stale': '当前显示的是上次读取的目录——这次刷新没能连上 GitHub。',
  'summary': '显示 {shown} / {total} 个',
  'snapshot': '快照 {date} · 已收录 {scanned} 个仓库',
  'source': '数据来自 awesome-dsh-plugin 社区目录',
  'stars': 'star',

  'install': '安全安装',
  'installing': '正在打开会话…',
  'staged': '已在新会话填入审查提示词',
  'staged.hint': '关闭本设置窗口，看过提示词后按回车执行。',
  'install.failed': '打开会话失败：{reason}',
  'install.noWorkspace': '还没有工作区。请先在侧边栏选择一个工作区，再回来安装。',
  'repo': 'GitHub',

  'skills.title': '当前会话可用的技能',
  'skills.body': '这里列出当前会话能解析到的全部技能。技能发现按会话所属的 Agent 预设分层，所以这份列表就是该会话实际可用的那份。读取不需要开启市场，也不会联网。',
  'skills.noSession': '请先打开一个会话——技能按会话所属的 Agent 预设分层解析，没有会话就没有可读的那一层。',
  'skills.loading': '正在读取技能…',
  'skills.empty': '当前部署没有可解析的技能',
  'skills.failed': '读取技能失败：{reason}',
  'skills.incomplete': '有技能来源读取失败或报告发现不完整，下面这份列表可能不全。',
  'skills.count': '共 {count} 个',
  'skills.search': '搜索技能名称或说明',
  'skills.model': '模型可调用',
  'skills.user': '用户可调用（/名称）',
  'skills.provider': '来源 {provider}',
} as const

/** English dictionary. */
export const en: Record<SafeMarketLocaleKey, string> = {
  'lang': 'en',
  'prompt': `Please review the security of this DSH plugin before installing it: {url}

Read the repository itself — do not rely on its README alone. Look for: credential or token access, data sent to third-party hosts, remote code execution or downloaded-and-executed payloads, install-time scripts (postinstall and friends), obfuscated or minified sources with no matching original, and permissions far wider than what the plugin claims to do.

If you find anything suspicious, stop, explain what you found and why it concerns you, and ask me whether to continue — do not install it on your own.

If it looks clean, say briefly what the plugin does and what it touches, then install it with the official command:

    dsh plugin --profile {profile} add <the repository's tarball URL>

Prefer the latest release tag's tarball ({url}/archive/refs/tags/<tag>.tar.gz); with no release, use the default branch {branch} ({url}/archive/refs/heads/{branch}.tar.gz). That command joins the plugin into the profile's bundles by itself, and dsh must be restarted before it loads — tell me that, and how to enable and verify it.`,

  'nav': 'Marketplace',
  'tab.plugins': 'Plugins',
  'tab.skills': 'Skills',
  'tabs.aria': 'Marketplace pages',

  'intro.title': 'Community plugin marketplace',
  'intro.body': 'A shortlist of community plugins, balanced across categories, from the daily-refreshed'
    + ' awesome-dsh-plugin catalog. Turning it on lets this machine read that catalog snapshot from GitHub;'
    + ' while it is off, nothing is requested.',
  'intro.enable': 'Enable the marketplace',
  'intro.enabling': 'Enabling…',
  'intro.disable': 'Disable the marketplace',
  'intro.disclaimer': 'Being listed is not a safety endorsement. Use Review and install to have the agent read the'
    + ' code first, and read its conclusion yourself before deciding.',

  'search': 'Search plugins by name, description, or category',
  'all': 'All',
  'refresh': 'Refresh',
  'refreshing': 'Refreshing…',
  'loading': 'Loading the community catalog…',
  'empty': 'No plugin matches this filter',
  'failed': 'Could not read the catalog: {reason}',
  'retry': 'Retry',
  'stale': 'Showing the catalog last read — this refresh did not reach GitHub.',
  'summary': 'Showing {shown} of {total}',
  'snapshot': 'Snapshot {date} · {scanned} repositories scanned',
  'source': 'Curated by awesome-dsh-plugin',
  'stars': 'stars',

  'install': 'Review and install',
  'installing': 'Opening a session…',
  'staged': 'The review prompt is in a new session',
  'staged.hint': 'Close Settings, read the prompt, then press Enter to run it.',
  'install.failed': 'Could not open a session: {reason}',
  'install.noWorkspace': 'No workspace yet. Choose one in the sidebar first, then come back to install.',
  'repo': 'GitHub',

  'skills.title': 'Skills this session can resolve',
  'skills.body': 'Every skill the current session resolves. Discovery is layered by the agent preset a session runs, so this is the list that session actually has. Reading it needs no marketplace and no network.',
  'skills.noSession': 'Open a session first — skills resolve through the layers of the agent preset a session runs, and with no session there is no layer to read.',
  'skills.loading': 'Loading skills…',
  'skills.empty': 'This deployment resolves no skills',
  'skills.failed': 'Could not read skills: {reason}',
  'skills.incomplete': 'A skill source failed or reported incomplete discovery — the list below may be short.',
  'skills.count': '{count} total',
  'skills.search': 'Search skills by name or description',
  'skills.model': 'Model-invocable',
  'skills.user': 'User-invocable (/name)',
  'skills.provider': 'from {provider}',
}

/** The dictionary's key set. */
export type SafeMarketLocaleKey = keyof typeof zh
