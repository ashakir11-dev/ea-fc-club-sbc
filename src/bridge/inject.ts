import { createEaPageSession } from "./ea-session.js";
import { installBridge, type BridgeWindow } from "./protocol.js";

declare const window: BridgeWindow & Parameters<typeof createEaPageSession>[0];

installBridge(window, createEaPageSession(window));
