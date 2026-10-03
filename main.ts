import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";

type LaunchError = Error & { code?: string };

type Dependencies = {
  execFile?: (file: string, args: string[], callback: (error: LaunchError | null) => void) => unknown;
  isSubagent?: boolean;
};

type RunCommand = NonNullable<Dependencies["execFile"]>;

// Extract text from assistant, user, or custom messages.
function messageText(message: unknown) {
  const content = (message as { content?: unknown } | null)?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .filter((part): part is { type: "text"; text: string } =>
      typeof part === "object" && part !== null &&
      (part as { type?: unknown }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("");
}

// Extract the first line of an assistant response.
function extractFirstResponseLine(message: unknown) {
  if ((message as { role?: unknown } | null)?.role !== "assistant") return "";
  return messageText(message).trim().split(/\r?\n/, 1)[0];
}

// Detect asynchronous run completion prompts.
function isAsyncCompletionPrompt(prompt: string) {
  return /^(?:(?:Workflow child|Background task|Detached foreground task) completed:|Background tasks completed \(\d+\):)/.test(prompt.trim());
}

// Identify a missing terminal-notifier executable.
function isTerminalNotifierUnavailable(error: LaunchError | null) {
  return error?.code === "ENOENT";
}

// Notify users when terminal-notifier is unavailable.
function notifyTerminalNotifierUnavailable(notify: (message: string, level: "warning") => void) {
  notify(
    "terminal-notifier is unavailable. The pi-notifier extension needs it to send macOS notifications. Install it with: brew install terminal-notifier",
    "warning",
  );
}

// Notify when an agent finishes.
function notifyAgentSettled(
  runCommand: RunCommand,
  sessionSubtitle: string,
  response: string,
  onUnavailable: () => void,
) {
  runCommand("terminal-notifier", [
    "-title",
    "Pi",
    "-subtitle",
    sessionSubtitle,
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
  sessionSubtitle: string,
  question: string,
  onUnavailable: () => void,
) {
  runCommand("terminal-notifier", [
    "-title",
    "Pi",
    "-subtitle",
    sessionSubtitle,
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
  let notificationMessage = "";
  let shortSessionId = "";
  const currentSessionIdentities = new Set<string>();
  const activeAsyncRuns = new Set<string>();
  let completionPrompt = false;
  let userPrompt = false;
  let agentRunning = false;
  let hasUserInput = false;
  let performedTools = false;
  let startedAsyncRun = false;
  let needsAttention = false;
  let completionTriggeredRun = false;
  // Limit missing-dependency reminders to one per session.
  let hasWarnedTerminalNotifierUnavailable = false;

  pi.on("session_start", async (_event, ctx) => {
    const currentSessionId = ctx.sessionManager.getSessionId();
    const sessionFile = ctx.sessionManager.getSessionFile?.();
    currentSessionIdentities.clear();
    currentSessionIdentities.add(currentSessionId);
    if (sessionFile) currentSessionIdentities.add(sessionFile);
    shortSessionId = currentSessionId.slice(0, 7);
    activeAsyncRuns.clear();
    completionPrompt = false;
    userPrompt = false;
    agentRunning = false;
    startedAsyncRun = false;
    completionTriggeredRun = false;
    hasWarnedTerminalNotifierUnavailable = false;
    // Show a warning message if terminal-notifier is unavailable.
    await new Promise<void>((resolve) => {
      runCommand("terminal-notifier", ["-version"], (error) => {
        if (isTerminalNotifierUnavailable(error)) {
          notifyTerminalNotifierUnavailable(ctx.ui.notify.bind(ctx.ui));
          hasWarnedTerminalNotifierUnavailable = true;
        }
        resolve();
      });
    });
  });

  pi.events.on("subagent:async-started", (raw) => {
    const event = raw as { sessionId?: unknown; id?: unknown } | null;
    if (typeof event?.sessionId !== "string" || !currentSessionIdentities.has(event.sessionId)) return;
    if (typeof event.id === "string" && event.id) {
      activeAsyncRuns.add(event.id);
      if (agentRunning) startedAsyncRun = true;
    }
  });

  pi.events.on("subagent:async-complete", (raw) => {
    const event = raw as { sessionId?: unknown; runId?: unknown } | null;
    if (typeof event?.sessionId !== "string" || !currentSessionIdentities.has(event.sessionId)) return;
    if (typeof event.runId === "string") activeAsyncRuns.delete(event.runId);
  });

  pi.on("before_agent_start", (event) => {
    completionPrompt = isAsyncCompletionPrompt(event.prompt);
    userPrompt = !completionPrompt;
  });

  pi.on("agent_start", () => {
    notificationMessage = "";
    agentRunning = true;
    completionTriggeredRun = completionPrompt;
    hasUserInput = userPrompt;
    performedTools = false;
    startedAsyncRun = false;
    needsAttention = false;
    completionPrompt = false;
    userPrompt = false;
  });

  pi.on("tool_execution_start", () => {
    if (agentRunning) performedTools = true;
  });

  pi.on("message_end", (event) => {
    const message = event.message;
    if (agentRunning) {
      if (message.role === "user" && !isAsyncCompletionPrompt(messageText(message))) {
        hasUserInput = true;
      }
      if (message.role === "custom" && (
        message.customType === "subagent-notify" ||
        message.customType === "subagent-incremental-child-notify"
      )) {
        if (isAsyncCompletionPrompt(messageText(message))) completionTriggeredRun = true;
        else needsAttention = true;
      }
      if (message.role === "assistant" && (
        message.stopReason === "error" || message.stopReason === "aborted"
      )) needsAttention = true;
    }
    const responseLine = extractFirstResponseLine(message);
    if (responseLine) notificationMessage = responseLine;
  });

  pi.on("agent_settled", (_event, ctx) => {
    const sessionName = pi.getSessionName()?.trim();
    const sessionSubtitle = sessionName || ctx.sessionManager.getSessionId().slice(0, 7);
    // Suppress completion wakes that continue asynchronous work.
    const suppress = completionTriggeredRun && activeAsyncRuns.size > 0 &&
      !hasUserInput && (!performedTools || startedAsyncRun) && !needsAttention;
    if (!suppress) {
      notifyAgentSettled(runCommand, sessionSubtitle, notificationMessage, () => {
        if (hasWarnedTerminalNotifierUnavailable) return;
        notifyTerminalNotifierUnavailable(ctx.ui.notify.bind(ctx.ui));
        hasWarnedTerminalNotifierUnavailable = true;
      });
    }
    completionTriggeredRun = false;
    agentRunning = false;
  });

  pi.events.on("rpiv:ask-user:prompt", (raw) => {
    const event = raw as { questions?: Array<{ question?: unknown }> };
    const question = event.questions?.[0]?.question;
    const sessionSubtitle = pi.getSessionName()?.trim() || shortSessionId;
    notifyQuestionAsked(runCommand, sessionSubtitle, typeof question === "string" ? question : "", () => {});
  });
}
