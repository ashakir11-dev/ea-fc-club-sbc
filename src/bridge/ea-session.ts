import { CHECKABLE_REQUIREMENTS } from "./types.js";
import type {
  CardCopy,
  CardGender,
  CardKind,
  CardQuality,
  ChallengeView,
  ManagerView,
  PageActionResponse,
  PageAgreement,
  PageGate,
  PageSession,
  RequirementView,
  SquadSlot,
} from "./types.js";

export interface EaSearchCriteria {
  type: string;
  count: number;
  offset: number;
}

export interface EaHost {
  document?: { querySelector?: (selector: string) => { textContent?: string | null } | null };
  SBCEligibilityKey?: Record<string, unknown>;
  UTSearchCriteriaDTO?: new () => EaSearchCriteria;
  SearchType?: { PLAYER?: string; MANAGER?: string };
  getAppMain?: () => EaApp | undefined;
}

interface EaApp {
  getService?: () => EaServices;
  getRepository?: () => EaRepositories;
  getRootViewController?: () => unknown;
}

interface EaServices {
  Authentication?: { isLoggedIn?: () => boolean };
  User?: { getUser?: () => EaUser };
  Club?: { getStats?: () => unknown; search?: (criteria: EaSearchCriteria) => unknown };
  Item?: { searchStorageItems?: (criteria: EaSearchCriteria) => unknown };
  Squad?: { activeSquad?: string };
  SBC?: {
    repository?: { getSetById?: (id: number) => unknown };
    saveChallenge?: (challenge: unknown) => unknown;
    submitChallenge?: (challenge: unknown, set: unknown, skip: unknown, chemistry: unknown) => unknown;
  };
  UserSettings?: { getSBCValidationSkip?: () => unknown };
  Chemistry?: { isFeatureEnabled?: () => unknown };
}

interface EaUser {
  getSelectedPersona?: () => EaPersona;
  selectedPersona?: EaPersona;
}

interface EaPersona {
  id?: unknown;
  name?: unknown;
  clubName?: unknown;
}

interface EaRepositories {
  Squad?: {
    getFormation?: (formation: unknown) => { displayName?: string; name?: string } | undefined;
    squads?: { get?: (persona: unknown) => { get?: (id: unknown) => EaSquad } | undefined };
  };
  Item?: {
    club?: { items?: unknown };
    storage?: unknown;
  };
}

interface EaSquad {
  getFieldPlayers?: () => EaSlot[];
  getSlot?: (index: number) => EaSlot | undefined;
  getManager?: () => { item?: unknown };
  getRating?: () => unknown;
  getChemistry?: () => unknown;
  addItemToSlot?: (index: number, item: unknown) => void;
  setManager?: (item: unknown) => void;
}

interface EaSlot {
  index?: number;
  item?: { id?: unknown } | null;
  positionName?: unknown;
  isBrick?: () => boolean;
  getPositionName?: () => unknown;
  getItem?: () => { id?: unknown } | null;
}

const PAGE_SIZE = 200;
const LOGIN_SELECTOR = "[data-ea-login], .ut-login, .ut-logged-out, .ut-login-view";
const CAPTCHA_SELECTOR = "iframe[src*='captcha' i], .ut-captcha, [data-ea-captcha]";
const ERROR_SELECTOR = ".ut-error-dialog, .ea-dialog-view-error, [data-ea-error]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The page is not ready.";
}

function failureMessage(response: Record<string, unknown>): string {
  const error = isRecord(response.error) ? response.error : undefined;
  if (typeof error?.message === "string" && error.message) return error.message;
  if (typeof error?.code === "string" && error.code) return error.code;
  return "The page returned an error.";
}

function succeeded(response: Record<string, unknown>): boolean {
  return response.success === true;
}

function itemsOf(response: Record<string, unknown>): unknown[] {
  const nested = isRecord(response.response) ? response.response : isRecord(response.data) ? response.data : {};
  return Array.isArray(nested.items) ? nested.items : [];
}

