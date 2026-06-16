import { addGoal, generateQuestOffers, makeInitialState, updateHost } from "../engine";
import { readSystemDirector } from "../director";

describe("system director read", () => {
  test("summarizes arc, next move, risk, history, and location", () => {
    let s = addGoal(makeInitialState(), "Build a useful mobile system", "craft");
    s = updateHost(s, { ...s.host, energy: 0.65, focus: 0.6, stress: 0.25, timeAvailableMinutes: 30 });
    s = generateQuestOffers(s);
    const read = readSystemDirector(s);
    expect(read.headline).toMatch(/Build a useful mobile system/);
    expect(read.nextMove.length).toBeGreaterThan(10);
    expect(read.risk).toMatch(/risk/i);
    expect(read.advisors.map((advisor) => advisor.name)).toEqual(["Strategist", "Guardian", "Scout", "Archivist"]);
  });

  test("location signal explains novel territory", () => {
    const s = {
      ...makeInitialState(),
      profile: { ...makeInitialState().profile, preferences: { ...makeInitialState().profile.preferences, locationQuests: true } },
      systemSignals: { ...makeInitialState().systemSignals, currentCellNovel: true }
    };
    expect(readSystemDirector(s).location).toMatch(/new territory/i);
  });
});
