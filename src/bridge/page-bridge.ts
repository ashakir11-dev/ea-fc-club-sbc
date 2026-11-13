import type {
  ActionResult,
  CardCopy,
  HaltReason,
  PageActionResponse,
  PageGate,
  PageSession,
  SnapshotResult,
} from "./types.js";

export type {
  ActionReason,
  ActionResult,
  CardCopy,
  CardGender,
  CardKind,
  CardQuality,
  CardSource,
  ChallengeView,
  ClubSnapshot,
  ManagerView,
  PageActionResponse,
  PageAgreement,
  PageGate,
  PageSession,
  RequirementView,
  SnapshotResult,
  SquadSlot,
} from "./types.js";

export { CHECKABLE_REQUIREMENTS } from "./types.js";

const HALT_MESSAGE: Record<HaltReason, string> = {
  "page-blocked": "Stopped. The page needs you.",
  "page-disagreed": "The page did not accept this squad.",
  failures: "Stopped after three failures.",
  stopped: "Stopped.",
  brick: "A brick slot cannot be replaced.",
  uncheckable: "A requirement on this challenge cannot be checked.",
  unavailable: "The page is not ready.",
  "manager-locked": "This challenge does not allow a manager change.",
};

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The page is not ready.";
}

export class PageBridge {
  private halt: HaltReason | null = null;
  private failures = 0;

  constructor(private readonly session: PageSession) {}

  stop(): void {
    this.halt = "stopped";
  }

  reset(): void {
    this.halt = null;
    this.failures = 0;
  }

  async snapshot(): Promise<SnapshotResult> {
    let pageGate: PageGate;
    try {
      pageGate = await this.session.readGate();
    } catch (error) {
      return {
        ok: false,
        reason: "unavailable",
        message: messageOf(error),
        pageGate: { kind: "clear" },
      };
    }
    if (pageGate.kind !== "clear") {
      this.halt = "page-blocked";
      return {
        ok: false,
        reason: "page-blocked",
        message: HALT_MESSAGE["page-blocked"],
        pageGate,
      };
    }
    try {
      const identity = await this.session.readIdentity();
      const cards = await this.session.readClubCards();
      const storage = await this.session.readStorageCards();
      const firstTeam = await this.session.readFirstTeam();
      const challenge = await this.session.readChallenge();
      const mark = (entry: CardCopy): CardCopy => ({
        ...entry,
        inFirstTeam: firstTeam.available && firstTeam.itemIds.includes(entry.itemId),
      });
      return {
        ok: true,
        snapshot: {
          clubId: identity.clubId,
          clubName: identity.clubName,
          cards: cards.map(mark),
          storage: storage.map(mark),
          firstTeamAvailable: firstTeam.available,
          firstTeamItemIds: firstTeam.available ? [...firstTeam.itemIds] : [],
          challenge,
        },
      };
    } catch (error) {
      return {
        ok: false,
        reason: "unavailable",
        message: messageOf(error),
        pageGate: { kind: "clear" },
      };
    }
  }

  async place(itemId: string, slotIndex: number): Promise<ActionResult> {
    const blocked = await this.gate();
    if (blocked) return blocked;
    try {
      const challenge = await this.session.readChallenge();
      if (!challenge) return this.stopWith("unavailable", "No challenge is open.");
      const slot = challenge.slots.find((entry) => entry.index === slotIndex);
      if (slot?.brick) return this.stopWith("brick", HALT_MESSAGE.brick);
      return this.settle(await this.session.placeCard(itemId, slotIndex), false);
    } catch (error) {
      return this.settle({ success: false, message: messageOf(error) }, false);
    }
  }

  async setManager(itemId: string): Promise<ActionResult> {
    const blocked = await this.gate();
    if (blocked) return blocked;
    try {
      const challenge = await this.session.readChallenge();
      if (!challenge) return this.stopWith("unavailable", "No challenge is open.");
      if (!challenge.managerChangeAllowed) {
        return this.stopWith("manager-locked", HALT_MESSAGE["manager-locked"]);
      }
      return this.settle(await this.session.setManager(itemId), false);
    } catch (error) {
      return this.settle({ success: false, message: messageOf(error) }, false);
    }
  }

  async submit(): Promise<ActionResult> {
    const blocked = await this.gate();
    if (blocked) return blocked;
    try {
      const agreement = await this.session.readAgreement();
      if (agreement.requirements.some((requirement) => !requirement.checkable)) {
        return this.stopWith("uncheckable", HALT_MESSAGE.uncheckable);
      }
      const unmet = agreement.requirements.some((requirement) => requirement.pageMet === false);
      if (!agreement.canSubmit || unmet) {
        return this.stopWith("page-disagreed", HALT_MESSAGE["page-disagreed"]);
      }
      return this.settle(await this.session.submit(), true);
    } catch (error) {
      return this.settle({ success: false, message: messageOf(error) }, false);
    }
  }

  private async gate(): Promise<ActionResult | null> {
    const halted = this.halted();
    if (halted) return halted;
    let pageGate: PageGate;
    try {
      pageGate = await this.session.readGate();
    } catch (error) {
      return this.settle({ success: false, message: messageOf(error) }, false);
    }
    if (pageGate.kind !== "clear") {
      return this.stopWith("page-blocked", HALT_MESSAGE["page-blocked"]);
    }
    return null;
  }

  private halted(): ActionResult | null {
    if (!this.halt) return null;
    return {
      ok: false,
      submitted: false,
      reason: this.halt,
      message: HALT_MESSAGE[this.halt],
      consecutiveFailures: this.failures,
    };
  }

  private stopWith(reason: HaltReason, message: string): ActionResult {
    this.halt = reason;
    return {
      ok: false,
      submitted: false,
      reason,
      message,
      consecutiveFailures: this.failures,
    };
  }

  private settle(result: PageActionResponse, submitted: boolean): ActionResult {
    if (result.success) {
      this.failures = 0;
      return { ok: true, submitted, message: "", consecutiveFailures: 0 };
    }
    this.failures += 1;
    if (this.failures >= 3) {
      this.halt = "failures";
      return {
        ok: false,
        submitted: false,
        reason: "failures",
        message: HALT_MESSAGE.failures,
        pageMessage: result.message,
        consecutiveFailures: this.failures,
      };
    }
    return {
      ok: false,
      submitted: false,
      reason: "page-error",
      message: result.message || "The page returned an error.",
      consecutiveFailures: this.failures,
    };
  }
}
