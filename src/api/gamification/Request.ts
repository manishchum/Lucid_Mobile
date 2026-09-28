import { getFirebaseToken } from "../users/Request";

const EXPO_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
const GAMIFICATION_BASE = `${EXPO_API_URL}/api/gamification`;

async function authHeaders() {
  const token = await getFirebaseToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${GAMIFICATION_BASE}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || `Gamification API error ${res.status}`);
  }
  const json = await res.json();
  return json.data as T;
}

// --- Types ---

export interface GamificationDrill {
  drill_id: string;
  sprint_id: string;
  format_type:
    | "VIBE_CHECK"
    | "RISK_RIZZ"
    | "FILL_BLANKS"
    | "FLOW_MASTER"
    | "CODE_BREAKER"
    | "AUDIT_SPOTTER"
    | "SPEED_RUN";
  title: string;
  base_xp: number;
  order_index: number;
  content_payload: any;
}

export interface GamificationSprint {
  sprint_id: string;
  module_id: string;
  module_title: string;
  sprint_title: string;
  sprint_description: string;
  sprint_number: number;
  is_locked: boolean;
  gamification_drills: GamificationDrill[];
}

export interface GamificationProfile {
  total_xp: number;
  current_streak_days: number;
  best_streak_days: number;
  drills_completed_count: number;
  completed_drills: string[];
  unlocked_badges: UnlockedBadge[];
}

export interface UnlockedBadge {
  badge_key: string;
  badge_title?: string;
  badge_description?: string;
}

export interface LeaderboardUser {
  id: string;
  name: string;
  role: string;
  sprints_completed: number;
  xp: number;
  badges_count: number;
  avatar_color: string;
  is_current_user: boolean;
}

export interface DrillProgressPayload {
  sprint_id: string;
  drill_id: string;
  completed: boolean;
  wrong_attempts: number;
  completion_time_seconds: number;
}

export interface DrillProgressResult {
  progress: any;
  earned_xp: number;
  streak_multiplier: number;
  new_badges: UnlockedBadge[];
}

// --- API Functions ---

export const fetchGamificationSprints = (): Promise<GamificationSprint[]> =>
  apiGet<GamificationSprint[]>("/sprints");

export const fetchGamificationProfile = (): Promise<GamificationProfile> =>
  apiGet<GamificationProfile>("/profile");

export const fetchGamificationLeaderboard = (): Promise<LeaderboardUser[]> =>
  apiGet<LeaderboardUser[]>("/leaderboard");

export const fetchActivityCalendar = (): Promise<string[]> =>
  apiGet<string[]>("/activity-calendar");

export const submitDrillProgress = async (
  payload: DrillProgressPayload
): Promise<DrillProgressResult> => {
  const headers = await authHeaders();
  const res = await fetch(`${GAMIFICATION_BASE}/progress`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail || `Submit drill error ${res.status}`);
  }
  const json = await res.json();
  return json.data as DrillProgressResult;
};
