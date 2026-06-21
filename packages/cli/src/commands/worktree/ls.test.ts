import { describe, expect, it } from "vitest";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import { runLsCommandWithDeps } from "./ls.js";

function createFakeDaemonClient(
  overrides: Partial<Pick<DaemonClient, "fetchAgents" | "getPaseoWorktreeList" | "close">> = {},
): DaemonClient {
  return {
    fetchAgents: async () => ({
      entries: [],
      total: 0,
      nextCursor: undefined,
      requestId: "req-agents",
    }),
    getPaseoWorktreeList: async () => ({
      worktrees: [],
      error: null,
      requestId: "req-list",
    }),
    close: async () => {},
    ...overrides,
  } as unknown as DaemonClient;
}

describe("runLsCommand", () => {
  it("lists worktrees for the current cwd by default", async () => {
    const cwd = "/tmp/current-repo";

    const listCalls: Array<Parameters<DaemonClient["getPaseoWorktreeList"]>[0]> = [];
    const fakeClient = createFakeDaemonClient({
      getPaseoWorktreeList: async (input) => {
        listCalls.push(input);
        return {
          worktrees: [],
          error: null,
          requestId: "req-list",
        };
      },
    });

    await runLsCommandWithDeps(
      {},
      {
        connectToDaemon: async () => fakeClient,
        getCwd: () => cwd,
      },
    );

    expect(listCalls).toEqual([{ cwd }]);
  });

  it("passes explicit cwd to the daemon worktree list request", async () => {
    const cwd = "/tmp/source-repo";
    const worktreePath = "/tmp/paseo-home/worktrees/repo/feature";
    const listCalls: Array<Parameters<DaemonClient["getPaseoWorktreeList"]>[0]> = [];
    const fakeClient = createFakeDaemonClient({
      getPaseoWorktreeList: async (input) => {
        listCalls.push(input);
        return {
          worktrees: [
            {
              worktreePath,
              branchName: "feature",
              head: "abc123",
              createdAt: "2026-04-12T00:00:00.000Z",
            },
          ],
          error: null,
          requestId: "req-list",
        };
      },
    });

    const result = await runLsCommandWithDeps(
      { cwd },
      {
        connectToDaemon: async () => fakeClient,
        getCwd: () => "/tmp/unused-repo",
      },
    );

    expect(listCalls).toEqual([{ cwd }]);
    expect(result).toEqual({
      type: "list",
      data: [
        {
          name: "feature",
          branch: "feature",
          cwd: worktreePath,
          agent: "-",
        },
      ],
      schema: expect.any(Object),
    });
  });
});
