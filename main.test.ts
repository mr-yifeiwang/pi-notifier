import assert from "node:assert/strict";
import test from "node:test";
import notifier from "./main.ts";

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

test("notifies for completion prompts when no asynchronous runs are tracked", () => {
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

  assert.equal(commands.length, 1);
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
    "terminal-notifier is unavailable. The pi-notifier extension needs it to send macOS notifications. Install it with: brew install terminal-notifier",
    "warning",
  ]]);
});

for (const missing of [false, true]) {
  test(`checks terminal-notifier at startup when ${missing ? "missing" : "available"}`, async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const commands: Array<[string, string[]]> = [];
    const notifications: Array<[string, string]> = [];
    const pi = {
      getSessionName: () => undefined,
      on: (event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler),
      events: { on: () => {} },
    };
    notifier(pi as never, {
      execFile: (file, args, callback) => {
        commands.push([file, args]);
        queueMicrotask(() => callback(missing
          ? Object.assign(new Error("terminal-notifier is missing"), { code: "ENOENT" })
          : null));
      },
      isSubagent: false,
    });
    // Loading the factory must not launch a process.
    assert.deepEqual(commands, []);
    await handlers.get("session_start")?.(undefined, {
      sessionManager: { getSessionId: () => "abcdef0-1234-5678-9abc-def012345678" },
      ui: { notify: (message: string, level: string) => notifications.push([message, level]) },
    });
    assert.deepEqual(commands, [["terminal-notifier", ["-version"]]]);
    assert.deepEqual(notifications, missing ? [[
      "terminal-notifier is unavailable. The pi-notifier extension needs it to send macOS notifications. Install it with: brew install terminal-notifier",
      "warning",
    ]] : []);
  });
}

test("does not repeat the startup warning at completion", async () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const notifications: Array<[string, string]> = [];
  const pi = {
    getSessionName: () => undefined,
    on: (event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler),
    events: { on: () => {} },
  };
  notifier(pi as never, {
    execFile: (_file, _args, callback) => {
      callback(Object.assign(new Error("terminal-notifier is missing"), { code: "ENOENT" }));
    },
    isSubagent: false,
  });
  const context = {
    sessionManager: { getSessionId: () => "abcdef0-1234-5678-9abc-def012345678" },
    ui: { notify: (message: string, level: string) => notifications.push([message, level]) },
  };
  await handlers.get("session_start")?.(undefined, context);
  assert.equal(notifications.length, 1, "startup must show the warning");
  handlers.get("agent_settled")?.(undefined, context);
  handlers.get("agent_settled")?.(undefined, context);
  assert.equal(notifications.length, 1, "completion must not repeat it");
  await handlers.get("session_start")?.(undefined, context);
  assert.equal(notifications.length, 2, "a new session must check and warn again");
});

function asyncRunHarness(sessionFile?: string) {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const eventHandlers = new Map<string, (...args: unknown[]) => void>();
  const commands: string[][] = [];
  const context = {
    sessionManager: {
      getSessionId: () => "parent-session",
      getSessionFile: () => sessionFile,
    },
    ui: { notify: () => {} },
  };
  const pi = {
    getSessionName: () => "Async run tests",
    on: (event: string, handler: (...args: unknown[]) => unknown) => handlers.set(event, handler),
    events: {
      on: (event: string, handler: (...args: unknown[]) => void) => eventHandlers.set(event, handler),
    },
  };
  notifier(pi as never, {
    execFile: (_file, args, callback) => {
      if (args.includes("-message")) commands.push(args);
      callback(null);
    },
    isSubagent: false,
  });
  const startSession = () => handlers.get("session_start")?.(undefined, context);
  startSession();
  const startAsyncRun = (id: string, sessionId = sessionFile ?? "parent-session") =>
    eventHandlers.get("subagent:async-started")?.({ id, sessionId });
  const completeAsyncRun = (runId: string, sessionId = sessionFile ?? "parent-session") =>
    eventHandlers.get("subagent:async-complete")?.({ runId, sessionId });
  const startAgentRun = (prompt?: string) => {
    if (prompt !== undefined) handlers.get("before_agent_start")?.({ prompt });
    handlers.get("agent_start")?.();
  };
  const message = (message: unknown) => handlers.get("message_end")?.({ message });
  const notice = (text = "Background task completed: **worker**", customType = "subagent-notify") =>
    message({ role: "custom", customType, content: text });
  const reply = (text: string, stopReason = "stop") =>
    message({ role: "assistant", content: [{ type: "text", text }], stopReason });
  const settle = () => handlers.get("agent_settled")?.(undefined, context);
  return { handlers, eventHandlers, commands, startSession, startAsyncRun, completeAsyncRun, startAgentRun, message, notice, reply, settle };
}

