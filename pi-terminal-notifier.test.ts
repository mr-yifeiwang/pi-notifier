import assert from "node:assert/strict";
import test from "node:test";
import notifier from "./pi-terminal-notifier.ts";

test("uses the session name as the subtitle when available", () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const commands: Array<[string, string[]]> = [];
  const pi = {
    getSessionName: () => "Notifier tests",
    on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
    events: { on: () => {} },
  };

  notifier(pi as never, {
    execFile: (file, args) => commands.push([file, args]),
    isSubagent: false,
  });
  handlers.get("agent_start")?.();
  handlers.get("message_end")?.({
    message: {
      role: "assistant",
      content: [{ type: "text", text: "The task is complete.\nMore detail." }],
    },
  });
  handlers.get("agent_settled")?.(undefined, {
    sessionManager: { getSessionId: () => "abcdef0-1234-5678-9abc-def012345678" },
  });

  assert.deepEqual(commands, [[
    "terminal-notifier",
    [
      "-title",
      "Pi",
      "-subtitle",
      "Notifier tests",
      "-message",
      "The task is complete.",
      "-sound",
      "Submarine",
    ],
  ]]);
});

test("uses the first seven ID characters without a display name", () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const commands: Array<[string, string[]]> = [];
  const pi = {
    getSessionName: () => undefined,
    on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
    events: { on: () => {} },
  };

  notifier(pi as never, {
    execFile: (file, args) => commands.push([file, args]),
    isSubagent: false,
  });
  handlers.get("agent_settled")?.(undefined, {
    sessionManager: { getSessionId: () => "abcdef0-1234-5678-9abc-def012345678" },
  });

  assert.equal(commands[0]?.[1][3], "abcdef0");
});

test("uses the ID when the display name is empty", () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const commands: Array<[string, string[]]> = [];
  const pi = {
    getSessionName: () => "   ",
    on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
    events: { on: () => {} },
  };

  notifier(pi as never, {
    execFile: (file, args) => commands.push([file, args]),
    isSubagent: false,
  });
  handlers.get("agent_settled")?.(undefined, {
    sessionManager: { getSessionId: () => "abcdef0-1234-5678-9abc-def012345678" },
  });

  assert.equal(commands[0]?.[1][3], "abcdef0");
});

test("notifies when ask-user-question presents a question", () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const eventHandlers = new Map<string, (...args: unknown[]) => void>();
  const commands: Array<[string, string[]]> = [];
  const pi = {
    getSessionName: () => "Question tests",
    on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
    events: {
      on: (event: string, handler: (...args: unknown[]) => void) => eventHandlers.set(event, handler),
    },
  };

  notifier(pi as never, {
    execFile: (file, args) => commands.push([file, args]),
    isSubagent: false,
  });
  eventHandlers.get("rpiv:ask-user:prompt")?.({
    questions: [{ question: "Which notification behavior should we test?" }],
  });

  assert.deepEqual(commands, [[
    "terminal-notifier",
    [
      "-title",
      "Pi",
      "-subtitle",
      "Question tests",
      "-message",
      "Question asked: Which notification behavior should we test?",
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
