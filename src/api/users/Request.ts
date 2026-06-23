import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
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
} from "./Dto";

const API_BASE_URL = "https://api.workfloww.ai/api";
const MODULE_CHAT_URL = "https://api.workfloww.ai/api/module-chat";

const getFirebaseToken = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;

    if (currentUser) {
      currentUser
        .getIdToken(true)
        .then(resolve)
        .catch(() => resolve(null));
      return;
    }

    const timeout = setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, 5000);
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      clearTimeout(timeout);
      unsubscribe();
      if (user) {
        user
          .getIdToken(true)
          .then(resolve)
          .catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  });
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
  console.info("[Request] postModuleChat", {
    processed_module_id: data.processed_module_id,
  });

  const response = await fetch(MODULE_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      processed_module_id: data.processed_module_id,
      user_message: data.user_message,
      user_id: data.user_id,
      company_id: data.company_id,
      chat_history: data.chat_history,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[Request] Error posting module chat:", errorText);
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = (await response.json()) as PostModuleChatResponseDto;
  console.info("[Request] postModuleChat success");
  return result;
};

const getHeaders = async (userId?: string): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (userId) headers["X-User-ID"] = userId;
  const token = await getFirebaseToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // ─── DEBUG ───────────────────────────────────────────────────────────────
  console.log("[DEBUG] getHeaders called with userId:", userId);
  console.log("[DEBUG] Authorization present:", !!token);
  console.log("[DEBUG] X-User-ID value:", userId ?? "NOT SET ⚠️");
  // ─────────────────────────────────────────────────────────────────────────

  return headers;
};

const getPublicHeaders = (userId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (userId) headers["X-User-ID"] = userId;
  return headers;
};

