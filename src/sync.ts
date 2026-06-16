import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { AppState, CommunityComment, CommunityPost, OutcomeType, QuestDomain } from "./types";
import { ensureStateShape } from "./engine";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSyncConfigured } from "./config";

/**
 * Sync layer (Supabase). Entirely additive and failure-tolerant: the app is
 * fully usable signed-out and local-only. Every remote call degrades to a safe
 * no-op / null on misconfiguration, network failure, or auth absence, so sync
 * can never break the app — same principle as the local storage hardening.
 *
 * Storage model: one row per user in `forge_state` (user_id, state jsonb,
 * updated_at), last-write-wins. RLS guarantees a user only ever touches their
 * own row.
 */

const TABLE = "forge_state";

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient | null {
  if (!isSyncConfigured()) return null;
  if (!client) {
    // AsyncStorage is required lazily: it touches React Native native modules at
    // import time, so loading it here (only on a configured device, never in the
    // node test environment where isSyncConfigured() is false) keeps Jest green.
    // It is what makes the auth session survive an app restart on the phone.
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        // No deep-link/URL session to parse in a native app.
        detectSessionInUrl: false
      }
    });
  }
  return client;
}

export function syncAvailable(): boolean {
  return getClient() !== null;
}

export async function currentUser(): Promise<User | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function currentAccessToken(): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export interface AuthResult {
  ok: boolean;
  message: string;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Sync is not configured." };
  try {
    const { error } = await c.auth.signUp({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Account created. Check your email if confirmation is required." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sign-up failed." };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Sync is not configured." };
  try {
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Signed in. Your progress will sync." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sign-in failed." };
  }
}

export async function signOut(): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.auth.signOut();
  } catch {
    // best-effort
  }
}

/** Load this user's remote state, normalized. Null if absent/unconfigured/failed. */
export async function loadRemoteState(): Promise<AppState | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const user = await currentUser();
    if (!user) return null;
    const { data, error } = await c.from(TABLE).select("state").eq("user_id", user.id).maybeSingle();
    if (error || !data?.state) return null;
    return ensureStateShape(data.state as AppState);
  } catch {
    return null;
  }
}

/** Upsert this user's state. Fire-and-forget; never throws to the caller. */
export async function saveRemoteState(state: AppState): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    const user = await currentUser();
    if (!user) return;
    await c.from(TABLE).upsert(
      { user_id: user.id, state, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  } catch {
    // Offline / transient failure: local cache remains source of truth.
  }
}

export interface CommunityResult<T = void> {
  ok: boolean;
  message: string;
  data?: T;
}

type CommunityPostRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  content: string;
  quest_title: string | null;
  quest_domain: QuestDomain | null;
  outcome_type: OutcomeType | null;
  created_at: string;
  community_reactions?: Array<{ user_id: string }>;
  community_comments?: Array<{
    id: string;
    post_id: string;
    user_id: string;
    display_name: string | null;
    content: string;
    created_at: string;
  }>;
};

function toCommunityPost(row: CommunityPostRow, userId: string): CommunityPost {
  const reactions = row.community_reactions ?? [];
  const comments: CommunityComment[] = (row.community_comments ?? [])
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((comment) => ({
      id: comment.id,
      postId: comment.post_id,
      displayName: comment.display_name || "Forge user",
      content: comment.content,
      createdAt: new Date(comment.created_at).getTime(),
      isMine: comment.user_id === userId
    }));

  return {
    id: row.id,
    displayName: row.display_name || "Forge user",
    content: row.content,
    questTitle: row.quest_title ?? undefined,
    questDomain: row.quest_domain ?? undefined,
    outcomeType: row.outcome_type ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    supportCount: reactions.length,
    supportedByMe: reactions.some((reaction) => reaction.user_id === userId),
    isMine: row.user_id === userId,
    comments
  };
}

export async function listCommunityPosts(): Promise<CommunityResult<CommunityPost[]>> {
  const c = getClient();
  if (!c) return { ok: false, message: "Community needs Supabase setup." };
  try {
    const user = await currentUser();
    if (!user) return { ok: false, message: "Sign in to open Community." };
    const { data, error } = await c
      .from("community_posts")
      .select(`
        id,user_id,display_name,content,quest_title,quest_domain,outcome_type,created_at,
        community_reactions(user_id),
        community_comments(id,post_id,user_id,display_name,content,created_at)
      `)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Loaded.", data: ((data ?? []) as CommunityPostRow[]).map((row) => toCommunityPost(row, user.id)) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not load Community." };
  }
}

export async function createCommunityPost(input: {
  displayName: string;
  content: string;
  questTitle?: string;
  questDomain?: QuestDomain;
  outcomeType?: OutcomeType;
}): Promise<CommunityResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Community needs Supabase setup." };
  try {
    const user = await currentUser();
    if (!user) return { ok: false, message: "Sign in before sharing." };
    const content = input.content.trim();
    if (!content) return { ok: false, message: "Write a short update first." };
    const { error } = await c.from("community_posts").insert({
      user_id: user.id,
      display_name: input.displayName.trim() || "Forge user",
      content: content.slice(0, 700),
      quest_title: input.questTitle ?? null,
      quest_domain: input.questDomain ?? null,
      outcome_type: input.outcomeType ?? null
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Shared to Community." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not share post." };
  }
}

export async function setCommunitySupport(postId: string, supported: boolean): Promise<CommunityResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Community needs Supabase setup." };
  try {
    const user = await currentUser();
    if (!user) return { ok: false, message: "Sign in before supporting posts." };
    const query = c.from("community_reactions");
    const { error } = supported
      ? await query.insert({ post_id: postId, user_id: user.id })
      : await query.delete().eq("post_id", postId).eq("user_id", user.id);
    if (error && !/duplicate key/i.test(error.message)) return { ok: false, message: error.message };
    return { ok: true, message: supported ? "Supported." : "Support removed." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not update support." };
  }
}

export async function createCommunityComment(postId: string, displayName: string, content: string): Promise<CommunityResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Community needs Supabase setup." };
  try {
    const user = await currentUser();
    if (!user) return { ok: false, message: "Sign in before replying." };
    const body = content.trim();
    if (!body) return { ok: false, message: "Write a short reply first." };
    const { error } = await c.from("community_comments").insert({
      post_id: postId,
      user_id: user.id,
      display_name: displayName.trim() || "Forge user",
      content: body.slice(0, 320)
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Reply added." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not reply." };
  }
}

export async function deleteCommunityPost(postId: string): Promise<CommunityResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Community needs Supabase setup." };
  try {
    const user = await currentUser();
    if (!user) return { ok: false, message: "Sign in first." };
    const { data, error } = await c.from("community_posts").delete().eq("id", postId).eq("user_id", user.id).select("id").maybeSingle();
    if (error) return { ok: false, message: error.message };
    if (!data) return { ok: false, message: "Post was not deleted. It may belong to another account, or the session expired." };
    return { ok: true, message: "Post deleted." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not delete post." };
  }
}

export async function reportCommunityPost(postId: string, reason = "reported"): Promise<CommunityResult> {
  const c = getClient();
  if (!c) return { ok: false, message: "Community needs Supabase setup." };
  try {
    const user = await currentUser();
    if (!user) return { ok: false, message: "Sign in first." };
    const { error } = await c.from("community_reports").insert({ post_id: postId, reporter_id: user.id, reason });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Report sent." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not report post." };
  }
}
