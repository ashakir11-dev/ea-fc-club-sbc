export type CardSource = "club" | "storage";
export type CardQuality = "bronze" | "silver" | "gold";
export type CardGender = "woman" | "man" | "unknown";
export type CardKind = "player" | "icon" | "hero" | "cornerstone";

export interface CardCopy {
  itemId: string;
  definitionId: string;
  name: string;
  rating: number;
  preferredPositions: string[];
  clubId: number;
  clubName: string;
  leagueId: number;
  leagueName: string;
  nationId: number;
  nationName: string;
  rarityId: number;
  quality: CardQuality;
  special: boolean;
  tradeable: boolean;
  untradeable: boolean;
  discardValue: number;
  source: CardSource;
  gender: CardGender;
  kind: CardKind;
  cornerstoneClubBoost: number;
  inFirstTeam: boolean;
}

export interface RequirementView {
  key: string;
  label: string;
  count: number;
  value: string;
  checkable: boolean;
  pageMet: boolean | null;
}

export interface SquadSlot {
  index: number;
  position: string;
  brick: boolean;
  itemId: string | null;
}

export interface ManagerView {
  itemId: string;
  name: string;
  nationId: number;
  leagueId: number;
}

export interface ChallengeView {
  id: string;
  name: string;
  formation: string;
  slots: SquadSlot[];
  manager: ManagerView | null;
  managerChangeAllowed: boolean;
  ownedManagers: ManagerView[];
  requirements: RequirementView[];
  pageRating: number | null;
  pageChemistry: number | null;
}

export interface ClubSnapshot {
  clubId: string;
  clubName: string;
  cards: CardCopy[];
  storage: CardCopy[];
  firstTeamAvailable: boolean;
  firstTeamItemIds: string[];
  challenge: ChallengeView | null;
}

export type PageGate =
  | { kind: "clear" }
  | { kind: "login" }
  | { kind: "captcha" }
  | { kind: "error"; message: string };

export interface PageActionResponse {
  success: boolean;
  message?: string;
}

export interface PageAgreement {
  canSubmit: boolean;
  requirements: RequirementView[];
}

export interface PageSession {
  readGate(): Promise<PageGate>;
  readIdentity(): Promise<{ clubId: string; clubName: string }>;
  readClubCards(): Promise<CardCopy[]>;
  readStorageCards(): Promise<CardCopy[]>;
  readFirstTeam(): Promise<{ available: boolean; itemIds: string[] }>;
  readChallenge(): Promise<ChallengeView | null>;
  placeCard(itemId: string, slotIndex: number): Promise<PageActionResponse>;
  setManager(itemId: string): Promise<PageActionResponse>;
  readAgreement(): Promise<PageAgreement>;
  submit(): Promise<PageActionResponse>;
}

export type ActionReason =
  | "page-blocked"
  | "page-disagreed"
  | "page-error"
  | "failures"
  | "stopped"
  | "brick"
  | "uncheckable"
  | "unavailable"
  | "manager-locked";

export interface ActionResult {
  ok: boolean;
  submitted: boolean;
  reason?: ActionReason;
  message: string;
  pageMessage?: string;
  consecutiveFailures: number;
}

export type SnapshotResult =
  | { ok: true; snapshot: ClubSnapshot }
  | {
      ok: false;
      reason: "page-blocked" | "unavailable";
      message: string;
      pageGate: PageGate;
    };

export const CHECKABLE_REQUIREMENTS: ReadonlySet<string> = new Set([
  "TEAM_RATING",
  "PLAYER_MIN_OVR",
  "PLAYER_MAX_OVR",
  "PLAYER_EXACT_OVR",
  "CHEMISTRY_POINTS",
  "LEAGUE_ID",
  "NATION_ID",
  "CLUB_ID",
  "SAME_LEAGUE_COUNT",
  "SAME_NATION_COUNT",
  "SAME_CLUB_COUNT",
  "PLAYER_RARITY",
  "PLAYER_RARITY_GROUP",
  "PLAYER_QUALITY",
  "PLAYER_LEVEL",
  "PLAYER_NAME",
  "PLAYER_DEFINITION",
  "PLAYER_ID",
  "PLAYER_COUNT",
  "QUALITY",
  "RARITY",
]);

export type HaltReason = Exclude<ActionReason, "page-error">;
