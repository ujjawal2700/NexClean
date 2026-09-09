# Security incident — repository implants, 2026-06-23 to 2026-09-09

Two separate implants were committed to this repository by an identity that is
not a project maintainer. Both are removed as of `0963e8e`. **Code removal is
the smaller half of this.** The delivery mechanism was a commit pushed to
`main`, which means repository write access — not a single infected laptop — so
the access review below is the part that actually stops recurrence. The same
family hit `nigam-service` and came back three times there.

---

## 1. What was found

### Implant A — `frontend/vite.config.js` (blob `8ca348df`, 9,840 bytes)

A Node loader appended to line 50 behind roughly 1,800 tab characters, which
pushes it off-screen in an editor and into a collapsed region in GitHub's diff
view.

It resolved its command-and-control address **from the Ethereum blockchain**
instead of hardcoding one:

1. Read the most recent transaction from a fixed wallet via public RPC
   endpoints, with a Blockscout API fallback and a nonce-bisection search if the
   wallet had not transacted in the sampled block window.
2. Decoded that transaction's `to` field as two packed IPv4 addresses.
3. Fetched XOR-encrypted second-stage code from those hosts, accepting it either
   as the response body or smuggled in an `X-Payload-B64` response header.
4. Executed it through **both** `eval()` and a detached, `unref`'d
   `node -e` child process, so it survives the parent exiting.

Using the chain as the dead drop means there is no domain or IP to sink — the
operator repoints the C2 by sending a transaction.

**This is what broke production.** Vite resolves `vite.config.js` *before*
`vite.config.ts`. The file was a stray `tsc` emit that should never have been
tracked, so the tampered copy silently shadowed the real config on every
`vite build` — including `deploy.sh` on the VPS. Note the loader swallows all
its own errors (`catch(t){}`), so a failed C2 fetch leaves no log line.

### Implant B — `.vscode/tasks.json` + `public/fonts/fa-solid-400.woff2` (blob `9446bb9d`, 20,861 bytes)

A VS Code task configured to run on `"runOn": "folderOpen"` — the moment the
repository is opened, before any file is read — invoking:

```
node ./public/fonts/fa-solid-400.woff2
```

That path was not a font. It was 20,861 bytes of obfuscated Node given a binary
extension so that code review and content scanners skip it. The task set
`"hide": true` with `reveal: never`, `echo: false` and `close: true`, and the
same commit set `"task.allowAutomaticTasks": true` in `settings.json` — the
setting that suppresses VS Code's "Allow automatic tasks?" consent prompt. The
two files were written to work as a pair.

The surrounding commit also added a FontAwesome dump that nothing in this
project references, purely as cover for the one fake file, and `launch.json` /
`settings.json` full of `sst`, `AWS_PROFILE=flo-ct-flo360`, Contentful, Lerna
and jest references belonging to some other codebase.

---

## 2. Delivery — the forged merge

`d7dde04`, which introduced Implant A, presents itself as a routine GitHub merge
of PR #1. It is not one.

| field | value |
|---|---|
| author | `Ujjawal Kumar Mahawar` — 2026-08-10 12:55:17 **+0530** |
| committer | **`yugin0120`** — 2026-08-31 18:55:05 **-0800** |
| signature | none |

A genuine GitHub "Merge pull request" commit has committer
`GitHub <noreply@github.com>` and carries GitHub's `web-flow` signature. This
has neither. The committer name is different, the timestamp is 21 days after the
authored date, and the timezone is not the author's. The email is the project
owner's GitHub `noreply` address, which is public in every commit and therefore
trivially set by anyone.

Decisively: **the merge tree contains bytes present in neither parent.**
`frontend/vite.config.js` is the identical clean 2,157-byte blob `fb8accf0` in
`20fac9e`, `8c019d0` and `179811f`. A merge cannot invent content. This commit
was hand-built to look like the routine merge it is impersonating, and pushed.

The same `yugin0120` identity committed `efe9bcb`, which carried Implant B under
the title "Fix toggle knob escaping the switch track on Area alerts" for what is
otherwise a 7-line TSX change.

That commit's `.gitignore` addition describes the operator's tooling:

```
branch_structure.json      # repository/branch reconnaissance output
temp_auto_push.bat         # automated push tooling (Windows)
temp_interactive_push.bat
.gitignore                 # .gitignore ignoring ITSELF
```

The last entry means subsequent edits to `.gitignore` never appear in
`git status`.

---

## 3. Exposure

Assume the second stage ran, and that it ran as the invoking user:

