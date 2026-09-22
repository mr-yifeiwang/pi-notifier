import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";

type LaunchError = Error & { code?: string };

type Dependencies = {
  execFile?: (file: string, args: string[], callback: (error: LaunchError | null) => void) => unknown;
  isSubagent?: boolean;
};

type RunCommand = NonNullable<Dependencies["execFile"]>;

// Extract the first line of an assistant response.
function responseText(message: unknown) {
  const assistant = message as { role?: unknown; content?: unknown };
  if (assistant.role !== "assistant" || !Array.isArray(assistant.content)) return "";

  return assistant.content
    .filter((part): part is { type: "text"; text: string } =>
      typeof part === "object" && part !== null &&
      (part as { type?: unknown }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("")
    .trim()
    .split(/\r?\n/, 1)[0];
}

// Detect subagent completion prompts.
function isSubagentCompletion(prompt: string) {
  return /^(?:Workflow child completed|Background task completed):/.test(prompt.trim());
}

// Identify a missing terminal-notifier executable.
function isTerminalNotifierUnavailable(error: LaunchError | null) {
  return error?.code === "ENOENT";
}

// Notify users when terminal-notifier is unavailable.
function notifyTerminalNotifierUnavailable(notify: (message: string, level: "warning") => void) {
  notify(
    "terminal-notifier is unavailable. Install it with: brew install terminal-notifier",
    "warning",
  );
}

// Notify when an agent finishes.
function notifyAgentSettled(
  runCommand: RunCommand,
  sessionTitle: string,
  response: string,
  onUnavailable: () => void,
) {
  runCommand("terminal-notifier", [
    "-title",
    "Pi",
    "-subtitle",
    sessionTitle,
    "-message",
    response || "Session finished",
    "-sound",
    "Submarine",
  ], (error) => {
    if (isTerminalNotifierUnavailable(error)) onUnavailable();
  });
}

// Notify when a question requires an answer.
function notifyQuestionAsked(
  runCommand: RunCommand,
  sessionTitle: string,
  question: string,
  onUnavailable: () => void,
) {
  runCommand("terminal-notifier", [
    "-title",
    "Pi",
    "-subtitle",
    sessionTitle,
    "-message",
    question ? `Question asked: ${question}` : "Question asked",
    "-sound",
    "Submarine",
  ], (error) => {
    if (isTerminalNotifierUnavailable(error)) onUnavailable();
  });
}

// Register completion notifications with Pi.
export default function (pi: ExtensionAPI, dependencies: Dependencies = {}) {
  if (dependencies.isSubagent ?? process.env.PI_SUBAGENT_CHILD === "1") return;

  const runCommand = dependencies.execFile ?? execFile;
  let latestResponse = "";
  let sessionId = "";
  let suppressSubagentNotification = false;
  // Limit missing-dependency reminders to one per session.
  let hasWarnedTerminalNotifierUnavailable = false;

  pi.on("session_start", (_event, ctx) => {
    sessionId = ctx.sessionManager.getSessionId().slice(0, 7);
  });

  pi.on("before_agent_start", (event) => {
    suppressSubagentNotification = isSubagentCompletion(event.prompt);
  });

  pi.on("agent_start", () => {
    latestResponse = "";
  });

  pi.on("message_end", (event) => {
    const response = responseText(event.message);
    if (response) latestResponse = response;
  });

  pi.on("agent_settled", (_event, ctx) => {
    const sessionName = pi.getSessionName()?.trim();
    const sessionTitle = sessionName || ctx.sessionManager.getSessionId().slice(0, 7);
    if (!suppressSubagentNotification) {
      notifyAgentSettled(runCommand, sessionTitle, latestResponse, () => {
        if (hasWarnedTerminalNotifierUnavailable) return;
        notifyTerminalNotifierUnavailable(ctx.ui.notify.bind(ctx.ui));
        hasWarnedTerminalNotifierUnavailable = true;
      });
    }
    suppressSubagentNotification = false;
  });

  pi.events.on("rpiv:ask-user:prompt", (raw) => {
    const event = raw as { questions?: Array<{ question?: unknown }> };
    const question = event.questions?.[0]?.question;
    const sessionTitle = pi.getSessionName()?.trim() || sessionId;
    notifyQuestionAsked(runCommand, sessionTitle, typeof question === "string" ? question : "", () => {});
  });
}
