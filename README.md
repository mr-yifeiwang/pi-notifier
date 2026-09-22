# Pi Notifier

[TOC]

---

This repository contains a Pi extension that sends macOS notifications.

- Notify when the main agent becomes idle
- Notify when the main agent needs attention through a [supported extension](#supported-extensions)
- Suppress noisy notifications from subagents

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

## Supported Extensions

Pi Notifier includes dedicated support for the following extensions:

- [@juicesharp/rpiv-ask-user-question](https://pi.dev/packages/@juicesharp/rpiv-ask-user-question): Notify when the agent is asking a question