function playerTotal(response: Record<string, unknown>): number {
  const nested = isRecord(response.response) ? response.response : isRecord(response.data) ? response.data : {};
  const stats = Array.isArray(nested.stats) ? nested.stats : [];
  const players = stats.find((stat) => isRecord(stat) && stat.type === "players");
  return isRecord(players) ? Number(players.count ?? 0) : 0;
}

function observe(observable: unknown, owner: unknown, timeoutMs: number): Promise<Record<string, unknown>> {
  if (!isRecord(observable) || typeof observable.observe !== "function") {
    return Promise.reject(new Error("the page did not answer"));
  }
  const subscribe = observable.observe as (
    owner: unknown,
    callback: (sender: { unobserve?: (owner: unknown) => void }, response: unknown) => void,
  ) => void;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("the page did not answer"));
    }, timeoutMs);
    try {
      subscribe(owner, (sender, response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          sender?.unobserve?.(owner);
        } catch {
          // Leave the page's dialog where it is.
        }
        resolve(isRecord(response) ? response : {});
      });
    } catch (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }
  });
}

function appOf(host: EaHost): EaApp {
  const app = host.getAppMain?.();
  if (!app) throw new Error("The page is not ready.");
  return app;
}

function servicesOf(host: EaHost): EaServices {
  const services = appOf(host).getService?.();
  if (!services) throw new Error("The page is not ready.");
  return services;
}

function criteriaFor(host: EaHost, type: string, offset: number): EaSearchCriteria {
  const Criteria = host.UTSearchCriteriaDTO;
  if (!Criteria) throw new Error("The page is not ready.");
  const criteria = new Criteria();
  criteria.type = type;
  criteria.count = PAGE_SIZE;
  criteria.offset = offset;
  return criteria;
}

function pushPosition(target: string[], value: unknown): void {
  if (typeof value === "string" && value && !target.includes(value)) target.push(value);
  if (Array.isArray(value)) {
    for (const entry of value) pushPosition(target, entry);
  }
}

function flag(item: Record<string, unknown>, name: string): boolean {
  const method = item[name];
  return typeof method === "function" ? Boolean(method.call(item)) : false;
}

function mapPlayer(item: unknown, source: CardCopy["source"]): CardCopy | null {
  if (!isRecord(item) || typeof item.isPlayer !== "function" || !item.isPlayer() || flag(item, "isManager")) {
    return null;
  }
  const positions: string[] = [];
  pushPosition(positions, item.preferredPosition);
  pushPosition(positions, item.possiblePositions);
  pushPosition(positions, item.positionModifiers);
  const rating = Number(item.rating ?? 0);
  const rareflag = Number(item.rareflag ?? 0);
  const untradeable = item.untradeable === true;
  const gender: CardGender = item.gender === 1 ? "woman" : item.gender === 0 ? "man" : "unknown";
  const kind: CardKind = flag(item, "isCornerstone")
    ? "cornerstone"
    : flag(item, "isIcon")
      ? "icon"
      : flag(item, "isHero")
        ? "hero"
        : "player";
  const quality: CardQuality = rating < 65 ? "bronze" : rating < 75 ? "silver" : "gold";
  return {
    itemId: String(item.id),
    definitionId: String(item.definitionId ?? ""),
    name: String(item.name ?? ""),
    rating,
    preferredPositions: positions,
    clubId: Number(item.teamId ?? 0),
    clubName: String(item.teamName ?? ""),
    leagueId: Number(item.leagueId ?? 0),
    leagueName: String(item.leagueName ?? ""),
    nationId: Number(item.nationId ?? 0),
    nationName: String(item.nationName ?? ""),
    rarityId: rareflag,
    quality,
    special: rareflag > 1,
    tradeable: !untradeable,
    untradeable,
    discardValue: Number(item.discardValue ?? 0),
    source,
    gender,
    kind,
    cornerstoneClubBoost: Number(item.cornerstoneClubLinks ?? 0),
    inFirstTeam: false,
  };
}

function mapManager(item: unknown): ManagerView | null {
  if (!isRecord(item) || item.id == null) return null;
  if (typeof item.isManager === "function" && !item.isManager()) return null;
  return {
    itemId: String(item.id),
    name: String(item.name ?? ""),
    nationId: Number(item.nationId ?? 0),
    leagueId: Number(item.leagueId ?? 0),
  };
}

