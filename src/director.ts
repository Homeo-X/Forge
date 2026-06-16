import { domains } from "./engine";
import { AppState, EvidenceRecord, Goal, Quest, QuestDomain } from "./types";

export interface SystemDirectorRead {
  headline: string;
  arc: string;
  nextMove: string;
  focusDomain: QuestDomain | null;
  risk: string;
  location: string;
  history: string;
  advisors: Array<{ name: string; line: string }>;
}

function domainLabel(domain: QuestDomain | null) {
  if (!domain) return "No domain";
  return domains.find((item) => item.id === domain)?.label ?? domain;
}

function activeGoal(state: AppState): Goal | null {
  return (
    state.profile.goals.find((goal) => goal.id === state.selectedGoalId && goal.status === "active") ??
    state.profile.goals.find((goal) => goal.status === "active") ??
    null
  );
}

function topOffer(state: AppState): Quest | null {
  return state.questOffers[0] ?? state.activeQuest ?? null;
}

function completionRate(state: AppState) {
  const recent = state.questHistory.slice(0, 10);
  if (!recent.length) return null;
  const completed = recent.filter((quest) => quest.status === "completed").length;
  return completed / recent.length;
}

function strongestEvidence(records: EvidenceRecord[]) {
  if (!records.length) return null;
  const counts = records.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function historyLine(state: AppState) {
  const rate = completionRate(state);
  if (rate === null) return "No pattern yet. The System needs a few logged quests before it can read your rhythm.";
  const evidence = strongestEvidence(state.evidenceLog);
  const evidenceNote = evidence ? ` Strongest evidence stream: ${evidence}.` : "";
  if (rate >= 0.7) return `Your recent follow-through is strong. Keep the quest small enough to preserve momentum.${evidenceNote}`;
  if (rate >= 0.4) return `Your recent pattern is mixed. A clear, short quest is better than a heroic one.${evidenceNote}`;
  return `Recent quests are meeting resistance. The next move should reduce friction, not raise pressure.${evidenceNote}`;
}

function locationLine(state: AppState) {
  if (!state.profile.preferences.locationQuests) return "Location layer is off. Exploration can still work, but it stays trust-based.";
  if (state.systemSignals.currentCellNovel) return "You are in new territory. Exploration quests get a real boost here.";
  if (state.world.currentCellId) return `You are in known territory (${state.world.currentCellId}). The map remembers this area.`;
  return "Location layer is ready, but no cell has been sampled yet.";
}

function riskLine(state: AppState, offer: Quest | null) {
  const ceiling = state.profile.preferences.maxRiskTier ?? 4;
  if (!offer) return `Risk ceiling is ${ceiling}. No quest is currently selected.`;
  if (offer.riskTier >= 3) return `Current best quest is risk ${offer.riskTier}. It requires explicit consent before starting.`;
  return `Current best quest is risk ${offer.riskTier}, inside your risk ceiling of ${ceiling}.`;
}

function nextMoveLine(state: AppState, goal: Goal | null, offer: Quest | null) {
  if (!goal) return "Create or resume one active goal; the System cannot choose a real next move without an arc.";
  if (state.activeQuests.length > 0) return `Finish or review "${state.activeQuests[0].title}" before opening more loops.`;
  if (offer) return `Best next move: ${offer.title}. ${offer.timeLimitMinutes} minutes, ${offer.difficultyBand} path.`;
  return "Run a check-in or ask for today's quest so the System can choose a concrete move.";
}

export function readSystemDirector(state: AppState): SystemDirectorRead {
  const goal = activeGoal(state);
  const offer = topOffer(state);
  const focusDomain = offer?.domain ?? goal?.domain ?? null;
  const headline = goal
    ? `Current arc: ${goal.text}`
    : "No active arc registered.";
  const arc = goal
    ? `${goal.arc.currentPhase}: ${goal.arc.weeklyFocus}`
    : "Register a goal manually, or let the System suggest one.";
  const nextMove = nextMoveLine(state, goal, offer);
  const location = locationLine(state);
  const history = historyLine(state);
  const risk = riskLine(state, offer);
  const advisors = [
    { name: "Strategist", line: focusDomain ? `${domainLabel(focusDomain)} is the cleanest domain for the next move.` : "Waiting for a domain signal." },
    { name: "Guardian", line: risk },
    { name: "Scout", line: location },
    { name: "Archivist", line: history }
  ];

  return { headline, arc, nextMove, focusDomain, risk, location, history, advisors };
}
