import React from "react";
import { Text, View } from "react-native";

import { styles } from "../theme";
import { AnimatedMeter, Panel } from "../components/common";
import { useStore } from "../state/store";
import { visibleSkillsByStat } from "../skills";

const difficultyLabels: Record<string, { label: string; help: string }> = {
  time: { label: "Available time", help: "Shorter quests when you usually have less time." },
  energy: { label: "Energy level", help: "Smaller quests when energy is low." },
  focus: { label: "Focus level", help: "Clearer quests when focus is low." },
  emotional: { label: "Mood load", help: "Calmer quests when stress is high." },
  social: { label: "People readiness", help: "Fewer social quests when they feel heavy." },
  physical: { label: "Body readiness", help: "Gentler body/outdoor quests when needed." },
  activation: { label: "Easy to start", help: "Simpler first steps when starting is hard." }
};

function questSizeTone(score: number) {
  if (score < 0.44) return "Easier quests today";
  if (score > 0.58) return "A little more challenge";
  return "Normal quest size";
}

function questSizeReason(name: string, value: number) {
  const lower = value < 0.5;
  switch (name) {
    case "time":
      return lower ? "less time available" : "more time available";
    case "energy":
      return lower ? "energy is lower" : "energy is stronger";
    case "focus":
      return lower ? "focus needs support" : "focus looks steady";
    case "emotional":
      return lower ? "mood needs gentler pacing" : "mood can hold more";
    case "social":
      return lower ? "people-facing quests need care" : "social quests are easier";
    case "physical":
      return lower ? "body/outdoor quests need care" : "body/outdoor quests are easier";
    case "activation":
      return lower ? "starting needs to be simpler" : "starting looks easier";
    default:
      return difficultyLabels[name]?.label.toLowerCase() ?? name;
  }
}

export function SheetScreen() {
  const { state } = useStore();
  const xpPercent = Math.min(100, Math.round((state.progression.xp / state.progression.xpToNext) * 100));
  const statRows = Object.entries(state.progression.stats);
  const visibleSkills = visibleSkillsByStat(state.progression.unlockedSkills);
  const calibrationEntries = Object.entries(state.profile.difficultyCalibration);
  const calibrationAverage =
    calibrationEntries.reduce((total, [, value]) => total + value, 0) / Math.max(1, calibrationEntries.length);
  const strongestDrivers = calibrationEntries
    .map(([name, value]) => ({ name, value, distance: Math.abs(value - 0.5) }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3);

  return (
    <View>
      <Panel title="Character Sheet" icon="person">
        <Text style={styles.bigNumber}>Level {state.progression.level}</Text>
        <Text style={styles.bodyText}>
          Class: {state.progression.classPath.inferred ?? "Initiate"}
        </Text>
        <AnimatedMeter percent={xpPercent} />
        <Text style={styles.muted}>{state.progression.xp} / {state.progression.xpToNext} XP</Text>
      </Panel>

      <Panel title="Stats" icon="bar-chart">
        {statRows.map(([name, value]) => (
          <View key={name} style={styles.statRow}>
            <Text style={styles.statName}>{name}</Text>
            <Text style={styles.statValue}>{value}</Text>
          </View>
        ))}
      </Panel>

      <Panel title="Awakened Abilities" icon="sparkles">
        {Object.keys(visibleSkills).length === 0 ? (
          <Text style={styles.bodyText}>No abilities awakened yet. Future abilities stay hidden until you cross their requirement.</Text>
        ) : null}
        {Object.entries(visibleSkills).map(([stat, skills]) => {
          const statValue = state.progression.stats[stat as keyof typeof state.progression.stats] ?? 0;
          return (
            <View key={stat} style={{ marginBottom: 10 }}>
              <Text style={styles.sectionLabel}>{stat} - {statValue}</Text>
              {skills.map((skill) => (
                <Text key={skill.id} style={styles.criteriaLine}>
                  * {skill.label}: {skill.description.replace(/\s*\(marker.*?\)/i, "")}
                </Text>
              ))}
            </View>
          );
        })}
      </Panel>

      <Panel title="Quest Size Settings" icon="pulse">
        <Text style={styles.bodyText}>How hard Forge is making your next quests.</Text>
        <View style={styles.statRow}>
          <Text style={styles.statName}>Current setting</Text>
          <Text style={styles.statValue}>{questSizeTone(calibrationAverage)}</Text>
        </View>
        {strongestDrivers.map(({ name, value }) => (
          <View key={name} style={styles.statRow}>
            <Text style={styles.muted}>{questSizeReason(name, value)}</Text>
            <Text style={styles.statValue}>{Math.round(value * 100)}</Text>
          </View>
        ))}
        {state.profile.knownPatterns.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Usually Works</Text>
            {state.profile.knownPatterns.slice(0, 2).map((item) => (
              <Text key={item} style={styles.criteriaLine}>- {item}</Text>
            ))}
          </>
        ) : null}
        {state.profile.resistancePatterns.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Often Gets Blocked</Text>
            {state.profile.resistancePatterns.slice(0, 2).map((item) => (
              <Text key={item} style={styles.criteriaLine}>- {item}</Text>
            ))}
          </>
        ) : null}
        {state.adaptationLog.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Recent Changes</Text>
            {state.adaptationLog.slice(0, 2).map((item, index) => (
              <Text key={`${item}_${index}`} style={styles.criteriaLine}>- {item}</Text>
            ))}
          </>
        ) : null}
      </Panel>
    </View>
  );
}
