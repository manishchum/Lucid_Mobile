import { logger } from "../../utils/UnifiedLogger";
import { maskPhone, maskUrl } from "../../utils/sanitizer";
import {
  EXPO_API_URL,
  API_BASE_URL,
  WS_BASE_URL,
  JWT_TOKEN_KEY,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_RETRY_DELAY_MS,
  getFirebaseToken,
  refreshFirebaseToken,
  getHeaders,
  getPublicHeaders,
  ApiError,
  ApiFetchOptions,
  apiFetch,
  clearInFlightRequests,
} from "../client";
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
import { getMobileDeviceId } from "../../utils/deviceId";
import { uploadMediaToStorage } from "../../services/storageUpload";
import { supabase } from "../../services/supabase";

export {
  EXPO_API_URL,
  API_BASE_URL,
  WS_BASE_URL,
  JWT_TOKEN_KEY,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_RETRY_DELAY_MS,
  getFirebaseToken,
  refreshFirebaseToken,
  getHeaders,
  getPublicHeaders,
  ApiError,
  ApiFetchOptions,
  apiFetch,
  clearInFlightRequests,
};

const MODULE_CHAT_URL = `${API_BASE_URL}/module-chat`;

export interface AuthMeTenantCompany {
  company_id?: string;
  name?: string;
  domain?: string | null;
  company_logo?: string | null;
  subscription_tier?: string | null;
  subscription_addons?: string[] | null;
  learning_style_enabled?: boolean;
}

export interface AuthMeResponse {
  success: boolean;
  employeeData: {
    user_id: string;
    name: string;
    email: string;
    phone: string;
    avatar_url?: string | null;
    position?: string | null;
    employment_status?: string | null;
    hire_date?: string | null;
    company_id: string;
    function_id: string | null;
    sub_function_id: string | null;
    manager_id: string | null;
    is_active: boolean;
    company_name?: string | null;
    company_logo?: string | null;
    subscription_tier?: string | null;
    learning_style_enabled?: boolean;
  };
  userId: string;
  userRoles: string[];
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isDeveloper: boolean;
  isManager: boolean;
  isManagerofUsers: boolean;
  tenant: {
    activeCompany: AuthMeTenantCompany | null;
    availableCompanies?: AuthMeTenantCompany[];
  };
  notifications?: {
    unread_count?: number;
    items?: any[];
  };
}

/**
 * Authoritative session & profile bootstrap (`GET /api/auth/me`).
 * Validates Firebase JWT + mobile single-device Redis session and returns
 * active user profile, company addons/tenant metadata, and recent notifications.
 */
export const getAuthMe = async (options?: {
  registerSession?: boolean;
  timeoutMs?: number;
  retries?: number;
  suppressSessionInvalidEvent?: boolean;
}): Promise<AuthMeResponse> => {
  const url = `${API_BASE_URL}/auth/me`;
  const headers: Record<string, string> = {};
  if (options?.registerSession) {
    headers["X-Register-Session"] = "true";
  }
  return apiFetch<AuthMeResponse>(url, {
    method: "GET",
    noCache: true,
    timeoutMs: options?.timeoutMs ?? 12_000,
    retries: options?.retries ?? 0,
    suppressSessionInvalidEvent: options?.suppressSessionInvalidEvent,
    headers,
  });
};

export const sendOtpApi = async (
  phone: string,
): Promise<{ success: boolean; message?: string; retry_after?: number }> => {
  const url = `${API_BASE_URL}/auth/send-otp`;
  const deviceId = await getMobileDeviceId();
  try {
    return await apiFetch<{
      success: boolean;
      message?: string;
      retry_after?: number;
    }>(url, {
      method: "POST",
      public: true,
      suppressSessionInvalidEvent: true,
      timeoutMs: 15_000,
      retries: 0,
      headers: {
        "X-Device-ID": deviceId,
        "X-Platform": "mobile",
      },
      body: JSON.stringify({ phone }),
    });
  } catch (err: any) {
    logger.error("[Request] sendOtpApi error:", err);
    throw err;
  }
};

