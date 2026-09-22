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

test("suppresses workflow-child completion notifications", () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const commands: Array<[string, string[]]> = [];
  const pi = {
    getSessionName: () => "Workflow tests",
    on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
    events: { on: () => {} },
  };

  notifier(pi as never, {
    execFile: (file, args) => commands.push([file, args]),
    isSubagent: false,
  });
  handlers.get("before_agent_start")?.({ prompt: "Workflow child completed: Reuters report" });
  handlers.get("agent_start")?.();
  handlers.get("agent_settled")?.(undefined, {
    sessionManager: { getSessionId: () => "abcdef0-1234-5678-9abc-def012345678" },
  });

  assert.deepEqual(commands, []);
});

test("warns once when terminal-notifier cannot be launched", () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const notifications: Array<[string, string]> = [];
  const pi = {
    getSessionName: () => undefined,
    on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
    events: { on: () => {} },
  };

  notifier(pi as never, {
    execFile: (_file, _args, callback) => {
      assert.ok(callback, "a launch-error callback must be provided");
      callback(Object.assign(new Error("terminal-notifier is missing"), { code: "ENOENT" }));
    },
    isSubagent: false,
  });

  const context = {
    sessionManager: { getSessionId: () => "abcdef0-1234-5678-9abc-def012345678" },
    ui: { notify: (message: string, level: string) => notifications.push([message, level]) },
  };

  assert.doesNotThrow(() => {
    handlers.get("agent_settled")?.(undefined, context);
    handlers.get("agent_settled")?.(undefined, context);
  });
  assert.deepEqual(notifications, [[
    "terminal-notifier is unavailable. Install it with: brew install terminal-notifier",
    "warning",
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
