import { logger } from "../../utils/UnifiedLogger";
import { emitSessionInvalid, SessionInvalidReason } from "../sessionEvents";
import {
  UserResponse,
  UserRolesResponse,
  TrainingModulesResponse,
  CompanyResponse,
  LearningStyleResponse,
  CompanyUsersResponse,
  TrainingModule,
  PostModuleChatDto,
  PostModuleChatResponseDto,
  DashboardSummaryResponse,
  TasksResponse,
  ModuleProgress,
  TaskSubmissionPayload,
  TaskSubmissionResponse,
  LeaderboardHighlightResponse,
  SubmissionFormat,
  FormatAnswer,
} from "./Dto";

import AsyncStorage from "@react-native-async-storage/async-storage";

const EXPO_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
const API_BASE_URL = `${EXPO_API_URL}/api`;
const MODULE_CHAT_URL = `${API_BASE_URL}/module-chat`;

export const JWT_TOKEN_KEY = "@auth_jwt_token";

export const getFirebaseToken = async (): Promise<string | null> => {
  try {
    const token = await AsyncStorage.getItem(JWT_TOKEN_KEY);
    if (token) return token;
  } catch (e) {
    logger.error("[Request] Error reading JWT token from AsyncStorage:", e);
  }
  return null;
};

export const sendOtpApi = async (
  phone: string
): Promise<{ success: boolean; message?: string; retry_after?: number }> => {
  const url = `${API_BASE_URL}/auth/send-otp`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(
        data.detail || data.message || "Failed to send OTP",
        response.status
      );
    }
    return data;
  } catch (err: any) {
    logger.error("[Request] sendOtpApi error:", err);
    throw err;
  }
};

export const verifyOtpApi = async (
  phone: string,
  otp: string
): Promise<{ success: boolean; token: string; user: any }> => {
  const url = `${API_BASE_URL}/auth/verify-otp`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(
        data.detail || data.message || "Failed to verify OTP",
        response.status
      );
    }
    return data;
  } catch (err: any) {
    logger.error("[Request] verifyOtpApi error:", err);
    throw err;
  }
};


export interface ModuleChatMessage {
  role: "user" | "assistant";
  content: string;
  isVoice?: boolean;
}

export interface ModuleChatRequest {
  processed_module_id: string;
  user_message: string;
  chat_history: ModuleChatMessage[];
  user_id: string;
  company_id: string;
}

export interface ModuleChatResponse {
  success: boolean;
  message: string;
}

export const postModuleChat = async (
  data: PostModuleChatDto,
): Promise<PostModuleChatResponseDto> => {
  logger.info("[Request] postModuleChat", {
    processed_module_id: data.processed_module_id,
  });

  const result = await apiFetch<PostModuleChatResponseDto>(MODULE_CHAT_URL, {
    method: "POST",
    userId: data.user_id,
    body: JSON.stringify({
      processed_module_id: data.processed_module_id,
      user_message: data.user_message,
      user_id: data.user_id,
      company_id: data.company_id,
      chat_history: data.chat_history,
    }),
  });

  logger.info("[Request] postModuleChat success");
  return result;
};

const getHeaders = async (
  userId?: string,
  options?: { noCache?: boolean; companyId?: string },
): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (options?.noCache) {
    headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
  }
  if (userId) headers["X-User-ID"] = userId;
  if (options?.companyId) headers["X-Company-ID"] = options.companyId;

  const token = await getFirebaseToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // ─── DEBUG ───────────────────────────────────────────────────────────────
  logger.debug("[DEBUG] getHeaders called with userId:", userId, "companyId:", options?.companyId);
  logger.debug("[DEBUG] Authorization present:", !!token);
  logger.debug("[DEBUG] X-User-ID value:", userId ?? "NOT SET ⚠️");
  if (options?.companyId) {
    logger.debug("[DEBUG] X-Company-ID value:", options.companyId);
  }
  // ─────────────────────────────────────────────────────────────────────────

  return headers;
};

