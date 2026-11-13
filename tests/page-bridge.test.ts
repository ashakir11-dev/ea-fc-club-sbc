import { describe, expect, it } from "vitest";
import { PageBridge, type CardCopy, type ChallengeView, type PageSession, type RequirementView } from "../src/bridge/page-bridge.ts";

function card(itemId: string, source: CardCopy["source"] = "club"): CardCopy {
  return {
    itemId,
    definitionId: `def-${itemId}`,
    name: `Player ${itemId}`,
    rating: 84,
    preferredPositions: ["ST"],
    clubId: 1,
    clubName: "Arsenal",
    leagueId: 2,
    leagueName: "Premier League",
    nationId: 3,
    nationName: "England",
    rarityId: 1,
    quality: "gold",
    special: false,
    tradeable: true,
    untradeable: false,
    discardValue: 696,
    source,
    gender: "man",
    kind: "player",
    cornerstoneClubBoost: 0,
    inFirstTeam: false,
  };
}

function requirement(patch: Partial<RequirementView> = {}): RequirementView {
  return {
    key: "TEAM_RATING",
    label: "Team Rating: Min 85",
    count: 1,
    value: "85",
    checkable: true,
    pageMet: true,
    ...patch,
  };
}

function challenge(patch: Partial<ChallengeView> = {}): ChallengeView {
  return {
    id: "c1",
    name: "Hybrid",
    formation: "4-3-3",
    slots: [
      { index: 0, position: "GK", brick: true, itemId: "brick-1" },
      { index: 1, position: "ST", brick: false, itemId: null },
    ],
    manager: { itemId: "m1", name: "Arteta", nationId: 14, leagueId: 13 },
    managerChangeAllowed: true,
    ownedManagers: [{ itemId: "m2", name: "Hayes", nationId: 14, leagueId: 13 }],
    requirements: [requirement()],
    pageRating: 85,
    pageChemistry: 28,
    ...patch,
  };
}

function harness(patch: Partial<PageSession> = {}) {
  const calls: string[] = [];
  const session: PageSession = {
    readGate: async () => {
      calls.push("gate");
      return { kind: "clear" };
    },
    readIdentity: async () => {
      calls.push("identity");
      return { clubId: "7", clubName: "Ada FC" };
    },
    readClubCards: async () => {
      calls.push("club");
      return [card("10")];
    },
    readStorageCards: async () => {
      calls.push("storage");
      return [card("20", "storage")];
    },
    readFirstTeam: async () => {
      calls.push("first-team");
      return { available: true, itemIds: ["10"] };
    },
    readChallenge: async () => {
      calls.push("challenge");
      return challenge();
    },
    placeCard: async (_itemId, slotIndex) => {
      calls.push(`place:${slotIndex}`);
      return { success: true };
    },
    setManager: async () => {
      calls.push("manager");
      return { success: true };
    },
    readAgreement: async () => {
      calls.push("agreement");
      return { canSubmit: true, requirements: [requirement()] };
    },
    submit: async () => {
      calls.push("submit");
      return { success: true };
    },
    ...patch,
  };
  return { bridge: new PageBridge(session), calls, session };
}