// 1. Get user by email
export const getUserByEmail = async (email: string): Promise<UserResponse> => {
  try {
    const url = `${API_BASE_URL}/users/by-email/${encodeURIComponent(email)}`;
    console.log("[Request] getUserByEmail →", url);
    const response = await fetch(url, {
      method: "GET",
      headers: getPublicHeaders(),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getUserByEmail ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    if (json.user) {
      console.log("[Request] getUserByEmail ✅ user_id:", json.user.user_id);
    } else {
      console.error(
        "[Request] getUserByEmail — user is null:",
        JSON.stringify(json),
      );
    }
    return json;
  } catch (error) {
    console.error("[Request] Error fetching user by email:", error);
    throw error;
  }
};

// 1b. Get user by phone
export const getUserByPhone = async (phone: string): Promise<UserResponse> => {
  try {
    const url = `${API_BASE_URL}/users/by-phone/${encodeURIComponent(phone)}`;
    console.log("[Request] getUserByPhone →", url);
    const response = await fetch(url, {
      method: "GET",
      headers: getPublicHeaders(),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getUserByPhone ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    if (json.user) {
      console.log("[Request] getUserByPhone ✅ user_id:", json.user.user_id);
    } else {
      console.warn(
        "[Request] getUserByPhone — no user found for phone:",
        phone,
      );
    }
    return json;
  } catch (error) {
    console.error("[Request] Error fetching user by phone:", error);
    throw error;
  }
};

export const getModuleProgress = async (
  userId: string,
): Promise<ModuleProgress> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/module-progress/user/${userId}`;
    console.log("[Request] getModuleProgress →", url);
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getModuleProgress ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    console.log(
      "[Request] getModuleProgress ✅ count:",
      json?.count,
      "entries:",
      json?.progress?.length,
    );
    return json;
  } catch (error) {
    console.error("[Request] Error fetching module progress:", error);
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
    console.error("[Request] Error fetching learning style:", error);
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
    console.error("[Request] Error fetching user roles:", error);
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
    console.error("[Request] Error fetching training modules:", error);
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
    console.error("[Request] Error fetching training module detail:", error);
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
    console.error("[Request] Error fetching company:", error);
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
    console.error("[Request] Error fetching company users:", error);
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
    const currentUser = getAuth().currentUser;
    if (!currentUser) throw new Error("No authenticated Firebase user");

    const headers = await getHeaders(dbUserId);
    const response = await fetch(`${API_BASE_URL}/training-plan`, {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: currentUser.uid, module_id: moduleId }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] POST /training-plan ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("[Request] Error fetching training plan:", error);
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
      console.error(`[Request] getProcessedModules ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("[Request] Error fetching processed modules:", error);
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
    console.log("[Quiz] Checking existing assessment →", url);
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      console.warn("[Quiz] getExistingAssessment HTTP", response.status);
      return null;
    }
    const json = await response.json();
    const assessments: any[] =
      json?.data?.assessments ?? json?.assessments ?? [];
    if (assessments.length === 0) return null;
    const raw = assessments[0]?.questions;
    if (!raw) return null;
    const questions = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { questions, assessmentId: assessments[0]?.assessment_id };
  } catch (err) {
    console.warn("[Quiz] getExistingAssessment error:", err);
    return null;
  }
};

export const generateModuleQuiz = async (
  processedModuleId: string,
  learningStyle: string,
  userId: string,
  companyId: string,
): Promise<{ questions: any[]; assessmentId?: string } | null> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/gpt-mcq-quiz`;
    console.log("[Quiz] Generating quiz →", url);
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
      console.error("[Quiz] submitQuizForGrading HTTP", response.status, body);
      // ─── DEBUG: log all response headers ─────────────────────────────────
      console.error("[DEBUG] Response headers:");
      response.headers.forEach((value, key) => {
        console.error(`[DEBUG]   ${key}: ${value}`);
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

    // Shape A
    if (Array.isArray(json?.quizMapping) && json.quizMapping.length > 0) {
      const entry = json.quizMapping[0];
      const raw = entry?.questions;
      if (raw) {
        questions = typeof raw === "string" ? JSON.parse(raw) : raw;
        assessmentId = entry?.assessment_id;
        console.log(
          "[Quiz] generateModuleQuiz — shape A (quizMapping), q count:",
          questions?.length,
        );
      }
    }

    // Shape B
    if (!questions && Array.isArray(json?.quiz) && json.quiz.length > 0) {
      questions = json.quiz;
      assessmentId = json?.assessmentId;
      console.log(
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
          console.log(
            "[Quiz] generateModuleQuiz — shape C (data.assessments), q count:",
            questions?.length,
          );
        }
      }
    }

    if (!questions || questions.length === 0) {
      console.error(
        "[Quiz] generateModuleQuiz — no questions in response. Raw:",
        JSON.stringify(json).slice(0, 400),
      );
      return null;
    }

    // If assessmentId still missing, fall back to GET (mirrors web behaviour)
    if (!assessmentId) {
      console.log(
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
          console.log(
            "[Quiz] generateModuleQuiz — assessmentId from GET fallback:",
            assessmentId,
          );
        }
      } catch (fallbackErr) {
        console.warn(
          "[Quiz] generateModuleQuiz — GET fallback failed (non-blocking):",
          fallbackErr,
        );
      }
    }

    return { questions, assessmentId };
  } catch (err) {
    console.error("[Quiz] generateModuleQuiz error:", err);
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
    console.log("[v0] [Request] Fetching processed module:", {
      url,
      processedModuleId,
    });

    const response = await fetch(url, { method: "GET", headers });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[v0] [Request] ❌ getProcessedModuleById HTTP ${response.status}:`,
        body.substring(0, 200),
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();

    if (!json || !json.data) {
      throw new Error('API response missing "data" field');
    }

    console.log(
      "[v0] [Request] ✅ Processed module fetched:",
      json.data?.title,
    );
    return json;
  } catch (error) {
    console.error("[v0] [Request] ❌ Error fetching processed module:", error);
    throw error;
  }
};

