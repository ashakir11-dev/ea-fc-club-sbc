import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mountClubUi,
  type ClubPlan,
  type ClubUiActions,
  type ClubUiHandle,
  type ClubUiState,
} from "./mount-club-ui";

const INK = "#F4F7FB";
const SECONDARY = "#B7C0D0";
const INDIGO = "#7C9CFF";
const ACTION = "#3D4ED8";
const DOCK = "#12141C";
const SHEET = "#161A24";
const LINE = "#2C3548";
const STOP = "#C62828";
const DISABLED = "#2A303C";
const DISABLED_LABEL = "#A8B3C4";
const ATTENTION = "#E6A23C";
const CONSEQUENCE = "#FFB4A2";
const COIN = "#F0C14A";
const QUIET = "#C9D4FF";

function rgb(hex: string): string {
  const n = hex.replace("#", "");
  return `rgb(${Number.parseInt(n.slice(0, 2), 16)}, ${Number.parseInt(n.slice(2, 4), 16)}, ${Number.parseInt(n.slice(4, 6), 16)})`;
}

function colorOf(el: Element, prop: string): string {
  const value = getComputedStyle(el).getPropertyValue(prop).trim().toLowerCase();
  const hex = value.match(/^#([0-9a-f]{6})$/);
  if (hex) {
    const n = hex[1] ?? "";
    return `rgb(${Number.parseInt(n.slice(0, 2), 16)}, ${Number.parseInt(n.slice(2, 4), 16)}, ${Number.parseInt(n.slice(4, 6), 16)})`;
  }
  const match = value.replace(/\s+/g, "").match(/^rgba?\((\d+),(\d+),(\d+)/);
  if (!match) return value;
  return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
}

function expectColor(el: Element | null, prop: string, hex: string) {
  expect(el, prop).not.toBeNull();
  expect(colorOf(el as Element, prop)).toBe(rgb(hex));
}

function buttonByName(name: string, root: ParentNode = document): HTMLButtonElement | undefined {
  return [...root.querySelectorAll("button")].find((button) => {
    const label = button.querySelector("[data-fc-label]")?.textContent?.trim();
    return (label ?? button.textContent?.replace(/\s+/g, " ").trim()) === name;
  });
}

function part(name: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(`[data-fc-part="${name}"]`);
}

function actions(): ClubUiActions {
  return {
    onSolve: vi.fn(),
    onStop: vi.fn(),
    onOpenLocks: vi.fn(),
    onOpenPlan: vi.fn(),
    onSaveLocks: vi.fn(),
    onToggleLock: vi.fn(),
    onIncludeOnce: vi.fn(),
    onReview: vi.fn(),
    onConfirm: vi.fn(),
    onBack: vi.fn(),
  };
}

function state(overrides: Partial<ClubUiState> = {}): ClubUiState {
  return {
    clubName: "Shakir FC",
    dockStatus: "idle",
    viewer: "this-tab",
    sheet: "none",
    firstTeamLocked: true,
    plan: null,
    cards: [{ id: "c1", name: "Saka", locked: false, firstTeam: false }],
    includeOnceIds: [],
    confirmBlockedReason: null,
    pageAgreed: false,
    ...overrides,
  };
}

function squadPlan(overrides: Partial<ClubPlan> = {}): ClubPlan {
  return {
    challengeName: "Hybrid Nations",
    outcome: "squad",
    managerName: "Arteta",
    managerChanged: false,
    slots: [
      { id: "c1", position: "ST", name: "Saka", rating: 84, source: "club", locked: true },
      { id: "c2", position: "RW", name: "Stored", rating: 81, source: "storage", locked: false },
      { id: "b1", position: "CB", name: "Brick", rating: null, source: "brick", locked: false },
    ],
    blockingLock: null,
    ...overrides,
  };
}

let handle: ClubUiHandle | undefined;

function mount(next: ClubUiState, acts: ClubUiActions = actions()) {
  handle = mountClubUi(
    {
      document,
      submitButton: document.querySelector("[data-ea=submit]") as HTMLElement,
      leftNav: document.querySelector("[data-ea=left-nav]") as HTMLElement,
      cards: [...document.querySelectorAll<HTMLElement>("[data-ea=card]")],
      rows: [...document.querySelectorAll<HTMLElement>("[data-ea=club-row]")],
    },
    next,
    acts,
  );
  return { acts };
}

beforeEach(() => {
  document.getElementById("fc-club-ui")?.remove();
  document.body.innerHTML = `
    <nav data-ea="left-nav" style="width: 96px"></nav>
    <footer data-ea="squad-footer">
      <button type="button" data-ea="submit">Submit</button>
    </footer>
    <article data-ea="card" data-card-id="c1" class="ea-rare"></article>
    <div data-ea="club-row" data-card-id="c1"></div>
    <div data-ea="club-row" data-card-id="c1" data-shows-art="true"></div>
  `;
});

afterEach(() => {
  handle?.destroy();
  handle = undefined;
});

describe("bottom dock", () => {
  it("shows the one open club on a bottom dock and does not draw a side panel", () => {
    mount(state());

    const dock = document.querySelector("[data-fc-surface=dock]");
    expect(dock).not.toBeNull();
    expect(dock?.getAttribute("role")).toBe("region");
    expect(dock?.getAttribute("aria-label")).toBe("Open club");
    expect(document.querySelector("[role=complementary]")).toBeNull();
    expect(document.querySelector("[data-fc-surface=side-panel]")).toBeNull();
    expect(document.querySelector("[data-fc-surface=popup]")).toBeNull();
    expect(buttonByName("Switch club")).toBeUndefined();
    expect(buttonByName("Caps")).toBeUndefined();
    expect(buttonByName("Solve set")).toBeUndefined();
    expect(part("club-name")?.textContent).toBe("Shakir FC");
    expect(document.querySelectorAll("[data-fc-part=club-name]")).toHaveLength(1);
    expect(getComputedStyle(dock as Element).position).toBe("fixed");
    expect(getComputedStyle(dock as Element).bottom).toBe("16px");
    expect(getComputedStyle(dock as Element).left).toBe("96px");
    expect(getComputedStyle(dock as Element).right).toBe("0px");
    expect(getComputedStyle(dock as Element).marginLeft).toBe("auto");
    expect(getComputedStyle(dock as Element).marginRight).toBe("auto");
    expect(getComputedStyle(dock as Element).maxWidth).toBe("720px");
    const submit = document.querySelector("[data-ea=submit]");
    expect(submit?.closest("[data-fc-surface=dock]")).toBeNull();
  });

  it("uses the indigo dock chrome and a blank mark", () => {
    mount(state());
    const dock = document.querySelector("[data-fc-surface=dock]") as HTMLElement;
    const mark = part("mark") as HTMLElement;

    expectColor(dock, "background-color", DOCK);
    expect(getComputedStyle(dock).borderTopWidth).toBe("1px");
    expect(getComputedStyle(dock).borderTopStyle).toBe("solid");
    expectColor(dock, "border-top-color", INDIGO);
    expect(getComputedStyle(dock).height).toBe("44px");
    expect(getComputedStyle(dock).borderRadius).toBe("10px");
    expect(getComputedStyle(dock).boxShadow).toContain("8px");
    expect(getComputedStyle(dock).boxShadow).toContain("24px");
    expect(getComputedStyle(dock).fontFamily.toLowerCase()).toContain("system-ui");
    expect(getComputedStyle(dock).fontFamily.toLowerCase()).toContain("segoe ui");
    expect(getComputedStyle(dock).fontSize).toBe("13px");
    expectColor(part("club-name") as Element, "color", INK);
    expectColor(part("status") as Element, "color", SECONDARY);
    expect(mark.textContent?.trim()).toBe("");
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(getComputedStyle(mark).width).toBe("10px");
    expect(getComputedStyle(mark).height).toBe("10px");
    expectColor(mark, "background-color", ACTION);
    expect(getComputedStyle(mark).borderRadius).not.toBe("0px");
  });

  it("keeps the club name and stop ahead of the status when the bar is short", () => {
    mount(state());
    const status = part("status") as HTMLElement;
    const club = part("club-name") as HTMLElement;
    const stop = buttonByName("Stop") as HTMLElement;

    expect(getComputedStyle(status).textOverflow).toBe("ellipsis");
    expect(getComputedStyle(status).minWidth === "0px" || getComputedStyle(status).minWidth === "0").toBe(true);
    expect(getComputedStyle(status).flexGrow).toBe("1");
    expect(getComputedStyle(club).flexShrink).toBe("0");
    expect(getComputedStyle(stop).flexShrink).toBe("0");
    expect(getComputedStyle(buttonByName("Locks") as Element).flexShrink).toBe("0");
    expect(getComputedStyle(club).whiteSpace).toBe("nowrap");
  });

  it.each([
    ["idle", "Idle"],
    ["searching", "Searching the club"],
    ["plan-ready", "Plan ready"],
    ["club-short", "Club is short"],
    ["paused", "Paused"],
    ["page-needs-you", "Stopped. The page needs you."],
  ] as const)("status %s reads %s", (dockStatus, label) => {
    mount(state({ dockStatus }));
    expect(part("status")?.textContent).toBe(label);
  });

  it("orders the mark, club, status, locks, and stop", () => {
    mount(state());
    const dock = document.querySelector("[data-fc-surface=dock]") as HTMLElement;
    const order = [...dock.children].map(
      (el) => el.getAttribute("data-fc-part") ?? el.getAttribute("data-fc-control"),
    );
    expect(order).toEqual(["mark", "club-name", "status", "locks", "stop"]);
  });

  it("disables Stop while idle and still shows the word Stop", () => {
    const { acts } = mount(state(), actions());
    const stop = buttonByName("Stop") as HTMLButtonElement;

    expect(stop).toBeDefined();
    expect(stop.disabled).toBe(true);
    expect(stop.textContent).toContain("Stop");
    expectColor(stop, "background-color", DISABLED);
    expectColor(stop, "color", DISABLED_LABEL);
    stop.click();
    expect(acts.onStop).not.toHaveBeenCalled();
  });

  it("enables the red Stop control for a running search and an open plan", () => {
    const searching = actions();
    mount(state({ dockStatus: "searching" }), searching);
    const stop = buttonByName("Stop") as HTMLButtonElement;

    expect(stop.disabled).toBe(false);
    expectColor(stop, "background-color", STOP);
    expectColor(stop, "color", "#FFFFFF");
    expect(getComputedStyle(stop).width).toBe("72px");
    expect(getComputedStyle(stop).height).toBe("32px");
    expect(getComputedStyle(stop).borderRadius).toBe("8px");
    expect(stop.querySelector("[data-icon=stop]")).not.toBeNull();
    stop.click();
    expect(searching.onStop).toHaveBeenCalledOnce();

    handle?.update(state({ dockStatus: "plan-ready", sheet: "plan", plan: squadPlan() }));
    const still = buttonByName("Stop") as HTMLButtonElement;
    expect(still.disabled).toBe(false);
    expect(still.closest("[data-fc-surface=sheet]")).toBeNull();
    expect(still.closest("[data-fc-surface=scrim]")).toBeNull();
  });

  it("enables Stop while the job is paused and disables it when the club is short", () => {
    mount(state({ dockStatus: "paused" }));
    expect(buttonByName("Stop")?.disabled).toBe(false);

    handle?.update(state({ dockStatus: "club-short", plan: squadPlan({ outcome: "short", slots: [] }) }));
    expect(buttonByName("Stop")?.disabled).toBe(true);
  });

  it("draws Plan only while a search is running or a plan is waiting", () => {
    const acts = actions();
    mount(state(), acts);
    expect(buttonByName("Plan")).toBeUndefined();

    handle?.update(state({ dockStatus: "searching", plan: squadPlan({ outcome: "searching" }) }));
    expect(buttonByName("Plan")).toBeDefined();

    handle?.update(state({ dockStatus: "plan-ready", plan: squadPlan() }));
    buttonByName("Plan")?.click();
    expect(acts.onOpenPlan).toHaveBeenCalledOnce();

    handle?.update(state({ dockStatus: "club-short", plan: squadPlan({ outcome: "short", slots: [] }) }));
    expect(buttonByName("Plan")).toBeDefined();
  });

  it("opens the locks sheet for this club from the dock", () => {
    const acts = actions();
    mount(state({ sheet: "locks", firstTeamLocked: true }), acts);

    expect(buttonByName("Locks")?.textContent).toContain("Locks");
    expect(buttonByName("Locks")?.querySelector("svg")).not.toBeNull();
    buttonByName("Locks")?.click();
    expect(acts.onOpenLocks).toHaveBeenCalledOnce();

    const sheet = document.querySelector("[data-fc-surface=sheet]") as HTMLElement;
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.textContent).toContain("Locks");
    expect(part("club-name", sheet)?.textContent).toBe("Shakir FC");
    const toggle = sheet.querySelector("[role=switch]") as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    expect(sheet.textContent).toContain("Lock first team");
    expect(sheet.textContent).toContain("Locks the current match squad for SBCs and listing.");
    toggle.click();
    buttonByName("Save", sheet)?.click();
    expect(acts.onSaveLocks).toHaveBeenCalledWith({ firstTeamLocked: false });
  });

  it("keeps Stop above the scrim while a sheet is open", () => {
    mount(state({ dockStatus: "plan-ready", sheet: "plan", plan: squadPlan() }));
    const dock = document.querySelector("[data-fc-surface=dock]") as HTMLElement;
    const scrim = document.querySelector("[data-fc-surface=scrim]") as HTMLElement;
    expect(Number(getComputedStyle(dock).zIndex)).toBeGreaterThan(Number(getComputedStyle(scrim).zIndex));
    expect(getComputedStyle(scrim).backgroundColor.replace(/\s+/g, "")).toBe("rgba(7,9,13,0.72)");
  });
});

describe("Solve beside Submit", () => {
  it("places Solve 8px to the left of Submit", () => {
    const acts = actions();
    mount(state(), acts);
    const solve = buttonByName("Solve") as HTMLButtonElement;
    const submit = document.querySelector("[data-ea=submit]");

    expect(solve.nextElementSibling).toBe(submit);
    expect(submit?.textContent).toBe("Submit");
    expect(getComputedStyle(solve).marginRight).toBe("8px");
    expect(getComputedStyle(solve).height).toBe("32px");
    expect(getComputedStyle(solve).borderRadius).toBe("8px");
    expect(getComputedStyle(solve).paddingLeft).toBe("12px");
    expect(getComputedStyle(solve).paddingRight).toBe("12px");
    expectColor(solve, "background-color", ACTION);
    expectColor(solve, "color", "#FFFFFF");
    expect(getComputedStyle(solve).fontSize).toBe("14px");
    expect(getComputedStyle(solve).fontWeight).toBe("600");
    solve.click();
    expect(acts.onSolve).toHaveBeenCalledOnce();
  });

  it("disables Solve and shows the search label while the club is searched", () => {
    const acts = actions();
    mount(state({ dockStatus: "searching" }), acts);
    const solve = buttonByName("Searching the club") as HTMLButtonElement;

    expect(solve.disabled).toBe(true);
    expect(solve.querySelector("[data-icon=searching]")).not.toBeNull();
    expectColor(solve, "background-color", DISABLED);
    expectColor(solve, "color", DISABLED_LABEL);
    solve.click();
    expect(acts.onSolve).not.toHaveBeenCalled();
  });
});

describe("padlock", () => {
  it("draws an open padlock on an unlocked card without a ring", () => {
    mount(state());
    const card = document.querySelector("[data-ea=card]") as HTMLElement;
    const lock = card.querySelector("[data-fc-control=padlock]") as HTMLElement;

    expect(card.className).toBe("ea-rare");
    expect(lock.getAttribute("data-icon")).toBe("unlocked");
    expect(getComputedStyle(lock).width).toBe("22px");
    expect(getComputedStyle(lock).height).toBe("22px");
    expect(getComputedStyle(lock).top).toBe("4px");
    expect(getComputedStyle(lock).right).toBe("4px");
    expectColor(lock, "background-color", DOCK);
    expectColor(lock, "color", INK);
    expect(getComputedStyle(lock).borderTopWidth).toBe("1px");
    expect(getComputedStyle(card).outlineStyle).toBe("none");
  });

  it("draws a closed indigo padlock and a ring when the card is locked", () => {
    const acts = actions();
    mount(state({ cards: [{ id: "c1", name: "Saka", locked: true, firstTeam: false }] }), acts);
    const card = document.querySelector("[data-ea=card]") as HTMLElement;
    const lock = card.querySelector("[data-fc-control=padlock]") as HTMLButtonElement;

    expect(lock.getAttribute("data-icon")).toBe("locked");
    expectColor(lock, "color", INDIGO);
    expect(getComputedStyle(lock).borderTopWidth).toBe("1.5px");
    expectColor(lock, "border-top-color", INDIGO);
    expect(getComputedStyle(card).outlineWidth).toBe("2px");
    expect(getComputedStyle(card).outlineOffset).toBe("2px");
    expectColor(card, "outline-color", INDIGO);
    lock.click();
    expect(acts.onToggleLock).toHaveBeenCalledWith("c1");
  });

  it("marks a locked first-team card with XI", () => {
    mount(state({ cards: [{ id: "c1", name: "Saka", locked: true, firstTeam: true }] }));
    const lock = document.querySelector("[data-ea=card] [data-fc-control=padlock]") as HTMLElement;

    expect(lock.getAttribute("data-icon")).toBe("locked");
    expect(lock.textContent).toContain("XI");
    expect(getComputedStyle(lock).height).toBe("28px");
    const xi = lock.querySelector("[data-fc-part=xi]") as HTMLElement;
    expect(getComputedStyle(xi).fontSize).toBe("8px");
    expectColor(xi, "color", SECONDARY);
  });

  it("puts one lock at the start of a club row and skips a row that already shows the card", () => {
    mount(state({ cards: [{ id: "c1", name: "Saka", locked: true, firstTeam: false }] }));
    const rows = [...document.querySelectorAll<HTMLElement>("[data-ea=club-row]")];
    const rowLock = rows[0]?.querySelector("[data-fc-control=padlock]") as HTMLElement;
    const word = rows[0]?.querySelector("[data-fc-part=lock-word]") as HTMLElement;

    expect(rowLock).not.toBeNull();
    expect(getComputedStyle(rowLock).width).toBe("20px");
    expect(getComputedStyle(rowLock).height).toBe("20px");
    expect(word.textContent).toBe("Locked");
    expect(getComputedStyle(word).marginLeft).toBe("6px");
    expect(getComputedStyle(word).fontSize).toBe("12px");
    expectColor(word, "color", QUIET);
    expect(rows[1]?.querySelector("[data-fc-control=padlock]")).toBeNull();
  });

  it("says First team on a first-team row", () => {
    mount(state({ cards: [{ id: "c1", name: "Saka", locked: true, firstTeam: true }] }));
    const word = document.querySelector("[data-ea=club-row] [data-fc-part=lock-word]");
    expect(word?.textContent).toBe("First team");
  });

  it("keeps the padlock closed when the card is included once", () => {
    mount(
      state({
        cards: [{ id: "c1", name: "Saka", locked: true, firstTeam: false }],
        includeOnceIds: ["c1"],
        sheet: "confirm",
        dockStatus: "plan-ready",
        plan: squadPlan(),
      }),
    );
    const card = document.querySelector("[data-ea=card]") as HTMLElement;
    const lock = card.querySelector("[data-fc-control=padlock]") as HTMLElement;
    expect(lock.getAttribute("data-icon")).toBe("locked");
    expect(getComputedStyle(card).outlineWidth).toBe("2px");
  });
});

describe("plan sheet", () => {
  it("shows the squad, a zero coin total, and the cards that leave", () => {
    const acts = actions();
    mount(state({ dockStatus: "plan-ready", sheet: "plan", plan: squadPlan() }), acts);
    const sheet = document.querySelector("[data-fc-surface=sheet]") as HTMLElement;

    expect(getComputedStyle(sheet).width).toBe("560px");
    expectColor(sheet, "background-color", SHEET);
    expect(getComputedStyle(sheet).borderLeftWidth).toBe("3px");
    expectColor(sheet, "border-left-color", INDIGO);
    expect(getComputedStyle(sheet).borderTopWidth).toBe("1px");
    expectColor(sheet, "border-top-color", LINE);
    expect(getComputedStyle(sheet).borderRadius).toBe("12px");
    expect(getComputedStyle(sheet).paddingTop).toBe("20px");
    expect(sheet.style.maxHeight).toBe("calc(100vh - 96px)");
    expect(part("title", sheet)?.textContent).toBe("Plan");
    expect(getComputedStyle(part("title", sheet) as Element).fontSize).toBe("18px");
    expectColor(part("title", sheet) as Element, "color", INK);
    expect(sheet.textContent).toContain("Hybrid Nations");
    expect(part("plan-status", sheet)?.textContent).toBe("Squad from the club");
    expect(sheet.textContent).toContain("Arteta");
    expect(sheet.textContent).not.toContain("Manager changes to");

    const slots = [...sheet.querySelectorAll("[data-fc-part=slot]")];
    expect(slots).toHaveLength(3);
    expect(slots[0]?.textContent).toContain("ST");
    expect(slots[0]?.textContent).toContain("Saka");
    expect(slots[0]?.textContent).toContain("84");
    expect(slots[0]?.textContent).toContain("Club");
    expect(getComputedStyle(slots[0]?.querySelector("[data-fc-part=rating]") as Element).fontVariantNumeric).toContain(
      "tabular-nums",
    );
    expect(slots[1]?.textContent).toContain("Storage");
    expect(slots[2]?.textContent).toContain("Brick");
    expect(slots[2]?.textContent).not.toContain("Club");
    expect(slots[2]?.querySelector("button")).toBeNull();

    expect(part("coin-amount", sheet)?.textContent).toBe("0");
    expect(part("coin-word", sheet)?.textContent).toBe("coins");
    expectColor(part("coin-amount", sheet) as Element, "color", COIN);
    expectColor(part("coin-word", sheet) as Element, "color", INK);
    const consequence = part("consequence", sheet) as HTMLElement;
    expect(consequence.textContent).toBe("These cards leave the club.");
    expectColor(consequence, "color", CONSEQUENCE);
    expect(getComputedStyle(consequence).fontSize).toBe("15px");
    expect(getComputedStyle(consequence).fontWeight).toBe("600");
    buttonByName("Review and confirm", sheet)?.click();
    expect(acts.onReview).toHaveBeenCalledOnce();
  });

  it("names a manager change in the attention color", () => {
    mount(
      state({
        dockStatus: "plan-ready",
        sheet: "plan",
        plan: squadPlan({ managerChanged: true }),
      }),
    );
    const line = part("manager") as HTMLElement;
    expect(line.textContent).toBe("Manager changes to Arteta");
    expectColor(line, "color", ATTENTION);
  });

  it("does not show a partial squad or confirm while searching", () => {
    mount(
      state({
        dockStatus: "searching",
        sheet: "plan",
        plan: squadPlan({ outcome: "searching" }),
      }),
    );
    const sheet = document.querySelector("[data-fc-surface=sheet]") as HTMLElement;
    expect(part("plan-status", sheet)?.textContent).toBe("Searching the club");
    expect(sheet.querySelector("[data-fc-part=slot]")).toBeNull();
    expect(sheet.textContent).not.toContain("Saka");
    expect(buttonByName("Review and confirm", sheet)).toBeUndefined();
  });

  it("shows a short club and a named lock without a confirm button", () => {
    const acts = actions();
    mount(
      state({
        dockStatus: "club-short",
        sheet: "plan",
        plan: squadPlan({
          outcome: "short",
          slots: [],
          blockingLock: { id: "c1", name: "Saka" },
        }),
      }),
      acts,
    );
    const sheet = document.querySelector("[data-fc-surface=sheet]") as HTMLElement;
    expect(part("plan-status", sheet)?.textContent).toBe("Club is short");
    expect(buttonByName("Review and confirm", sheet)).toBeUndefined();
    expect(sheet.textContent).not.toContain("These cards leave the club.");
    const block = part("blocking-lock", sheet) as HTMLElement;
    expect(block.textContent).toContain("Saka");
    expect(block.querySelector("[data-icon=locked]")).not.toBeNull();
    expect(block.textContent).toContain("Include this once");
    expect(block.textContent).toContain("The lock stays on.");
    const box = block.querySelector("input") as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.click();
    expect(acts.onIncludeOnce).toHaveBeenCalledWith("c1", true);
  });
});

describe("confirm sheet", () => {
  it("asks once before submit and keeps Back quiet", () => {
    const acts = actions();
    mount(
      state({
        dockStatus: "plan-ready",
        sheet: "confirm",
        plan: squadPlan(),
      }),
      acts,
    );
    const sheet = document.querySelector("[data-fc-surface=sheet]") as HTMLElement;
    const title = part("title", sheet) as HTMLElement;
    expect(title.textContent).toBe("Submit this squad");
    expect(title.nextElementSibling?.getAttribute("data-fc-part")).toBe("consequence");
    expect(part("consequence", sheet)?.textContent).toBe("These cards leave the club.");
    expect(part("summary", sheet)?.textContent).toContain("0");
    expect(part("summary", sheet)?.textContent).toContain("coins");
    expect(part("summary", sheet)?.textContent).toContain("2 cards");
    expect(part("summary", sheet)?.textContent).toContain("The reward pack stays unopened.");
    expect(sheet.textContent).toContain("The page check is what allows submit.");
    expect(sheet.querySelector("[data-icon=page-agreed]")).toBeNull();

    const include = part("include-once", sheet) as HTMLElement;
    expect(include?.textContent).toContain("Saka");
    expect(include?.textContent).toContain("Include this once");
    expect(include?.textContent).toContain("The lock stays on.");
    expect((include?.querySelector("input") as HTMLInputElement | null)?.checked).toBe(false);
    expect(include?.textContent).not.toContain("Stored");
    expect(sheet.textContent).toContain("Stored");
    expect(sheet.querySelectorAll("[data-fc-part=include-once]")).toHaveLength(1);

    const confirm = buttonByName("Confirm", sheet) as HTMLButtonElement;
    const back = buttonByName("Back", sheet) as HTMLButtonElement;
    expect(confirm.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expectColor(confirm, "background-color", ACTION);
    expectColor(back, "color", QUIET);
    expectColor(back, "border-top-color", INDIGO);
    expect(getComputedStyle(back).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    confirm.click();
    back.click();
    expect(acts.onConfirm).toHaveBeenCalledOnce();
    expect(acts.onBack).toHaveBeenCalledOnce();
    expect(buttonByName("Stop", sheet)).toBeUndefined();
  });

  it("shows the page agreement in indigo after the page agrees", () => {
    mount(
      state({
        dockStatus: "plan-ready",
        sheet: "confirm",
        plan: squadPlan(),
        pageAgreed: true,
      }),
    );
    const icon = document.querySelector("[data-icon=page-agreed]") as HTMLElement;
    expect(icon).not.toBeNull();
    expectColor(icon, "color", QUIET);
    expect(colorOf(icon, "color")).not.toBe(rgb("#3DDC97"));
  });

  it("disables Confirm and shows the reason when a requirement cannot be checked", () => {
    const acts = actions();
    mount(
      state({
        dockStatus: "plan-ready",
        sheet: "confirm",
        plan: squadPlan(),
        confirmBlockedReason: "A requirement cannot be checked.",
      }),
      acts,
    );
    const confirm = buttonByName("Confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const reason = part("reason") as HTMLElement;
    expect(reason.textContent).toBe("A requirement cannot be checked.");
    expect(getComputedStyle(reason).fontSize).toBe("12px");
    expectColor(reason, "color", SECONDARY);
    confirm.click();
    expect(acts.onConfirm).not.toHaveBeenCalled();
  });
});

describe("one club", () => {
  it("replaces the dock name when a later login opens another club", () => {
    mount(state());
    handle?.update(state({ clubName: "Other FC", sheet: "locks" }));

    const names = [...document.querySelectorAll("[data-fc-part=club-name]")].map((el) => el.textContent);
    expect(names).toEqual(["Other FC", "Other FC"]);
    expect(document.body.textContent).not.toContain("Shakir FC");
    expect(buttonByName("Switch club")).toBeUndefined();
    expect(document.querySelector("[data-fc-surface=side-panel]")).toBeNull();
  });

  it("shows status on the other tab and disables the screen actions", () => {
    const acts = actions();
    mount(
      state({
        dockStatus: "searching",
        viewer: "other-tab",
        plan: squadPlan({ outcome: "searching" }),
      }),
      acts,
    );

    expect(part("status")?.textContent).toBe("Searching the club");
    expect(part("viewer")?.textContent).toBe("Showing status");
    const solve = buttonByName("Searching the club") as HTMLButtonElement;
    expect(solve.disabled).toBe(true);
    expect(part("reason")?.textContent).toBe("Showing status");
    expect(buttonByName("Locks")?.disabled).toBe(true);
    expect(buttonByName("Plan")?.disabled).toBe(true);
    expect(buttonByName("Stop")?.disabled).toBe(true);
    buttonByName("Stop")?.click();
    expect(acts.onStop).not.toHaveBeenCalled();
  });

  it("closes sheets and sits on the bottom edge when the page needs you", () => {
    mount(
      state({
        dockStatus: "page-needs-you",
        sheet: "confirm",
        plan: squadPlan(),
      }),
    );
    const dock = document.querySelector("[data-fc-surface=dock]") as HTMLElement;
    expect(part("status")?.textContent).toBe("Stopped. The page needs you.");
    expect(document.querySelector("[data-fc-surface=sheet]")).toBeNull();
    expect(document.querySelector("[data-fc-surface=scrim]")).toBeNull();
    expect(getComputedStyle(dock).bottom).toBe("0px");
    expect(buttonByName("Stop")?.disabled).toBe(true);
  });

  it("removes the dock, Solve, and the padlock on destroy", () => {
    mount(state({ cards: [{ id: "c1", name: "Saka", locked: true, firstTeam: false }] }));
    expect(document.querySelector("[data-fc-surface=dock]")).not.toBeNull();
    expect(buttonByName("Solve")).toBeDefined();
    expect(document.querySelector("[data-fc-control=padlock]")).not.toBeNull();
    handle?.destroy();
    handle = undefined;

    expect(document.querySelector("[data-fc-surface=dock]")).toBeNull();
    expect(buttonByName("Solve")).toBeUndefined();
    expect(document.querySelector("[data-fc-control=padlock]")).toBeNull();
    expect(document.getElementById("fc-club-ui")).toBeNull();
    expect(document.querySelector("[data-ea=card]")?.getAttribute("style")).toBeNull();
  });
});
