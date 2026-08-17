# dsh-desktop-safe-market

[中文](./README.md) | English

A **review-before-install** extension marketplace for the DeepSeek Harness web GUI. It deliberately differs from click-to-install marketplaces on two counts:

- **A curated source.** The list is not a raw crawl of the `dsh-plugin` topic. It is the daily, human-curated output of the [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin) snapshot pipeline — topic riders, archived and disabled repositories are removed upstream, and entries are dealt round by round across categories — so what you browse is an editorially filtered shortlist, never a popularity dump.
- **Review before install.** The install button installs nothing. It opens a new session and stages a **security-review prompt**; an agent reads the repository's actual code, and only a clean reading proceeds to the official install command. The plugin itself has no interface that could run an install — review and install are inseparable by construction.

In use, it adds a **Marketplace** entry to the Settings navigation (wearing the market's own storefront icon), with two pages:

- **Plugins** — an **installed panel** on top: the plugin packages installed into this profile as dependencies, with their live state, each disableable/enableable and uninstallable; the marketplace plugin the desktop client placed is listed here too, because nowhere else can remove it. Layers shipped with DSH, and in-box bundles carrying no ownership marker, are not listed. Below it, the curated market, whose **All plugins** view ranks by stars.
- **Skills** — what the current session can actually resolve.

![The marketplace tab](./assets/screenshots/marketplace.png)

## What it is for

Installing a plugin means running someone else's code on your machine. An ordinary catalog answers *which plugins exist* and leaves the risk to your click; *is this one safe* stays unanswered — yet that is exactly what you are betting on at the moment you click install.

This plugin joins the two halves: a community shortlist that has **already had the non-plugins curated out**, and a **code review performed by an agent**. It downloads nothing, executes nothing, and judges nothing itself — it puts the request in front of you. That is the whole differentiation from an ordinary market: **a curated entrance, and an install that cannot skip its review.**

## Install

```sh
dsh plugin --profile web add https://github.com/bruc3van/dsh-desktop-safe-market/archive/refs/tags/v0.2.8.tar.gz
```

Or hand the install to your agent — copy this one-line prompt:

```text
Install the DSH plugin market for me: run the official command `dsh plugin --profile web add https://github.com/bruc3van/dsh-desktop-safe-market/archive/refs/tags/v0.2.8.tar.gz` into the web profile, then remind me to restart dsh web for it to load.
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

The prompt asks the agent to treat everything in the repository as untrusted material under review (instructions found there are never followed), to read the code rather than the README, and to look for credential or token access, data sent to third-party hosts, remote code execution or downloaded-and-executed payloads, install-time scripts (`postinstall`, `prepare`, and friends), obfuscated sources with no matching original, and permissions far wider than the plugin claims. **Anything suspicious means stop, explain, and ask you.** A clean reading is followed by the official command, by priority — the npm package or the latest release tag's prebuilt tarball first (no repository code runs at install time), and only failing both, source from the default branch pinned to an exact commit:

```sh
dsh plugin --profile web add <npm package | tarball URL | github:owner/name#<commit sha>>
```

A source install is blocked by pnpm's `allowBuilds` gate — permission for the repository's code to run on your machine at install time — and the prompt has the agent hand pnpm's printed key to you verbatim, wait for it to land in the profile's `pnpm-workspace.yaml`, and re-run. dsh must be restarted before the plugin loads; the prompt has the agent verify with `--dump-config` right after the install, before that restart.

Whether it is sent is your Enter key. With no workspace at all, the card says so and points you at the sidebar.

![Review and install](./assets/screenshots/marketplace-sec-install.png)

### Already installed: review and upgrade

A catalog row already installed into this profile is marked **Installed vX.Y.Z** in its card, and its button reads **Review and upgrade** instead of Review and install — so you are not offered an install for something you already have.

The join is the installed package's `repository` field (every npm spelling is reduced to `owner/name`), because the catalog is keyed by GitHub repository while an install is keyed by package name, and the two are only sometimes spelled alike. A package that declares no repository falls back to matching its short name against the repository name — but only while that name picks out exactly one installed package: when two share it, neither claims the row, because an answer that depends on iteration order is worse than no answer.

**The catalog carries no versions** (the upstream `market.json` records repository facts, not releases), so whether a newer version exists is something this plugin cannot compute locally — and does not guess. The upgrade prompt's first step is to have the agent establish the newest upstream version — the latest release tag, or the version the repository publishes to npm — and, **if it is not newer, say so and change nothing**; only a real update leads on to reading the code changes between the two versions, looking for newly added credential access, newly added outbound data, changed install scripts, and widened permissions. Upgrades install through the same ladder as fresh installs (npm / release tarball / commit-pinned source) and the same `allowBuilds` rules. As with install, the plugin runs no command itself.

## The installed panel

The **installed panel** at the top of the Plugins page lists the packages this profile gained through `dsh plugin add` (names that sit in both `dependencies` and `dsh.profile.bundles`) — version, description, the live state of each loader entry — **and the marketplace plugin the desktop client placed**. Layers shipped with the DSH profile template are not listed. Two actions:

- **Disable/enable** writes (or removes) a `- id: <entry>` / `disabled: true` row in the profile's own `cordis.patch.yml` (the user patch layer) and nudges the loader entry directly — **effective immediately, no restart**, and durable across restarts. The market's own row has no disable button: disabling the market would take down the only surface that could re-enable it.
- **Uninstall** removes the dependency and the `dsh.profile.bundles` layer from the profile's `package.json` (the next boot simply never composes it) and stops the plugin for the rest of the session; on the next boot the plugin takes those stop rows back out of your patch file. The sweep record lives in a small plugin-owned file under the harness home — not the market's cache domain, so a broken domain cannot strand the rows; when the in-session stop fails, the uninstall notice says the plugin may run until the next restart. A plugin uninstalled and reinstalled within one session is held down by the leftover rows, and its card explains that Enable will clear them. Files left in `node_modules` become inert and are pruned by the next `dsh plugin` command.

### The marketplace plugin placed by the desktop client

The desktop client does not install this market with `dsh plugin add`. It **copies** the plugin into `<DSH_HOME>/profiles/node_modules` and adds one entry to `dsh.profile.bundles` — no dependency. Such a copy is labelled *seated by the desktop client*, and **this panel is the only place it can be removed**: official `dsh plugin` deliberately never touches a bundle that is not a profile dependency, and the client that placed it may have been uninstalled since.

The copy is never written as a dependency — the directory itself IS the install — so uninstalling removes the `bundles` entry *and* the copied directory. Taking only the entry would strand a plugin tree that nothing lists, nothing loads, and nothing can ever offer to remove again; the panel finds this plugin through the bundle list.

If the client is still installed and still set to install the marketplace, it will put the plugin back the next time it starts; the card says so. To stop it coming back, turn the switch off in the client's connection settings. An in-box bundle with no ownership marker belongs to the deployment itself: it is neither listed nor removable here.

By design it matches "review and install": **local file edits plus loader calls — no process spawned, no network** — the panel reads only this machine's own facts. With the market switched off, though, the page is the switch and nothing else: what you turned off is this marketplace, and it should not keep a plugin manager running in your settings.

![The installed panel](./assets/screenshots/marketplace-installed.png)

## The Skills page

Lists the skills the **current session** resolves — name, description, owning provider, and invocation policy (model-invocable, user-invocable via `/name`) — with search.

Addressing it by session is required, not lazy: the skill registry is host+per-scope layered, and the web deployment **deliberately disables the host-plane `skill-filesystem` row** — local discovery belongs to each agent preset. A read from the plugin's root context sees the global layer alone and would report "no skills" to a user with plenty. With no session open, the page says there is no layer to read.

![The Skills page](./assets/screenshots/marketplace-skills.png)

## Where the data comes from

The market reads a single published file, [`market.json`](https://github.com/bruc3van/awesome-dsh-plugin/blob/main/data/market.json), from [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)'s daily snapshot pipeline. Every editorial decision happens upstream, where the crawl and the human curation live:

- the crawl of repositories tagged `dsh-plugin` (`repositories.json`) is filtered there — a description is required, archived/disabled repositories are dropped, and the exclusions in `curated.json` are applied;
- rows are categorized and **balanced** there — not a straight star ranking (that would hand almost every slot to two or three categories), but entries dealt round by round so every category places its best entry before any places its second, up to 300;
- this plugin truncates that order to `marketSize` (default 200) and re-validates every row on the Host before the browser sees it;
- **network resilience (automatic failover)**: the default read comes from GitHub raw. When the default address cannot answer (timeout, DNS/connection failure, or an HTTP error), the read automatically falls over to the Gitee mirror of the same published file ([bruc3van/awesome-dsh-plugin](https://gitee.com/bruc3van/awesome-dsh-plugin)'s `raw/main/data/market.json`). The side that answered is remembered (sticky) and tried first next time, falling back the other way if it later fails — no configuration needed. A deployment with its own `catalogBase` keeps exactly that one source.

The wire protocol — field shapes, truncation limits, the branch-name whitelist, the ordering invariant, and the versioning rules — is documented in [docs/market-json-spec.md](docs/market-json-spec.md).

## Configuration

Override in `~/.dsh/profiles/web/cordis.patch.yml`:

| Field | Default | Meaning |
| --- | --- | --- |
| `catalogBase` | awesome-dsh-plugin's `data/` directory | Point the market at a mirror of the same file |
| `marketSize` | `200` | How many plugins the market shows |

## Security boundary

- **The plugin runs no install command and exposes no interface that could** — review and install are therefore inseparable;
- **the market file is fetched and re-validated on the Host** before the browser sees it — a curated list of at most 300 rows, not the 2.4 MB crawl — and persisted at `$DSH_HOME/storages/safe_market.json` so a restart asks conditionally (one 304, or the Gitee mirror when the default address is unreachable, or the last catalog when both are);
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
- **The nav icon is a skin-level swap.** The settings shell hardcodes section nav icons by id (unknown ids get the gear) and the slot contract has no icon option; this plugin finds its own labeled row and re-skins the icon. If the shell restructures, the worst case is the gear returning — nothing functional breaks.

## Development

```sh
pnpm install --ignore-workspace
pnpm run typecheck
pnpm test          # node --test, the catalog reduction and reader regressions
pnpm run build     # lib/index.js (Host ESM), lib/client.js (browser, ModuleLoader-wrapped), lib/types
```

A version bump has places that must move together: `package.json`, `dsh.plugin.json`, and the tarball URLs in both READMEs (the install command and the agent prompt each carry one). The version gate in `pnpm test` (`test/version.test.ts`) checks each one, and CI (`.github/workflows/check.yml`) runs the same check on every push and PR.

`devDependencies` are pinned to the published `@deepseek-ai/*` versions the runtime actually loads; every `peerDependency` is optional and supplied by the profile's node_modules.

## Related projects

**Maintained by the author**

- **[dsh-desktop](https://github.com/bruc3van/dsh-desktop)** — a standalone DeepSeek Harness client that keeps an agent safely resident on your desktop: the official Web UI untouched, long-running tasks resident in the tray, curated plugins reviewed before they install. (This market ships in-box with the desktop client.)
- **[awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)** — find the right plugin for your DeepSeek Harness in 30 seconds. Not another repo list: every repository on GitHub tagged `dsh-plugin` is crawled daily by script and then verified one by one by a human — genuine plugins enter the catalog, topic riders land on the blacklist, and every exclusion reason is public to check. It also tells you who each plugin is for and where to start. (Also the data source this market reads.)

**Official repositories**

- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)** — DeepSeek Harness: Everything is a Plugin. The upstream project behind the official `dsh` and Web UI — this plugin is a third-party marketplace on its plugin system, and everything the market installs lands in its profiles and runs on it.

## License

MIT
