# AGENTS.md

[TOC]

---

Read `README.md` and `main.ts` first.

## Development and Testing

1. Ensure all changes are compatible with [Pi Coding Agent](https://pi.dev/) and [Terminal Notifier](https://github.com/julienXX/terminal-notifier).
2. Use TDD. Update tests whenever `main.ts` behavior changes. Use `npm test` to verify.
3. Use a standalone function for each notification type. Add a comment describing what each function does in 60 characters. Avoid generic notification abstractions.
4. Follow [SemVer](https://semver.org/). Determine whether the changes require a major, minor, patch, or no version bump. Explain the choice briefly, ask the user to confirm the proposed version, then update it consistently across the repo.
5. After modifying `main.ts`, ask the user for permission to do live testing:
   1. Disable the `pi-notifier` extension in Pi temporarily, if it is installed.
   2. Sync `main.ts` to `~/.pi/agent/extensions/pi-notifier-tmp.ts`. After syncing, remind the user to `/reload`.
   3. When `~/.pi/agent/extensions/pi-notifier-tmp.ts` exists, remind the user to (1) uninstall it when testing finishes and (2) re-enable `pi-notifier`.
