# Pi Terminal Notifier

This repository contains a Pi extension that sends macOS notifications. The extension uses [terminal-notifier](#dependencies) to send a notification when the main agent finishes a run. The notification shows the session name or a short session ID, and the first line of Pi's response. If `@juicesharp/rpiv-ask-user-question` is installed, it also notifies the user when Pi asks a question.

## Dependencies

- [Pi Coding Agent](https://pi.dev/), an open-source agent harness
- [Terminal Notifier](https://github.com/julienXX/terminal-notifier)
- (_dev only_) [Node](https://nodejs.org/)
- (_optional_) [@juicesharp/rpiv-ask-user-question](https://pi.dev/packages/@juicesharp/rpiv-ask-user-question)

## Installation

1. Copy `pi-terminal-notifier.ts` to Pi's config folder:

   ```sh
   mkdir -p ~/.pi/agent/extensions
   cp pi-terminal-notifier.ts ~/.pi/agent/extensions
   ```

1. Restart pi.
