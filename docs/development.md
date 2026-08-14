# Development conventions

Engineering baseline adapted from the `rsp/com` project: strictest TypeScript
preset, flat ESLint with type-checked rules, Prettier, Husky/lint-staged/
commitlint gates, and Vitest with an 80% coverage red line. Everything runs
through one command.

## Commands

| Task        | Command                                                               |
| ----------- | --------------------------------------------------------------------- |
| Type-check  | `npm run type-check` (`tsc -p tsconfig.json --noEmit`)                |
| Lint        | `npm run lint` (flat ESLint, type-checked)                            |
| Format      | `npm run format` / `npm run format:check`                             |
| Tests       | `npm run test` (Vitest, `vitest run`)                                 |
| Watch tests | `npm run test:watch`                                                  |
| Coverage    | `npm run test:coverage` (v8, 80% branches/functions/lines/statements) |
| Build       | `npm run build` (tsc emit to `lib/` with declarations + source maps)  |
| Full gate   | `npm run verify` (format:check + lint + type-check + test:coverage)   |

Run a single test file: `npm run test -- src/guard.test.ts`
Run tests by name: `npm run test -- -t "guard"`

## Git hooks

- `pre-commit`: lint-staged (Prettier + `eslint --fix` on staged files).
- `commit-msg`: commitlint — Conventional Commits, pinned type set
  (`feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert`).
- `pre-push`: full `npm run type-check` — type errors surface locally, not in CI.

## Structure

```
src/
├── index.ts        # plugin entry: name / inject / Config / apply
├── guard.ts        # M1: webServer route/upgrade/fallback wrapping (plan §4)
├── session-store.ts# M1: storage-domain session persistence (plan §5)
└── *.test.ts       # colocated tests, explicit vitest imports
```

`lib/` is the build output (`tsc -p tsconfig.build.json`) and is gitignored;
`package.json` `exports`/`files` publish only `lib`.

## Conventions

- **TypeScript strictest preset**: `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, `verbatimModuleSyntax`,
  `noUnusedLocals/Parameters`. NodeNext module resolution: relative imports
  end in `.js`.
- **No ambient globals in tests**: import `describe/it/expect` from `vitest`.
- **No `console.*` in `src/`** (ESLint error). Log through the cordis
  `ctx.logger`; scripts/config files are exempt.
- **Complexity/length caps** (ESLint errors, not baselined):
  complexity ≤ 15, file ≤ 250 lines, function ≤ 80 lines (blank/comment lines
  excluded). Split instead of exceeding.
- **`.sort()`/`.toSorted()` require an explicit comparator** — default
  lexicographic order is unreliable outside plain ASCII.
- **Line endings LF everywhere** (`.editorconfig` + `.gitattributes`), Prettier
  defaults: 100 width, double quotes, trailing commas.
- **Commit style**: `type(scope): subject`, scope is a module name
  (`guard`, `session-store`, `ci`).

## CI

`.github/workflows/ci.yml` runs `npm ci` + `npm run verify` + `npm run build`
on Node 22 for every push/PR to `main`. The local gate and the CI gate are the
same command.

## Dependency notes

- `@deepseek-ai/cordis`, `@deepseek-ai/schemastery`, `zod` are runtime deps.
- `@deepseek-ai/dsh-storage-domain` is **not pinned yet**: the registry
  currently resolves `0.0.1-rc.1` while the deployed dsh checkout carries
  `0.1.0-rc.6`. Pin the exact version the target deployment's dsh resolves
  when M1 adds session persistence.
