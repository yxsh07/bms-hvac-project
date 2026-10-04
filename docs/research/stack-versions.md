# Stack Version Check (T-002)

| Tech | Latest | Constraints | Gotcha |
|---|---|---|---|
| React | 19.3.0 | 19.x; pairs with R3F v9, Drei v10; TS >=5.0 | Replaces `forwardRef` with `ref` prop; strict hydration errors. |
| Vite | 8.3.2 | Node >=20, Rollup 4+; pairs with `@tailwindcss/vite` | API deprecations break legacy SVG loaders. |
| @react-three/fiber | 9.8.1 | React `^19`, Three.js `>=0.156` | State mutations inside `useFrame` cause severe re-render thrashing. |
| @react-three/drei | 10.7.9 | R3F `^9.0.0`, React `^19`, Three.js `>=0.159` | Mismatched Three crashes shaders; `useGLTF` leaks without disposal. |
| three | 0.186.1 | Peer for R3F 9 & Drei 10; single workspace pin | Non-semver minor releases break APIs and color spaces. |
| zustand | 5.0.15 | React `>=18` (supports React 19) | No default shallow equality; object slices need `useShallow`. |
| Tailwind CSS | 4.3.3 | Vite 8 via `@tailwindcss/vite`; Node >=18 | Deprecates config JS; configuration moves to CSS `@theme`. |
| Fastify | 5.12.5 | Node >=20, ESM-first; types in core | Scope isolation needs `fastify-plugin`; async routes must return. |
| zod | 4.6.5 | TS >=5.0; types in core | Breaking changes in inference/transforms; contracts target v4. |
| Playwright | 1.63.0 | Node >=18; browser binaries match library | Binaries omitted on install; CI must run `playwright install`. |
| TimescaleDB docker tag | `2.30.2-pg16` (`latest-pg16`) | PG16 base; plain SQL migrations | Unpinned `latest` may auto-upgrade PG major, breaking volumes. |
| FastAPI | 0.142.2 | Python `>=3.8`, Pydantic v2 | Deprecates v1 `@validator`; mixing validator syntax fails runtime. |
| Python | 3.14.8 (pin 3.12.15) | Sim requires Python 3.12 (EOL Oct 2028) | 3.13+ removes legacy stdlib modules, breaking scientific C-extensions. |
| pnpm | 12.9.1 | Node >=18/20; lockfile v9/v10 | Strict isolation hides phantom deps; transitive packages need manifests. |
| exceljs | 4.4.0 | Node >=12; browser & Node | Memory intensive; large exports must stream via `WorkbookWriter`. |
| Capacitor | 8.5.2 (`@capacitor/core`) | Node >=20; Android Studio / Xcode | `webDir` must match Vite `dist`; run `cap sync` after builds. |
| `skills` CLI | 1.7.0 (`skills`) | Node >=18; repo format `owner/repo` | Published as `skills` (not `@skills/cli`); audit scripts before install. |
| opencode skill discovery paths | `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` | Case-sensitive `SKILL.md`; dir matches name | Lowercase `skill.md` or name mismatch causes silent discovery failure. |
| Orca CLI binary name | `orca` (`orca.exe`/`orca.cmd`) | Running Orca runtime / pairing session | Commands like `snapshot` fail if Orca desktop app is not running. |

## Recommended Pins

- **Frontend / 3D:** react/react-dom `19.3.0`, @react-three/fiber `9.8.1`, @react-three/drei `10.7.9`, three `0.186.1`, zustand `5.0.15`, vite `8.3.2`, tailwindcss/@tailwindcss/vite `4.3.3`
- **Backend / Contracts:** fastify `5.12.5`, zod `4.6.5` (omit `@types/fastify`, `@types/zod`)
- **Sim / Database:** python `3.12.15`, fastapi `0.142.2`, timescale/timescaledb `2.30.2-pg16`
- **Tooling / E2E:** pnpm `12.9.1`, playwright `1.63.0`, exceljs `4.4.0`, skills `1.7.0`, @capacitor/core `8.5.2`, Orca CLI `orca`
