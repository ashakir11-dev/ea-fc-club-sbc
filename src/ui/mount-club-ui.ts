export type DockStatus =
  | "idle"
  | "searching"
  | "plan-ready"
  | "club-short"
  | "paused"
  | "page-needs-you";

export type CardFace = {
  id: string;
  name: string;
  locked: boolean;
  firstTeam: boolean;
};

export type SquadSlot = {
  id: string;
  position: string;
  name: string;
  rating: number | null;
  source: "club" | "storage" | "brick";
  locked: boolean;
};

export type ClubPlan = {
  challengeName: string;
  outcome: "squad" | "searching" | "short";
  managerName: string;
  managerChanged: boolean;
  slots: SquadSlot[];
  blockingLock: { id: string; name: string } | null;
};

export type ClubUiState = {
  clubName: string;
  dockStatus: DockStatus;
  viewer: "this-tab" | "other-tab";
  sheet: "none" | "locks" | "plan" | "confirm";
  firstTeamLocked: boolean;
  plan: ClubPlan | null;
  cards: CardFace[];
  includeOnceIds: readonly string[];
  confirmBlockedReason: string | null;
  pageAgreed: boolean;
};

export type ClubUiActions = {
  onSolve: () => void;
  onStop: () => void;
  onOpenLocks: () => void;
  onOpenPlan: () => void;
  onSaveLocks: (next: { firstTeamLocked: boolean }) => void;
  onToggleLock: (cardId: string) => void;
  onIncludeOnce: (cardId: string, included: boolean) => void;
  onReview: () => void;
  onConfirm: () => void;
  onBack: () => void;
};

export type ClubUiTargets = {
  document: Document;
  submitButton: HTMLElement;
  leftNav: HTMLElement;
  cards: HTMLElement[];
  rows: HTMLElement[];
};

export type ClubUiHandle = {
  update: (state: ClubUiState) => void;
  destroy: () => void;
};

const STATUS_LINE: Record<DockStatus, string> = {
  idle: "Idle",
  searching: "Searching the club",
  "plan-ready": "Plan ready",
  "club-short": "Club is short",
  paused: "Paused",
  "page-needs-you": "Stopped. The page needs you.",
};

const PLAN_STATUS = {
  squad: "Squad from the club",
  searching: "Searching the club",
  short: "Club is short",
} as const;

