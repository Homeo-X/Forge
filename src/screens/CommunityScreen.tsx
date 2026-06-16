import React, { useEffect, useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { Chip, GhostButton, MiniAction, Panel, PrimaryButton } from "../components/common";
import { domainColors, styles } from "../theme";
import { useStore } from "../state/store";
import { CommunityPost } from "../types";
import {
  createCommunityComment,
  createCommunityPost,
  deleteCommunityPost,
  listCommunityPosts,
  reportCommunityPost,
  setCommunitySupport
} from "../sync";
import { outcomes } from "../uiConstants";

function shortDate(time: number) {
  return new Date(time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function outcomeLabel(kind?: string) {
  if (!kind) return null;
  return outcomes.find((item) => item.id === kind)?.label ?? kind.replaceAll("_", " ");
}

export function CommunityScreen() {
  const { state, auth } = useStore();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Community is opt-in. Nothing from your journal is shared automatically.");
  const [busy, setBusy] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);

  const latestCompleted = useMemo(
    () => state.questHistory.find((quest) => quest.outcome),
    [state.questHistory]
  );

  async function refresh() {
    setBusy(true);
    const result = await listCommunityPosts();
    setBusy(false);
    setStatus(result.message);
    if (result.ok) setPosts(result.data ?? []);
  }

  useEffect(() => {
    if (auth.email) void refresh();
  }, [auth.email]);

  function useLatestQuest() {
    if (!latestCompleted?.outcome) {
      setStatus("Complete a quest first, then you can share progress.");
      return;
    }
    const label = outcomeLabel(latestCompleted.outcome.type) ?? "completed";
    setContent(`I ${label.toLowerCase()} this quest: ${latestCompleted.title}.`);
  }

  async function submitPost() {
    const result = await createCommunityPost({
      displayName,
      content,
      questTitle: latestCompleted?.outcome && content.includes(latestCompleted.title) ? latestCompleted.title : undefined,
      questDomain: latestCompleted?.outcome && content.includes(latestCompleted.title) ? latestCompleted.domain : undefined,
      outcomeType: latestCompleted?.outcome && content.includes(latestCompleted.title) ? latestCompleted.outcome.type : undefined
    });
    setStatus(result.message);
    if (result.ok) {
      setContent("");
      await refresh();
    }
  }

  async function toggleSupport(post: CommunityPost) {
    const result = await setCommunitySupport(post.id, !post.supportedByMe);
    setStatus(result.message);
    if (result.ok) await refresh();
  }

  async function submitComment(postId: string) {
    const result = await createCommunityComment(postId, displayName, commentDrafts[postId] ?? "");
    setStatus(result.message);
    if (result.ok) {
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await refresh();
    }
  }

  async function deletePost(postId: string) {
    const result = await deleteCommunityPost(postId);
    setStatus(result.message);
    setPendingDeleteId(null);
    if (result.ok) await refresh();
  }

  async function reportPost(postId: string) {
    const result = await reportCommunityPost(postId);
    setStatus(result.message);
    setPendingReportId(null);
  }

  if (!auth.configured) {
    return (
      <Panel title="Community" icon="people">
        <Text style={styles.bodyText}>Community needs Supabase setup first.</Text>
        <Text style={styles.muted}>The rest of Forge still works offline.</Text>
      </Panel>
    );
  }

  if (!auth.email) {
    return (
      <Panel title="Community" icon="people">
        <Text style={styles.bodyText}>Sign in from the drawer before using Community.</Text>
        <Text style={styles.muted}>Sharing is always manual. Your notes, photos, and location evidence are never posted automatically.</Text>
      </Panel>
    );
  }

  return (
    <View>
      <Panel title="Share Progress" icon="cloud-upload">
        <Text style={styles.bodyText}>Post a small progress update. Keep it kind, specific, and safe.</Text>
        <Text style={styles.muted}>Private proof stays private. Do not share exact location or sensitive photos.</Text>
        <Text style={styles.sectionLabel}>Display name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Forge user"
          placeholderTextColor="#64748b"
          style={styles.input}
        />
        <Text style={styles.sectionLabel}>Update</Text>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="What progress do you want to share?"
          placeholderTextColor="#64748b"
          multiline
          style={[styles.input, { minHeight: 92 }]}
        />
        <View style={styles.inlineActions}>
          <GhostButton icon="book" label="Use latest completed quest" onPress={useLatestQuest} />
          <PrimaryButton icon="cloud-upload" label={busy ? "Working..." : "Share"} onPress={() => void submitPost()} />
        </View>
        <Text style={styles.routeStatus}>{status}</Text>
      </Panel>

      <Panel title="Community Feed" icon="people">
        <GhostButton icon="refresh" label={busy ? "Loading..." : "Refresh"} onPress={() => void refresh()} />
        {posts.length === 0 ? (
          <Text style={styles.bodyText}>No community posts yet.</Text>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.offerCard}>
              <View style={styles.progressHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.stepTitle}>{post.displayName}</Text>
                  <Text style={styles.muted}>{shortDate(post.createdAt)}</Text>
                </View>
                <Chip label={`${post.supportCount} support`} active={post.supportedByMe} />
              </View>
              {post.questTitle ? (
                <View style={styles.questMeta}>
                  <Chip label={post.questDomain ?? "quest"} tone={post.questDomain ? domainColors[post.questDomain] : undefined} />
                  {post.outcomeType ? <Chip label={outcomeLabel(post.outcomeType) ?? post.outcomeType} /> : null}
                </View>
              ) : null}
              {post.questTitle ? <Text style={styles.sectionLabel}>{post.questTitle}</Text> : null}
              <Text style={styles.bodyText}>{post.content}</Text>
              <View style={styles.questMeta}>
                <MiniAction label={post.supportedByMe ? "Supported" : "Support"} onPress={() => void toggleSupport(post)} tone="primary" />
                {post.isMine ? (
                  pendingDeleteId === post.id ? (
                    <>
                      <MiniAction label="Confirm delete" onPress={() => void deletePost(post.id)} tone="danger" />
                      <MiniAction label="Cancel" onPress={() => setPendingDeleteId(null)} />
                    </>
                  ) : (
                    <MiniAction label="Delete" onPress={() => setPendingDeleteId(post.id)} tone="danger" />
                  )
                ) : (
                  pendingReportId === post.id ? (
                    <>
                      <MiniAction label="Confirm report" onPress={() => void reportPost(post.id)} tone="danger" />
                      <MiniAction label="Cancel" onPress={() => setPendingReportId(null)} />
                    </>
                  ) : (
                    <MiniAction label="Report" onPress={() => setPendingReportId(post.id)} />
                  )
                )}
              </View>
              {post.comments.length ? (
                <View style={{ marginTop: 8 }}>
                  {post.comments.map((comment) => (
                    <View key={comment.id} style={styles.assumptionCard}>
                      <Text style={styles.sectionLabel}>{comment.displayName}</Text>
                      <Text style={styles.bodyText}>{comment.content}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <TextInput
                value={commentDrafts[post.id] ?? ""}
                onChangeText={(text) => setCommentDrafts((current) => ({ ...current, [post.id]: text }))}
                placeholder="Write a short reply"
                placeholderTextColor="#64748b"
                style={styles.input}
              />
              <GhostButton icon="add-circle" label="Reply" onPress={() => void submitComment(post.id)} />
            </View>
          ))
        )}
      </Panel>
    </View>
  );
}
