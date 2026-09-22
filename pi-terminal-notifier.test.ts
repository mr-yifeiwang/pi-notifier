import assert from "node:assert/strict";
import test from "node:test";
import notifier from "./pi-terminal-notifier.ts";

test("sends a completion notification when the agent settles", () => {
  const handlers = new Map<string, () => void>();
  const commands: Array<[string, string[]]> = [];
  const pi = {
    getSessionName: () => "Notifier tests",
    on: (event: string, handler: () => void) => handlers.set(event, handler),
  };

  notifier(pi as never, {
    execFile: (file, args) => commands.push([file, args]),
    isSubagent: false,
  });
  handlers.get("agent_settled")?.();

  assert.deepEqual(commands, [[
    "terminal-notifier",
    [
      "-title",
      "Pi",
      "-subtitle",
      "Notifier tests",
      "-message",
      "Session finished",
      "-sound",
      "Submarine",
    ],
  ]]);
});

test("does not register notifications in subagent processes", () => {
  let registrations = 0;
  const pi = {
    getSessionName: () => "Ignored",
    on: () => registrations++,
  };

  notifier(pi as never, { isSubagent: true });

  assert.equal(registrations, 0);
});
