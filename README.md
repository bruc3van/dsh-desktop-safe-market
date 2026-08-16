# dsh-desktop-safe-market

English | [中文](./README.zh.md)

A **review-before-install** extension marketplace for the DeepSeek Harness web GUI. It adds a **Marketplace** entry to the Settings navigation (wearing the market's own storefront icon), with two pages:

- **Plugins** — an **installed panel** on top: the plugin packages installed into this profile with their live state, each disableable/enableable and uninstallable (what shipped with DSH is not listed); below it, 200 community plugins balanced across categories. **Review and install** installs nothing: it opens a new session, stages a **security-review prompt** in the composer, and closes Settings, so an agent reads the code and only then runs the official install command.
- **Skills** — what the current session can actually resolve.

![The marketplace tab](./assets/screenshots/market.png)

## What it is for

Installing a plugin means running someone else's code on your machine. A catalog can tell you *which* plugins exist; it cannot tell you whether one is safe — and that is exactly what you are betting on at the moment you click install.

This plugin joins the two halves: a community shortlist that has **already had the non-plugins curated out**, and a **code review performed by an agent**. It downloads nothing, executes nothing, and judges nothing itself — it puts the request in front of you.

## Install

```sh
dsh plugin --profile web add https://github.com/bruc3van/dsh-desktop-safe-market/archive/refs/tags/v0.2.0.tar.gz
```

The official command installs the dependency into the profile and **joins it into `dsh.profile.bundles` by itself** (any dependency declaring `dsh.bundle` is reconciled into the layer stack), so there is no `package.json` to edit. Restart `dsh web` (or the desktop client) afterwards.

The browser, the CLI, and the desktop client share one profile, so the entry appears in all three.

## You turn it on yourself

The **market half** of the Plugins page ships **off**. Until you enable it, it is one card explaining what enabling does, and a button (the installed panel answers either way).

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

## The installed panel

The **installed panel** at the top of the Plugins page lists the packages this profile gained through `dsh plugin add` — version, description, the live state of each loader entry — with two actions:

- **Disable/enable** writes (or removes) a `- id: <entry>` / `disabled: true` row in the profile's own `cordis.patch.yml` (the user patch layer) and nudges the loader entry directly — **effective immediately, no restart**, and durable across restarts. The market's own row has no disable button: disabling the market would take down the only surface that could re-enable it.
- **Uninstall** removes the dependency and the `dsh.profile.bundles` layer from the profile's `package.json` (the next boot simply never composes it) and stops the plugin for the rest of the session; on the next boot the plugin takes those stop rows back out of your patch file. Files left in `node_modules` become inert and are pruned by the next `dsh plugin` command.

By design it matches "review and install": **local file edits plus loader calls — no process spawned, no network**, and the panel reads only this machine's own facts, so it works with the market off.

## The Skills page

Lists the skills the **current session** resolves — name, description, owning provider, and invocation policy (model-invocable, user-invocable via `/name`) — with search.

Addressing it by session is required, not lazy: the skill registry is host+per-scope layered, and the web deployment **deliberately disables the host-plane `skill-filesystem` row** — local discovery belongs to each agent preset. A read from the plugin's root context sees the global layer alone and would report "no skills" to a user with plenty. With no session open, the page says there is no layer to read.

![The Skills page](./assets/screenshots/skills.png)

## Where the data comes from

The market reads a single published file, [`market.json`](https://github.com/bruc3van/awesome-dsh-plugin/blob/main/data/market.json), from [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)'s daily snapshot pipeline. Every editorial decision happens upstream, where the crawl and the human curation live:

- the crawl of repositories tagged `dsh-plugin` (`repositories.json`) is filtered there — a description is required, archived/disabled repositories are dropped, and the exclusions in `curated.json` are applied;
- rows are categorized and **balanced** there — not a straight star ranking (that would hand almost every seat to two or three categories), but seats dealt round by round so every category places its best entry before any places its second, up to 300;
- this plugin truncates that order to `marketSize` (default 200) and re-validates every row on the Host before the browser sees it.

The wire protocol — field shapes, truncation limits, the branch-name whitelist, the ordering invariant, and the versioning rules — is documented in [docs/market-json-spec.md](docs/market-json-spec.md).

## Configuration

Override in `~/.dsh/profiles/web/cordis.patch.yml`:

| Field | Default | Meaning |
| --- | --- | --- |
| `catalogBase` | awesome-dsh-plugin's `data/` directory | Point the market at a mirror of the same file |
| `marketSize` | `200` | How many plugins the market shows |

## Security boundary

- **The plugin runs no install command and exposes no interface that could** — review and install are therefore inseparable;
- **the market file is fetched and re-validated on the Host** before the browser sees it — a curated list of at most 300 rows, not the 2.4 MB crawl — and persisted at `$DSH_HOME/storages/safe_market.json` so a restart asks conditionally (one 304, or the last catalog when GitHub is unreachable);
- **repository links are rebuilt from `owner/name`** rather than trusted from the file, so a poisoned file cannot contribute a URL scheme of its own — the wire codec enforces the rebuilt shape, not just a comment;
- **the default branch is pattern-checked before it reaches the prompt** (`[A-Za-z0-9][A-Za-z0-9._/-]*` plus the git ref rules; anything else falls back to `main`), and the prompt declares both the URL and the branch as opaque marketplace literals — a poisoned branch name cannot inject instructions into the review;
- every card renders as plain text;
- while disabled, the Remote refuses — the catalog cannot be read around the switch;
- the install hand-off runs entirely through published services (workspaces / sessions / conversation): it reads no DOM and sends no message;
- the installed-panel verbs accept only **wire-codec-checked package names that are actually in the profile manifest**, and land as local file edits plus loader calls with no process spawned; edits to your patch layer preserve existing comments and hand-written rows.

**Being listed is not a safety endorsement.** The agent's review is an informed second opinion, not a verdict — read it yourself before deciding.

## Known limitations

- **Skills are read-only for now.** The Skills page answers "what do I have". Skills are distributed as filesystem directories rather than npm packages, so installing them is the next step.
- **It does not audit what you already installed.** The installed panel views, disables, and uninstalls, but it does not re-review code that is already running — the before-install review is still the gate.
- **The market does not run the install itself.** The command lives in the prompt and the agent runs it, which is what makes the review impossible to skip — at the cost of no progress display inside the market.
- **The nav icon is a skin-level swap.** The settings shell hardcodes section nav icons by id (unknown ids get the gear) and the slot contract has no icon seat; this plugin finds its own labeled row and re-skins the icon. If the shell restructures, the worst case is the gear returning — nothing functional breaks.

## Development

```sh
pnpm install --ignore-workspace
pnpm run typecheck
pnpm test          # node --test, the catalog reduction and reader regressions
pnpm run build     # lib/index.js (Host ESM), lib/client.js (browser, ModuleLoader-wrapped), lib/types
```

`devDependencies` are pinned to the published `@deepseek-ai/*` versions the runtime actually loads; every `peerDependency` is optional and supplied by the profile's node_modules.

## License

MIT