test("suppresses intermediate custom-message wakes but allows the last completion", () => {
  const h = asyncRunHarness();
  h.startAsyncRun("a");
  h.startAsyncRun("b");
  h.completeAsyncRun("a");
  h.startAgentRun(); // Custom-message wakes bypass before_agent_start.
  h.notice();
  h.reply("Worker A finished. Waiting for worker B.");
  h.settle();
  assert.equal(h.commands.length, 0);
  h.completeAsyncRun("b");
  h.startAgentRun();
  h.notice();
  h.reply("All results have been aggregated.");
  h.settle();
  assert.equal(h.commands.length, 1);
  assert.equal(h.commands[0]?.[5], "All results have been aggregated.");
});

for (const [text, customType] of [
  ["Workflow child completed: **worker**", "subagent-incremental-child-notify"],
  ["Detached foreground task completed: **worker**", "subagent-notify"],
  ["Background tasks completed (2): **a**, **b**", "subagent-notify"],
]) {
  test(`suppresses intermediate notices: ${text}`, () => {
    const h = asyncRunHarness();
    h.startAsyncRun("remaining");
    h.startAgentRun();
    h.notice(text, customType);
    h.reply("A child finished.");
    h.settle();
    assert.equal(h.commands.length, 0);
  });
}

for (const identity of ["parent-session", "/sessions/parent-session.jsonl"]) {
  test(`tracks completion events using session identity ${identity}`, () => {
    const h = asyncRunHarness("/sessions/parent-session.jsonl");
    h.startAsyncRun("a", identity);
    h.startAsyncRun("b", identity);
    h.completeAsyncRun("a", identity);
    h.startAgentRun();
    h.notice();
    h.reply("Waiting for the remaining run.");
    h.settle();
    assert.equal(h.commands.length, 0);
    h.completeAsyncRun("b", identity);
    h.startAgentRun();
    h.notice();
    h.reply("All work is complete.");
    h.settle();
    assert.equal(h.commands.length, 1);
  });

  for (const wake of ["prompt", "custom"]) {
    test(`suppresses workflow transitions with ${wake} wakes and ${identity}`, () => {
      const h = asyncRunHarness("/sessions/parent-session.jsonl");
      const startCompletion = () => {
        h.startAgentRun(wake === "prompt" ? "Background task completed: **workflow**" : undefined);
        if (wake === "custom") h.notice("Background task completed: **workflow**");
      };
      h.startAgentRun("Research rankings using two workflows.");
      h.handlers.get("tool_execution_start")?.({ toolName: "subagent" });
      h.startAsyncRun("workflow-1", identity);
      h.reply("Workflow 1 is running.");
      h.settle();
      assert.equal(h.commands.length, 1, "initial user-triggered reply must notify");

      h.completeAsyncRun("workflow-1", identity);
      startCompletion();
      h.handlers.get("tool_execution_start")?.({ toolName: "subagent" });
      h.startAsyncRun("workflow-2", identity);
      h.reply("Workflow 2 is running.");
      h.settle();
      assert.equal(h.commands.length, 1, "workflow transition must not notify");

      h.completeAsyncRun("workflow-2", identity);
      startCompletion();
      h.handlers.get("tool_execution_start")?.({ toolName: "read" });
      h.reply("The checked comparison is complete.");
      h.settle();
      assert.equal(h.commands.length, 2, "final results must notify");
      assert.equal(h.commands[1]?.[5], "The checked comparison is complete.");
    });
  }
}

test("ignores another session's file-path lifecycle events", () => {
  const h = asyncRunHarness("/sessions/parent-session.jsonl");
  h.startAsyncRun("other", "/sessions/other-session.jsonl");
  h.startAgentRun();
  h.notice();
  h.reply("All done.");
  h.settle();
  assert.equal(h.commands.length, 1);

  h.startAsyncRun("local");
  h.completeAsyncRun("local", "/sessions/other-session.jsonl");
  h.startAgentRun();
  h.notice();
  h.reply("Still waiting for local work.");
  h.settle();
  assert.equal(h.commands.length, 1);
});

test("resets asynchronous start tracking before later tool work", () => {
  const h = asyncRunHarness("/sessions/parent-session.jsonl");
  h.startAgentRun();
  h.notice();
  h.handlers.get("tool_execution_start")?.({ toolName: "subagent" });
  h.startAsyncRun("next-workflow");
  h.reply("The next workflow is running.");
  h.settle();
  assert.equal(h.commands.length, 0);

  h.startAgentRun();
  h.notice();
  h.handlers.get("tool_execution_start")?.({ toolName: "write" });
  h.reply("Updated the combined report.");
  h.settle();
  assert.equal(h.commands.length, 1);
});

for (const stopReason of ["error", "aborted"]) {
  test(`preserves ${stopReason} alerts during a file-path workflow transition`, () => {
    const h = asyncRunHarness("/sessions/parent-session.jsonl");
    h.startAgentRun();
    h.notice();
    h.handlers.get("tool_execution_start")?.({ toolName: "subagent" });
    h.startAsyncRun("next-workflow");
    h.reply("The main agent needs attention.", stopReason);
    h.settle();
    assert.equal(h.commands.length, 1);
  });
}

