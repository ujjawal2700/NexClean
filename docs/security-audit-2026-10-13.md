# Repository security review — 13 October 2026

## Result

No active malicious payload was identified in the current first-party repository tree. Local `main` and the freshly fetched GitHub `origin/main` both point to `af3c1819d01c5d71a2c56989f4bd388c80528a14`. All 646 tracked files were checked against their Git blob hashes with no differences.

This is a repository/code review, not a forensic certification of the computer, deployment servers, GitHub account, or all third-party dependencies.

## Checks performed

- Reviewed the existing malware scanner before running it; its tracked-file scan passes.
- Independently checked GitHub `main` blobs for hidden whitespace-padded payloads, editor auto-run settings, and injected startup commands.
- Refreshed all configured remote branches and enumerated GitHub branches, tags and pull-request heads. Only `main` and `refs/pull/1/head` were advertised. The PR head (`179811f5b2e6e6b8dbfc78c7ecd17ad52b694222`, 406 files) has no matches for those indicators. Its older code was not executed.
- Checked the ignored local `.vscode/settings.json`: it only disables a Postman dotenv-detection notification. There is no local hidden auto-run task.
- Confirmed the local pre-commit hook matches the committed scanner hook. No custom Git filter or alternate hooks path was found.
- Reviewed application package scripts and Vite configuration. No `node api.js`, unexpected lifecycle loader, or injected configuration payload is present.
- Inspected font file types and four SVG assets. The fonts have genuine EOT/TTF/WOFF/WOFF2 headers; SVG checks found no script tags, JavaScript URLs, event handlers, or entity declarations.
- Checked built frontend/backend output and ignored editor files for the known loader indicators; no matches were found.
- Reviewed all four lockfiles. Resolved packages come from `registry.npmjs.org`, with the existing SheetJS package from `cdn.sheetjs.com`. Every HTTP-resolved package has an integrity value.
- Reviewed the listed install-script packages (`core-js`, `esbuild`, `fsevents`, `@firebase/util`, `protobufjs`) and scanned their top-level JavaScript for known implant indicators. No matching hidden loader was found. Install scripts were not run.
- Fresh `npm audit` runs for frontend, backend and tests, including development dependencies, report zero known vulnerabilities. These advisory results do not prove that every dependency is free from malware.

## Confirmed malicious code in GitHub history

Commit `b69bcedffeee7b6701410cc5cd70de250e937796` still exists as a historical ancestor. It contains:

- `backend/api.js`: obfuscated, whitespace-hidden JavaScript;
- `public/fonts/fa-solid-700.fml`: obfuscated JavaScript disguised as a font;
- `.vscode/tasks.json`: a hidden `folderOpen` task executing the fake font;
- `.vscode/settings.json`: `task.allowAutomaticTasks: true`;
- `backend/package.json`: commands running `node api.js` before development, builds and startup.

These files and settings are absent from current `main`; the backend scripts are clean. History was not rewritten, old commits were not checked out, and the payloads were not executed during this review. Do not build or open the compromised revision with automatic editor tasks enabled. See `SECURITY-INCIDENT.md` for the earlier incidents and cleanup.

## Unrelated but not identified as malicious

`public/fonts/` contains 15 genuine Font Awesome font/vector assets and a README referring to a different “Blockchain Explorer” application. No current NexClean source references them. They appear to be unused leftovers associated with the older cover files, rather than the active fake-font payload. They were left intact because this request was an inspection, not an asset deletion.

The database cleanup utilities are application maintenance scripts, not hidden loaders. In particular, `backend/scripts/execute-cleanup.mjs` loads the backend environment and deletes records without a confirmation gate. It was reviewed as text only and was not run. Its destructive behaviour should not be confused with malware or with a safe general-purpose test command.

## GitHub access controls still need review

Git access allowed source and reference verification. The GitHub CLI is unavailable, and unauthenticated GitHub API access was unavailable, so collaborators, access tokens, deploy keys, webhooks and branch-protection settings were not verified. No GitHub permissions or account settings were changed, and no attribution of the injection is made from commit author names.

Because a remote force-update previously reintroduced the payload, code cleanup alone is insufficient to establish that repository write access is secure. Review repository writers and credentials, and protect `main` against force pushes and unreviewed changes, including administrator bypass where appropriate. GitHub documents these controls at:
https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