const getPublicHeaders = (userId?: string, companyId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (userId) headers["X-User-ID"] = userId;
  if (companyId) headers["X-Company-ID"] = companyId;
  return headers;
};

// ==================== CENTRALIZED FETCH WRAPPER ====================
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ApiFetchOptions extends RequestInit {
  userId?: string;
  companyId?: string;
  noCache?: boolean;
  /** Skip auth headers entirely */
  public?: boolean;
}

async function apiFetch<T = any>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    userId,
    companyId,
    noCache,
    public: isPublic,
    headers: extraHeaders,
    ...rest
  } = options;

  const baseHeaders = isPublic
    ? getPublicHeaders(userId, companyId)
    : await getHeaders(userId, { noCache, companyId });

  const headers = {
    ...baseHeaders,
    ...(extraHeaders as Record<string, string> | undefined),
  };

  logger.debug(`[apiFetch] ${rest.method ?? "GET"} → ${url}`);


  let response: Response;
  try {
    response = await fetch(url, { ...rest, headers });
  } catch (networkErr) {
    logger.error(`[apiFetch] network error for ${url}:`, networkErr);
    throw new ApiError("Network request failed", 0, "NETWORK_ERROR");
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {}

  // Session/account-validity codes --- sessionEvents.ts. Handled here
  // once, rather than at every individual call site.
  const code = body?.code as SessionInvalidReason | undefined;
  if (
    response.status === 401 &&
    (code === "SESSION_TERMINATED" ||
      code === "ACCOUNT_DEACTIVATED" ||
      code === "COMPANY_DEACTIVATED")
  ) {
    logger.warn(
      `[apiFetch] session invalid (${code}) — emitting sessionEvents`,
    );
    emitSessionInvalid(code);
    throw new ApiError(
      body?.message ?? "Session invalid",
      response.status,
      code,
    );
  }

  if (!response.ok) {
    logger.error(`[apiFetch] ${response.status} for ${url}:`, body);
    throw new ApiError(
      body?.message ?? `HTTP error! status: ${response.status}`,
      response.status,
      code,
    );
  }

  return body as T;
}

