# Pi Terminal Notifier

[TOC]

---

This repository contains a Pi extension that sends macOS notifications. The extension uses [terminal-notifier](#dependencies) to send a notification when the main agent finishes a run. The notification shows the session name or a short session ID, and the first line of Pi's response.

## Dependencies

- [Pi Coding Agent](https://pi.dev/), an open-source agent harness
- [Terminal Notifier](https://github.com/julienXX/terminal-notifier)
- (_dev only_) [Node](https://nodejs.org/)

## Installation

1. Install the extension from GitHub:
   ```sh
   pi install git:github.com/mr-yifeiwang/pi-terminal-notifier
   ```
1. Restart Pi.

## Supported Extensions

Pi Terminal Notifier includes dedicated support for the following extensions:

- [@juicesharp/rpiv-ask-user-question@2.9.0](https://pi.dev/packages/@juicesharp/rpiv-ask-user-question): Notify when asking a question
