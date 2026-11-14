# Pi Notifier

> [!WARNING]
>
> **Maintenance Notice:** As of November 14, 2026, the owner will no longer maintain this project for [Pi](https://pi.dev/) and prefers using [Oh My Pi (OMP)](https://omp.sh/). Compared to Pi's minimalist nature, OMP provides centralized notification management for commonly used agentic features.
>
> For a similar OMP plugin, see [`mr-yifeiwang/omp-custom-notifications`](https://github.com/mr-yifeiwang/omp-custom-notifications).

[TOC]

---

This repository contains a Pi extension that sends macOS notifications and integrates with selected popular [community extensions](https://pi.dev/packages).

- [1.0.0] Notify when the main agent becomes idle
- [1.0.0] Notify when [@juicesharp/rpiv-ask-user-question](https://pi.dev/packages/@juicesharp/rpiv-ask-user-question) asks a question
- [1.0.3] Suppress intermediate completion notifications from asynchronous subagent runs and workflow transitions with [pi-subagents](https://pi.dev/packages/pi-subagents)
- [1.1.0] Notify when [@gotgenes/pi-permission-system](https://pi.dev/packages/@gotgenes/pi-permission-system) presents a permission dialog
- [1.2.0] Notify when [pi-goal-x](https://pi.dev/packages/pi-goal-x) presents a question, questionnaire, goal proposal, or task-list confirmation

Notifications include the session name or a short session ID, along with relevant context such as the first line of Pi's response.

## Requirements

- [Pi Coding Agent](https://pi.dev/), an open-source agent harness
- [Terminal Notifier](https://github.com/julienXX/terminal-notifier#installation), installed via Homebrew

## Installation

1. Type the following in Pi:
   ```txt
   Install pi-notifier using git:github.com/mr-yifeiwang/pi-notifier
   ```
2. Reload Pi.
