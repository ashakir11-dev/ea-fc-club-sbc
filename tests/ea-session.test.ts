import { describe, expect, it } from "vitest";
import { PageBridge } from "../src/bridge/page-bridge.ts";
import { createEaPageSession } from "../src/bridge/ea-session.ts";

interface RawPlayer {
  id: number;
  definitionId: number;
  rating: number;
  preferredPosition: string;
  possiblePositions: string[];
  positionModifiers: string[];
  teamId: number;
  leagueId: number;
  nationId: number;
  rareflag: number;
  untradeable: boolean;
  discardValue: number;
  gender: number;
  groups: number[];
  name: string;
  sessionToken: string;
  _auth: string;
  isPlayer: () => boolean;
  isIcon?: () => boolean;
  isHero?: () => boolean;
  isCornerstone?: () => boolean;
  cornerstoneClubLinks?: number;
  teamName?: string;
  leagueName?: string;
  nationName?: string;
}

function player(id: number, patch: Partial<RawPlayer> = {}): RawPlayer {
  return {
    id,
    definitionId: id + 1000,
    rating: 84,
    preferredPosition: "ST",
    possiblePositions: ["CF", "ST"],
    positionModifiers: ["LW"],
    teamId: 1,
    leagueId: 2,
    nationId: 3,
    rareflag: 1,
    untradeable: false,
    discardValue: 696,
    gender: 0,
    groups: [4],
    name: `Player ${id}`,
    sessionToken: "secret-token",
    _auth: "nope",
    teamName: "Arsenal",
    leagueName: "Premier League",
    nationName: "England",
    isPlayer: () => true,
    ...patch,
  };
}

function observable<T>(response: T) {
  return {
    observe(_owner: unknown, callback: (sender: { unobserve: () => void }, value: T) => void) {
      callback({ unobserve() {} }, response);
    },
  };
}

