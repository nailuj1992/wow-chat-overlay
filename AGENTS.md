# AGENTS.md

Guide for AI agents (and humans) working on this repo.

## What this is

World of Warcraft–style chat overlay for OBS Browser Sources. Shows Twitch and YouTube chat with Twitch, 7TV, BetterTTV and FrankerFaceZ emotes. Static site: plain HTML/CSS/JS, **no build step, no server, no dependencies**.

- Live: https://nailuj1992.github.io/wow-chat-overlay/
- Repo: https://github.com/nailuj1992/wow-chat-overlay

## Git workflow (mandatory)

- Only branch: **`dev`** (default, protected). GitHub Pages deploys from `dev`, so every merge goes live.
- **Never push directly to `dev`.** Branch protection blocks it, admins included.
- Every change: create a branch from `dev` → commit → open a PR into `dev` → merge.
  ```bash
  git switch dev && git pull
  git switch -c feat/short-description
  # ...changes...
  git push -u origin feat/short-description
  gh pr create --base dev
  ```
- Branch names: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Never force-push to or delete `dev`.

## Secrets (mandatory)

The repo is **public**.

- Never commit `.env` files, API keys or tokens. `.gitignore` blocks `.env*`, but check `git status` before every commit anyway.
- The YouTube API key is passed **only** through the overlay URL that goes into OBS (`?youtube_key=...`). Never write it in `js/config.js` or any other tracked file.
- Before committing, scan: `git diff --cached | grep -E "AIza|gh[op]_|oauth:"` must return nothing.

## Architecture

```
index.html            overlay page (loads scripts in order below)
config.html           URL builder + live demo preview
css/wow.css           look; everything scales from --font-size
js/config.js          WC.DEFAULTS + URL parsing -> WC.config
js/emotes.js          WC.Emotes: 7TV/BTTV/FFZ, scopes 'global' | 'tw:<roomId>' | 'yt:<channelId>'
js/render.js          WC.render(msg): WoW channel mapping, labels (en/es), name colors
js/providers/twitch.js   anonymous IRC over WebSocket (justinfan), tags, emotes, CLEARCHAT/CLEARMSG
js/providers/youtube.js  YouTube Data API v3 polling (needs key, quota-limited)
js/demo.js            fake messages (?demo=1)
js/main.js            wiring, filters (hidden users, !commands), fading, deletions
```

Rules:

- **Classic `<script>` tags only, no ES modules.** The overlay must also work from `file://` in OBS, where modules are blocked by CORS.
- Shared namespace is `window.WC`.
- Build message DOM with `textContent` / DOM nodes. Never `innerHTML` with chat content (XSS).
- New setting → add to `WC.DEFAULTS` in `js/config.js` (its type decides parsing: boolean / number / string), use it via `WC.config`, add it to `config.html` and the README table.
- New platform → `js/providers/<name>.js` emitting the message shape documented at the top of `js/render.js`; start it in `js/main.js`; add a `<script>` tag in `index.html`.

## Current defaults

Background 0.7, size 400×250 (0 = fill source), name colors `platform`, font 14px, fade 90s, max 50, labels `en`. No default channel. Users whose login or display name ends in `bot` (case-insensitive) render as `role_bot` (`yell`), ahead of broadcaster/mod/VIP/sub roles; `/me`, announcements and system lines keep their own style. Messages starting with `!` are hidden, except commands in `show_commands` (default `s`, the TTS command), which are shown with the `!cmd ` prefix stripped.

## Testing

No test suite. Check changes in a browser:

```bash
python -m http.server 8765
```

- `http://localhost:8765/index.html?demo=1&fade=0` — fake messages
- `http://localhost:8765/index.html?twitch=<busy channel>` — real chat, 7TV emotes
- `http://localhost:8765/config.html` — config page

Check the browser console: `[emotes] tw:<id>: N emotes` confirms emote loading. 404s from BTTV/FFZ for channels without an account there are normal.