- **The VPS**, via `deploy.sh` → `npm run build` → Vite loading the tampered
  config, for any deploy after 2026-08-31. That process can read `backend/.env`,
  the PM2 environment, `~/.ssh`, `~/.npmrc` and `~/.git-credentials`, and the
  deploy user holds at least `sudo systemctl reload nginx`.
- **Any developer machine** that ran `npm run dev` or `npm run build` after
  2026-08-31, or that opened the repo in VS Code between 2026-06-23 and
  2026-07-21 with automatic tasks permitted.

Implant B's payload was blanked to 0 bytes in `23dd2f1` (2026-07-21) and its
task deleted in `74bde0d`, so only Implant A was live at the time of the failed
deploy.

---

## 4. Indicators of compromise

```
Identity     yugin0120 <90878964+ujjawal2700@users.noreply.github.com>
Commits      d7dde04  forged merge, carried Implant A
             efe9bcb  carried Implant B
Blobs        8ca348df8d73ea454bc60d48214437f986759b2a   9,840 B  vite.config.js
             9446bb9d9c…                               20,861 B  fa-solid-400.woff2
Clean blob   fb8accf0ce1a…                              2,157 B  (uninfected config)

Wallet       0xa322E5f3D311D3080e6f0121063e9aDC2490Ef1a
Indexer      https://eth.blockscout.com/api
RPC          1rpc.io/eth, eth.drpc.org, ethereum-rpc.publicnode.com,
             eth-mainnet.public.blastapi.io, and $ETH_RPC_URL if set
C2 paths     http://<decoded-ip>:443/0x/cls  and  /0x/ls   (plain HTTP on :443)
XOR keys     q4FZkxX{!h,Sr3=@   y-p_>d$0B&@^1aQk
Headers      Sec-V (request), X-Payload-B64 (response)
Markers      global.i = 'A8-4392-2'      (Implant A campaign tag)
             global['!'] = '8-***'       (Implant B)
```

A full sweep of all 3,454 blobs in this repository's history found exactly these
two payloads and nothing else.

---

## 5. Remediation checklist

### 5.1 GitHub access — do this first

Nothing else matters if the push path stays open.

- [ ] `github.com/ujjawal2700/NexClean` → Settings → **Collaborators**. Remove
      anyone unrecognised. Check **Manage access** on every other repo too.
- [ ] Settings → **Deploy keys**. Remove any key you did not create; a deploy
      key with write access is a common persistence foothold.
- [ ] Settings → **Webhooks**. Remove unrecognised endpoints.
- [ ] Account → Settings → **Personal access tokens** (classic *and*
      fine-grained). Revoke everything you cannot positively account for. A
      stolen PAT with `repo` scope fully explains these pushes.
- [ ] Account → Settings → **Applications** → Authorized OAuth Apps and GitHub
      Apps. Revoke unrecognised grants.
- [ ] Account → Settings → **Sessions**. Sign out all other sessions.
- [ ] Account → Settings → **SSH and GPG keys**. Remove unrecognised keys.
- [ ] Change the GitHub password, confirm 2FA is on, and regenerate recovery
      codes.
- [ ] Security log (`github.com/settings/security-log`) — filter for
      `repo.add_member`, `oauth_authorization.create`, `public_key.create`,
      `protected_branch.policy_override` around **2026-06-23** and
      **2026-08-31**.

### 5.2 Stop forged commits from being pushable

- [ ] Branch protection on `main`: require a pull request, block force pushes,
      and enable **Require signed commits**. That single setting makes this
      exact attack impossible — the forged merge is unsigned and could not have
      landed.
- [ ] Set up commit signing locally (`git config --global commit.gpgsign true`)
      so your own commits satisfy the rule.
- [ ] Enable GitHub secret scanning and push protection on the repo.

### 5.3 VPS — rotate every secret, in this order

The loader ran here with the deploy user's privileges. Treat all of
`backend/.env` as disclosed. Highest-impact first:

- [ ] **`FIREBASE_SERVICE_ACCOUNT_BASE64`** — a service-account private key.
      Delete the key in Google Cloud IAM, issue a new one, re-encode. Highest
      priority: it does not expire on its own.
- [ ] **`RAZORPAY_KEY_SECRET`** / `RAZORPAY_KEY_ID` — regenerate in the Razorpay
      dashboard and review recent transactions and payouts.
- [ ] **`MONGODB_URI`** — rotate the database user's password. If Atlas, review
      the IP access list and check access logs around the dates above.
- [ ] **`JWT_SECRET`** — rotate. This invalidates every issued session, which is
      what you want; the existing `tokenVersion` mechanism handles the rest.
- [ ] **`ADMIN_PASSWORD`** / `ADMIN_EMAIL` — change the seeded super-admin
      credential.