function requirementKey(host: EaHost, raw: unknown): string {
  for (const [name, value] of Object.entries(host.SBCEligibilityKey ?? {})) {
    if (value === raw) return name;
  }
  return raw == null ? "UNKNOWN" : String(raw);
}

function mapRequirement(host: EaHost, requirement: unknown): RequirementView {
  const record = isRecord(requirement) ? requirement : {};
  const rawKey = typeof record.getFirstKey === "function" ? record.getFirstKey() : record.key;
  const key = requirementKey(host, rawKey);
  let pageMet: boolean | null = null;
  if (typeof record.isMet === "function") pageMet = Boolean(record.isMet());
  else if (typeof record.met === "boolean") pageMet = record.met;
  const value = typeof record.getValue === "function" ? record.getValue() : record.value;
  return {
    key,
    label: typeof record.label === "string" ? record.label : key,
    count: Number(record.count ?? 1),
    value: value == null ? "" : String(value),
    checkable: CHECKABLE_REQUIREMENTS.has(key),
    pageMet,
  };
}

function requirementsOf(host: EaHost, challenge: Record<string, unknown>): RequirementView[] {
  const list = Array.isArray(challenge.eligibilityRequirements) ? challenge.eligibilityRequirements : [];
  return list.map((requirement) => mapRequirement(host, requirement));
}

function slotItem(slot: EaSlot): { id?: unknown } | null {
  if (slot.item) return slot.item;
  return typeof slot.getItem === "function" ? slot.getItem() : null;
}

function mapSlots(squad: EaSquad): SquadSlot[] {
  const field = squad.getFieldPlayers?.() ?? [];
  return field.map((slot, index) => {
    const item = slotItem(slot);
    const position = typeof slot.getPositionName === "function" ? slot.getPositionName() : slot.positionName ?? index;
    return {
      index: typeof slot.index === "number" ? slot.index : index,
      position: String(position),
      brick: typeof slot.isBrick === "function" ? Boolean(slot.isBrick()) : false,
      itemId: item?.id != null ? String(item.id) : null,
    };
  });
}

function findChallenge(root: unknown): Record<string, unknown> | null {
  const seen = new Set<unknown>();
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!isRecord(current) || seen.has(current)) continue;
    seen.add(current);
    const challenge = isRecord(current._challenge) ? current._challenge : isRecord(current.challenge) ? current.challenge : null;
    if (challenge && isRecord(challenge.squad)) return challenge;
    for (const key of ["getPresentedViewController", "getCurrentViewController", "getCurrentController", "getChildViewController"]) {
      const method: unknown = current[key];
      if (typeof method === "function") {
        const next: unknown = Reflect.apply(method, current, []);
        if (next) stack.push(next);
      }
    }
  }
  return null;
}

function personaOf(services: EaServices): EaPersona {
  const user = services.User?.getUser?.();
  const persona = user?.getSelectedPersona?.() ?? user?.selectedPersona;
  if (!persona || persona.id == null) throw new Error("The page did not show a club.");
  return persona;
}