function page(options?: {
  playerCount?: number;
  players?: RawPlayer[];
  storage?: RawPlayer[];
  managerSearch?: "ok" | "fail";
  canSubmit?: boolean;
  requirements?: Array<{ key: number; met: boolean | null; count?: number; value?: unknown; label?: string }>;
  allowsManager?: boolean;
  rating?: number;
  chemistry?: number;
  loggedIn?: boolean;
  loginElement?: boolean;
  timeout?: boolean;
  placeKeepsCard?: boolean;
  saveSucceeds?: boolean;
  saveMessage?: string;
}) {
  const opts = {
    playerCount: options?.playerCount ?? 1,
    players: options?.players ?? [player(10)],
    storage: options?.storage ?? [player(20, { gender: 1, untradeable: true, discardValue: 0 })],
    managerSearch: options?.managerSearch ?? "ok",
    canSubmit: options?.canSubmit ?? true,
    requirements: options?.requirements ?? [{ key: 1, met: true, count: 1, value: 85, label: "Team Rating: Min 85" }],
    allowsManager: options?.allowsManager ?? true,
    rating: options?.rating ?? 85,
    chemistry: options?.chemistry ?? 33,
    loggedIn: options?.loggedIn ?? true,
    loginElement: options?.loginElement ?? false,
    timeout: options?.timeout ?? false,
    placeKeepsCard: options?.placeKeepsCard ?? true,
    saveSucceeds: options?.saveSucceeds ?? true,
    saveMessage: options?.saveMessage ?? "Squad full",
  };
  const calls: string[] = [];
  const persona = { id: 7, name: "Ada FC", sessionToken: "secret-token" };
  const slots = [
    { index: 0, positionName: "GK", brick: true, item: { id: 1 }, isBrick: () => true, getPositionName: () => "GK", getItem: () => ({ id: 1 }) },
    { index: 4, positionName: "ST", brick: false, item: null as { id: number } | null, isBrick: () => false, getPositionName: () => "ST", getItem: () => null },
  ];
  const challenge = {
    id: 44,
    name: "Hybrid",
    setId: 3,
    formation: "f433",
    allowsManagerChange: () => opts.allowsManager,
    canSubmit: () => opts.canSubmit,
    eligibilityRequirements: opts.requirements.map((requirement) => ({
      getFirstKey: () => requirement.key,
      getValue: () => requirement.value,
      count: requirement.count ?? 1,
      label: requirement.label,
      isMet: requirement.met === null ? undefined : () => requirement.met,
    })),
    squad: {
      getRating: () => opts.rating,
      getChemistry: () => opts.chemistry,
      getFieldPlayers: () => slots,
      getSlot: (index: number) => slots.find((slot) => slot.index === index),
      getManager: () => ({ item: { id: 50, name: "Arteta", nationId: 14, leagueId: 13 } }),
      addItemToSlot: (index: number, item: { id: number }) => {
        calls.push(`add:${index}:${item.id}`);
        const slot = slots.find((entry) => entry.index === index);
        if (slot && opts.placeKeepsCard) slot.item = item;
      },
      setManager: (item: { id: number }) => {
        calls.push(`set-manager:${item.id}`);
      },
    },
  };
  const set = { id: 3 };
  const services = {
    Authentication: { isLoggedIn: () => opts.loggedIn },
    User: { getUser: () => ({ getSelectedPersona: () => persona }) },
    Club: {
      getStats: () => {
        calls.push("stats");
        return observable({ success: true, response: { stats: [{ type: "players", count: opts.playerCount }] } });
      },
      search: (criteria: { type?: string; offset?: number; count?: number }) => {
        calls.push(`search:${criteria.type}:${criteria.offset}`);
        if (criteria.type === "manager") {
          if (opts.managerSearch === "fail") return observable({ success: false, error: { message: "No managers" } });
          return observable({
            success: true,
            response: { items: [{ id: 80, name: "Hayes", nationId: 14, leagueId: 13, isManager: () => true, rating: 80 }] },
          });
        }
        const start = criteria.offset ?? 0;
        const batch = opts.players.slice(start, start + (criteria.count ?? 200));
        return observable({ success: true, response: { items: batch } });
      },
    },
    Item: {
      searchStorageItems: (criteria: { offset?: number; count?: number }) => {
        calls.push(`storage:${criteria.offset}`);
        const start = criteria.offset ?? 0;
        const batch = opts.storage.slice(start, start + (criteria.count ?? 200));
        return observable({ success: true, response: { items: batch } });
      },
    },
    Squad: { activeSquad: "main" },
    SBC: {
      repository: { getSetById: (id: number) => (id === 3 ? set : null) },
      saveChallenge: (current: unknown) => {
        calls.push("save");
        expect(current).toBe(challenge);
        if (opts.timeout) return { observe() {} };
        if (!opts.saveSucceeds) return observable({ success: false, error: { message: opts.saveMessage } });
        return observable({ success: true });
      },
      submitChallenge: (current: unknown, currentSet: unknown, skip: unknown, chemistry: unknown) => {
        calls.push(`submit:${String(skip)}:${String(chemistry)}`);
        expect(current).toBe(challenge);
        expect(currentSet).toBe(set);
        return observable({ success: true });
      },
    },
    UserSettings: { getSBCValidationSkip: () => false },
    Chemistry: { isFeatureEnabled: () => true },
    Market: { search: () => { throw new Error("market"); } },
  };
  const host = {
    document: {
      querySelector: (selector: string) => (opts.loginElement && selector.includes("ut-login") ? { textContent: "Sign in" } : null),
    },
    SBCEligibilityKey: { TEAM_RATING: 1, DREAM_HACK: 99 },
    UTSearchCriteriaDTO: class {
      type = "";
      count = 0;
      offset = 0;
    },
    SearchType: { PLAYER: "player", MANAGER: "manager" },
    getAppMain: () => ({
      getService: () => services,
      getRepository: () => ({
        Squad: {
          getFormation: () => ({ displayName: "4-3-3" }),
          squads: new Map([[persona, new Map([["main", { getFieldPlayers: () => [{ item: { id: 10 } }, { getItem: () => ({ id: 11 }) }] }]])]]),
        },
        Item: { club: { items: {} as Record<string, RawPlayer> }, storage: {} },
      }),
      getRootViewController: () => ({
        getPresentedViewController: () => ({
          getCurrentController: () => ({ _challenge: challenge }),
        }),
      }),
    }),
  };
  return { host, calls, challenge, persona };
}

