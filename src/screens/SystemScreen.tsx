import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { domains } from "../engine";
import { QuestDomain } from "../types";
import { domainColors, styles } from "../theme";
import { Chip, GhostButton, MiniAction, Panel, PrimaryButton, Segmented, SystemMessage } from "../components/common";
import { useStore } from "../state/store";
import { familiarityOf } from "../voice";
import { characterNudge } from "../activities";
import { readSystemDirector } from "../director";

export function SystemScreen() {
  const { state, dispatch } = useStore();
  const [goal, setGoal] = useState("");
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const liveGoals = state.profile.goals.filter((g) => g.status !== "archived");
  const archivedGoals = state.profile.goals.filter((g) => g.status === "archived");

  function confirmDelete(goalId: string, text: string) {
    Alert.alert("Delete goal?", `"${text}" will be removed permanently. Its quest history stays in the chronicle.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void dispatch({ type: "DELETE_GOAL", goalId }) }
    ]);
  }
  const [domain, setDomain] = useState<QuestDomain>("craft");
  const nudge = characterNudge(state);
  const director = readSystemDirector(state);
  const selectedGoal =
    state.profile.goals.find((item) => item.id === state.selectedGoalId && item.status === "active") ??
    state.profile.goals.find((item) => item.status === "active");
  const loop = state.dailyLoop;

  function timeLabel(time: number | null) {
    return time ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "pending";
  }

  function registerGoal() {
    if (!goal.trim()) {
      Alert.alert("Goal required", "Enter one active goal first.");
      return;
    }
    void dispatch({ type: "ADD_GOAL", text: goal, domain });
    setGoal("");
  }

  return (
    <View>
      <SystemMessage text={state.lastSystemMessage} />
      <Chip label={`Voice: ${familiarityOf(state).label}`} />
      <Panel title="System Read" icon="sparkles">
        <Text style={styles.questText}>{director.headline}</Text>
        <Text style={styles.bodyText}>{director.arc}</Text>
        <Text style={styles.sectionLabel}>Next Move</Text>
        <Text style={styles.bodyText}>{director.nextMove}</Text>
        <View style={styles.questMeta}>
          {director.focusDomain ? <Chip label={director.focusDomain} tone={domainColors[director.focusDomain]} active /> : null}
          <Chip label={director.risk} />
        </View>
        {director.advisors.map((advisor) => (
          <Text key={advisor.name} style={styles.criteriaLine}>- {advisor.name}: {advisor.line}</Text>
        ))}
      </Panel>
      <Panel title="Today" icon="pulse">
        {loop.missedYesterday ? (
          <Text style={styles.muted}>Yesterday had an open quest window without a review. No penalty; the loop simply starts clean today.</Text>
        ) : null}
        {[
          ["Morning scan", loop.morningScanAt],
          ["Quest offered", loop.questOfferedAt],
          ["Evening review", loop.eveningReviewAt]
        ].map(([label, time]) => (
          <View key={String(label)} style={styles.statRow}>
            <Text style={styles.statName}>{String(label)}</Text>
            <Chip label={time ? timeLabel(time as number) : "pending"} active={Boolean(time)} />
          </View>
        ))}
        <View style={styles.rowGap}>
          <PrimaryButton icon="sparkles" label="Offer Today's Quest" onPress={() => void dispatch({ type: "GENERATE_QUEST" })} />
        </View>
      </Panel>
      <Panel title="Goals" icon="flag">
        {liveGoals.length === 0 ? (
          <Text style={styles.muted}>No goals yet. Add one below or from the activity browser.</Text>
        ) : (
          <Text style={styles.muted}>Tap a goal to manage it.</Text>
        )}
        {liveGoals.map((g) => {
          const expanded = expandedGoalId === g.id;
          return (
            <View key={g.id} style={styles.assumptionCard}>
              <Pressable onPress={() => setExpandedGoalId(expanded ? null : g.id)}>
                <Text style={styles.bodyText} numberOfLines={expanded ? undefined : 2}>{g.text}</Text>
                <View style={styles.questMeta}>
                  <Chip label={g.domain} tone={domainColors[g.domain]} />
                  <Chip label={`P${g.priority}`} />
                  {g.status !== "active" ? <Chip label={g.status} /> : null}
                  {state.selectedGoalId === g.id ? <Chip label="focused" active /> : null}
                </View>
              </Pressable>
              {expanded ? (
                <View>
                  <Segmented
                    value={String(g.priority)}
                    onChange={(value) => void dispatch({ type: "UPDATE_GOAL", goalId: g.id, patch: { priority: Number(value) } })}
                    options={[1, 2, 3].map((priorityLevel) => ({ value: String(priorityLevel), label: ["Low", "Mid", "High"][priorityLevel - 1] }))}
                  />
                  <View style={styles.questMeta}>
                    {g.status === "active" ? (
                      <MiniAction label="Focus next" tone="primary" onPress={() => void dispatch({ type: "PATCH", patch: { selectedGoalId: g.id, goalPinned: true } })} />
                    ) : null}
                    {g.status === "active" ? (
                      <MiniAction label="Pause" onPress={() => void dispatch({ type: "UPDATE_GOAL", goalId: g.id, patch: { status: "paused" } })} />
                    ) : g.status === "paused" ? (
                      <MiniAction label="Resume" onPress={() => void dispatch({ type: "UPDATE_GOAL", goalId: g.id, patch: { status: "active" } })} />
                    ) : null}
                    {g.status !== "done" ? (
                      <MiniAction label="Done" onPress={() => void dispatch({ type: "UPDATE_GOAL", goalId: g.id, patch: { status: "done" } })} />
                    ) : null}
                    <MiniAction label="Archive" onPress={() => void dispatch({ type: "UPDATE_GOAL", goalId: g.id, patch: { status: "archived" } })} />
                    <MiniAction label="Delete" tone="danger" onPress={() => confirmDelete(g.id, g.text)} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
        {archivedGoals.length > 0 ? (
          <View>
            <MiniAction
              label={showArchived ? `Hide archived (${archivedGoals.length})` : `Show archived (${archivedGoals.length})`}
              onPress={() => setShowArchived(!showArchived)}
            />
            {showArchived
              ? archivedGoals.map((g) => (
                  <View key={g.id} style={styles.assumptionCard}>
                    <Text style={styles.muted} numberOfLines={2}>{g.text}</Text>
                    <View style={styles.questMeta}>
                      <Chip label={g.domain} tone={domainColors[g.domain]} />
                      <MiniAction label="Restore" tone="primary" onPress={() => void dispatch({ type: "UPDATE_GOAL", goalId: g.id, patch: { status: "active" } })} />
                      <MiniAction label="Delete" tone="danger" onPress={() => confirmDelete(g.id, g.text)} />
                    </View>
                  </View>
                ))
              : null}
          </View>
        ) : null}
      </Panel>

      {nudge ? (
        <Panel title="System Guidance" icon="sparkles">
          <Text style={styles.bodyText}>{nudge.text}</Text>
          <View style={styles.questMeta}>
            {nudge.activities.map((activity) => (
              <Chip key={activity.id} label={activity.label} />
            ))}
          </View>
          <Text style={styles.muted}>Open the Quest Board and pick one to quest in it.</Text>
        </Panel>
      ) : null}
      <Panel title="Your Main Goal" icon="compass">
        <Text style={styles.bodyText}>
          {selectedGoal ? selectedGoal.text : "No goal set yet."}
        </Text>
        {selectedGoal?.arc && (
          <View style={styles.arcBox}>
            <Text style={styles.arcTitle}>{selectedGoal.arc.title}</Text>
            <View style={styles.questMeta}>
              <Chip label={`Phase: ${selectedGoal.arc.currentPhase}`} />
              <Chip label={`Sticking point: ${selectedGoal.arc.bottleneck}`} />
            </View>
            <Text style={styles.sectionLabel}>Weekly Focus</Text>
            <Text style={styles.bodyText}>{selectedGoal.arc.weeklyFocus}</Text>
            <Text style={styles.sectionLabel}>Questline</Text>
            {selectedGoal.arc.milestones.map((milestone, index) => (
              <View key={milestone.id} style={styles.milestoneRow}>
                <View style={[styles.milestoneDot, milestone.status === "active" && styles.milestoneDotActive]}>
                  <Text style={styles.milestoneDotText}>{index + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{milestone.label}</Text>
                  <Text style={styles.bodyText}>{milestone.objective}</Text>
                </View>
                <Text style={styles.milestoneStatus}>{milestone.status}</Text>
              </View>
            ))}
            <Text style={styles.sectionLabel}>Next Actions</Text>
            {selectedGoal.arc.nextActions.map((action) => (
              <Text key={action} style={styles.criteriaLine}>- {action}</Text>
            ))}
          </View>
        )}
        <TextInput
          value={goal}
          onChangeText={setGoal}
          placeholder="Example: build and publish my first AI mobile app"
          placeholderTextColor="#64748b"
          multiline
          style={styles.input}
        />
        <Segmented
          value={domain}
          onChange={(value) => setDomain(value as QuestDomain)}
          options={domains.map((item) => ({ value: item.id, label: item.label }))}
        />
        <PrimaryButton icon="add-circle" label="Add Goal" onPress={registerGoal} />
        <View style={styles.rowGap}>
          <GhostButton icon="sparkles" label="Suggest a Goal for Me" onPress={() => void dispatch({ type: "GENERATE_SYSTEM_GOAL" })} />
        </View>
      </Panel>

      <Panel title="What I've Learned About You" icon="shield-checkmark">
        {state.assumptions.length === 0 ? (
          <Text style={styles.bodyText}>Nothing here yet. Finish a few quests and I'll start to learn what works for you.</Text>
        ) : (
          state.assumptions.map((assumption) => (
            <View key={assumption.id} style={styles.assumptionCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.stepTitle}>{assumption.label}</Text>
                <Chip label={`${Math.round(assumption.confidence * 100)}%`} />
              </View>
              <Text style={styles.bodyText}>{assumption.value}</Text>
              <Text style={styles.muted}>
                Evidence {assumption.evidenceCount} | {assumption.protected ? "Protected" : "Editable"}
              </Text>
              <View style={styles.inlineActions}>
                <GhostButton icon="checkmark-circle" label="Confirm" onPress={() => void dispatch({ type: "UPDATE_ASSUMPTION", id: assumption.id, action: "confirm" })} />
                <GhostButton icon="shield-checkmark" label={assumption.protected ? "Unprotect" : "Protect"} onPress={() => void dispatch({ type: "UPDATE_ASSUMPTION", id: assumption.id, action: "protect" })} />
                <GhostButton icon="close-circle" label="Reject" onPress={() => void dispatch({ type: "UPDATE_ASSUMPTION", id: assumption.id, action: "reject" })} />
              </View>
            </View>
          ))
        )}
      </Panel>
    </View>
  );
}
