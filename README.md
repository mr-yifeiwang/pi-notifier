# Pi Terminal Notifier

This repository contains a Pi extension that sends macOS notifications.

## Dependencies

- [Pi Coding Agent](https://pi.dev/), an open-source agent harness
- [Terminal Notifier](https://github.com/julienXX/terminal-notifier)
- (_optional_) [@juicesharp/rpiv-ask-user-question](https://pi.dev/packages/@juicesharp/rpiv-ask-user-question)

## Installation

1. Copy `pi-terminal-notifier.ts` to Pi's config folder:

   ```sh
   mkdir -p ~/.pi/agent/extensions
   cp pi-terminal-notifier.ts ~/.pi/agent/extensions
   ```

1. Restart pi.
