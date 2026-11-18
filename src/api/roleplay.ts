import { logger } from "../utils/UnifiedLogger";
import { apiFetch, ApiError, API_BASE_URL } from "./client";

export interface EvaluationParameter {
  name: string;
  description: string;
  weight: number;
}

export interface Scenario {
  scenario_id: string;
  title: string;
  description?: string;
  role: string;
  difficulty: "Easy" | "Medium" | "Hard" | string;
  initialPrompt: string;
  userRole: string;
  tone?: string;
  learnerBrief: string;
  aiObjectives?: string;
  maxDuration?: number;
  minTurns?: number;
  endConditions?: string;
  evaluationParams?: EvaluationParameter[];
  passingScore?: number;
  cutoffScore?: number;
}

export interface RoleplayAssessment {
  id: string;
  overall_score: number;
  summary: string;
  parameters: any;
  recommendations: string[];
  created_at: string;
}

export interface RoleplaySession {
  id: string;
  employee_id: string;
  scenario_id: string;
  scenario_title?: string;
  scenario_role?: string;
  scenario_difficulty?: string;
  conversation_transcript: Array<{ role: string; text: string }>;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  message_count?: number;
  roleplay_assessments?: RoleplayAssessment[];
}

export interface UserRoleplayDataResponse {
  scenarios: Scenario[];
  limits: {
    roleplayLimit: number;
    retryLimit: number;
  };
  attemptedCounts?: Record<string, number>;
  remainingAttempts?: Record<string, number>;
  user?: {
    user_id: string;
    email: string;
  };
}

export async function getUserRoleplayData(email: string): Promise<UserRoleplayDataResponse | null> {
  try {
    // 1. Try bootstrap endpoint first for both scenarios and company limits
    const bootstrapUrl = `${API_BASE_URL}/roleplay/bootstrap`;
    try {
      const data = await apiFetch<any>(bootstrapUrl, { method: "GET" });
      if (data?.success && data?.data) {
        return {
          scenarios: data.data.scenarios || [],
          limits: {
            roleplayLimit: data.data.companyLimits?.roleplayLimit ?? 5,
            retryLimit: data.data.companyLimits?.retryLimit ?? data.data.retryLimits?.maxRetries ?? 3,
          },
        };
      }
    } catch (bootstrapErr: any) {
      if (bootstrapErr instanceof ApiError && bootstrapErr.status === 401) {
        return null;
      }
      logger.warn("[RoleplayAPI] Bootstrap unavailable, falling back to /roleplay/scenarios:", bootstrapErr?.message);
    }

    // 2. Fallback to /roleplay/scenarios endpoint
    const scenariosUrl = `${API_BASE_URL}/roleplay/scenarios`;
    const scenariosData = await apiFetch<any>(scenariosUrl, { method: "GET" });
    const scenariosList = Array.isArray(scenariosData?.data)
      ? scenariosData.data
      : (scenariosData?.scenarios || []);
    return {
      scenarios: scenariosList,
      limits: { roleplayLimit: 5, retryLimit: 3 },
    };
  } catch (e) {
    logger.error("[RoleplayAPI] Error fetching user roleplay data:", e);
    return null;
  }
}

export async function createRoleplaySession(
  employeeId: string,
  scenario: Scenario
): Promise<{ id: string } | null> {
  try {
    const url = `${API_BASE_URL}/roleplay/sessions`;
    const result = await apiFetch<any>(url, {
      method: "POST",
      userId: employeeId,
      body: JSON.stringify({
        employee_id: employeeId,
        scenario_id: scenario.scenario_id,
        scenario_title: scenario.title || "Roleplay Session",
        scenario_role: scenario.role || "Learner",
        scenario_difficulty: scenario.difficulty || "Medium",
      }),
    });
    return result?.data || result;
  } catch (e) {
    logger.error("[RoleplayAPI] Error creating session:", e);
    return null;
  }
}

export async function updateRoleplaySession(
  sessionId: string,
  transcript: Array<{ role: string; text: string }>,
  durationSeconds?: number
): Promise<boolean> {
  try {
    const url = `${API_BASE_URL}/roleplay/sessions/${sessionId}`;
    await apiFetch(url, {
      method: "PUT",
      body: JSON.stringify({
        conversation_transcript: transcript,
        duration_seconds: durationSeconds || 0,
        message_count: transcript.length,
      }),
    });
    return true;
  } catch (e) {
    logger.error("[RoleplayAPI] Error updating session:", e);
    return false;
  }
}

export async function generateRoleplayAssessment(
  sessionId: string,
  scenarioId: string,
  transcript: Array<{ role: string; text: string }>
): Promise<RoleplayAssessment | null> {
  try {
    const url = `${API_BASE_URL}/roleplay/sessions/${sessionId}/assessment`;
    const data = await apiFetch<any>(url, {
      method: "POST",
      timeoutMs: 60_000,
      body: JSON.stringify({
        scenario_id: scenarioId,
        conversation_transcript: transcript,
      }),
    });
    return data?.assessment || data;
  } catch (e) {
    logger.error("[RoleplayAPI] Error generating assessment:", e);
    return null;
  }
}

export async function finishRoleplaySession(
  sessionId: string,
  transcript: Array<{ role: string; text: string }>,
  durationSeconds?: number
): Promise<{ session: any; assessment: RoleplayAssessment } | null> {
  try {
    const url = `${API_BASE_URL}/roleplay/finish`;
    return await apiFetch(url, {
      method: "POST",
      timeoutMs: 60_000,
      body: JSON.stringify({
        session_id: sessionId,
        conversation_transcript: transcript,
        duration_seconds: durationSeconds || 0,
      }),
    });
  } catch (e) {
    logger.error("[RoleplayAPI] Error finishing session:", e);
    return null;
  }
}

export async function getUserRoleplayReports(employeeId: string): Promise<RoleplaySession[]> {
  try {
    const url = `${API_BASE_URL}/roleplay/reports/${encodeURIComponent(employeeId)}`;
    const data = await apiFetch<any>(url, {
      method: "GET",
      userId: employeeId,
    });

    if (Array.isArray(data?.data?.sessions)) return data.data.sessions;
    if (Array.isArray(data?.sessions)) return data.sessions;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.reports)) return data.reports;
    if (Array.isArray(data)) return data;

    logger.warn("[RoleplayAPI] getUserRoleplayReports: unexpected response shape", data);
    return [];
  } catch (e) {
    logger.error("[RoleplayAPI] Error fetching roleplay reports:", e);
    return [];
  }
}
