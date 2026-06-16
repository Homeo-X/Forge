import React, { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { questModes, quickCheckinHostForToday } from "../engine";
import { HostState, QuestMode } from "../types";
import { styles } from "../theme";
import { Metric, Panel, PrimaryButton, Segmented, SystemMessage } from "../components/common";
import { useStore } from "../state/store";
import { BodySection } from "./BodySection";

const MOODS = ["low", "flat", "steady", "good", "charged"];

export function CheckinScreen() {
  const { state, dispatch } = useStore();
  const [host, setHost] = useState<HostState>(() => quickCheckinHostForToday(state));

  useEffect(() => {
    setHost(quickCheckinHostForToday(state));
  }, [state.dailyLoop.date, state.dailyLoop.morningScanAt, state.host.scannedAt]);

  const setNumber = (key: keyof HostState, value: number) => {
    setHost((current) => ({ ...current, [key]: value }));
  };

  function saveScan() {
    void dispatch({ type: "SAVE_SCAN", host });
  }

  const latestSaved = state.hostHistory[0] ?? state.host;

  return (
    <View>
      <SystemMessage text="Check in on how you're doing before getting a quest." />
      <Panel title="Saved Check-in" icon="scan">
        {state.hostHistory.length === 0 ? (
          <Text style={styles.bodyText}>No saved check-ins yet. Save one below and it will appear here.</Text>
        ) : (
          <View>
            <Text style={styles.bodyText}>
              Last saved {new Date(latestSaved.scannedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </Text>
            <View style={styles.questMeta}>
              <Text style={styles.muted}>Energy {Math.round(latestSaved.energy * 100)}%</Text>
              <Text style={styles.muted}>Focus {Math.round(latestSaved.focus * 100)}%</Text>
              <Text style={styles.muted}>Stress {Math.round(latestSaved.stress * 100)}%</Text>
              <Text style={styles.muted}>Mood {latestSaved.mood}</Text>
            </View>
          </View>
        )}
      </Panel>
      <Panel title="Quick Check-in" icon="pulse">
        <Metric label="Energy" value={host.energy} setValue={(value) => setNumber("energy", value)} />
        <Metric label="Focus" value={host.focus} setValue={(value) => setNumber("focus", value)} />
        <Metric label="Stress" value={host.stress} setValue={(value) => setNumber("stress", value)} />
        <Metric label="Need to Rest" value={host.recoveryNeed} setValue={(value) => setNumber("recoveryNeed", value)} />
        <Metric label="Up for a Challenge" value={host.challengeReadiness} setValue={(value) => setNumber("challengeReadiness", value)} />
        <Metric label="Body Feels" value={host.bodyStatus} setValue={(value) => setNumber("bodyStatus", value)} />
        <Metric label="Up for People" value={host.socialReadiness} setValue={(value) => setNumber("socialReadiness", value)} />
        <Metric label="Creative Spark" value={host.creativeReadiness} setValue={(value) => setNumber("creativeReadiness", value)} />
        <Text style={styles.muted}>Mood</Text>
        <Segmented
          options={MOODS.map((m) => ({ value: m, label: m }))}
          value={MOODS.includes(host.mood) ? host.mood : "steady"}
          onChange={(value) => setHost({ ...host, mood: value })}
        />
        <Text style={styles.muted}>Time available now (minutes)</Text>
        <TextInput
          value={String(host.timeAvailableMinutes)}
          onChangeText={(value) => setNumber("timeAvailableMinutes", Number(value.replace(/[^0-9]/g, "")) || 5)}
          placeholder="20"
          keyboardType="number-pad"
          style={styles.input}
        />
        <Text style={styles.muted}>Quest style for today</Text>
        <Segmented
          value={host.desiredMode}
          onChange={(value) => setHost((current) => ({ ...current, desiredMode: value as QuestMode }))}
          options={questModes.map((item) => ({ value: item.id, label: item.label }))}
        />
        <PrimaryButton icon="scan" label="Save Check-in" onPress={saveScan} />
      </Panel>

      {state.hostHistory.length > 0 ? (
        <Panel title="Check-in Log" icon="book">
          {state.hostHistory.slice(0, 8).map((scan, index) => (
            <View key={`${scan.scannedAt}_${index}`} style={styles.statRow}>
              <View>
                <Text style={styles.statName}>
                  {new Date(scan.scannedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {index === 0 ? " · latest" : ""}
                </Text>
                <Text style={styles.muted}>
                  Energy {Math.round(scan.energy * 100)}% · Focus {Math.round(scan.focus * 100)}% · Stress {Math.round(scan.stress * 100)}% · {scan.timeAvailableMinutes} min
                </Text>
              </View>
              <Text style={styles.statValue}>{scan.mood}</Text>
            </View>
          ))}
        </Panel>
      ) : null}

      <BodySection />
    </View>
  );
}
