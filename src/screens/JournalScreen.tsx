import { Image, Text, View } from "react-native";
import { Chip, Panel } from "../components/common";
import { useStore } from "../state/store";
import { domainColors, styles } from "../theme";
import { EvidenceRecord } from "../types";
import { evidenceTypes, outcomes } from "../uiConstants";
import { readSystemDirector } from "../director";

function shortDate(time: number) {
  return new Date(time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function evidenceLabel(kind: string) {
  return evidenceTypes.find((item) => item.id === kind)?.label ?? kind;
}

function outcomeLabel(kind: string) {
  return outcomes.find((item) => item.id === kind)?.label ?? kind.replaceAll("_", " ");
}

export function JournalScreen() {
  const { state } = useStore();
  const director = readSystemDirector(state);
  const recentHistory = state.questHistory.slice(0, 14);
  const fallbackEvidence = state.questHistory.flatMap((quest) =>
    (quest.outcome?.evidence ?? []).map((item) => ({
      ...item,
      questId: quest.id,
      questTitle: quest.title,
      questDomain: quest.domain,
      outcomeType: quest.outcome!.type
    }))
  ) as EvidenceRecord[];
  const evidence = (state.evidenceLog.length ? state.evidenceLog : fallbackEvidence).slice(0, 24);

  return (
    <View>
      <Panel title="Pattern Read" icon="sparkles">
        <Text style={styles.bodyText}>{director.history}</Text>
        <Text style={styles.muted}>{director.nextMove}</Text>
      </Panel>
      <Panel title="Quest Journal" icon="book">
        {recentHistory.length === 0 ? (
          <Text style={styles.bodyText}>No quests logged yet. Complete or reroll a quest and it will appear here.</Text>
        ) : (
          recentHistory.map((quest) => (
            <View key={`${quest.id}_${quest.status}`} style={styles.offerCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.stepTitle}>{quest.title}</Text>
                <Chip label={quest.status} active={quest.status === "completed"} />
              </View>
              <View style={styles.questMeta}>
                <Chip label={quest.domain} tone={domainColors[quest.domain]} />
                <Chip label={`Rank ${quest.rank}`} />
                <Chip label={`${quest.timeLimitMinutes} min`} />
              </View>
              <Text style={styles.bodyText}>{quest.objective}</Text>
              {quest.outcome ? (
                <View>
                  <View style={styles.questMeta}>
                    <Chip label={outcomeLabel(quest.outcome.type)} active />
                    <Chip label={`${Math.round((quest.outcome.verificationConfidence ?? 0) * 100)}% verified`} />
                    <Chip label={shortDate(quest.outcome.completedAt)} />
                  </View>
                  {quest.outcome.note ? <Text style={styles.muted}>{quest.outcome.note}</Text> : null}
                </View>
              ) : null}
              {quest.rejection ? (
                <View>
                  <View style={styles.questMeta}>
                    <Chip label={`Reroll: ${quest.rejection.label}`} />
                    <Chip label={shortDate(quest.rejection.rejectedAt)} />
                  </View>
                  <Text style={styles.muted}>{quest.rejection.impact}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </Panel>

      <Panel title="Evidence Trail" icon="document-text">
        {evidence.length === 0 ? (
          <Text style={styles.bodyText}>No evidence records yet.</Text>
        ) : (
          evidence.map((item) => (
            <View key={item.id} style={styles.statRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.statName}>{evidenceLabel(item.kind)} - {item.questTitle}</Text>
                <Text style={styles.muted}>
                  {outcomeLabel(item.outcomeType)} | {shortDate(item.recordedAt)}
                  {item.cellId ? ` | cell ${item.cellId}` : ""}
                  {item.timer ? ` | ${item.timer.actualMinutes} min` : ""}
                  {item.artifactUri ? ` | ${item.artifactUri}` : ""}
                  {item.photoUri ? " | photo" : ""}
                </Text>
                {item.note ? <Text style={styles.muted}>{item.note}</Text> : null}
                {item.photoUri ? <Image source={{ uri: item.photoUri }} style={styles.journalPhotoThumb} /> : null}
              </View>
              <Chip label={`${Math.round(item.confidence * 100)}%`} />
            </View>
          ))
        )}
      </Panel>
    </View>
  );
}
