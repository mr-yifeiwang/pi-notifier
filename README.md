# Pi Notifier

[TOC]

---

This repository contains a Pi extension that sends macOS notifications and integrates with selected popular [community extensions](https://pi.dev/packages).

- Notify when the main agent becomes idle
- Notify when [@juicesharp/rpiv-ask-user-question](https://pi.dev/packages/@juicesharp/rpiv-ask-user-question) asks a question
- Suppress intermediate completion notifications from asynchronous subagent runs and workflow transitions with [pi-subagents](https://pi.dev/packages/pi-subagents)

Notifications include the session name or a short session ID, along with relevant context such as the first line of Pi's response.

## Requirements

- [Pi Coding Agent](https://pi.dev/), an open-source agent harness
- [Terminal Notifier](https://github.com/julienXX/terminal-notifier#installation), installed via Homebrew

## Installation

1. Type the following in Pi:
   ```txt
   Install https://github.com/mr-yifeiwang/pi-notifier
   ```
1. Reload Pi.