export const verifyOtpApi = async (
  phone: string,
  otp: string,
): Promise<{ success: boolean; token: string; user: any; company?: any }> => {
  const url = `${API_BASE_URL}/auth/verify-otp`;
  const deviceId = await getMobileDeviceId();
  try {
    return await apiFetch<{
      success: boolean;
      token: string;
      user: any;
      company?: any;
    }>(url, {
      method: "POST",
      public: true,
      suppressSessionInvalidEvent: true,
      timeoutMs: 15_000,
      retries: 0,
      headers: {
        "X-Device-ID": deviceId,
        "X-Platform": "mobile",
      },
      body: JSON.stringify({
        phone,
        otp,
        device_id: deviceId,
        platform: "mobile",
      }),
    });
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
    module_id: data.module_id,
  });

  const payload: Record<string, any> = {
    user_message: data.user_message,
    user_id: data.user_id,
    company_id: data.company_id,
    chat_history: data.chat_history,
  };

  if (data.processed_module_id) {
    payload.processed_module_id = data.processed_module_id;
  }
  if (data.module_id) {
    payload.module_id = data.module_id;
  }

  const result = await apiFetch<PostModuleChatResponseDto>(MODULE_CHAT_URL, {
    method: "POST",
    userId: data.user_id,
    companyId: data.company_id,
    timeoutMs: 60_000,
    body: JSON.stringify(payload),
  });

  logger.info("[Request] postModuleChat success");
  return result;
};

export { PresignedUploadResponse, getPresignedUploadUrlApi } from "../../services/storageUpload";

// 1. Get user by phone
export const getUserByPhone = async (phone: string): Promise<UserResponse> => {
  try {
    const url = `${API_BASE_URL}/users/by-phone/${encodeURIComponent(phone)}`;
    logger.debug("[Request] getUserByPhone →", maskUrl(url));
    const json = await apiFetch<UserResponse>(url, { method: "GET" });
    if (json.user) {
      logger.debug("[Request] getUserByPhone ✅ user_id:", json.user.user_id);
    } else {
      logger.warn("[Request] getUserByPhone — no user found for phone:", maskPhone(phone));
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

// 1b-2. Fetch full company details (addons, tiers, logos) directly
export const getCompanyDetails = async (
  companyId: string,
  userId?: string,
): Promise<any | null> => {
  if (!companyId) return null;
  try {
    const url = `${API_BASE_URL}/companies/${encodeURIComponent(companyId)}`;
    logger.debug("[Request] getCompanyDetails →", url);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId,
      companyId,
      noCache: true,
    });

    const company = json?.company ?? json?.data?.company ?? json?.data ?? json;
    if (!company || typeof company !== "object") {
      logger.warn(
        "[Request] getCompanyDetails — company not found for ID:",
        companyId,
      );
      return null;
    }
    return company;
  } catch (error) {
    logger.error("[Request] Error fetching company details:", error);
    return null;
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
  options?: { timeoutMs?: number; retries?: number },
): Promise<ModuleProgress> => {
  try {
    const url = `${API_BASE_URL}/module-progress/user/${userId}`;
    logger.debug("[Request] getModuleProgress →", url);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId,
      timeoutMs: options?.timeoutMs ?? 25000,
      retries: options?.retries ?? 1,
    });
    logger.debug(
      "[Request] getModuleProgress ✅ count:",
      json?.count,
      "entries:",
      json?.progress?.length,
    );
    return json;
  } catch (error) {
    logger.warn("[Request] Error fetching module progress:", error);
    throw error;
  }
};

