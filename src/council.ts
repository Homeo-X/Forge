import { AppState, Goal, Quest } from "./types";

/**
 * Deterministic council layer: each advisor adjusts offer ranking from one
 * concern. Notes are short tags only; full prose belongs in Director panels,
 * not inside quest cards.
 */
export interface AdvisorVote {
  advisor: string;
  /** Multiplicative adjustment around 1.0 (0.8 = discourage, 1.2 = champion). */
  weight: number;
  /** Short internal tag, safe to show as a chip if needed. */
  note: string;
}

interface Advisor {
  name: string;
  vote: (offer: Quest, state: AppState, goal: Goal) => AdvisorVote | null;
}

const strategist: Advisor = {
  name: "Strategist",
  vote: (offer, _state, goal) => {
    if (!goal.arc) return null;
    const aligned = offer.domain === goal.domain;
    return {
      advisor: "Strategist",
      weight: aligned ? 1.15 : 0.95,
      note: aligned ? `${goal.arc.currentPhase} phase` : "Side path"
    };
  }
};

const guardian: Advisor = {
  name: "Guardian",
  vote: (offer, state) => {
    const tired = state.host.energy < 0.35 || state.host.recoveryNeed > 0.65;
    if (!tired) return null;
    const restful = offer.domain === "recovery" || offer.mode === "recover";
    return {
      advisor: "Guardian",
      weight: restful ? 1.3 : 0.75,
      note: restful ? "Recovery fit" : "Heavy today"
    };
  }
};

const quartermaster: Advisor = {
  name: "Quartermaster",
  vote: (offer, state) => {
    const have = state.host.timeAvailableMinutes;
    const need = offer.timeLimitMinutes;
    if (need <= have * 0.9) return null;
    return {
      advisor: "Quartermaster",
      weight: need > have ? 0.8 : 0.92,
      note: need > have ? "Too long" : "Close time fit"
    };
  }
};

const chronicler: Advisor = {
  name: "Chronicler",
  vote: (offer, state) => {
    const recent = state.questHistory.slice(0, 5);
    if (recent.length < 3) return null;
    const repeats = recent.filter((q) => q.domain === offer.domain).length;
    if (repeats >= 3) {
      return { advisor: "Chronicler", weight: 0.9, note: "Repeated domain" };
    }
    if (repeats === 0) {
      return { advisor: "Chronicler", weight: 1.1, note: "Fresh domain" };
    }
    return null;
  }
};

const warden: Advisor = {
  name: "Warden",
  vote: (offer, state) => {
    const avoidance = state.systemSignals.domainAvoidance[offer.domain] ?? 0;
    if (avoidance < 2) return null;
    return { advisor: "Warden", weight: 1.2, note: "Avoidance break" };
  }
};

const scout: Advisor = {
  name: "Scout",
  vote: (offer, state) => {
    if (!state.systemSignals.currentCellNovel || offer.domain !== "exploration") return null;
    return { advisor: "Scout", weight: 1.18, note: "New territory" };
  }
};

const COUNCIL: Advisor[] = [strategist, guardian, quartermaster, chronicler, warden, scout];

export interface Deliberation {
  /** Offers re-ranked by council-adjusted score (pinned first item preserved). */
  offers: Quest[];
}

export function deliberate(offers: Quest[], state: AppState, goal: Goal, pinnedFirst: boolean): Deliberation {
  const judged = offers.map((offer, index) => {
    const votes = COUNCIL.map((a) => a.vote(offer, state, goal)).filter((v): v is AdvisorVote => v !== null);
    const adjusted = votes.reduce((score, v) => score * v.weight, offer.acceptanceScore);
    const strongest = votes.sort((a, b) => Math.abs(b.weight - 1) - Math.abs(a.weight - 1))[0];
    const councilNote = strongest?.note;
    return { offer: { ...offer, councilNote, councilScore: adjusted }, adjusted, index };
  });

  const head = pinnedFirst ? judged.slice(0, 1) : [];
  const tail = (pinnedFirst ? judged.slice(1) : judged).sort((a, b) => b.adjusted - a.adjusted);
  return { offers: [...head, ...tail].map((j) => j.offer) };
}
