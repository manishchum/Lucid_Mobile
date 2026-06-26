import { useState, useEffect } from "react";
import {
  getUserByEmail,
  getUserByPhone,
  getUserRoles,
  getProcessedModules,
  getProcessedModuleById,
  getTrainingModules,
  getTrainingModuleDetail,
  getCompany,
  getLearningStyle,
  getCompanyUsers,
  getTrainingPlan,
  getDashboardSummary,
  getModuleProgress,
} from "./Request";
import {
  User,
  UserResponse,
  UserRolesResponse,
  UserRoleAssignment,
  LearningPlan,
  TrainingModulesResponse,
  TrainingModule,
  CompanyResponse,
  Company,
  LearningStyleResponse,
  LearningStyle,
  CompanyUsersResponse,
  DashboardSummaryResponse,
  ModuleProgress,
  ModuleProgressEntry,
} from "./Dto";

export const USER_QUERY_KEY = ["user"];

// ==================== USER BY EMAIL HOOK ====================
interface UseGetUserByEmailReturn {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetUserByEmail = (
  email: string | null,
): UseGetUserByEmailReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    if (!email) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: UserResponse = await getUserByEmail(email);
      setUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch user"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (email) fetchUser();
  }, [email]);

  return { user, isLoading, error, refetch: fetchUser };
};

// ==================== USER BY PHONE HOOK ====================
interface UseGetUserByPhoneReturn {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetUserByPhone = (
  phone: string | null,
): UseGetUserByPhoneReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    if (!phone) return;
    setIsLoading(true);
    setError(null);
    try {
      // Defensive normalization — backend strictly expects +91XXXXXXXXXX.
      const digits = phone.replace(/[^\d]/g, "");
      const normalizedPhone =
        phone.startsWith("+91") && phone.length === 13
          ? phone
          : digits.length === 10
            ? `+91${digits}`
            : digits.length === 12 && digits.startsWith("91")
              ? `+${digits}`
              : digits.length === 11 && digits.startsWith("0")
                ? `+91${digits.slice(1)}`
                : phone;
      const response: UserResponse = await getUserByPhone(normalizedPhone);
      setUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch user"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (phone) fetchUser();
  }, [phone]);

  return { user, isLoading, error, refetch: fetchUser };
};