export function createEaPageSession(host: EaHost, options?: { timeoutMs?: number }): PageSession {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const owner = {};
  const known = new Map<string, Record<string, unknown>>();

  function remember(items: unknown[]): void {
    for (const item of items) {
      if (isRecord(item) && item.id != null) known.set(String(item.id), item);
    }
  }

  async function searchPile(
    run: (criteria: EaSearchCriteria) => unknown,
    type: string,
    total: number | null,
  ): Promise<unknown[]> {
    if (total === 0) return [];
    const collected: unknown[] = [];
    const cap = total ?? Number.POSITIVE_INFINITY;
    let offset = 0;
    while (collected.length < cap && offset <= 20000) {
      const response = await observe(run(criteriaFor(host, type, offset)), owner, timeoutMs);
      if (!succeeded(response)) throw new Error(failureMessage(response));
      const batch = itemsOf(response);
      collected.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    return total == null ? collected : collected.slice(0, total);
  }

  async function loadManagers(): Promise<ManagerView[]> {
    try {
      const services = servicesOf(host);
      const search = services.Club?.search;
      if (!search) return [];
      const type = host.SearchType?.MANAGER ?? "manager";
      const items = await searchPile((criteria) => search(criteria), type, null);
      remember(items);
      return items.map(mapManager).filter((manager): manager is ManagerView => manager !== null);
    } catch {
      return [];
    }
  }

  function currentChallenge(): Record<string, unknown> | null {
    return findChallenge(appOf(host).getRootViewController?.());
  }

  async function save(challenge: Record<string, unknown>): Promise<PageActionResponse> {
    const saveChallenge = servicesOf(host).SBC?.saveChallenge;
    if (!saveChallenge) return { success: false, message: "The page is not ready." };
    try {
      const response = await observe(saveChallenge(challenge), owner, timeoutMs);
      if (!succeeded(response)) return { success: false, message: failureMessage(response) };
      return { success: true };
    } catch (error) {
      return { success: false, message: messageOf(error) };
    }
  }

  return {
    async readGate() {
      const document = host.document;
      if (document?.querySelector?.(LOGIN_SELECTOR)) return { kind: "login" };
      if (document?.querySelector?.(CAPTCHA_SELECTOR)) return { kind: "captcha" };
      const error = document?.querySelector?.(ERROR_SELECTOR);
      if (error) {
        const message = String(error.textContent ?? "").trim() || "The page showed an error.";
        return { kind: "error", message };
      }
      const loggedIn = servicesOf(host).Authentication?.isLoggedIn?.();
      if (loggedIn === false) return { kind: "login" };
      return { kind: "clear" };
    },

    async readIdentity() {
      const persona = personaOf(servicesOf(host));
      const clubName = persona.clubName ?? persona.name ?? "Club";
      return { clubId: String(persona.id), clubName: String(clubName) };
    },

    async readClubCards() {
      const services = servicesOf(host);
      const statsCall = services.Club?.getStats;
      const search = services.Club?.search;
      if (!statsCall || !search) throw new Error("The page is not ready.");
      const stats = await observe(statsCall(), owner, timeoutMs);
      if (!succeeded(stats)) throw new Error(failureMessage(stats));
      const type = host.SearchType?.PLAYER ?? "player";
      const items = await searchPile((criteria) => search(criteria), type, playerTotal(stats));
      remember(items);
      return items.map((item) => mapPlayer(item, "club")).filter((card): card is CardCopy => card !== null);
    },

    async readStorageCards() {
      const search = servicesOf(host).Item?.searchStorageItems;
      if (!search) throw new Error("The page is not ready.");
      const type = host.SearchType?.PLAYER ?? "player";
      const items = await searchPile((criteria) => search(criteria), type, null);
      remember(items);
      return items.map((item) => mapPlayer(item, "storage")).filter((card): card is CardCopy => card !== null);
    },

    async readFirstTeam() {
      try {
        const services = servicesOf(host);
        const squads = appOf(host).getRepository?.()?.Squad?.squads;
        const persona = personaOf(services);
        const activeId = services.Squad?.activeSquad;
        const squad = squads?.get?.(persona)?.get?.(activeId);
        const field = squad?.getFieldPlayers?.();
        if (!field) return { available: false, itemIds: [] };
        const itemIds = field.slice(0, 11).flatMap((slot) => {
          const item = slotItem(slot);
          return item?.id == null ? [] : [String(item.id)];
        });
        return { available: true, itemIds };
      } catch {
        return { available: false, itemIds: [] };
      }
    },

    async readChallenge() {
      const challenge = currentChallenge();
      if (!challenge) return null;
      const squad = challenge.squad as EaSquad;
      const formation = appOf(host).getRepository?.()?.Squad?.getFormation?.(challenge.formation);
      const managerItem = squad.getManager?.()?.item;
      const rating = squad.getRating?.();
      const chemistry = squad.getChemistry?.();
      const pageChemistry = typeof chemistry === "number"
        ? chemistry
        : isRecord(chemistry) && typeof chemistry.chemistry === "number"
          ? chemistry.chemistry
          : null;
      const allowed = challenge.allowsManagerChange;
      return {
        id: String(challenge.id ?? ""),
        name: String(challenge.name ?? ""),
        formation: formation?.displayName || formation?.name || String(challenge.formation ?? ""),
        slots: mapSlots(squad),
        manager: mapManager(managerItem),
        managerChangeAllowed: typeof allowed === "function" ? Boolean(allowed.call(challenge)) : allowed === true,
        ownedManagers: await loadManagers(),
        requirements: requirementsOf(host, challenge),
        pageRating: typeof rating === "number" ? rating : null,
        pageChemistry,
      } satisfies ChallengeView;
    },

    async placeCard(itemId, slotIndex) {
      const challenge = currentChallenge();
      const squad = challenge?.squad as EaSquad | undefined;
      if (!challenge || !squad) return { success: false, message: "No challenge is open." };
      const slot = squad.getSlot?.(slotIndex);
      if (slot && typeof slot.isBrick === "function" && slot.isBrick()) {
        return { success: false, message: "A brick slot cannot be replaced." };
      }
      const item = known.get(itemId);
      if (!item) return { success: false, message: "That card is not in the club or SBC storage." };
      if (!squad.addItemToSlot) return { success: false, message: "The page is not ready." };
      squad.addItemToSlot(slotIndex, item);
      const placed = slot ? slotItem(slot) : null;
      if (!placed || String(placed.id) !== itemId) {
        return { success: false, message: "The page did not keep that card in the slot." };
      }
      return save(challenge);
    },

    async setManager(itemId) {
      const challenge = currentChallenge();
      const squad = challenge?.squad as EaSquad | undefined;
      if (!challenge || !squad) return { success: false, message: "No challenge is open." };
      const allowed = challenge.allowsManagerChange;
      const managerChangeAllowed = typeof allowed === "function" ? Boolean(allowed.call(challenge)) : allowed === true;
      if (!managerChangeAllowed) {
        return { success: false, message: "This challenge does not allow a manager change." };
      }
      if (!known.has(itemId)) await loadManagers();
      const item = known.get(itemId);
      if (!item) return { success: false, message: "That manager is not in the club." };
      if (!squad.setManager) return { success: false, message: "The page is not ready." };
      squad.setManager(item);
      return save(challenge);
    },

    async readAgreement() {
      const challenge = currentChallenge();
      if (!challenge) return { canSubmit: false, requirements: [] } satisfies PageAgreement;
      const canSubmit = typeof challenge.canSubmit === "function" ? Boolean(challenge.canSubmit()) : false;
      return { canSubmit, requirements: requirementsOf(host, challenge) };
    },

    async submit() {
      const challenge = currentChallenge();
      if (!challenge) return { success: false, message: "No challenge is open." };
      const requirements = requirementsOf(host, challenge);
      if (requirements.some((requirement) => !requirement.checkable)) {
        return { success: false, message: "A requirement on this challenge cannot be checked." };
      }
      const canSubmit = typeof challenge.canSubmit === "function" ? Boolean(challenge.canSubmit()) : false;
      if (!canSubmit || requirements.some((requirement) => requirement.pageMet === false)) {
        return { success: false, message: "The page did not accept this squad." };
      }
      const services = servicesOf(host);
      const set = services.SBC?.repository?.getSetById?.(Number(challenge.setId)) ?? challenge.set;
      const submitChallenge = services.SBC?.submitChallenge;
      if (!set || !submitChallenge) return { success: false, message: "The page is not ready." };
      try {
        const response = await observe(
          submitChallenge(
            challenge,
            set,
            services.UserSettings?.getSBCValidationSkip?.(),
            services.Chemistry?.isFeatureEnabled?.(),
          ),
          owner,
          timeoutMs,
        );
        if (!succeeded(response)) return { success: false, message: failureMessage(response) };
        return { success: true };
      } catch (error) {
        return { success: false, message: messageOf(error) };
      }
    },
  };
}

export type { PageGate };