// 1. Get user by email
export const getUserByEmail = async (email: string): Promise<UserResponse> => {
  try {
    const url = `${API_BASE_URL}/users/by-email/${encodeURIComponent(email)}`;
    logger.debug("[Request] getUserByEmail →", url);
    const response = await fetch(url, {
      method: "GET",
      headers: getPublicHeaders(),
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error(`[Request] getUserByEmail ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    if (json.user) {
      logger.debug("[Request] getUserByEmail ✅ user_id:", json.user.user_id);
    } else {
      logger.error(
        "[Request] getUserByEmail — user is null:",
        JSON.stringify(json),
      );
    }
    return json;
  } catch (error) {
    logger.error("[Request] Error fetching user by email:", error);
    throw error;
  }
};

// 1b. Get user by phone
export const getUserByPhone = async (phone: string): Promise<UserResponse> => {
  try {
    const url = `${API_BASE_URL}/users/by-phone/${encodeURIComponent(phone)}`;
    logger.debug("[Request] getUserByPhone →", url);
    const json = await apiFetch<any>(url, { method: "GET", public: true });
    if (json.user) {
      logger.debug("[Request] getUserByPhone ✅ user_id:", json.user.user_id);
    } else {
      logger.warn("[Request] getUserByPhone — no user found for phone:", phone);
    }
    return json;
  } catch (error) {
    logger.error("[Request] Error fetching user by phone:", error);
    throw error;
  }
};

// 1b. Check whether a company is still active
export const getCompanyActiveStatus = async (
  companyId: string,
  userId?: string,
): Promise<boolean | null> => {
  if (!companyId) return null;
  try {
    const url = `${API_BASE_URL}/companies/${encodeURIComponent(companyId)}`;
    logger.debug("[Request] getCompanyActiveStatus →", url);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId,
      companyId,
    });
    
    // Response can be direct company object or wrapped in data/company property
    const company = json?.company ?? json?.data?.company ?? json?.data ?? json;
    if (!company || typeof company !== "object") {
      logger.warn(
        "[Request] getCompanyActiveStatus — company not found for ID:",
        companyId,
      );
      return null;
    }

    const isActive =
      company.is_company_active ??
      company.is_active ??
      company.active ??
      true;

    return !!isActive;
  } catch (error) {
    logger.error("[Request] Error fetching company active status:", error);
    return null; // network error — treat as unknown, not as "inactive"
  }
};


// 1c. Record user login metadata
export const recordUserLogin = async (userId: string): Promise<any> => {
  try {
    const url = `${API_BASE_URL}/users/record-login`;
    logger.debug("[Request] recordUserLogin →", url);
    const result = await apiFetch<any>(url, {
      method: "POST",
      userId,
      body: JSON.stringify({ user_id: userId }),
    });
    return result;
  } catch (error) {
    logger.error("[Request] Error recording user login:", error);
    throw error;
  }
};

export const getModuleProgress = async (
  userId: string,
): Promise<ModuleProgress> => {
  try {
    const url = `${API_BASE_URL}/module-progress/user/${userId}`;
    logger.debug("[Request] getModuleProgress →", url);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId,
      noCache: true,
    });
    logger.debug(
      "[Request] getModuleProgress ✅ count:",
      json?.count,
      "entries:",
      json?.progress?.length,
    );
    return json;
  } catch (error) {
    logger.error("[Request] Error fetching module progress:", error);
    throw error;
  }
};

// 4. Get learning style by userId
export const getLearningStyle = async (
  userId: string,
): Promise<LearningStyleResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(
      `${API_BASE_URL}/learning-style?user_id=${userId}`,
      {
        method: "GET",
        headers,
      },
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error("[Request] Error fetching learning style:", error);
    throw error;
  }
};

// 5. Get user roles by userId
export const getUserRoles = async (
  userId: string,
): Promise<UserRolesResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/roles/users/${userId}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error("[Request] Error fetching user roles:", error);
    throw error;
  }
};

// 6. Get training modules by company ID
export const getTrainingModules = async (
  companyId: string,
  userId: string,
): Promise<TrainingModulesResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(
      `${API_BASE_URL}/training-modules/company/${companyId}`,
      {
        method: "GET",
        headers,
      },
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error("[Request] Error fetching training modules:", error);
    throw error;
  }
};

// 7. Get training module detail by moduleId
export const getTrainingModuleDetail = async (
  moduleId: string,
  userId: string,
): Promise<{ module: TrainingModule }> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(
      `${API_BASE_URL}/training-modules/${moduleId}`,
      {
        method: "GET",
        headers,
      },
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error("[Request] Error fetching training module detail:", error);
    throw error;
  }
};

// 8. Get company details by companyId
export const getCompany = async (
  companyId: string,
  userId: string,
): Promise<CompanyResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/companies/${companyId}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error("[Request] Error fetching company:", error);
    throw error;
  }
};

// 9. Get company users by companyId
export const getCompanyUsers = async (
  companyId: string,
  userId: string,
): Promise<CompanyUsersResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/users/company/${companyId}`, {
      method: "GET",
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    logger.error("[Request] Error fetching company users:", error);
    throw error;
  }
};

// 10. POST /training-plan
// body.user_id must equal the Firebase JWT Bearer token's sub claim.
export const getTrainingPlan = async (
  dbUserId: string,
  moduleId: string,
): Promise<any> => {
  try {
    if (!dbUserId) throw new Error("No authenticated user id (dbUserId)");

    const headers = await getHeaders(dbUserId);
    const response = await fetch(`${API_BASE_URL}/training-plan`, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: dbUserId, module_id: moduleId }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error(`[Request] POST /training-plan ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logger.error("[Request] Error fetching training plan:", error);
    throw error;
  }
};

// 11. Get processed modules by original module ID
export const getProcessedModules = async (
  originalModuleId: string,
  userId: string,
): Promise<any> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(
      `${API_BASE_URL}/processed-modules/original-module/${originalModuleId}`,
      { method: "GET", headers },
    );
    if (!response.ok) {
      const body = await response.text();
      logger.error(`[Request] getProcessedModules ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    logger.error("[Request] Error fetching processed modules:", error);
    throw error;
  }
};

// ── Quiz API ──────────────────────────────────────────────────────────────────

export const getEmployeeLearningStyle = async (
  _userId: string,
): Promise<string> => {
  // Learning style is hardcoded to 'default' for now.
  // Extend this when additional learning styles are introduced.
  return "default";
};

export const getExistingAssessment = async (
  processedModuleId: string,
  learningStyle: string,
  userId: string,
  originalModuleId?: string, // ADD this param
): Promise<any | null> => {
  try {
    const headers = await getHeaders(userId);

    // Web uses original_module_id + user_id_filter on first attempt
    const primaryId = originalModuleId || processedModuleId;
    const paramName = originalModuleId
      ? "original_module_id"
      : "processed_module_id";

    const url = `${API_BASE_URL}/assessments/filter/search?type=module&${paramName}=${primaryId}&learning_style=${encodeURIComponent(learningStyle)}&user_id_filter=${userId}`;
    logger.debug("[Quiz] Checking existing assessment →", url);
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      logger.warn("[Quiz] getExistingAssessment HTTP", response.status);
      return null;
    }
    const json = await response.json();
    const assessments: any[] =
      json?.data?.assessments ?? json?.assessments ?? [];
    if (assessments.length === 0) return null;
    const raw = assessments[0]?.questions;
    if (!raw) return null;
    const questions = typeof raw === "string" ? JSON.parse(raw) : raw;
    const thresholdValue =
      assessments[0]?.threshold_value ?? assessments[0]?.threshold ?? null;
    return {
      questions,
      assessmentId: assessments[0]?.assessment_id,
      thresholdValue,
    };
  } catch (err) {
    logger.warn("[Quiz] getExistingAssessment error:", err);
    return null;
  }
};

export const generateModuleQuiz = async (
  processedModuleId: string,
  learningStyle: string,
  userId: string,
  companyId: string,
): Promise<{
  questions: any[];
  assessmentId?: string;
  thresholdValue?: number;
} | null> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/gpt-mcq-quiz`;
    logger.debug("[Quiz] Generating quiz →", url);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        moduleId: processedModuleId, // camelCase, matches web
        learningStyle,
        userId,
        companyId,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error("[Quiz] submitQuizForGrading HTTP", response.status, body);
      // ─── DEBUG: log all response headers ─────────────────────────────────
      logger.error("[DEBUG] Response headers:");
      response.headers.forEach((value, key) => {
        logger.error(`[DEBUG]   ${key}: ${value}`);
      });
      // ─────────────────────────────────────────────────────────────────────
      return null;
    }
    const json = await response.json();

    // ── Parse response: server can return three different shapes ─────────────
    //
    // Shape A (quizMapping — newer backend):
    //   { quizMapping: [{ module_id, questions, assessment_id }] }
    //
    // Shape B (legacy — module quiz path):
    //   { quiz: [...questions], assessmentId: "uuid" }
    //
    // Shape C (data.assessments — batch baseline path):
    //   { success, data: { assessments: [{ questions, assessment_id }] } }

    let questions: any[] | null = null;
    let assessmentId: string | undefined;
    let thresholdValue: number | undefined =
      json?.threshold_value ?? json?.thresholdValue ?? json?.threshold;

    // Shape A
    if (Array.isArray(json?.quizMapping) && json.quizMapping.length > 0) {
      const entry = json.quizMapping[0];
      const raw = entry?.questions;
      if (raw) {
        questions = typeof raw === "string" ? JSON.parse(raw) : raw;
        assessmentId = entry?.assessment_id;
        logger.debug(
          "[Quiz] generateModuleQuiz — shape A (quizMapping), q count:",
          questions?.length,
        );
      }
    }

    // Shape B
    if (!questions && Array.isArray(json?.quiz) && json.quiz.length > 0) {
      questions = json.quiz;
      assessmentId = json?.assessmentId;
      logger.debug(
        "[Quiz] generateModuleQuiz — shape B (quiz array), q count:",
        questions?.length,
      );
    }

    // Shape C
    if (!questions) {
      const assessments: any[] = json?.data?.assessments ?? [];
      if (assessments.length > 0) {
        const raw = assessments[0]?.questions;
        if (raw) {
          questions = typeof raw === "string" ? JSON.parse(raw) : raw;
          assessmentId = assessments[0]?.assessment_id;
          logger.debug(
            "[Quiz] generateModuleQuiz — shape C (data.assessments), q count:",
            questions?.length,
          );
        }
      }
    }

    if (!questions || questions.length === 0) {
      logger.error(
        "[Quiz] generateModuleQuiz — no questions in response. Raw:",
        JSON.stringify(json).slice(0, 400),
      );
      return null;
    }

    // If assessmentId still missing, fall back to GET (mirrors web behaviour)
    if (!assessmentId) {
      logger.debug(
        "[Quiz] generateModuleQuiz — no assessmentId in POST response, fetching via GET...",
      );
      try {
        const searchUrl = `${API_BASE_URL}/assessments/filter/search?type=module&processed_module_id=${processedModuleId}&learning_style=${encodeURIComponent(learningStyle)}`;
        const searchRes = await fetch(searchUrl, { method: "GET", headers });
        if (searchRes.ok) {
          const searchJson = await searchRes.json();
          const list: any[] =
            searchJson?.data?.assessments ?? searchJson?.assessments ?? [];
          assessmentId = list[0]?.assessment_id;
          logger.debug(
            "[Quiz] generateModuleQuiz — assessmentId from GET fallback:",
            assessmentId,
          );
        }
      } catch (fallbackErr) {
        logger.warn(
          "[Quiz] generateModuleQuiz — GET fallback failed (non-blocking):",
          fallbackErr,
        );
      }
    }

    return { questions, assessmentId, thresholdValue };
  } catch (err) {
    logger.error("[Quiz] generateModuleQuiz error:", err);
    return null;
  }
};

// 12. Get a single processed module by its specific processed_module_id
export const getProcessedModuleById = async (
  processedModuleId: string,
  userId: string,
): Promise<any> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/processed-modules/${processedModuleId}`;
    logger.debug("[v0] [Request] Fetching processed module:", {
      url,
      processedModuleId,
    });

    const response = await fetch(url, { method: "GET", headers });

    if (!response.ok) {
      const body = await response.text();
      logger.error(
        `[v0] [Request] ❌ getProcessedModuleById HTTP ${response.status}:`,
        body.substring(0, 200),
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();

    if (!json || !json.data) {
      throw new Error('API response missing "data" field');
    }

    logger.debug(
      "[v0] [Request] ✅ Processed module fetched:",
      json.data?.title,
    );
    return json;
  } catch (error) {
    logger.error("[v0] [Request] ❌ Error fetching processed module:", error);
    throw error;
  }
};

// 13. Dashboard Summary
export const getDashboardSummary = async (
  userId: string,
  companyId: string,
): Promise<DashboardSummaryResponse> => {
  try {
    const url = `${API_BASE_URL}/employee/dashboard_summary/${encodeURIComponent(userId)}`;
    logger.debug("[Request] getDashboardSummary →", url);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId,
      noCache: true,
      headers: { "X-Company-ID": companyId },
    });

    if (Array.isArray(json?.plans)) {
      json.plans = json.plans.map((p: any) => {
        if (typeof p?.plan_json === "string") {
          try {
            return { ...p, plan_json: JSON.parse(p.plan_json) };
          } catch (e) {
            logger.warn(
              `[Request] Failed to parse plan_json string for plan ${p?.learning_plan_id}`,
              e,
            );
            return { ...p, plan_json: null };
          }
        }
        return p;
      });
    }

    logger.debug(
      "[Request] getDashboardSummary raw response — plans:",
      json?.plans?.length,
    );

    return json;
  } catch (error) {
    logger.error("[Request] Error fetching dashboard summary:", error);
    throw error;
  }
};

// 14. Get tasks (Task Manager) — GET /task-manager/tasks/user/{userId}

export const getTasks = async (
  userId: string,
  companyId: string,
): Promise<TasksResponse> => {
  try {
    const url = `${API_BASE_URL}/task-manager/tasks/user/${userId}`;
    logger.debug("[Request] getTasks →", url);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId,
      noCache: true,
      headers: { "X-Company-ID": companyId },
    });
    logger.debug(
      "[Request] getTasks ✅ total:",
      json?.total,
      "tasks:",
      json?.tasks?.length,
    );
    return json;
  } catch (error) {
    logger.error("[Request] Error fetching tasks:", error);
    throw error;
  }
};

