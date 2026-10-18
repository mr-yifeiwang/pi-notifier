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

// Notify when a goal proposal requires confirmation.
function notifyGoalConfirmationAsked(
  runCommand: RunCommand,
  sessionSubtitle: string,
  message: string,
) {
  runCommand("terminal-notifier", [
    "-title", "Pi",
    "-subtitle", sessionSubtitle,
    "-message", message,
    "-sound", "Submarine",
  ], () => {});
}

// Match delivered goal checkpoints, not audit messages.
function isGoalCheckpoint(message: unknown) {
  const raw = message as { role?: unknown; customType?: unknown; details?: { kind?: unknown; goalId?: unknown } | null } | null;
  return raw?.role === "custom" && raw.customType === "pi-goal-event" &&
    raw.details?.kind === "checkpoint" && typeof raw.details.goalId === "string" &&
    raw.details.goalId.trim().length > 0;
}

// Format permission prompts for a concise notification.
function permissionPromptText(raw: unknown) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return;
  const event = raw as {
    requestId?: unknown;
    surface?: unknown;
    value?: unknown;
    forwarding?: { requesterAgentName?: unknown } | null;
  };
  if (typeof event.requestId !== "string" || !event.requestId.trim()) return;

  const text = (value: unknown) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  const requester = text(event.forwarding?.requesterAgentName);
  const detail = [text(event.surface), text(event.value)].filter(Boolean).join(": ");
  const message = `Permission required${requester ? ` (${requester})` : ""}${detail ? `: ${detail}` : ""}`;
  return message.length > 200 ? `${message.slice(0, 199)}…` : message;
}

// Notify when a permission dialog requires an answer.
function notifyPermissionAsked(
  runCommand: RunCommand,
  sessionSubtitle: string,
  message: string,
  onUnavailable: () => void,
) {
  runCommand("terminal-notifier", [
    "-title",
    "Pi",
    "-subtitle",
    sessionSubtitle,
    "-message",
    message,
    "-sound",
    "Submarine",
  ], (error) => {
    if (isTerminalNotifierUnavailable(error)) onUnavailable();
  });
}

// Register notification handlers with Pi.
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
  let pendingCompletion: { timer: ReturnType<typeof setTimeout>; send: () => void } | undefined;

  // Clear a deferred completion, optionally delivering it.
  function clearPendingCompletion(deliver = false) {
    const pending = pendingCompletion;
    if (!pending) return;
    pendingCompletion = undefined;
    clearTimeout(pending.timer);
    if (deliver) pending.send();
  }

  pi.on("session_shutdown", () => clearPendingCompletion());

  pi.on("session_start", async (_event, ctx) => {
    clearPendingCompletion();
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

  pi.on("tool_execution_start", (event, ctx) => {
    if (agentRunning) performedTools = true;
    if (!ctx?.hasUI) return;
    const args = event.args as { question?: unknown; questions?: Array<{ question?: unknown } | null>; objective?: unknown } | null;
    const subtitle = pi.getSessionName()?.trim() || shortSessionId;
    if (event.toolName === "goal_question" || event.toolName === "goal_questionnaire") {
      const question = event.toolName === "goal_question" ? args?.question : args?.questions?.[0]?.question;
      notifyQuestionAsked(runCommand, subtitle, typeof question === "string" ? question : "", () => {});
    } else if (process.env.PI_GOAL_AUTO_CONFIRM !== "1") {
      if (event.toolName === "propose_goal_draft") {
        const objective = typeof args?.objective === "string" ? args.objective.trim().split(/\r?\n/, 1)[0] : "";
        notifyGoalConfirmationAsked(runCommand, subtitle, objective ? `Goal confirmation required: ${objective}` : "Goal confirmation required");
      } else if (event.toolName === "set_goal_tasks") {
        notifyGoalConfirmationAsked(runCommand, subtitle, "Goal task confirmation required");
      }
    }
  });

  pi.on("message_start", (event) => {
    if (isGoalCheckpoint(event.message)) clearPendingCompletion();
    else if (event.message.role === "user") clearPendingCompletion(true);
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
    clearPendingCompletion(true);
    if (!suppress) {
      const response = notificationMessage;
      const send = () => notifyAgentSettled(runCommand, sessionSubtitle, response, () => {
        if (hasWarnedTerminalNotifierUnavailable) return;
        notifyTerminalNotifierUnavailable(ctx.ui.notify.bind(ctx.ui));
        hasWarnedTerminalNotifierUnavailable = true;
      });
      // Allow an actual goal checkpoint to cancel an interim alert.
      // Never infer continuation from an active goal alone.
      const hasGoalExtension = pi.getAllTools?.().some((tool) => tool.name === "goal_question");
      if (hasGoalExtension && ctx.hasUI && !needsAttention) {
        const timer = setTimeout(() => {
          pendingCompletion = undefined;
          send();
        }, 250);
        timer.unref?.();
        pendingCompletion = { timer, send };
      } else send();
    }
    completionTriggeredRun = false;
    agentRunning = false;
  });

  pi.events.on("permissions:ui_prompt", (raw) => {
    const message = permissionPromptText(raw);
    if (!message) return;
    const sessionSubtitle = pi.getSessionName()?.trim() || shortSessionId;
    notifyPermissionAsked(runCommand, sessionSubtitle, message, () => {});
  });

  pi.events.on("rpiv:ask-user:prompt", (raw) => {
    const event = raw as { questions?: Array<{ question?: unknown }> };
    const question = event.questions?.[0]?.question;
    const sessionSubtitle = pi.getSessionName()?.trim() || shortSessionId;
    notifyQuestionAsked(runCommand, sessionSubtitle, typeof question === "string" ? question : "", () => {});
  });
}
