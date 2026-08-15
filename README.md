# dsh-auth

**English** | [简体中文](README.zh.md)

Application-layer authentication for the
[DeepSeek Harness](https://github.com/deepseek-ai/dsh) web surface. It wraps
the `webServer` route tables with a login gate, so a public dsh deployment is
protected before any agent session, session history, or LLM credentials can be
reached.

Ask your agent to deploy it, and it will: pack the package, install it into a
dsh profile (`dsh plugin --profile web add <tarball>`), create the
`users.yaml` credential file with the bundled CLI, wire the production
overlay, and run the acceptance checklist against the live instance — see
[docs/deployment.md](docs/deployment.md).

## What it adds

**A guard over all four entry types** of `webServer` (exact routes, prefixes,
fallback, WebSocket upgrades), with a boot-time self-check that fails loud if
any entry is left unwrapped. Requests without a valid session are rejected:
302 to the login page for browser navigation, 401 / refused handshake for
API/WS. It is a single-door model: passing the gate means full access — there
is no per-user isolation (see [docs/dsh-auth-plan.md](docs/dsh-auth-plan.md)).

**Two mutually exclusive login flows** (choose one via `mode`):

| Mode                    | Credential                                                                        | Bearer channel                                                      | Entry points                                                    |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `"token"` (default, M2) | Shared random token from `$DSH_HOME/.credentials.yaml` (env ref `DSH_AUTH_TOKEN`) | `Authorization: Bearer <token>` (constant-time compare)             | `GET/POST /auth/login`, `POST /auth/logout`, `GET /auth/status` |
| `"password"` (M3)       | Username/password from `$DSH_HOME/auth/users.yaml` (scrypt hashes)                | `Authorization: Bearer <session token>` (session lookup, revocable) | same four endpoints + `dsh-auth` CLI                            |

**Security properties** (both modes):

- `HttpOnly; Secure; SameSite=Lax` session cookies (`cookieSecure` off for
  http test environments); session tokens stored as SHA-256 digests;
  256-bit random issuance, new session per login (anti-fixation);
- Password mode: scrypt (`node:crypto`, N=2¹⁶ / r=8 / p=1), constant-time
  verification with a dummy-hash path for unknown users (no enumeration),
  uniform 401 for unknown/wrong/disabled accounts, users file re-read per
  login (no restart needed), 0600 permission discipline;
- Login rate limiting: per-IP + per-account buckets, exponential backoff
  (30 s base, 15 min cap), `429 + retry-after` while locked;
- Fail-closed: missing credentials/users file, unparseable file, or missing
  session store all deny rather than silently allow; the guard self-check
  aborts startup if anything is unwrapped.

**CLI** (`dsh-auth`, bin shipped with the package):

```sh
dsh-auth user add admin --password-stdin     # create a user, hash written to users.yaml
dsh-auth user list                            # list users (disabled marked)
dsh-auth user disable admin                   # block new logins (existing sessions stay valid)
# all subcommands accept --file <path>
```

## Example session

A typical deployment flow (run by you or your agent):

1. **Pack & install** — `npm pack` → `scp dsh-auth-*.tgz server:/tmp/` →
   `dsh plugin --profile web add /tmp/dsh-auth-*.tgz` (forwards to pnpm).
2. **Create an admin** — `printf '%s\n' '<strong-password>' | dsh-auth user add admin --password-stdin`.
3. **Configure** — copy [deploy/cordis.patch.yml](deploy/cordis.patch.yml) to
   `$DSH_HOME/cordis.patch.yml`; set `mode: "password"` and keep
   `cookieSecure: true` behind TLS.
4. **Verify** — restart, then run the acceptance sequence
   ([docs/deployment.md](docs/deployment.md) §4): unauthenticated requests are
   rejected, login issues a session cookie, the Bearer session token passes the
   gate, WS upgrades need a cookie, logout revokes, and the rate limiter
   returns `429 + retry-after` after repeated failures.

## Requirements

- Node ≥ 22.19 (same as the target dsh deployment); pnpm for `dsh plugin add`
  (server npm global prefix may need `--prefix ~/.npm-global`);
- A working dsh web profile; TLS termination in front for
  `cookieSecure: true` (curl/scripts are unaffected by `Secure`);
- `--trusted-host` is orthogonal: it guards against DNS rebinding, it is not
  authentication — configure both on a public instance.

## Install

The package is not published to npm (UNLICENSED). Install from a tarball:

```sh
# on the source machine
npm pack                                  # produces dsh-auth-<version>.tgz
scp dsh-auth-<version>.tgz server:/tmp/

# on the server
dsh plugin --profile web add /tmp/dsh-auth-<version>.tgz
```

Upgrade by repacking and re-adding; remove with
`dsh plugin --profile web remove dsh-auth` (and delete the overlay row).

## Configuration

Plugin row config (in `$DSH_HOME/cordis.patch.yml`):

| Field          | Default            | Meaning                                                                      |
| -------------- | ------------------ | ---------------------------------------------------------------------------- |
| `mode`         | `"token"`          | `"token"` (M2 shared token) or `"password"` (M3)                             |
| `sessionTtl`   | `604800`           | Session TTL in seconds, fixed expiry from creation                           |
| `cookieName`   | `dsh_auth`         | Session cookie name                                                          |
| `tokenRef`     | `"DSH_AUTH_TOKEN"` | Token mode: credentials reference (env var name)                             |
| `cookieSecure` | `true`             | Add `; Secure`; keep `false` only for http test environments                 |
| `usersFile`    | `""`               | Password mode: users.yaml path; `""` = `${DSH_HOME:-~/.dsh}/auth/users.yaml` |

## Docs

- Roadmap & threat model: [docs/dsh-auth-plan.md](docs/dsh-auth-plan.md)
- Executable specs (authoritative for implementation):
  [docs/impl-m1.md](docs/impl-m1.md) / [docs/impl-m2.md](docs/impl-m2.md) /
  [docs/impl-m3.md](docs/impl-m3.md)
- Deployment & acceptance checklist: [docs/deployment.md](docs/deployment.md)
  - [deploy/cordis.patch.yml](deploy/cordis.patch.yml)
- Development conventions: [docs/development.md](docs/development.md)

## Known limitations

- Disabling a user only blocks new logins; issued sessions stay valid until
  their TTL (no `revokeBySubject` yet).
- Rate limiting is in-memory (resets on restart) and keys on the socket peer
  address — `X-Forwarded-For` is deliberately untrusted, so behind a reverse
  proxy limits aggregate by the proxy's address.
- No CSRF token on login (single-door model has no per-user isolation;
  `SameSite=Lax` covers most cases; residual risk reassessed in M4).
- No client-side GUI (logout button) yet.
