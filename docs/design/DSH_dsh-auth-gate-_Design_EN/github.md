repo: TecFancy/dsh-auth-gate
branch: main

## Last sync

date: 2026-08-20T11:37:04Z

### Updated in this project

- Recreated the dsh GUI shell (sidebar + hero) from src/client/logout-action.tsx, index.tsx, README to ground the logout redesign in the real component/icon/copy.
- Moved the Sign out entry from the top-right icon (session header / hero overlay) to a sidebar footer row directly below 设置.
- Added a language tweak (zh/en) on the moved row's label only, per user scope decision — no other i18n redesign.

## Screen map

| Screen                        | Source                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| Logout Under Settings.dc.html | src/client/logout-action.tsx, src/client/index.tsx, README.md (top-right placement being replaced) |