const STYLE = `
[data-fc-surface="dock"],
[data-fc-surface="sheet"],
[data-fc-solve] {
  font-family: system-ui, "Segoe UI", sans-serif;
  box-sizing: border-box;
}
[data-fc-surface="dock"] {
  position: fixed;
  right: 0;
  bottom: 16px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  padding: 0 12px;
  overflow: hidden;
  color: #F4F7FB;
  font-size: 13px;
  font-weight: 400;
  background: #12141C;
  border: 1px solid #7C9CFF;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
[data-fc-surface="dock"][data-fc-pinned="edge"] { bottom: 0; }
[data-fc-part="mark"] {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #3D4ED8;
}
[data-fc-part="club-name"] {
  flex: 0 0 auto;
  max-width: 40%;
  overflow: hidden;
  color: #F4F7FB;
  white-space: nowrap;
  text-overflow: ellipsis;
}
[data-fc-part="status"],
[data-fc-part="viewer"] {
  min-width: 0;
  overflow: hidden;
  color: #B7C0D0;
  white-space: nowrap;
  text-overflow: ellipsis;
}
[data-fc-part="status"] { flex: 1 1 auto; }
[data-fc-part="viewer"] { flex: 0 0 auto; }
[data-fc-control="locks"],
[data-fc-control="plan"],
[data-fc-control="stop"] { flex: 0 0 auto; }
[data-fc-solve],
[data-fc-control="locks"],
[data-fc-control="plan"],
[data-fc-control="stop"],
[data-fc-tone="action"],
[data-fc-tone="quiet"] {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}
[data-fc-solve],
[data-fc-tone="action"] {
  border: 0;
  color: #FFFFFF;
  background: #3D4ED8;
}
[data-fc-solve]:not([disabled]):hover,
[data-fc-tone="action"]:not([disabled]):hover { background: #4F5FE0; }
[data-fc-solve][disabled],
[data-fc-tone="action"][disabled],
[data-fc-control="locks"][disabled],
[data-fc-control="plan"][disabled],
[data-fc-control="stop"][disabled] {
  color: #A8B3C4;
  background: #2A303C;
  border-color: transparent;
  cursor: default;
}
[data-fc-solve] { margin-right: 8px; }
[data-fc-control="locks"],
[data-fc-control="plan"] {
  border: 0;
  color: #F4F7FB;
  background: transparent;
}
[data-fc-control="stop"] {
  width: 72px;
  border: 0;
  color: #FFFFFF;
  background: #C62828;
}
[data-fc-tone="quiet"] {
  color: #C9D4FF;
  background: rgba(0, 0, 0, 0);
  border: 1px solid #7C9CFF;
}
[data-fc-part="reason"] {
  color: #B7C0D0;
  font-size: 12px;
  font-weight: 400;
}
[data-fc-surface="scrim"] {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: rgba(7, 9, 13, 0.72);
}
[data-fc-surface="sheet"] {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 30;
  transform: translate(-50%, -50%);
  width: 560px;
  max-height: calc(100vh - 96px);
  overflow: auto;
  padding: 20px;
  color: #F4F7FB;
  background: #161A24;
  border: 1px solid #2C3548;
  border-left: 3px solid #7C9CFF;
  border-radius: 12px;
}
[data-fc-part="title"] {
  margin: 0;
  color: #F4F7FB;
  font-size: 18px;
  font-weight: 600;
}
[data-fc-part="consequence"] {
  margin: 8px 0 0;
  color: #FFB4A2;
  font-size: 15px;
  font-weight: 600;
}
[data-fc-part="section"] {
  margin: 14px 0 4px;
  color: #8B95A8;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
[data-fc-part="manager"][data-changed="true"] { color: #E6A23C; }
[data-fc-part="coin-amount"],
[data-fc-part="rating"] { font-variant-numeric: tabular-nums; }
[data-fc-part="coin-amount"] { color: #F0C14A; }
[data-fc-part="coin-word"] { color: #F4F7FB; }
[data-fc-part="slot"],
[data-fc-part="include-once"],
[data-fc-part="blocking-lock"] {
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
}
[data-fc-control="padlock"] {
  box-sizing: border-box;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 50%;
  background: #12141C;
  line-height: 1;
}
[data-fc-control="padlock"][data-place="card"] {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
}
[data-fc-control="padlock"][data-place="row"] {
  width: 20px;
  height: 20px;
}
[data-fc-control="padlock"][data-icon="unlocked"] {
  height: 22px;
  color: #F4F7FB;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
[data-fc-control="padlock"][data-icon="locked"] {
  color: #7C9CFF;
  border: 1.5px solid #7C9CFF;
}
[data-fc-control="padlock"][data-place="card"][data-icon="locked"] { height: 22px; }
[data-fc-control="padlock"][data-place="card"][data-first-team="true"] { height: 28px; }
[data-fc-part="xi"] {
  color: #B7C0D0;
  font-size: 8px;
  font-weight: 400;
}
[data-fc-part="lock-word"] {
  margin-left: 6px;
  color: #C9D4FF;
  font-size: 12px;
}
[data-fc-row-lock] {
  display: inline-flex;
  align-items: center;
}
[data-fc-owned]:focus-visible {
  outline: 2px solid #F4F7FB;
  outline-offset: 2px;
}
[data-icon="page-agreed"] { color: #C9D4FF; }
`;