- [ ] **`CLOUDINARY_API_SECRET`** / `CLOUDINARY_API_KEY` — regenerate.
- [ ] **`SMS_INDIA_HUB_PASSWORD`** / `SMS_INDIA_HUB_API_KEY` — rotate, and check
      the send log for messages you did not originate (SMS credentials get
      resold for spam).
- [ ] **`REDIS_URL`** — rotate the password if it carries one.
- [ ] `~/.ssh/authorized_keys` on the VPS — remove unrecognised keys. Rotate the
      host's outbound SSH keys and any `~/.npmrc` or `~/.git-credentials` tokens.

Frontend `VITE_*` values are compiled into the client bundle and are public by
design — the Firebase web config needs no rotation. Do confirm
`VITE_GOOGLE_MAPS_KEY` has HTTP-referrer restrictions, since an unrestricted
Maps key is billable by anyone.

### 5.4 VPS — verify nothing was left behind

The second stage spawned detached processes, so a restart does not clear it.

- [ ] `ps aux | grep -E "node -e|node --eval"` — the loader's spawn signature.
- [ ] `crontab -l`, `systemctl list-timers`, and `~/.bashrc` / `~/.profile` for
      unexpected entries.
- [ ] `ss -tupn` for outbound connections to unfamiliar addresses on :80/:443.
- [ ] `git -C /path/to/NexClean log --format='%h %cn %ce' | sort -u -k2` to
      confirm no other foreign committer.
- [ ] Given a working backup, **rebuilding the VPS from a clean image is the
      only way to be certain.** Rotate credentials either way.

### 5.5 Developer machines

The `.bat` filenames indicate a Windows host. Any machine that opened this repo
in VS Code before 2026-07-21, or built it after 2026-08-31, is in scope.

- [ ] Audit VS Code / Cursor extensions and remove anything unrecognised; this
      malware family is distributed through editor extension marketplaces, which
      would explain recurrence across machines and repositories.
- [ ] Check `~/.vscode/extensions` modification times against 2026-06-23.
- [ ] `npm token list` and revoke unknown tokens; check `~/.npmrc`.
- [ ] Run a reputable anti-malware scan.

### 5.6 Ongoing

- [ ] `scripts/scan-malware.mjs` is committed and wired to a pre-commit hook.
      After a fresh clone the hook must be reinstalled — hooks are not cloned:
      `cp scripts/pre-commit .git/hooks/pre-commit`
- [ ] Consider running it in CI as well, since a local hook is bypassable with
      `--no-verify` and does not protect against a direct push.
- [ ] Note `.vscode/` is gitignored in this repo, so a `tasks.json` dropped
      locally is invisible to both `git status` and this scanner, which reads
      tracked files. That gap closes by keeping the machine clean, not by the
      scanner.

---

## 6. What was already fixed in code

`d73538c` and `0963e8e` on `main`:

- Deleted `frontend/vite.config.js` and `frontend/vite.config.d.ts`. These were
  stray `tsc` emits; `vite.config.ts` is now the only config and is identical in
  behaviour, minus a `createRequire` shim the attacker added to give
  `require("node:http")` a binding inside an ESM config. Both are now gitignored
  so the shadowing hazard cannot return.
- Repaired `frontend/tsconfig.node.json`, where `"noEmit": true` was followed by
  a stray comma on its own line — the trace of whatever produced the emit. No
  compiler option changed.
- Deleted the blanked `public/fonts/fa-solid-400.woff2` so the path the hidden
  task pointed at no longer exists, and the planted `.vscode/extensions.json`.
- Ported `scripts/scan-malware.mjs` from `nigam-service` and closed the two gaps
  Implant B exposed there — it evaded both structural rules and was caught only
  by a wallet-specific string that a variant would change:
  - `asset-shaped-text` — a font/image/archive extension holding NUL-free text
    is not the asset it claims to be. Binary extensions are no longer skipped by
    name, since genuine ones are dropped by the existing binary check.
  - the pad rule required code *before* the pad and so missed a file that opens
    with one. A leading pad now matches at a 100-column floor.
  - `auto-run-task` — reports `runOn: folderOpen` and `allowAutomaticTasks`.

  Verified against both real payload blobs and against a clean tree.

**History was deliberately not rewritten.** Both payloads remain reachable in
`d7dde04` and `efe9bcb` for the forensic record. They are inert unless checked
out and executed, and no build path reaches them. If you later want them gone —
for GitHub malware flagging, or before making the repo public — use
`git filter-repo` to strip blobs `8ca348df` and `9446bb9d`, then force-push;
every clone and the VPS checkout must then be re-cloned or hard-reset.