// ==================== USER ROLES HOOK ====================
interface UseGetUserRolesReturn {
  roles: UserRoleAssignment[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetUserRoles = (
  userId: string | null,
): UseGetUserRolesReturn => {
  const [roles, setRoles] = useState<UserRoleAssignment[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRoles = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: UserRolesResponse = await getUserRoles(userId);
      setRoles(response.assignments);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch user roles"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [userId]);

  return { roles, isLoading, error, refetch: fetchRoles };
};

// ==================== PROCESSED MODULES HOOK ====================
interface UseGetProcessedModulesReturn {
  modules: any[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetProcessedModules = (
  userId: string | null,
): UseGetProcessedModulesReturn => {
  const [modules, setModules] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchModules = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getProcessedModules(userId, userId);
      setModules(response?.data || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to fetch processed modules"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, [userId]);

  return { modules, isLoading, error, refetch: fetchModules };
};

// ==================== PROCESSED MODULE BY ID HOOK ====================
interface UseGetProcessedModuleByIdReturn {
  module: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetProcessedModuleById = (
  processedModuleId: string | null,
  userId: string | null,
): UseGetProcessedModuleByIdReturn => {
  const [module, setModule] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchModule = async () => {
    if (!processedModuleId || !userId) {
      setModule(null);
      return;
    }
    setIsLoading(true);
    setModule(null);
    setError(null);
    try {
      const response = await getProcessedModuleById(processedModuleId, userId);
      const data = response?.data ?? null;
      if (!data) throw new Error("API returned empty data field");
      setModule(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to fetch processed module"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModule();
  }, [processedModuleId, userId]);

  return { module, isLoading, error, refetch: fetchModule };
};

// ==================== TRAINING MODULES HOOK ====================
interface UseGetTrainingModulesReturn {
  modules: TrainingModule[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetTrainingModules = (
  sprintId: string | null,
  userId: string | null,
): UseGetTrainingModulesReturn => {
  const [modules, setModules] = useState<TrainingModule[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchModules = async () => {
    if (!sprintId || !userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: TrainingModulesResponse = await getTrainingModules(
        sprintId,
        userId,
      );
      setModules(response.modules || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to fetch training modules"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, [sprintId, userId]);

  return { modules, isLoading, error, refetch: fetchModules };
};

// ==================== TRAINING MODULE DETAIL HOOK ====================
interface UseGetTrainingModuleDetailReturn {
  module: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetTrainingModuleDetail = (
  moduleId: string | null,
): UseGetTrainingModuleDetailReturn => {
  const [module, setModule] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchModule = async () => {
    if (!moduleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: TrainingModulesResponse = await getTrainingModuleDetail(
        moduleId,
        moduleId,
      );
      setModule(response.modules?.[0] || null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch module detail"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModule();
  }, [moduleId]);

  return { module, isLoading, error, refetch: fetchModule };
};

// ==================== COMPANY HOOK ====================
interface UseGetCompanyReturn {
  company: Company | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetCompany = (
  companyId: string | null,
  userId: string | null,
): UseGetCompanyReturn => {
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompany = async () => {
    if (!companyId || !userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: CompanyResponse = await getCompany(companyId, userId);
      setCompany(response.data ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch company"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompany();
  }, [companyId, userId]);

  return { company, isLoading, error, refetch: fetchCompany };
};

// ==================== LEARNING STYLE HOOK ====================
interface UseGetLearningStyleReturn {
  learningStyle: LearningStyle | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetLearningStyle = (
  userId: string | null,
): UseGetLearningStyleReturn => {
  const [learningStyle, setLearningStyle] = useState<LearningStyle | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLearningStyle = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: LearningStyleResponse = await getLearningStyle(userId);
      setLearningStyle(response.learning_style);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to fetch learning style"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningStyle();
  }, [userId]);

  return { learningStyle, isLoading, error, refetch: fetchLearningStyle };
};

// ==================== COMPANY USERS HOOK ====================
interface UseGetCompanyUsersReturn {
  users: any[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetCompanyUsers = (
  companyId: string | null,
  userId: string | null,
): UseGetCompanyUsersReturn => {
  const [users, setUsers] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = async () => {
    if (!companyId || !userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: CompanyUsersResponse = await getCompanyUsers(
        companyId,
        userId,
      );
      setUsers(response.users || []);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch company users"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [companyId, userId]);

  return { users, isLoading, error, refetch: fetchUsers };
};

// ==================== TRAINING PLAN HOOK ====================
interface UseGetTrainingPlanReturn {
  plan: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetTrainingPlan = (
  dbUserId: string | null,
  moduleId: string | null,
): UseGetTrainingPlanReturn => {
  const [plan, setPlan] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPlan = async () => {
    if (!dbUserId || !moduleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getTrainingPlan(dbUserId, moduleId);
      setPlan(response?.data || null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch training plan"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [dbUserId, moduleId]);

  return { plan, isLoading, error, refetch: fetchPlan };
};

export interface ResolvedPlanCard {
  planKey: string;
  moduleId: string;
  status: string;
  title: string;
  tips: string;
  totalModules: number;
  modules: Array<{ order: number; title: string; recommended_time: number }>;
  processedModuleIds: string[];
  completedModulesCount: number;
}

interface DashboardStats {
  completedCount: number;
  totalAssigned: number;
  progressPercentage: number;
  nudgeMessage: string;
}

const ASSIGNED_STATUSES = new Set(["ASSIGNED", "IN_PROGRESS", "COMPLETED"]);

async function resolveProcessedModuleIdsForPlan(
  plan: any,
  userId: string,
): Promise<string[]> {
  const planModules: Array<{ title: string; processed_module_id?: string }> =
    plan?.plan_json?.modules ?? [];

  if (planModules.length === 0) {
    console.warn(
      `[resolveIds] ⚠️ Plan "${plan.learning_plan_id}" has no plan_json.modules`,
    );
    return [];
  }

  // ── Strategy 1: IDs already embedded per module (new plans) ───────────────
  const embedded = planModules
    .map((m: any) => m?.processed_module_id ?? "")
    .filter(Boolean);

  if (embedded.length === planModules.length) {
    console.log(
      `[resolveIds] ✅ Plan "${plan.learning_plan_id}" — Strategy 1: embedded IDs (${embedded.length})`,
    );
    return embedded;
  }

  // ── Strategy 2: Fetch from original-module endpoint (older plans) ──────────
  const originalModuleId: string = plan?.module_id ?? "";
  if (originalModuleId) {
    try {
      console.log(
        `[resolveIds] Plan "${plan.learning_plan_id}" — Strategy 2: fetching ` +
          `/processed-modules/original-module/${originalModuleId}`,
      );
      const response = await getProcessedModules(originalModuleId, userId);
      const allProcessed: any[] = response?.data ?? [];

      // Always filter to learning_style="default" — this is what the home screen uses
      const defaultModules = allProcessed.filter(
        (pm: any) =>
          String(pm?.learning_style ?? "")
            .trim()
            .toLowerCase() === "default",
      );

      console.log(
        `[resolveIds] Found ${defaultModules.length} "default" modules ` +
          `out of ${allProcessed.length} total`,
      );

      if (defaultModules.length > 0) {
        const sorted = [...defaultModules].sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0),
        );

        // Build title → id lookup for exact matching
        const titleToId = new Map<string, string>();
        sorted.forEach((pm: any) => {
          if (pm?.title && pm?.processed_module_id) {
            titleToId.set(
              pm.title.trim().toLowerCase(),
              pm.processed_module_id,
            );
          }
        });

        const aligned = planModules
          .map((m: any, i: number) => {
            const key = m?.title?.trim().toLowerCase() ?? "";
            const byTitle = titleToId.get(key);
            if (byTitle) {
              console.log(
                `[resolveIds] ✅ Module[${i}] "${m.title}" → title match → "${byTitle}"`,
              );
              return byTitle;
            }
            // Positional fallback within the default-style sorted list
            const byPos = sorted[i]?.processed_module_id ?? "";
            if (byPos) {
              console.warn(
                `[resolveIds] ⚠️ Module[${i}] "${m.title}" → positional fallback → "${byPos}"`,
              );
            } else {
              console.error(
                `[resolveIds] ❌ Module[${i}] "${m.title}" — no ID found`,
              );
            }
            return byPos;
          })
          .filter(Boolean);

        if (aligned.length > 0) return aligned;
      }
    } catch (err) {
      console.error(
        `[resolveIds] ❌ Strategy 2 failed for plan "${plan.learning_plan_id}":`,
        err,
      );
    }
  }

  console.error(
    `[resolveIds] ❌ Plan "${plan.learning_plan_id}" — all strategies exhausted, no IDs resolved`,
  );
  return [];
}

interface UseGetDashboardSummaryReturn {
  dashboardData: DashboardSummaryResponse | null;
  resolvedPlanCards: ResolvedPlanCard[];
  stats: DashboardStats;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetDashboardSummary = (
  userId: string | null,
  companyId: string | null,
): UseGetDashboardSummaryReturn => {
  const [dashboardData, setDashboardData] =
    useState<DashboardSummaryResponse | null>(null);
  const [resolvedPlanCards, setResolvedPlanCards] = useState<
    ResolvedPlanCard[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboard = async () => {
    if (!userId || !companyId) {
      console.log(
        "[Hook] useGetDashboardSummary skipped — missing userId or companyId",
      );
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      console.log(
        "[Hook] GET /employee/dashboard_summary/ →",
        userId,
        "companyId:",
        companyId,
      );

      const data: DashboardSummaryResponse = await getDashboardSummary(
        userId,
        companyId,
      );
      setDashboardData(data);

      const moduleMap = new Map<string, any>();
      (data.modules ?? []).forEach((m: any) => {
        if (m?.module_id) moduleMap.set(m.module_id, m);
      });
      console.log(
        "[Hook] Module map built —",
        moduleMap.size,
        "entries:",
        [...moduleMap.values()].map(
          (m) => `${m.module_id.slice(0, 8)}… "${m.title}"`,
        ),
      );

      const allPlans: any[] = data?.plans ?? [];
      console.log("[Hook] Total plans received:", allPlans.length);

      // Only render ASSIGNED / IN_PROGRESS / COMPLETED sprints on the home screen
      const activePlans = allPlans.filter((p: any) =>
        ASSIGNED_STATUSES.has(
          String(p?.status ?? "")
            .trim()
            .toUpperCase(),
        ),
      );
      console.log("[Hook] Active plans:", activePlans.length);

      const completedProcessedModuleIds = new Set(
        (data?.progress ?? [])
          .map((p: any) => p?.processed_module_id)
          .filter(Boolean),
      );
      console.log(
        "[Hook] Completed processed-module IDs:",
        completedProcessedModuleIds.size,
      );

      const cards: ResolvedPlanCard[] = await Promise.all(
        activePlans.map(async (plan: any) => {
          const planKey = String(plan.learning_plan_id ?? plan.module_id ?? "");
          const moduleId = String(plan.module_id ?? "");
          const serverStatus = String(plan.status ?? "")
            .trim()
            .toUpperCase();

          // ── Sprint title ─────────────────────────────────────────────────
          // Primary: data.modules[] looked up by plan.module_id
          const moduleRecord = moduleMap.get(moduleId);
          const title: string =
            moduleRecord?.title ??
            plan.module_name ??
            plan.module_title ??
            plan.title ??
            plan.plan_json?.modules?.[0]?.title ??
            "Learning Plan";

          // ── Sprint steps from plan_json.modules[] ────────────────────────
          const planJsonModules: Array<{
            order: number;
            title: string;
            recommended_time?: number;
            processed_module_id?: string;
          }> = plan.plan_json?.modules ?? [];

          const modules = planJsonModules.map((m: any, i: number) => ({
            order: m.order ?? i + 1,
            title: m.title ?? `Module ${i + 1}`,
            recommended_time: m.recommended_time ?? 0,
          }));

          const tips: string = plan.plan_json?.tips ?? "";

          // ── processedModuleIds per step ──────────────────────────────────
          // Strategy 1: embedded in plan_json.modules[i].processed_module_id (new plans, zero extra calls)
          // Strategy 2: GET /processed-modules/original-module/{moduleId} filtered to "default" (older plans)
          const processedModuleIds = await resolveProcessedModuleIdsForPlan(
            plan,
            userId,
          );

          console.log(
            `[Hook] Plan "${planKey}" → sprint="${title}" steps=${modules.length} resolvedIds=${processedModuleIds.length}`,
          );
          modules.forEach((m, i) => {
            console.log(
              `[Hook]   Step[${i + 1}] "${m.title}" → processedId="${
                processedModuleIds[i] ?? "❌ MISSING"
              }"`,
            );
          });

          // ── Status, derived from actual quiz-submission progress ────────
          const completedModulesCount = processedModuleIds.filter(
            (id) => !!id && completedProcessedModuleIds.has(id),
          ).length;

          let status: string;
          if (modules.length > 0 && completedModulesCount >= modules.length) {
            status = "COMPLETED";
          } else if (completedModulesCount > 0) {
            status = "IN_PROGRESS";
          } else {
            status = serverStatus === "COMPLETED" ? "COMPLETED" : "NOT_STARTED";
          }

          console.log(
            `[Hook]   → status="${status}" (server="${serverStatus}", completed=${completedModulesCount}/${modules.length})`,
          );

          return {
            planKey,
            moduleId,
            status,
            title,
            tips,
            totalModules: modules.length,
            modules,
            processedModuleIds,
            completedModulesCount,
          };
        }),
      );

      setResolvedPlanCards(cards);
      console.log("[Hook] ✅ All sprint cards resolved:", cards.length);
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error("Failed to fetch dashboard summary");
      console.error("[Hook] useGetDashboardSummary error:", error.message);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [userId, companyId]);

  // ── Stats derived from resolved plan cards ────────────────────────────────
  const stats: DashboardStats = (() => {
    const totalAssigned = resolvedPlanCards.length;
    const completedCount = resolvedPlanCards.filter(
      (c) => c.status === "COMPLETED",
    ).length;
    const progressPercentage =
      totalAssigned > 0
        ? Number(((completedCount / totalAssigned) * 100).toFixed(1))
        : 0;
    const nudgeMessage =
      progressPercentage >= 100
        ? "🎉 Congratulations! You've completed your Performance Sprint!"
        : "💪 One step in! Complete your sprints and stand among the top 5%.";
    return { completedCount, totalAssigned, progressPercentage, nudgeMessage };
  })();

  return {
    dashboardData,
    resolvedPlanCards,
    stats,
    isLoading,
    error,
    refetch: fetchDashboard,
  };
};

// ==================== MODULE PROGRESS HOOK ====================

interface UseModuleProgressReturn {
  progress: ModuleProgressEntry[];
  completedProcessedModuleIds: Set<string>;
  quizPassedProcessedModuleIds: Set<string>;
  count: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useModuleProgress = (
  userId: string | null,
): UseModuleProgressReturn => {
  const [progress, setProgress] = useState<ModuleProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProgress = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: ModuleProgress = await getModuleProgress(userId);
      setProgress(response.progress ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Failed to fetch module progress"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchProgress();
  }, [userId]);

  const completedProcessedModuleIds = new Set(
    progress
      .filter((p) => !!p.processed_module_id)
      .map((p) => p.processed_module_id),
  );

  // A quiz is "attempted" when quiz_score is not null (a score was recorded after submission).
  // quiz_score is a raw correct-answer count (e.g. 8 out of 10), NOT a percentage,
  // so checking >= 70 would never match. pass_status is also never set by the POST body.
  // We disable the button + show "Quiz Attempted" after any completed attempt.
  const quizPassedProcessedModuleIds = new Set(
    progress
      .filter(
        (p) =>
          !!p.processed_module_id &&
          p.quiz_score !== null,
      )
      .map((p) => p.processed_module_id),
  );

  return {
    progress,
    completedProcessedModuleIds,
    quizPassedProcessedModuleIds,
    count: progress.length,
    isLoading,
    error,
    refetch: fetchProgress,
  };
};