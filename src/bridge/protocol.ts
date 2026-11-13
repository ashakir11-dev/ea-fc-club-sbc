import { PageBridge } from "./page-bridge.js";
import type { PageSession } from "./types.js";

export const BRIDGE_CHANNEL = "ea-fc-club-sbc";

export interface BridgeWindow {
  addEventListener(type: string, listener: (event: BridgeMessageEvent) => void): void;
  removeEventListener(type: string, listener: (event: BridgeMessageEvent) => void): void;
  postMessage(data: unknown): void;
}

export interface BridgeMessageEvent {
  data: unknown;
  source: unknown;
}

interface BridgeRequest {
  channel?: string;
  id?: string;
  op?: string;
  itemId?: string;
  slotIndex?: number;
}

function isRequest(value: unknown): value is BridgeRequest {
  return typeof value === "object" && value !== null;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The page is not ready.";
}

async function run(bridge: PageBridge, request: BridgeRequest): Promise<unknown> {
  switch (request.op) {
    case "snapshot":
      return bridge.snapshot();
    case "place":
      return bridge.place(String(request.itemId ?? ""), Number(request.slotIndex));
    case "set-manager":
      return bridge.setManager(String(request.itemId ?? ""));
    case "submit":
      return bridge.submit();
    case "stop":
      bridge.stop();
      return { ok: true, message: "Stopped." };
    case "reset":
      bridge.reset();
      return { ok: true, message: "" };
    default:
      return { ok: false, message: "The page is not ready." };
  }
}

export function installBridge(win: BridgeWindow, session: PageSession): void {
  const bridge = new PageBridge(session);
  win.addEventListener("message", (event) => {
    if (event.source !== win || !isRequest(event.data)) return;
    const request = event.data;
    if (request.channel !== BRIDGE_CHANNEL || !request.id || !request.op) return;
    void run(bridge, request)
      .then((result) => {
        win.postMessage({ channel: BRIDGE_CHANNEL, id: request.id, ok: true, result });
      })
      .catch((error: unknown) => {
        win.postMessage({
          channel: BRIDGE_CHANNEL,
          id: request.id,
          ok: false,
          result: { ok: false, message: messageOf(error) },
        });
      });
  });
}

export function createBridgeClient(win: BridgeWindow, options?: { timeoutMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 20000;

  function request(payload: Record<string, unknown>): Promise<{ ok: boolean; result: unknown }> {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        win.removeEventListener("message", onMessage);
        reject(new Error("the page did not answer"));
      }, timeoutMs);
      function onMessage(event: BridgeMessageEvent) {
        if (event.source !== win || !isRequest(event.data)) return;
        const data = event.data;
        if (data.channel !== BRIDGE_CHANNEL || data.id !== id || data.op) return;
        clearTimeout(timer);
        win.removeEventListener("message", onMessage);
        const record = data as BridgeRequest & { ok?: boolean; result?: unknown };
        resolve({ ok: Boolean(record.ok), result: record.result });
      }
      win.addEventListener("message", onMessage);
      win.postMessage({ channel: BRIDGE_CHANNEL, id, ...payload });
    });
  }

  return {
    snapshot: () => request({ op: "snapshot" }),
    place: (itemId: string, slotIndex: number) => request({ op: "place", itemId, slotIndex }),
    setManager: (itemId: string) => request({ op: "set-manager", itemId }),
    submit: () => request({ op: "submit" }),
    stop: () => request({ op: "stop" }),
    reset: () => request({ op: "reset" }),
  };
}