// ── Submit quiz answers + get GPT feedback ────────────────────────────────────

export const getUserByEmailForQuiz = async (
  email: string,
  userId: string,
): Promise<any | null> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/users/by-email/${encodeURIComponent(email)}`;
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) return null;
    const json = await response.json();
    return json?.user ?? null;
  } catch (err) {
    logger.warn("[Quiz] getUserByEmailForQuiz error:", err);
    return null;
  }
};

/**
 * POST /module-progress
 */
export const postModuleProgress = async (
  dbUserId: string,
  payload: {
    module_id: string;
    processed_module_id: string;
    quiz_score: number;
    max_score: number;
    quiz_feedback: string;
    completed_at: string;
  },
): Promise<void> => {
  try {
    const headers = await getHeaders(dbUserId);
    const url = `${API_BASE_URL}/module-progress`;
    logger.debug("[Quiz] POST /module-progress →", url, {
      module_id: payload.module_id,
      processed_module_id: payload.processed_module_id,
      quiz_score: payload.quiz_score,
      max_score: payload.max_score,
    });
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: dbUserId,
        module_id: payload.module_id,
        processed_module_id: payload.processed_module_id,
        quiz_score: payload.quiz_score,
        max_score: payload.max_score,
        quiz_feedback: payload.quiz_feedback,
        completed_at: payload.completed_at,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      logger.warn("[Quiz] POST /module-progress HTTP", response.status, body);
    } else {
      logger.debug("[Quiz] POST /module-progress ✅");
    }
  } catch (err) {
    logger.warn("[Quiz] postModuleProgress error (non-blocking):", err);
  }
};

/**
 * POST /gpt-feedback
 *
 * Mirrors the web MODULE QUIZ page payload exactly:
 *   { quiz, userAnswers, user_id, employee_name, assessment_id, modules }
 *
 * Key points:
 * - `userAnswers` = string option texts (NOT integer indices) — this is what
 *   the server expects and validates; sending integer `answers` causes 403.
 * - `modules[0].module_id` = processedModuleId (NOT the original moduleId) —
 *   sending [] or the wrong ID also causes 403.
 *
 * Flow:
 *   1. GET /users/by-email/:email      (non-blocking, parity with web)
 *   2. POST /gpt-feedback
 *   3. POST /module-progress           (non-blocking)
 *   4. GET  /employee-assessments      (non-blocking background refresh)
 */
export const submitQuizForGrading = async (
  assessmentId: string,
  answerIndices: number[],
  questions: any[],
  dbUserId: string,
  employeeName?: string,
  moduleObjects?: any[],
  processedModuleId?: string,
  moduleId?: string,
): Promise<any | null> => {
  try {
    if (!dbUserId) throw new Error("No authenticated user ID provided");

    const headers = await getHeaders(dbUserId);

    // Step 1 — non-blocking parity with web
    if (employeeName && employeeName.includes("@")) {
      fetch(
        `${API_BASE_URL}/users/by-email/${encodeURIComponent(employeeName)}`,
        {
          method: "GET",
          headers,
        },
      )
        .then((r) => logger.debug("[Quiz] Step 1 by-email HTTP", r.status))
        .catch((e) =>
          logger.warn("[Quiz] Step 1 by-email failed (non-blocking):", e),
        );
    }

    // Convert integer indices → string option texts (matches web module quiz page)
    const userAnswers = answerIndices.map((selectedIdx, i) => {
      const q = questions[i];
      if (
        typeof selectedIdx === "number" &&
        selectedIdx >= 0 &&
        selectedIdx < q?.options?.length
      ) {
        return q.options[selectedIdx];
      }
      return "";
    });

    const localScore = answerIndices.reduce((acc, selectedIdx, i) => {
      return acc + (selectedIdx === questions[i]?.correctIndex ? 1 : 0);
    }, 0);

    // Save module progress to DB FIRST so student completion is registered even if AI fails or rate limits
    if (moduleId && processedModuleId) {
      try {
        await postModuleProgress(dbUserId, {
          module_id: moduleId,
          processed_module_id: processedModuleId,
          quiz_score: localScore,
          max_score: questions.length,
          quiz_feedback: "Submitted",
          completed_at: new Date().toISOString(),
        });
        logger.debug("[Quiz] ✅ Module progress saved to DB successfully.");
      } catch (e) {
        logger.warn("[Quiz] Module progress saving error (non-blocking):", e);
      }
    }

    // Step 2 — gpt-feedback request
    let feedbackJson: any = null;
    try {
      const url = `${API_BASE_URL}/gpt-feedback`;
      logger.debug("[Quiz] Submitting GPT feedback request →", url);
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          quiz: questions,
          userAnswers,
          user_id: dbUserId,
          employee_name: employeeName ?? "",
          assessment_id: assessmentId,
          modules: moduleObjects ?? [],
        }),
      });

      if (response.ok) {
        feedbackJson = await response.json();
      } else {
        const body = await response.text();
        logger.warn(`[Quiz] GPT Feedback HTTP ${response.status}:`, body.slice(0, 200));
      }
    } catch (gptErr) {
      logger.warn("[Quiz] GPT Feedback request failed or rate limited (non-blocking):", gptErr);
    }

    // Step 3 — background refresh (non-blocking)
    fetch(`${API_BASE_URL}/employee-assessments/user/${dbUserId}`, {
      method: "GET",
      headers,
    })
      .then((r) =>
        logger.debug("[Quiz] Step 3 assessments refresh HTTP", r.status),
      )
      .catch((e) =>
        logger.warn(
          "[Quiz] Step 3 assessments refresh failed (non-blocking):",
          e,
        ),
      );

    return {
      score: feedbackJson?.score ?? localScore,
      maxScore: feedbackJson?.maxScore ?? questions.length,
      feedback:
        feedbackJson?.feedback ??
        "Quiz completed & score saved! Detailed AI analysis is currently queued.",
    };
  } catch (err) {
    logger.error("[Quiz] submitQuizForGrading error:", err);
    throw err;
  }
};


export interface FormatSubmissionInput {
  taskId: string;
  childTaskId?: string;
  assignmentId: string;
  userId: string;
  maxScore: number;
  score: number;
  format: SubmissionFormat;
  formatAnswer: FormatAnswer;
}

const TEXT_ANALYSIS_FORMATS: SubmissionFormat[] = ["text"];

export const submitFormatAnswer = async (
  input: FormatSubmissionInput,
): Promise<TaskSubmissionResponse> => {
  const {
    taskId,
    childTaskId,
    assignmentId,
    userId,
    maxScore,
    score,
    format,
    formatAnswer,
  } = input;

  const usesTextAnalysis = TEXT_ANALYSIS_FORMATS.includes(format);
  const url = usesTextAnalysis
    ? `${API_BASE_URL}/text-analysis/submit`
    : `${API_BASE_URL}/task-manager/tasks/submit`;

  const body: Record<string, any> = {
    task_id: taskId,
    assignment_id: assignmentId,
    user_id: userId,
    max_score: maxScore,
    score: score,
    submission_type: format,
  };

  if (childTaskId) {
    body.child_task_id = childTaskId;
  }

  if (format === "text") {
    body.text_response = formatAnswer.text_answer ?? "";
  } else if (format === "multiple_choice") {
    body.answers = formatAnswer.answers ?? [];
  } else if (format === "image") {
    body.image_url = formatAnswer.image_url ?? "";
  } else if (format === "video") {
    body.video_url = formatAnswer.video_url ?? "";
  } else if (format === "audio") {
    body.audio_url = formatAnswer.audio_url ?? "";
  }

  try {
    const headers = await getHeaders(userId);
    logger.debug("[Request] submitFormatAnswer →", url, {
      task_id: taskId,
      format,
    });

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      logger.error(
        `[Request] submitFormathhAnswer(${format}) ${response.status}:`,
        errText,
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = (await response.json()) as TaskSubmissionResponse;
    logger.debug(
      `[Request] submitFormatAnswer(${format}) ✅`,
      json?.submission_id,
    );
    return json;
  } catch (error) {
    logger.error(
      `[Request] Error submitting ${format} answer for task ${taskId}:`,
      error,
    );
    throw error;
  }
};

export const submitTaskAnswer = async (
  userId: string,
  payload: TaskSubmissionPayload,
): Promise<TaskSubmissionResponse> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/task-manager/tasks/submit`;

    // Map internal submission_type → the wire value the API actually expects.
    // "options" tasks must be posted as "multiple_choice".
    const wireSubmissionType =
      payload.submission_type === "options"
        ? "multiple_choice"
        : payload.submission_type;

    const body: Record<string, any> = {
      task_id: payload.task_id,
      assignment_id: payload.assignment_id,
      user_id: payload.user_id,
      submission_type: wireSubmissionType,
      max_score: payload.max_score,
      score: payload.score,
    };

    if (payload.submission_type === "image") {
      body.image_url = payload.image_url ?? "";
    } else if (payload.submission_type === "text") {
      body.text_response = payload.text_answer ?? "";
    } else if (payload.submission_type === "options") {
      body.answers =
        payload.answers ??
        (payload.selected_options ?? []).map((opt) => ({
          question_id: "",
          question: "",
          selected_option: opt,
        }));
    }

    logger.debug("[Request] submitTaskAnswer →", url, {
      task_id: payload.task_id,
      submission_type: payload.submission_type,
    });

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      logger.error(`[Request] submitTaskAnswer ${response.status}:`, errText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = (await response.json()) as TaskSubmissionResponse;
    logger.debug("[Request] submitTaskAnswer", json?.submission_id);
    return json;
  } catch (error) {
    logger.error("[Request] Error submitting task answer:", error);
    throw error;
  }
};

