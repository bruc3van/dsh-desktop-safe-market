# dsh-desktop-safe-market

English | [中文](./README.zh.md)

A **review-before-install** extension marketplace for the DeepSeek Harness web GUI. It adds a **Marketplace** entry to the Settings navigation, with two pages:

- **Plugins** — 100 community plugins balanced across categories. **Review and install** installs nothing: it opens a new session, stages a **security-review prompt** in the composer, and closes Settings, so an agent reads the code and only then runs the official install command.
- **Skills** — what the current session can actually resolve.

![The marketplace tab](./assets/screenshots/market.png)

## What it is for

Installing a plugin means running someone else's code on your machine. A catalog can tell you *which* plugins exist; it cannot tell you whether one is safe — and that is exactly what you are betting on at the moment you click install.

This plugin joins the two halves: a community shortlist that has **already had the non-plugins curated out**, and a **code review performed by an agent**. It downloads nothing, executes nothing, and judges nothing itself — it puts the request in front of you.

## Install

```sh
dsh plugin --profile web add https://github.com/bruc3van/dsh-desktop-safe-market/archive/refs/tags/v0.1.0.tar.gz
```

The official command installs the dependency into the profile and **joins it into `dsh.profile.bundles` by itself** (any dependency declaring `dsh.bundle` is reconciled into the layer stack), so there is no `package.json` to edit. Restart `dsh web` (or the desktop client) afterwards.

The browser, the CLI, and the desktop client share one profile, so the entry appears in all three.

## You turn it on yourself

The **Plugins** page ships **off**. Until you enable it, it is one card explaining what enabling does, and a button.

That is deliberate: **enabling is what lets this machine read the catalog snapshot from GitHub**, and while it is off the plugin makes no network request at all. A plugin that arrives already reaching out has decided something on your behalf. The switch is the plugin's own durable setting — answer once and it stays answered.

## What "Review and install" does

1. connects a new session in the current session's workspace (or the most recently used one) and navigates there;
2. **stages** the review prompt in the composer — it does not send it;
3. closes Settings, so you are looking at the session it was staged in.

The prompt asks the agent to read the repository rather than its README, and to look for credential or token access, data sent to third-party hosts, remote code execution or downloaded-and-executed payloads, install-time scripts (`postinstall` and friends), obfuscated sources with no matching original, and permissions far wider than the plugin claims. **Anything suspicious means stop, explain, and ask you.** A clean reading is followed by the official command:

```sh
dsh plugin --profile web add <the repository's tarball URL>
```

preferring the latest release tag and falling back to the default branch (the catalog supplies the branch name). The prompt also says that dsh must be restarted before the plugin loads.

Whether it is sent is your Enter key. With no workspace at all, the card says so and points you at the sidebar.

## The Skills page

Lists the skills the **current session** resolves — name, description, owning provider, and invocation policy (model-invocable, user-invocable via `/name`) — with search.

Addressing it by session is required, not lazy: the skill registry is host+per-scope layered, and the web deployment **deliberately disables the host-plane `skill-filesystem` row** — local discovery belongs to each agent preset. A read from the plugin's root context sees the global layer alone and would report "no skills" to a user with plenty. With no session open, the page says there is no layer to read.

![The Skills page](./assets/screenshots/skills.png)

## Where the data comes from

The daily snapshot published by [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin):

- `repositories.json` — the crawl of repositories tagged `dsh-plugin`, with category, stars, licence, and last push;
- `curated.json` — the human exclusions (rival catalog sites, product repos whose stars belong to something else).

**Both are read together**: the crawl does *not* have the exclusions applied, so reading only the first would put a rival catalog at the top of your own market. Archived repositories are dropped too.

Selection is not a straight star ranking — that would hand almost every seat to two or three categories. Seats are **dealt round by round**: every category places its best entry before any category places its second, until 100 are filled. The result is then ordered by stars, so the list still reads as a leaderboard.

## Configuration

Override in `~/.dsh/profiles/web/cordis.patch.yml`:

| Field | Default | Meaning |
| --- | --- | --- |
| `catalogBase` | awesome-dsh-plugin's `data/` directory | Point the market at your own curation |
| `marketSize` | `100` | How many plugins the market shows |

## Security boundary

- **The plugin runs no install command and exposes no interface that could** — review and install are therefore inseparable;
- **the catalog is fetched and reduced on the Host** before the browser sees it (about 100 rows, not a 2.4 MB snapshot), and persisted at `$DSH_HOME/storages/safe_market.json` so a restart asks conditionally;
- **repository links are rebuilt from `owner/name`** rather than trusted from the snapshot, so a poisoned snapshot cannot contribute a URL scheme of its own;
- every card renders as plain text;
- while disabled, the Remote refuses — the catalog cannot be read around the switch;
- the install hand-off runs entirely through published services (workspaces / sessions / conversation): it reads no DOM and sends no message.

**Being listed is not a safety endorsement.** The agent's review is an informed second opinion, not a verdict — read it yourself before deciding.

## Known limitations

- **Skills are read-only for now.** The Skills page answers "what do I have". Skills are distributed as filesystem directories rather than npm packages, so installing them is the next step.
- **It does not audit what you already installed.** This covers the moment before an install, not the plugins already running.
- **The market does not run the install itself.** The command lives in the prompt and the agent runs it, which is what makes the review impossible to skip — at the cost of no progress display inside the market.

## Development

```sh
pnpm install --ignore-workspace
pnpm run typecheck
pnpm run build      # lib/index.js (Host ESM), lib/client.js (browser, ModuleLoader-wrapped), lib/types
```

`devDependencies` are pinned to the published `@deepseek-ai/*` versions the runtime actually loads; every `peerDependency` is optional and supplied by the profile's node_modules.

## License

MIT