export function mountClubUi(
  targets: ClubUiTargets,
  initial: ClubUiState,
  actions: ClubUiActions,
): ClubUiHandle {
  const doc = targets.document;
  let current = initial;
  let firstTeamDraft = initial.firstTeamLocked;
  let destroyed = false;
  const cardStyles = new Map<HTMLElement, string | null>();

  const style = doc.createElement("style");
  style.id = "fc-club-ui";
  style.textContent = STYLE;
  doc.head.append(style);

  const render = () => {
    if (destroyed) return;
    clearDrawn();
    drawSolve();
    drawPadlocks();
    drawDock();
    drawSheet();
  };

  const clearDrawn = () => {
    for (const node of doc.querySelectorAll("[data-fc-drawn]")) node.remove();
    for (const card of targets.cards) {
      card.style.outline = "";
      card.style.outlineOffset = "";
    }
  };

  const rememberCard = (card: HTMLElement) => {
    if (!cardStyles.has(card)) cardStyles.set(card, card.getAttribute("style"));
    if (getComputedStyle(card).position === "static") card.style.position = "relative";
  };

  const drawSolve = () => {
    const searching = current.dockStatus === "searching";
    const statusOnly = current.viewer === "other-tab";
    const blocked = current.dockStatus === "page-needs-you";
    const solve = control(
      searching ? "Searching the club" : "Solve",
      () => actions.onSolve(),
      {
        "data-fc-solve": "",
        "data-fc-drawn": "",
        "data-fc-owned": "",
      },
    );
    solve.disabled = searching || statusOnly || blocked;
    if (searching) solve.append(iconSearching());
    targets.submitButton.before(solve);
    if (statusOnly) {
      const reason = el("div", { "data-fc-part": "reason", "data-fc-drawn": "" });
      reason.textContent = "Showing status";
      targets.submitButton.after(reason);
    }
  };

  const drawPadlocks = () => {
    const faces = new Map(current.cards.map((card) => [card.id, card]));
    for (const card of targets.cards) {
      const face = faces.get(card.dataset.cardId ?? "");
      if (!face) continue;
      rememberCard(card);
      const locked = face.locked || face.firstTeam;
      card.append(padlock(face, "card"));
      card.style.outline = locked ? "2px solid #7C9CFF" : "none";
      card.style.outlineOffset = locked ? "2px" : "0";
    }
    for (const row of targets.rows) {
      if (row.dataset.showsArt === "true") continue;
      const face = faces.get(row.dataset.cardId ?? "");
      if (!face) continue;
      const wrap = el("span", { "data-fc-row-lock": "", "data-fc-drawn": "" });
      wrap.append(padlock(face, "row"));
      if (face.locked || face.firstTeam) {
        const word = el("span", { "data-fc-part": "lock-word" });
        word.textContent = face.firstTeam ? "First team" : "Locked";
        wrap.append(word);
      }
      row.prepend(wrap);
    }
  };

  const padlock = (face: CardFace, place: "card" | "row") => {
    const locked = face.locked || face.firstTeam;
    const control = el("button", {
      type: "button",
      "data-fc-control": "padlock",
      "data-fc-drawn": "",
      "data-fc-owned": "",
      "data-icon": locked ? "locked" : "unlocked",
      "data-place": place,
      "aria-label": locked ? `Unlock ${face.name}` : `Lock ${face.name}`,
      "aria-pressed": locked ? "true" : "false",
    });
    if (place === "card" && face.firstTeam && locked) control.setAttribute("data-first-team", "true");
    control.append(locked ? iconLocked() : iconUnlocked());
    if (place === "card" && face.firstTeam && locked) {
      const xi = el("span", { "data-fc-part": "xi" });
      xi.textContent = "XI";
      control.append(xi);
    }
    control.addEventListener("click", () => {
      if (control.disabled) return;
      actions.onToggleLock(face.id);
    });
    if (current.viewer === "other-tab") control.disabled = true;
    return control;
  };

  const drawDock = () => {
    const pageNeedsYou = current.dockStatus === "page-needs-you";
    const statusOnly = current.viewer === "other-tab";
    const dock = el("div", {
      "data-fc-surface": "dock",
      "data-fc-drawn": "",
      role: "region",
      "aria-label": "Open club",
    });
    dock.style.left = `${laneLeft(targets.leftNav)}px`;
    if (pageNeedsYou) dock.setAttribute("data-fc-pinned", "edge");

    const mark = el("span", { "data-fc-part": "mark", "aria-hidden": "true" });
    const club = el("span", { "data-fc-part": "club-name" });
    club.textContent = current.clubName;
    const status = el("span", { "data-fc-part": "status" });
    status.textContent = STATUS_LINE[current.dockStatus];
    dock.append(mark, club, status);
    if (statusOnly && !pageNeedsYou) {
      const viewer = el("span", { "data-fc-part": "viewer" });
      viewer.textContent = "Showing status";
      dock.append(viewer);
    }

    const locks = control("Locks", () => actions.onOpenLocks(), {
      "data-fc-control": "locks",
      "data-fc-owned": "",
    });
    locks.append(iconSliders());
    locks.disabled = statusOnly;
    dock.append(locks);

    const showPlan =
      !pageNeedsYou && (current.dockStatus === "searching" || current.plan !== null);
    if (showPlan) {
      const plan = control("Plan", () => actions.onOpenPlan(), {
        "data-fc-control": "plan",
        "data-fc-owned": "",
      });
      plan.disabled = statusOnly;
      dock.append(plan);
    }

    const stop = control("Stop", () => actions.onStop(), {
      "data-fc-control": "stop",
      "data-fc-owned": "",
    });
    stop.append(iconStop());
    stop.disabled = statusOnly || !stopEnabled(current);
    dock.append(stop);
    doc.body.append(dock);
  };

  const drawSheet = () => {
    if (current.dockStatus === "page-needs-you" || current.sheet === "none") return;
    const scrim = el("div", { "data-fc-surface": "scrim", "data-fc-drawn": "", role: "presentation" });
    const sheet = el("section", {
      "data-fc-surface": "sheet",
      "data-fc-drawn": "",
      role: "dialog",
      "aria-modal": "true",
    });
    sheet.style.maxHeight = "calc(100vh - 96px)";
    if (current.sheet === "locks") drawLocks(sheet);
    if (current.sheet === "plan" && current.plan) drawPlan(sheet, current.plan);
    if (current.sheet === "confirm" && current.plan) drawConfirm(sheet, current.plan);
    const title = sheet.querySelector("[data-fc-part=title]");
    if (title) {
      title.id = "fc-club-sheet-title";
      sheet.setAttribute("aria-labelledby", title.id);
    }
    doc.body.append(scrim, sheet);
  };

  const drawLocks = (sheet: HTMLElement) => {
    sheet.append(title("Locks"));
    const club = el("p", { "data-fc-part": "club-name" });
    club.textContent = current.clubName;
    const caption = el("p", { "data-fc-part": "caption" });
    caption.textContent = "Locks the current match squad for SBCs and listing.";
    const label = el("label");
    const toggle = doc.createElement("input");
    toggle.type = "checkbox";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-label", "Lock first team");
    toggle.checked = firstTeamDraft;
    toggle.addEventListener("click", () => {
      firstTeamDraft = toggle.checked;
    });
    label.append(toggle, doc.createTextNode(" Lock first team"));
    const save = control("Save", () => actions.onSaveLocks({ firstTeamLocked: firstTeamDraft }), {
      "data-fc-tone": "action",
      "data-fc-owned": "",
    });
    sheet.append(club, label, caption, save);
  };

  const drawPlan = (sheet: HTMLElement, plan: ClubPlan) => {
    sheet.append(title("Plan"));
    const challenge = el("p", { "data-fc-part": "challenge" });
    challenge.textContent = plan.challengeName;
    const status = el("p", { "data-fc-part": "plan-status" });
    status.textContent = PLAN_STATUS[plan.outcome];
    sheet.append(challenge, status, managerLine(plan));
    if (plan.outcome === "searching") return;
    if (plan.outcome === "squad") {
      sheet.append(sectionLabel("Squad"), ...plan.slots.map(slotRow), coins(), consequence());
    }
    if (plan.outcome === "short" && plan.blockingLock) {
      sheet.append(blockingLock(plan.blockingLock));
    }
    if (plan.outcome === "squad") {
      sheet.append(
        control("Review and confirm", () => actions.onReview(), {
          "data-fc-tone": "action",
          "data-fc-owned": "",
        }),
      );
    }
  };

  const drawConfirm = (sheet: HTMLElement, plan: ClubPlan) => {
    const heading = title("Submit this squad");
    const leave = consequence();
    sheet.append(heading, leave);
    const summary = el("p", { "data-fc-part": "summary" });
    const leaving = plan.slots.filter((slot) => slot.source !== "brick").length;
    summary.append(coinAmount(), doc.createTextNode(" "), coinWord(), doc.createTextNode(` ${leaving} cards `));
    const pack = el("span");
    pack.textContent = "The reward pack stays unopened.";
    summary.append(pack);
    sheet.append(summary, managerLine(plan), sectionLabel("Squad"), ...plan.slots.map(slotRow));
    for (const slot of plan.slots) {
      if (!slot.locked || slot.source === "brick") continue;
      sheet.append(includeOnce(slot.id, slot.name));
    }
    const check = el("p", { "data-fc-part": "page-check" });
    check.textContent = "The page check is what allows submit.";
    if (current.pageAgreed) check.append(iconPageAgreed());
    const confirm = control("Confirm", () => actions.onConfirm(), {
      "data-fc-tone": "action",
      "data-fc-owned": "",
    });
    const back = control("Back", () => actions.onBack(), {
      "data-fc-tone": "quiet",
      "data-fc-owned": "",
    });
    confirm.disabled = current.confirmBlockedReason !== null;
    sheet.append(check, confirm);
    if (current.confirmBlockedReason) {
      const reason = el("p", { "data-fc-part": "reason" });
      reason.textContent = current.confirmBlockedReason;
      sheet.append(reason);
    }
    sheet.append(back);
  };

  const includeOnce = (id: string, name: string) => {
    const row = el("div", { "data-fc-part": "include-once" });
    const nameEl = el("span");
    nameEl.textContent = name;
    const label = el("label");
    const input = doc.createElement("input");
    input.type = "checkbox";
    input.checked = current.includeOnceIds.includes(id);
    input.addEventListener("click", () => {
      actions.onIncludeOnce(id, input.checked);
    });
    label.append(input, doc.createTextNode(" Include this once"));
    const caption = el("span");
    caption.textContent = "The lock stays on.";
    row.append(nameEl, iconLocked(), label, caption);
    return row;
  };

  const blockingLock = (lock: { id: string; name: string }) => {
    const row = el("div", { "data-fc-part": "blocking-lock" });
    const nameEl = el("span");
    nameEl.textContent = lock.name;
    const label = el("label");
    const input = doc.createElement("input");
    input.type = "checkbox";
    input.checked = current.includeOnceIds.includes(lock.id);
    input.addEventListener("click", () => {
      actions.onIncludeOnce(lock.id, input.checked);
    });
    label.append(input, doc.createTextNode(" Include this once"));
    const caption = el("span");
    caption.textContent = "The lock stays on.";
    row.append(nameEl, iconLocked(), label, caption);
    return row;
  };

  const managerLine = (plan: ClubPlan) => {
    const line = el("p", { "data-fc-part": "manager" });
    if (plan.managerChanged) {
      line.dataset.changed = "true";
      line.textContent = `Manager changes to ${plan.managerName}`;
    } else {
      line.textContent = plan.managerName;
    }
    return line;
  };

  const slotRow = (slot: SquadSlot) => {
    const row = el("div", { "data-fc-part": "slot" });
    const position = el("span");
    position.textContent = slot.position;
    row.append(position);
    if (slot.source === "brick") {
      const brick = el("span");
      brick.textContent = "Brick";
      row.append(brick);
      return row;
    }
    const name = el("span");
    name.textContent = slot.name;
    const rating = el("span", { "data-fc-part": "rating" });
    rating.textContent = slot.rating === null ? "" : String(slot.rating);
    const source = el("span");
    source.textContent = slot.source === "storage" ? "Storage" : "Club";
    row.append(name, rating, source);
    return row;
  };

  const coins = () => {
    const row = el("p", { "data-fc-part": "coins" });
    row.append(coinAmount(), doc.createTextNode(" "), coinWord());
    return row;
  };

  const coinAmount = () => {
    const amount = el("span", { "data-fc-part": "coin-amount" });
    amount.textContent = "0";
    return amount;
  };

  const coinWord = () => {
    const word = el("span", { "data-fc-part": "coin-word" });
    word.textContent = "coins";
    return word;
  };

  const consequence = () => {
    const line = el("p", { "data-fc-part": "consequence" });
    line.textContent = "These cards leave the club.";
    return line;
  };

  const title = (text: string) => {
    const heading = el("h2", { "data-fc-part": "title" });
    heading.textContent = text;
    return heading;
  };

  const sectionLabel = (text: string) => {
    const label = el("p", { "data-fc-part": "section" });
    label.textContent = text;
    return label;
  };

  const control = (name: string, onClick: () => void, attrs: Record<string, string>) => {
    const node = el("button", { ...attrs, type: "button" }) as HTMLButtonElement;
    const label = el("span", { "data-fc-label": "" });
    label.textContent = name;
    node.append(label);
    node.addEventListener("click", () => {
      if (node.disabled) return;
      onClick();
    });
    return node;
  };

  const el = (tag: string, attrs: Record<string, string> = {}) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  const svg = (icon: string, markup: string) => {
    const node = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("data-icon", icon);
    node.setAttribute("viewBox", "0 0 16 16");
    node.setAttribute("width", "16");
    node.setAttribute("height", "16");
    node.setAttribute("aria-hidden", "true");
    node.innerHTML = markup;
    return node;
  };

  const iconStop = () => svg("stop", `<rect x="4" y="4" width="8" height="8" fill="currentColor"></rect>`);
  const iconSearching = () =>
    svg(
      "searching",
      `<circle cx="7" cy="7" r="3.25" fill="none" stroke="currentColor" stroke-width="1.5"></circle><path d="M10 10.5 L13 13.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
    );
  const iconSliders = () =>
    svg(
      "sliders",
      `<path d="M2 5 H14 M2 11 H14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path><circle cx="6" cy="5" r="1.6" fill="currentColor"></circle><circle cx="11" cy="11" r="1.6" fill="currentColor"></circle>`,
    );
  const iconLocked = () =>
    svg(
      "locked",
      `<rect x="3.5" y="7" width="9" height="6.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"></rect><path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
    );
  const iconUnlocked = () =>
    svg(
      "unlocked",
      `<rect x="3.5" y="7" width="9" height="6.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"></rect><path d="M5.5 7 V5 a2.5 2.5 0 0 1 4.6-1.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
    );
  const iconPageAgreed = () =>
    svg(
      "page-agreed",
      `<path d="M3 8.2 L6.4 11.6 L13 4.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>`,
    );

  render();

  return {
    update(next) {
      current = next;
      firstTeamDraft = next.firstTeamLocked;
      render();
    },
    destroy() {
      destroyed = true;
      clearDrawn();
      style.remove();
      for (const [card, previous] of cardStyles) {
        if (previous === null) card.removeAttribute("style");
        else card.setAttribute("style", previous);
      }
      cardStyles.clear();
    },
  };
}

function stopEnabled(state: ClubUiState): boolean {
  return state.dockStatus === "searching" || state.dockStatus === "plan-ready" || state.dockStatus === "paused";
}

function laneLeft(nav: HTMLElement): number {
  const box = nav.getBoundingClientRect().width;
  if (box > 0) return box;
  const parsed = Number.parseFloat(getComputedStyle(nav).width);
  if (parsed > 0) return parsed;
  const inline = Number.parseFloat(nav.style.width);
  return Number.isFinite(inline) ? inline : 0;
}
