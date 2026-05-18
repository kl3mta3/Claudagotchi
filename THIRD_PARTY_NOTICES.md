# Third-Party Notices

Claudagotchi is released under the [MIT License](LICENSE). It bundles
third-party software, each governed by its own license. Full license texts
are included with each package under `app/node_modules/<package>/LICENSE`
in source builds and inside the installer's asar bundle in distributed builds.

This file is informational — for legal text of any individual component,
consult its package directory or upstream repository.

## Anthropic SDKs (bundled in distributed builds)

| Package | License | Source |
|---|---|---|
| `@anthropic-ai/claude-code` | Anthropic Commercial Terms | https://github.com/anthropics/claude-code |
| `@anthropic-ai/claude-agent-sdk` | Anthropic Commercial Terms | https://github.com/anthropics/claude-agent-sdk-typescript |

Use of Claude (via the bundled `claude.exe` runtimes or any Anthropic API call)
remains subject to Anthropic's terms — see https://www.anthropic.com/legal.
Claudagotchi does not redistribute Anthropic's models or service capacity;
end users authenticate against their own Claude account.

## Runtime — MIT licensed

- [Electron](https://www.electronjs.org/) 33.x
- [React](https://react.dev/) 18.x and `react-dom`
- [Vite](https://vitejs.dev/) 5.x
- [electron-builder](https://www.electron.build/) 25.x
- [electron-updater](https://www.electron.build/auto-update) 6.x
- [Prettier](https://prettier.io/) 3.x — format-on-save
- [concurrently](https://github.com/open-cli-tools/concurrently), [wait-on](https://github.com/jeffbski/wait-on), [to-ico](https://github.com/kevva/to-ico)

## CodeMirror — MIT licensed

Editor stack used by the artifact and file pop-out windows:

- `@codemirror/state`, `view`, `commands`, `language`, `search`, `autocomplete`,
  `lint`, `merge`
- Language packs: `lang-javascript`, `lang-html`, `lang-css`, `lang-json`,
  `lang-markdown`, `lang-python`
- Theme: `@uiw/codemirror-theme-dracula`

Source: https://codemirror.net/

## Other components

| Package | License | Use |
|---|---|---|
| [highlight.js](https://highlightjs.org/) | BSD-3-Clause | Chat code-block highlighting |
| [chess.js](https://github.com/jhlywa/chess.js) | BSD-2-Clause | Chess game move validation |
| [sharp](https://sharp.pixelplumbing.com/) | Apache-2.0 | Icon generation (build-time only) |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | MIT | Vite React integration |

## Code signing (build-time, not bundled)

- [Microsoft Trusted Signing](https://learn.microsoft.com/azure/trusted-signing/)
  — Microsoft service, cert lives in Azure
- `Azure.CodeSigning.Dlib` / `Microsoft.Trusted.Signing.Client` — Microsoft
  redistributable, loaded by `signtool.exe` during builds

## Trademarks

- "Claude" and the Claude logo are trademarks of Anthropic PBC.
- "Electron" is a trademark of the OpenJS Foundation.
- "Tamagotchi" is a registered trademark of Bandai Co., Ltd. Claudagotchi is
  not affiliated with, endorsed by, or sponsored by Bandai — the name is a
  play on the genre, used in a descriptive sense.

Other names may be trademarks of their respective owners.