describe("page bridge", () => {
  it("reads the open club, SBC storage, first team, and challenge", async () => {
    const { bridge } = harness();

    const result = await bridge.snapshot();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.clubId).toBe("7");
    expect(result.snapshot.clubName).toBe("Ada FC");
    expect(result.snapshot.cards.map((entry) => entry.itemId)).toEqual(["10"]);
    expect(result.snapshot.cards[0]?.inFirstTeam).toBe(true);
    expect(result.snapshot.storage.map((entry) => entry.source)).toEqual(["storage"]);
    expect(result.snapshot.firstTeamAvailable).toBe(true);
    expect(result.snapshot.firstTeamItemIds).toEqual(["10"]);
    expect(result.snapshot.challenge?.name).toBe("Hybrid");
    expect(result.snapshot.challenge?.pageRating).toBe(85);
    expect(result.snapshot.challenge?.pageChemistry).toBe(28);
  });

  it("does not treat the first team as empty when the page cannot show it", async () => {
    const { bridge } = harness({
      readFirstTeam: async () => ({ available: false, itemIds: [] }),
      readClubCards: async () => [{ ...card("10"), inFirstTeam: true }],
    });

    const result = await bridge.snapshot();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.firstTeamAvailable).toBe(false);
    expect(result.snapshot.cards[0]?.inFirstTeam).toBe(false);
  });

  it("does not read the club when a login wall is up", async () => {
    const { bridge, calls } = harness({
      readGate: async () => ({ kind: "login" }),
    });

    const result = await bridge.snapshot();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("page-blocked");
    expect(result.message).toBe("Stopped. The page needs you.");
    expect(calls).not.toContain("club");
    expect(calls).not.toContain("submit");
  });

  it("places a card and returns when the page succeeds", async () => {
    const { bridge, calls } = harness();

    const result = await bridge.place("11", 1);

    expect(result).toMatchObject({ ok: true, submitted: false, message: "" });
    expect(calls).toContain("place:1");
  });

  it("returns the error the page showed", async () => {
    const { bridge } = harness({
      placeCard: async () => ({ success: false, message: "Squad full" }),
    });

    const result = await bridge.place("11", 1);

    expect(result.ok).toBe(false);
    expect(result.submitted).toBe(false);
    expect(result.reason).toBe("page-error");
    expect(result.message).toBe("Squad full");
  });

  it("does not replace a brick slot", async () => {
    const { bridge, calls } = harness();

    const result = await bridge.place("11", 0);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("brick");
    expect(result.message).toBe("A brick slot cannot be replaced.");
    expect(calls.some((call) => call.startsWith("place:"))).toBe(false);
  });

  it("does not submit when a requirement tick is unmet", async () => {
    const { bridge, calls } = harness({
      readAgreement: async () => ({
        canSubmit: true,
        requirements: [requirement({ pageMet: false })],
      }),
    });

    const result = await bridge.submit();

    expect(result.ok).toBe(false);
    expect(result.submitted).toBe(false);
    expect(result.reason).toBe("page-disagreed");
    expect(result.message).toBe("The page did not accept this squad.");
    expect(calls).not.toContain("submit");
  });

  it("does not submit when a requirement cannot be checked", async () => {
    const { bridge, calls } = harness({
      readAgreement: async () => ({
        canSubmit: true,
        requirements: [requirement({ key: "DREAM_HACK", checkable: false, pageMet: true })],
      }),
    });

    const result = await bridge.submit();

    expect(result.reason).toBe("uncheckable");
    expect(result.message).toBe("A requirement on this challenge cannot be checked.");
    expect(calls).not.toContain("submit");
  });

  it("submits only after the page marks the squad valid", async () => {
    let ready = false;
    const { bridge, calls } = harness({
      placeCard: async (_itemId, slotIndex) => {
        calls.push(`place:${slotIndex}`);
        ready = true;
        return { success: true };
      },
      readAgreement: async () => ({
        canSubmit: ready,
        requirements: [requirement({ pageMet: ready ? true : null })],
      }),
    });

    const tooSoon = await bridge.submit();
    expect(tooSoon.reason).toBe("page-disagreed");
    expect(calls).not.toContain("submit");

    bridge.reset();
    await bridge.place("11", 1);
    const result = await bridge.submit();

    expect(result).toMatchObject({ ok: true, submitted: true, message: "" });
    expect(calls).toContain("submit");
  });

  it("does not place or submit when the page shows a captcha", async () => {
    const { bridge, calls } = harness({
      readGate: async () => ({ kind: "captcha" }),
    });

    const placed = await bridge.place("11", 1);
    const submitted = await bridge.submit();

    expect(placed.message).toBe("Stopped. The page needs you.");
    expect(submitted.reason).toBe("page-blocked");
    expect(calls.some((call) => call.startsWith("place:"))).toBe(false);
    expect(calls).not.toContain("submit");
  });

  it("stops on an error dialog and leaves the page alone", async () => {
    const { bridge, calls } = harness({
      readGate: async () => ({ kind: "error", message: "Something went wrong" }),
    });

    const result = await bridge.place("11", 1);

    expect(result.reason).toBe("page-blocked");
    expect(result.message).toBe("Stopped. The page needs you.");
    expect(calls.some((call) => call.startsWith("place:"))).toBe(false);
  });

  it("stops after three failed place or submit actions and does not send the next one", async () => {
    const { bridge, calls } = harness({
      placeCard: async (_itemId, slotIndex) => {
        calls.push(`place:${slotIndex}`);
        return { success: false, message: "rejected" };
      },
    });

    const first = await bridge.place("11", 1);
    const second = await bridge.place("11", 1);
    const third = await bridge.place("11", 1);
    const fourth = await bridge.place("11", 1);

    expect(first.reason).toBe("page-error");
    expect(second.reason).toBe("page-error");
    expect(third.reason).toBe("failures");
    expect(third.message).toBe("Stopped after three failures.");
    expect(fourth.reason).toBe("failures");
    expect(calls.filter((call) => call.startsWith("place:"))).toHaveLength(3);
  });

  it("lets a later action run after a success clears the failure streak", async () => {
    let attempts = 0;
    const { bridge, calls } = harness({
      placeCard: async (_itemId, slotIndex) => {
        calls.push(`place:${slotIndex}`);
        attempts += 1;
        return attempts === 2 ? { success: true } : { success: false, message: "rejected" };
      },
    });

    expect((await bridge.place("11", 1)).reason).toBe("page-error");
    expect((await bridge.place("11", 1)).ok).toBe(true);
    expect((await bridge.place("11", 1)).reason).toBe("page-error");
    expect((await bridge.submit()).ok).toBe(true);
    expect(calls.filter((call) => call.startsWith("place:"))).toHaveLength(3);
    expect(calls).toContain("submit");
  });

  it("sets the manager only when the challenge allows a change", async () => {
    const blocked = harness({
      readChallenge: async () => challenge({ managerChangeAllowed: false }),
    });

    const refused = await blocked.bridge.setManager("m2");

    expect(refused.reason).toBe("manager-locked");
    expect(refused.message).toBe("This challenge does not allow a manager change.");
    expect(blocked.calls).not.toContain("manager");

    const allowed = harness();
    const changed = await allowed.bridge.setManager("m2");

    expect(changed.ok).toBe(true);
    expect(allowed.calls).toContain("manager");
  });

  it("stops the job when Stop is requested and reset lets a new job start", async () => {
    const { bridge, calls } = harness();
    bridge.stop();

    const stopped = await bridge.place("11", 1);
    expect(stopped.reason).toBe("stopped");
    expect(stopped.message).toBe("Stopped.");
    expect(calls.some((call) => call.startsWith("place:"))).toBe(false);

    bridge.reset();
    const again = await bridge.place("11", 1);
    expect(again.ok).toBe(true);
    expect(calls).toContain("place:1");
  });

  it("does not keep acting after the page rejects the squad", async () => {
    const { bridge, calls } = harness({
      readAgreement: async () => ({
        canSubmit: false,
        requirements: [requirement({ pageMet: null })],
      }),
    });

    await bridge.submit();
    await bridge.place("11", 1);

    expect(calls).not.toContain("submit");
    expect(calls.some((call) => call.startsWith("place:"))).toBe(false);
  });
});
