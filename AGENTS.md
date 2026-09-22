# AGENTS.md

[TOC]

---

Read `README.md` and `pi-terminal-notifier.ts` first.

## Development and Testing

1. Ensure all changes are compatible with [Pi Coding Agent](https://pi.dev/) and [Terminal Notifier](https://github.com/julienXX/terminal-notifier).
1. Use TDD. Update tests whenever `pi-terminal-notifier.ts` behavior changes.
1. Use a standalone function for each notification type. Add a comment describing what each function does in 60 characters. Avoid generic notification abstractions.
1. After modifying `pi-terminal-notifier.ts`, ask the user for permission before syncing it to `~/.pi/agent/extensions/pi-terminal-notifier.ts`. Only perform the sync after the user explicitly approves it. After syncing, remind the user to `/reload`.