describe("EA page session", () => {
  it("reads the club in pages and SBC storage without copying a session token", async () => {
    const players = Array.from({ length: 201 }, (_, index) => player(index + 1));
    const storage = [...Array.from({ length: 200 }, (_, index) => player(1000 + index)), player(1200, { gender: 1 })];
    const { host } = page({ playerCount: 201, players, storage });
    const session = createEaPageSession(host);

    const cards = await session.readClubCards();
    const stored = await session.readStorageCards();

    expect(cards).toHaveLength(201);
    expect(cards[0]).toMatchObject({
      itemId: "1",
      definitionId: "1001",
      name: "Player 1",
      rating: 84,
      preferredPositions: ["ST", "CF", "LW"],
      clubName: "Arsenal",
      quality: "gold",
      special: false,
      source: "club",
      gender: "man",
      kind: "player",
    });
    expect(stored).toHaveLength(201);
    expect(stored[200]).toMatchObject({ itemId: "1200", source: "storage", gender: "woman" });
    expect(JSON.stringify({ cards, stored })).not.toContain("secret-token");
  });

  it("does not search an empty club", async () => {
    const { host, calls } = page({ playerCount: 0, players: [] });
    const session = createEaPageSession(host);

    await expect(session.readClubCards()).resolves.toEqual([]);
    expect(calls.some((call) => call.startsWith("search:"))).toBe(false);
  });

  it("reports the active match squad and leaves the flag unset when it is missing", async () => {
    const { host } = page();
    const session = createEaPageSession(host);

    await expect(session.readFirstTeam()).resolves.toEqual({ available: true, itemIds: ["10", "11"] });

    const missing = createEaPageSession({
      ...host,
      getAppMain: () => {
        const app = host.getAppMain();
        return { ...app, getRepository: () => ({}) };
      },
    });
    await expect(missing.readFirstTeam()).resolves.toEqual({ available: false, itemIds: [] });
  });

  it("names requirement keys from the page and exposes the page rating", async () => {
    const { host } = page({
      requirements: [
        { key: 1, met: true, value: 85, label: "Team Rating: Min 85" },
        { key: 99, met: true, label: "Dream hack" },
      ],
    });
    const session = createEaPageSession(host);

    const challenge = await session.readChallenge();

    expect(challenge).toMatchObject({
      id: "44",
      name: "Hybrid",
      formation: "4-3-3",
      pageRating: 85,
      pageChemistry: 33,
      manager: { itemId: "50", name: "Arteta" },
      managerChangeAllowed: true,
    });
    expect(challenge?.slots).toEqual([
      { index: 0, position: "GK", brick: true, itemId: "1" },
      { index: 4, position: "ST", brick: false, itemId: null },
    ]);
    expect(challenge?.requirements.map((requirement) => [requirement.key, requirement.checkable])).toEqual([
      ["TEAM_RATING", true],
      ["DREAM_HACK", false],
    ]);
    expect(challenge?.ownedManagers.map((manager) => manager.name)).toEqual(["Hayes"]);
  });

  it("does not call submitChallenge when the page has not accepted the squad", async () => {
    const blocked = page({ canSubmit: false });
    const session = createEaPageSession(blocked.host);

    const result = await session.submit();

    expect(result.success).toBe(false);
    expect(blocked.calls.some((call) => call.startsWith("submit:"))).toBe(false);
  });

  it("does not submit an unknown requirement", async () => {
    const { host, calls } = page({
      requirements: [{ key: 99, met: true }],
    });
    const session = createEaPageSession(host);

    const result = await session.submit();

    expect(result.success).toBe(false);
    expect(calls.some((call) => call.startsWith("submit:"))).toBe(false);
  });

  it("submits with the page's own arguments only after the page agrees", async () => {
    const { host, calls } = page();
    const session = createEaPageSession(host);

    const result = await session.submit();

    expect(result).toEqual({ success: true });
    expect(calls).toContain("submit:false:true");
    expect(calls.some((call) => call.includes("market"))).toBe(false);
  });

  it("does not place a card into a brick and returns the page's save error", async () => {
    const brick = page();
    const session = createEaPageSession(brick.host);
    await session.readClubCards();

    const refused = await session.placeCard("10", 0);

    expect(refused.success).toBe(false);
    expect(brick.calls.some((call) => call.startsWith("add:"))).toBe(false);

    const saved = page({ saveSucceeds: false, saveMessage: "Squad full" });
    const placing = createEaPageSession(saved.host);
    await placing.readClubCards();
    const failed = await placing.placeCard("10", 4);

    expect(failed).toEqual({ success: false, message: "Squad full" });
    expect(saved.calls).toContain("add:4:10");
    expect(saved.calls).toContain("save");
  });

  it("fails closed when the page never answers", async () => {
    const { host } = page({ timeout: true });
    const session = createEaPageSession(host, { timeoutMs: 20 });
    await session.readClubCards();

    const result = await session.placeCard("10", 4);

    expect(result.success).toBe(false);
    expect(result.message).toBe("the page did not answer");
  });

  it("does not search the club while a login wall is up", async () => {
    const { host, calls } = page({ loggedIn: false });
    const bridge = new PageBridge(createEaPageSession(host));

    const result = await bridge.snapshot();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("page-blocked");
    expect(calls).not.toContain("stats");
  });

  it("sets a manager only when the challenge allows it", async () => {
    const locked = page({ allowsManager: false });
    const lockedSession = createEaPageSession(locked.host);
    await lockedSession.readClubCards();

    const refused = await lockedSession.setManager("80");

    expect(refused.success).toBe(false);
    expect(locked.calls.some((call) => call.startsWith("set-manager:"))).toBe(false);

    const open = page();
    const session = createEaPageSession(open.host);
    await session.readClubCards();
    const changed = await session.setManager("80");

    expect(changed.success).toBe(true);
    expect(open.calls).toContain("set-manager:80");
    expect(open.calls).toContain("save");
  });

  it("reads the club id the page shows and drops the persona secret", async () => {
    const { host } = page();
    const session = createEaPageSession(host);

    const identity = await session.readIdentity();

    expect(identity).toEqual({ clubId: "7", clubName: "Ada FC" });
    expect(JSON.stringify(identity)).not.toContain("secret-token");
  });
});
