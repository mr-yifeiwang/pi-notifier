import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";

type Dependencies = {
  execFile?: (file: string, args: string[]) => unknown;
  isSubagent?: boolean;
};

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

// Notify when an agent finishes.
function notifyAgentSettled(
  runCommand: (file: string, args: string[]) => unknown,
  sessionTitle: string,
  response: string,
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
  ]);
}

// Register completion notifications with Pi.
export default function (pi: ExtensionAPI, dependencies: Dependencies = {}) {
  if (dependencies.isSubagent ?? process.env.PI_SUBAGENT_CHILD === "1") return;

  const runCommand = dependencies.execFile ?? execFile;
  let latestResponse = "";

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
    notifyAgentSettled(runCommand, sessionTitle, latestResponse);
  });
}