export const getEmployeeAssessments = async (
  userId: string,
): Promise<any | null> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/employee-assessments/user/${userId}`;
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    logger.warn("[Quiz] getEmployeeAssessments error:", err);
    return null;
  }
};

export const getLeaderboardHighlight = async (
  companyId: string,
  userId: string,
  topLimit: number = 10,
): Promise<LeaderboardHighlightResponse> => {
  try {
    const url = `${API_BASE_URL}/analytics/leaderboard/${companyId}/highlight?top_limit=${topLimit}`;
    logger.debug("[Request] getLeaderboardHighlight →", url);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId,
      noCache: true,
    });
    return json;
  } catch (error) {
    logger.error("[Request] Error fetching leaderboard highlight:", error);
    throw error;
  }
};

export const getAssessmentsBatch = async (
  userId: string,
  assessmentIds: string[],
): Promise<any | null> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/assessments/batch`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ assessment_ids: assessmentIds }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    logger.warn("[Request] getAssessmentsBatch error:", err);
    return null;
  }
};

export const getProcessedModulesBatch = async (
  userId: string,
  processedModuleIds: string[],
): Promise<any | null> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/processed-modules/batch`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ processed_module_ids: processedModuleIds }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    logger.warn("[Request] getProcessedModulesBatch error:", err);
    return null;
  }
};