// 4. Get learning style by userId
export const getLearningStyle = async (
  userId: string,
): Promise<LearningStyleResponse> => {
  try {
    return await apiFetch<LearningStyleResponse>(
      `${API_BASE_URL}/learning-style?user_id=${userId}`,
      {
        method: "GET",
        userId,
      },
    );
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
    return await apiFetch<UserRolesResponse>(
      `${API_BASE_URL}/roles/users/${userId}`,
      {
        method: "GET",
        userId,
      },
    );
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
    return await apiFetch<TrainingModulesResponse>(
      `${API_BASE_URL}/training-modules/company/${companyId}`,
      {
        method: "GET",
        userId,
        companyId,
      },
    );
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
    return await apiFetch<{ module: TrainingModule }>(
      `${API_BASE_URL}/training-modules/${moduleId}`,
      {
        method: "GET",
        userId,
      },
    );
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
    return await apiFetch<CompanyResponse>(
      `${API_BASE_URL}/companies/${companyId}`,
      {
        method: "GET",
        userId,
        companyId,
      },
    );
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
    return await apiFetch<CompanyUsersResponse>(
      `${API_BASE_URL}/users/company/${companyId}`,
      {
        method: "GET",
        userId,
        companyId,
      },
    );
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

    return await apiFetch<any>(`${API_BASE_URL}/training-plan`, {
      method: "POST",
      userId: dbUserId,
      body: JSON.stringify({ user_id: dbUserId, module_id: moduleId }),
    });
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
    return await apiFetch<any>(
      `${API_BASE_URL}/processed-modules/original-module/${originalModuleId}`,
      {
        method: "GET",
        userId,
      },
    );
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
    // Web uses original_module_id + user_id_filter on first attempt
    const primaryId = originalModuleId || processedModuleId;
    const paramName = originalModuleId
      ? "original_module_id"
      : "processed_module_id";

    const url = `${API_BASE_URL}/assessments/filter/search?type=module&${paramName}=${primaryId}&learning_style=${encodeURIComponent(learningStyle)}&user_id_filter=${userId}`;
    logger.debug("[Quiz] Checking existing assessment →", url);
    const json = await apiFetch<any>(url, { method: "GET", userId });
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
    const url = `${API_BASE_URL}/gpt-mcq-quiz`;
    logger.debug("[Quiz] Generating quiz →", url);
    const json = await apiFetch<any>(url, {
      method: "POST",
      userId,
      companyId,
      timeoutMs: 45_000,
      body: JSON.stringify({
        moduleId: processedModuleId, // camelCase, matches web
        learningStyle,
        userId,
        companyId,
      }),
    });

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
        const searchJson = await apiFetch<any>(searchUrl, {
          method: "GET",
          userId,
        });
        const list: any[] =
          searchJson?.data?.assessments ?? searchJson?.assessments ?? [];
        assessmentId = list[0]?.assessment_id;
        logger.debug(
          "[Quiz] generateModuleQuiz — assessmentId from GET fallback:",
          assessmentId,
        );
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

export const generateBaselineQuiz = async (
  moduleId: string,
  learningStyle: string,
  userId: string,
  companyId: string,
): Promise<{
  questions: any[];
  assessmentId?: string;
  thresholdValue?: number;
} | null> => {
  try {
    const url = `${API_BASE_URL}/gpt-mcq-quiz`;
    logger.debug("[Quiz] Generating baseline quiz →", url);
    const json = await apiFetch<any>(url, {
      method: "POST",
      userId,
      companyId,
      timeoutMs: 45_000,
      body: JSON.stringify({
        moduleIds: [moduleId],
        learningStyle,
        userId,
        user_id: userId,
        companyId,
        isBaseline: true,
        assessmentType: "baseline",
      }),
    });

    let questions: any[] | null = null;
    let assessmentId: string | undefined;
    let thresholdValue: number | undefined =
      json?.threshold_value ?? json?.thresholdValue ?? json?.threshold;

    if (Array.isArray(json?.quizMapping) && json.quizMapping.length > 0) {
      const entry = json.quizMapping[0];
      const raw = entry?.questions;
      if (raw) {
        questions = typeof raw === "string" ? JSON.parse(raw) : raw;
        assessmentId = entry?.assessment_id;
      }
    } else if (Array.isArray(json?.quiz)) {
      questions = json.quiz;
      assessmentId = json?.assessmentId ?? json?.assessment_id;
    } else if (json?.data?.assessments?.length > 0) {
      const entry = json.data.assessments[0];
      const raw = entry?.questions;
      if (raw) {
        questions = typeof raw === "string" ? JSON.parse(raw) : raw;
        assessmentId = entry?.assessment_id;
      }
    }

    if (questions && questions.length > 0) {
      return { questions, assessmentId, thresholdValue };
    }
    return null;
  } catch (err) {
    logger.error("[Quiz] generateBaselineQuiz error:", err);
    return null;
  }
};

// 12. Get a single processed module by its specific processed_module_id
export const getProcessedModuleById = async (
  processedModuleId: string,
  userId: string,
): Promise<any> => {
  try {
    const url = `${API_BASE_URL}/processed-modules/${processedModuleId}`;
    logger.debug("[v0] [Request] Fetching processed module:", {
      url,
      processedModuleId,
    });

    const json = await apiFetch<any>(url, { method: "GET", userId });

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
  forceFresh: boolean = false,
): Promise<DashboardSummaryResponse> => {
  try {
    const url = `${API_BASE_URL}/employee/dashboard_summary/${encodeURIComponent(userId)}`;
    logger.debug("[Request] getDashboardSummary →", url, "forceFresh:", forceFresh);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId,
      companyId,
      timeoutMs: 30000,
      headers: {
        "X-Company-ID": companyId,
        ...(forceFresh
          ? { "Cache-Control": "no-cache", Pragma: "no-cache" }
          : {}),
      },
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

const isUuidFormat = (val?: string | null): boolean =>
  Boolean(
    val &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        val,
      ),
  );

// 14. Get tasks (Task Manager) — GET /task-manager/tasks/user/{userId}

export const getTasks = async (
  userId: string,
  companyId: string,
  forceFresh: boolean = false,
): Promise<TasksResponse> => {
  try {
    const targetId = userId && isUuidFormat(userId) ? userId : "me";
    const url = `${API_BASE_URL}/task-manager/tasks/user/${encodeURIComponent(targetId)}`;
    logger.debug("[Request] getTasks →", url, "forceFresh:", forceFresh);
    const json = await apiFetch<any>(url, {
      method: "GET",
      userId: targetId === "me" ? undefined : targetId,
      companyId,
      timeoutMs: 30_000,
      headers: forceFresh
        ? { "Cache-Control": "no-cache", Pragma: "no-cache" }
        : undefined,
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
    const url = `${API_BASE_URL}/module-progress`;
    logger.debug("[Quiz] POST /module-progress →", url, {
      module_id: payload.module_id,
      processed_module_id: payload.processed_module_id,
      quiz_score: payload.quiz_score,
      max_score: payload.max_score,
    });
    await apiFetch<any>(url, {
      method: "POST",
      userId: dbUserId,
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
    logger.debug("[Quiz] POST /module-progress ✅");
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
 *   1. POST /module-progress           (non-blocking)
 *   2. POST /gpt-feedback
 *   3. GET  /employee-assessments      (non-blocking background refresh)
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
    if (processedModuleId || moduleId) {
      try {
        await postModuleProgress(dbUserId, {
          module_id: moduleId || "",
          processed_module_id: processedModuleId || "",
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
      feedbackJson = await apiFetch<any>(url, {
        method: "POST",
        userId: dbUserId,
        timeoutMs: 45_000,
        body: JSON.stringify({
          quiz: questions,
          userAnswers,
          user_id: dbUserId,
          employee_name: employeeName ?? "",
          assessment_id: assessmentId,
          modules: moduleObjects ?? [],
        }),
      });
    } catch (gptErr) {
      logger.warn("[Quiz] GPT Feedback request failed or rate limited (non-blocking):", gptErr);
    }

    // Step 3 — background refresh (non-blocking)
    apiFetch<any>(`${API_BASE_URL}/employee-assessments/user/${dbUserId}`, {
      method: "GET",
      userId: dbUserId,
      noCache: true,
    })
      .then(() =>
        logger.debug("[Quiz] Step 3 assessments refresh ✅"),
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

  const resolvedUserId = userId;

  const url = `${API_BASE_URL}/task-manager/tasks/submit`;

  const body: Record<string, any> = {
    task_id: taskId,
    assignment_id: assignmentId,
    user_id: resolvedUserId,
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
    let imgUrl = formatAnswer.image_url ?? "";
    if (imgUrl && (imgUrl.startsWith("file://") || imgUrl.startsWith("file:/"))) {
      imgUrl = await uploadMediaToStorage(imgUrl, "image/jpeg", { userId: resolvedUserId ?? undefined });
    }
    body.image_url = imgUrl;
  } else if (format === "video") {
    let vidUrl = formatAnswer.video_url ?? "";
    if (vidUrl && (vidUrl.startsWith("file://") || vidUrl.startsWith("file:/"))) {
      vidUrl = await uploadMediaToStorage(vidUrl, "video/mp4", { userId: resolvedUserId ?? undefined });
    }
    body.video_url = vidUrl;
  } else if (format === "audio") {
    let audUrl = formatAnswer.audio_url ?? "";
    if (audUrl && (audUrl.startsWith("file://") || audUrl.startsWith("file:/"))) {
      audUrl = await uploadMediaToStorage(audUrl, "audio/m4a", { userId: resolvedUserId ?? undefined });
    }
    body.audio_url = audUrl;
  }

  try {
    logger.debug("[Request] submitFormatAnswer →", url, {
      task_id: taskId,
      format,
    });

    const json = await apiFetch<TaskSubmissionResponse>(url, {
      method: "POST",
      userId: resolvedUserId ?? undefined,
      timeoutMs: 30_000,
      body: JSON.stringify(body),
    });
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
    const resolvedUserId = payload.user_id || userId;
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
      user_id: resolvedUserId,
      submission_type: wireSubmissionType,
      max_score: payload.max_score,
      score: payload.score,
    };

    if (payload.submission_type === "image") {
      let imgUrl = payload.image_url ?? "";
      if (imgUrl && (imgUrl.startsWith("file://") || imgUrl.startsWith("file:/"))) {
        imgUrl = await uploadMediaToStorage(imgUrl, "image/jpeg", { userId });
      }
      body.image_url = imgUrl;
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

    const json = await apiFetch<TaskSubmissionResponse>(url, {
      method: "POST",
      userId: resolvedUserId ?? undefined,
      timeoutMs: 30_000,
      body: JSON.stringify(body),
    });
    logger.debug("[Request] submitTaskAnswer", json?.submission_id);

    // Broadcast instant realtime completion event across Web & Mobile
    try {
      const channel = supabase.channel(`realtime_tasks_${resolvedUserId}_broadcast`);
      await channel.subscribe();
      await channel.send({
        type: "broadcast",
        event: "task_completed",
        payload: { userId: resolvedUserId, taskId: payload.task_id, submissionId: json?.submission_id },
      });
      setTimeout(() => {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }, 1000);
    } catch (broadcastErr) {
      logger.warn("[Request] Broadcast task_completed failed:", broadcastErr);
    }

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
    const url = `${API_BASE_URL}/employee-assessments/user/${userId}`;
    return await apiFetch<any>(url, { method: "GET", userId });
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
      companyId,
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
    const url = `${API_BASE_URL}/assessments/batch`;
    return await apiFetch<any>(url, {
      method: "POST",
      userId,
      body: JSON.stringify({ assessment_ids: assessmentIds }),
    });
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
    const url = `${API_BASE_URL}/processed-modules/batch`;
    return await apiFetch<any>(url, {
      method: "POST",
      userId,
      body: JSON.stringify({ processed_module_ids: processedModuleIds }),
    });
  } catch (err) {
    logger.warn("[Request] getProcessedModulesBatch error:", err);
    return null;
  }
};