// 13. Dashboard Summary
export const getDashboardSummary = async (
  userId: string,
  companyId: string,
): Promise<DashboardSummaryResponse> => {
  try {
    const headers = await getHeaders(userId);
    headers["X-Company-ID"] = companyId;
    const url = `${API_BASE_URL}/employee/dashboard_summary/${encodeURIComponent(userId)}`;
    console.log("[Request] getDashboardSummary →", url);
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getDashboardSummary ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();

    console.log(
      "[Request] ══════════════════════════════════════════════════════",
    );
    console.log(
      "[Request] getDashboardSummary raw response — plans:",
      json?.plans?.length,
    );
    (json?.plans ?? []).forEach((p: any, i: number) => {
      console.log(
        `[Request] Raw Plan[${i}] learning_plan_id=${p?.learning_plan_id}, module_id=${p?.module_id}`,
      );
      console.log(
        `[Request] Raw Plan[${i}] processed_module_ids=`,
        JSON.stringify(p?.processed_module_ids),
      );
      console.log(
        `[Request] Raw Plan[${i}] plan_json.modules=`,
        JSON.stringify((p?.plan_json?.modules ?? []).map((m: any) => m?.title)),
      );
    });
    console.log(
      "[Request] ══════════════════════════════════════════════════════",
    );

    return json;
  } catch (error) {
    console.error("[Request] Error fetching dashboard summary:", error);
    throw error;
  }
};

// 14. Get tasks (Task Manager) — GET /task-manager/tasks

export const getTasks = async (
  userId: string,
  companyId: string,
): Promise<TasksResponse> => {
  try {
    const headers = await getHeaders(userId);
    headers["X-Company-ID"] = companyId;
    const url = `${API_BASE_URL}/task-manager/tasks`;
    console.log("[Request] getTasks →", url);
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getTasks ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    console.log(
      "[Request] getTasks ✅ total:",
      json?.total,
      "tasks:",
      json?.tasks?.length,
    );
    return json;
  } catch (error) {
    console.error("[Request] Error fetching tasks:", error);
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
    console.warn("[Quiz] getUserByEmailForQuiz error:", err);
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
    console.log("[Quiz] POST /module-progress →", url, {
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
      console.warn("[Quiz] POST /module-progress HTTP", response.status, body);
    } else {
      console.log("[Quiz] POST /module-progress ✅");
    }
  } catch (err) {
    console.warn("[Quiz] postModuleProgress error (non-blocking):", err);
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
    const currentUser = getAuth().currentUser;
    if (!currentUser) throw new Error("No authenticated Firebase user");

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
        .then((r) => console.log("[Quiz] Step 1 by-email HTTP", r.status))
        .catch((e) =>
          console.warn("[Quiz] Step 1 by-email failed (non-blocking):", e),
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

    const url = `${API_BASE_URL}/gpt-feedback`;
    console.log("[Quiz] Step 2 — submitting →", url, {
      assessmentId,
      answersCount: userAnswers.length,
      modulesCount: moduleObjects?.length ?? 0,
      userId: dbUserId,
    });

    // Step 2 — exact web module quiz payload shape
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

    if (!response.ok) {
      const body = await response.text();
      console.error("[Quiz] submitQuizForGrading HTTP", response.status, body);
      return null;
    }

    const json = await response.json();
    console.log("[Quiz] Step 2 ✅ score:", json?.score, "/", json?.maxScore);

    const score =
      typeof json?.score === "number"
        ? json.score
        : answerIndices.reduce((acc, selectedIdx, i) => {
            return acc + (selectedIdx === questions[i]?.correctIndex ? 1 : 0);
          }, 0);

    // Step 3 — module-progress.
    if (moduleId && processedModuleId) {
      try {
        await postModuleProgress(dbUserId, {
          module_id: moduleId,
          processed_module_id: processedModuleId,
          quiz_score: score,
          max_score: questions.length,
          quiz_feedback: json?.feedback ?? "",
          completed_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("[Quiz] Step 3 module-progress error (non-blocking):", e);
      }
    } else {
      console.warn(
        "[Quiz] Step 3 module-progress SKIPPED — missing moduleId or processedModuleId",
        { moduleId, processedModuleId },
      );
    }

    // Step 4 — background refresh (non-blocking)
    fetch(`${API_BASE_URL}/employee-assessments/user/${dbUserId}`, {
      method: "GET",
      headers,
    })
      .then((r) =>
        console.log("[Quiz] Step 4 assessments refresh HTTP", r.status),
      )
      .catch((e) =>
        console.warn(
          "[Quiz] Step 4 assessments refresh failed (non-blocking):",
          e,
        ),
      );

    return json;
  } catch (err) {
    console.error("[Quiz] submitQuizForGrading error:", err);
    return null;
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
    console.warn("[Quiz] getEmployeeAssessments error:", err);
    return null;
  }
};