test("preserves questions during a file-path workflow transition", () => {
  const h = asyncRunHarness("/sessions/parent-session.jsonl");
  h.startAgentRun();
  h.notice();
  h.handlers.get("tool_execution_start")?.({ toolName: "subagent" });
  h.startAsyncRun("next-workflow");
  h.eventHandlers.get("rpiv:ask-user:prompt")?.({ questions: [{ question: "Continue?" }] });
  h.reply("Waiting for the next workflow.");
  h.settle();
  assert.equal(h.commands.length, 1);
  assert.equal(h.commands[0]?.[5], "Question asked: Continue?");
});

test("preserves user input during a file-path workflow transition", () => {
  const h = asyncRunHarness("/sessions/parent-session.jsonl");
  h.startAgentRun("Background task completed: **workflow**");
  h.message({ role: "user", content: [{ type: "text", text: "Please continue." }] });
  h.handlers.get("tool_execution_start")?.({ toolName: "subagent" });
  h.startAsyncRun("next-workflow");
  h.reply("Continuing as requested.");
  h.settle();
  assert.equal(h.commands.length, 1);
});

test("notifies if new asynchronous work finishes before settling", () => {
  const h = asyncRunHarness("/sessions/parent-session.jsonl");
  h.startAgentRun("Background task completed: **workflow**");
  h.handlers.get("tool_execution_start")?.({ toolName: "subagent" });
  h.startAsyncRun("next-workflow");
  h.completeAsyncRun("next-workflow");
  h.reply("All work is complete.");
  h.settle();
  assert.equal(h.commands.length, 1);
});

test("supports completion prompts without suppressing the last completion", () => {
  const h = asyncRunHarness();
  h.startAsyncRun("remaining");
  h.startAgentRun("Workflow child completed: worker");
  h.reply("Waiting for the remaining child.");
  h.settle();
  assert.equal(h.commands.length, 0);
  h.completeAsyncRun("remaining");
  h.startAgentRun("Workflow child completed: worker");
  h.reply("The task is complete.");
  h.settle();
  assert.equal(h.commands.length, 1);
});

for (const userFirst of [false, true]) {
  test(`preserves user-triggered notifications with a completion notice, userFirst=${userFirst}`, () => {
    const h = asyncRunHarness();
    h.startAsyncRun("remaining");
    h.startAgentRun("Please review these results.");
    const userMessage = () => h.message({ role: "user", content: [{ type: "text", text: "Please review these results." }] });
    if (userFirst) userMessage();
    h.notice();
    if (!userFirst) userMessage();
    h.reply("Your review is complete.");
    h.settle();
    assert.equal(h.commands.length, 1);
  });
}

test("preserves notifications when the main agent uses tools", () => {
  const h = asyncRunHarness();
  h.startAsyncRun("remaining");
  h.startAgentRun();
  h.notice();
  h.handlers.get("tool_execution_start")?.({ toolName: "write" });
  h.reply("Updated the combined report.");
  h.settle();
  assert.equal(h.commands.length, 1);
});

test("preserves question alerts during an intermediate completion run", () => {
  const h = asyncRunHarness();
  h.startAsyncRun("remaining");
  h.startAgentRun();
  h.notice();
  h.eventHandlers.get("rpiv:ask-user:prompt")?.({ questions: [{ question: "Continue?" }] });
  assert.equal(h.commands.length, 1);
  assert.equal(h.commands[0]?.[5], "Question asked: Continue?");
});

for (const text of ["Background task failed: **worker**", "Workflow child paused (needs attention): **worker**"]) {
  test(`preserves attention notifications: ${text}`, () => {
    const h = asyncRunHarness();
    h.startAsyncRun("remaining");
    h.startAgentRun();
    h.notice();
    h.notice(text);
    h.reply("A child needs attention.");
    h.settle();
    assert.equal(h.commands.length, 1);
  });
}

for (const stopReason of ["error", "aborted"]) {
  test(`preserves main-agent notifications after ${stopReason}`, () => {
    const h = asyncRunHarness();
    h.startAsyncRun("remaining");
    h.startAgentRun();
    h.notice();
    h.reply("The run did not finish normally.", stopReason);
    h.settle();
    assert.equal(h.commands.length, 1);
  });
}

test("ignores asynchronous run lifecycle events from other sessions", () => {
  const h = asyncRunHarness();
  h.startAsyncRun("other", "another-session");
  h.startAgentRun();
  h.notice();
  h.reply("All done.");
  h.settle();
  assert.equal(h.commands.length, 1);
  h.startAsyncRun("local");
  h.completeAsyncRun("local", "another-session");
  h.startAgentRun();
  h.notice();
  h.reply("Still waiting for the local child.");
  h.settle();
  assert.equal(h.commands.length, 1);
});

test("clears pending asynchronous runs when the session changes", () => {
  const h = asyncRunHarness();
  h.startAsyncRun("remaining");
  h.startSession();
  h.startAgentRun();
  h.notice();
  h.reply("No pending children in this session.");
  h.settle();
  assert.equal(h.commands.length, 1);
});

test("does not let an idle completion notice suppress a later normal run", () => {
  const h = asyncRunHarness();
  h.startAsyncRun("remaining");
  h.notice();
  h.startAgentRun();
  h.reply("Normal work is done.");
  h.settle();
  assert.equal(h.commands.length, 1);
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
