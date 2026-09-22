import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile } from "node:child_process";

type Dependencies = {
  execFile?: (file: string, args: string[]) => unknown;
  isSubagent?: boolean;
};

// Notify when an agent finishes.
function notifyAgentSettled(
  runCommand: (file: string, args: string[]) => unknown,
  sessionTitle: string,
) {
  runCommand("terminal-notifier", [
    "-title",
    "Pi",
    "-subtitle",
    sessionTitle,
    "-message",
    "Session finished",
    "-sound",
    "Submarine",
  ]);
}

export default function (pi: ExtensionAPI, dependencies: Dependencies = {}) {
  if (dependencies.isSubagent ?? process.env.PI_SUBAGENT_CHILD === "1") return;

  const runCommand = dependencies.execFile ?? execFile;

  pi.on("agent_settled", (_event, ctx) => {
    const sessionName = pi.getSessionName()?.trim();
    const sessionTitle = sessionName || ctx.sessionManager.getSessionId().slice(0, 7);
    notifyAgentSettled(runCommand, sessionTitle);
  });
}
