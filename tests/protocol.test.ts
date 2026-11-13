import { describe, expect, it } from "vitest";
import type { PageSession } from "../src/bridge/page-bridge.ts";
import { createBridgeClient, installBridge } from "../src/bridge/protocol.ts";

function fakeWindow() {
  const listeners = new Set<(event: { data: unknown; source: unknown }) => void>();
  const win = {
    addEventListener(_type: string, fn: (event: { data: unknown; source: unknown }) => void) {
      listeners.add(fn);
    },
    removeEventListener(_type: string, fn: (event: { data: unknown; source: unknown }) => void) {
      listeners.delete(fn);
    },
    postMessage(data: unknown) {
      const event = { data, source: win };
      for (const fn of [...listeners]) fn(event);
    },
    emit(data: unknown, source: unknown) {
      const event = { data, source };
      for (const fn of [...listeners]) fn(event);
    },
  };
  return win;
}

function session(): PageSession {
  return {
    readGate: async () => ({ kind: "clear" }),
    readIdentity: async () => ({ clubId: "7", clubName: "Ada FC" }),
    readClubCards: async () => [],
    readStorageCards: async () => [],
    readFirstTeam: async () => ({ available: true, itemIds: [] }),
    readChallenge: async () => null,
    placeCard: async () => ({ success: true }),
    setManager: async () => ({ success: true }),
    readAgreement: async () => ({ canSubmit: true, requirements: [] }),
    submit: async () => ({ success: true }),
  };
}

describe("page bridge protocol", () => {
  it("returns a snapshot for a request from the same window", async () => {
    const win = fakeWindow();
    installBridge(win, session());
    const client = createBridgeClient(win);

    const response = await client.snapshot();

    expect(response.ok).toBe(true);
    expect(response.result).toMatchObject({ ok: true, snapshot: { clubId: "7", clubName: "Ada FC" } });
  });

  it("ignores a request from another window", async () => {
    const win = fakeWindow();
    let replies = 0;
    const post = win.postMessage.bind(win);
    win.postMessage = (data) => {
      replies += 1;
      post(data);
    };
    installBridge(win, session());

    win.emit({ channel: "ea-fc-club-sbc", id: "other", op: "snapshot" }, { other: true });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(replies).toBe(0);
  });

  it("stops the shared job from the page", async () => {
    const win = fakeWindow();
    installBridge(win, session());
    const client = createBridgeClient(win);

    await client.stop();
    const response = await client.place("11", 1);

    expect(response.result).toMatchObject({ ok: false, reason: "stopped", message: "Stopped." });
  });
});
