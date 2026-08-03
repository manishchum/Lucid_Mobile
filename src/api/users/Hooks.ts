import { useState, useEffect, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { eventBus } from "../../utils/EventBus";
import { logger } from "../../utils/UnifiedLogger";
import { useTenant } from "../../contex/TenantContext";
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
  getTasks,
  getLeaderboardHighlight,
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
  Task,
  TasksResponse,
  LeaderboardHighlightData,
  LeaderboardHighlightResponse,
} from "./Dto";

// Cache to store resolved processed module metadata (such as titles) for fallback rendering
const processedModuleMetadata = new Map<
  string,
  { title: string; recommended_time: number }
>();

export const USER_QUERY_KEY = ["user"];

const PLACEHOLDER_TITLE_RE = /^Module \d+$/;

function hasPlaceholderTitles(cards: ResolvedPlanCard[]): boolean {
  return cards.some((c) =>
    c.modules.some((m) => PLACEHOLDER_TITLE_RE.test(m.title)),
  );
}

async function reconcilePlaceholderTitles(
  cards: ResolvedPlanCard[],
  userId: string,
): Promise<{ cards: ResolvedPlanCard[]; changed: boolean }> {
  let changed = false;

  const nextCards = await Promise.all(
    cards.map(async (card) => {
      const placeholderIdxs = card.modules
        .map((m, i) => (PLACEHOLDER_TITLE_RE.test(m.title) ? i : -1))
        .filter((i) => i !== -1);

      if (placeholderIdxs.length === 0) return card;

      let stillMissing = false;
      const patchedFromCache = card.modules.map((m, i) => {
        if (!placeholderIdxs.includes(i)) return m;
        const pid = card.processedModuleIds[i];
        const meta = pid ? processedModuleMetadata.get(pid) : undefined;
        if (meta?.title) return { ...m, title: meta.title };
        stillMissing = true;
        return m;
      });

      if (!stillMissing) {
        changed = true;
        return { ...card, modules: patchedFromCache };
      }

      if (!card.moduleId) return { ...card, modules: patchedFromCache };

      try {
        const response = await getProcessedModules(card.moduleId, userId);
        const items: any[] = response?.data ?? [];
        items.forEach((pm: any) => {
          if (pm?.processed_module_id) {
            processedModuleMetadata.set(pm.processed_module_id, {
              title: pm.title ?? "Module",
              recommended_time: pm.recommended_time ?? 0,
            });
          }
        });

        const patched = patchedFromCache.map((m, i) => {
          if (!placeholderIdxs.includes(i)) return m;
          const pid = card.processedModuleIds[i];
          const meta = pid ? processedModuleMetadata.get(pid) : undefined;
          return meta?.title ? { ...m, title: meta.title } : m;
        });

        if (patched.some((m, i) => m.title !== card.modules[i].title)) {
          changed = true;
        }
        return { ...card, modules: patched };
      } catch (err) {
        logger.warn(
          `[reconcilePlaceholderTitles] Failed to fetch titles for plan "${card.planKey}":`,
          err,
        );
        return card;
      }
    }),
  );

  return { cards: nextCards, changed };
}

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
  originalModuleId: string | null,
  userId: string | null,
): UseGetProcessedModulesReturn => {
  const [modules, setModules] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchModules = async () => {
    if (!originalModuleId || !userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getProcessedModules(originalModuleId, userId);
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
  }, [originalModuleId, userId]);

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

  const fetchModuleData = async (showSpinner: boolean) => {
    if (!processedModuleId || !userId) return;
    if (showSpinner) setIsLoading(true);
    setError(null);
    try {
      const response = await getProcessedModuleById(processedModuleId, userId);
      const data = response?.data ?? null;
      if (!data) throw new Error("API returned empty data field");
      setModule(data);

      const cacheKey = `@processed_module_${processedModuleId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    } catch (err) {
      const error =
        err instanceof Error
          ? err
          : new Error("Failed to fetch processed module");
      logger.error("[Hook] fetchModuleData error:", error.message);
      throw error;
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadAndFetch = async () => {
      if (!processedModuleId || !userId) {
        setModule(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      let hasCache = false;

      // 1. Try to load from cache first
      try {
        const cacheKey = `@processed_module_${processedModuleId}`;
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson) {
          const cachedData = JSON.parse(cachedJson);
          setModule(cachedData);
          logger.debug(
            "[Hook] ✅ Loaded processed module from cache:",
            processedModuleId,
          );
          hasCache = true;
          setIsLoading(false);
        }
      } catch (err) {
        logger.warn("[Hook] Failed to load cached processed module:", err);
      }

      // 2. Fetch fresh data from network
      try {
        await fetchModuleData(!hasCache);
      } catch (err) {
        if (!hasCache) {
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to fetch processed module"),
          );
        }
      }
    };

    loadAndFetch();
  }, [processedModuleId, userId]);

  return {
    module,
    isLoading,
    error,
    refetch: async () => {
      await fetchModuleData(true);
    },
  };
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
      const response = await getTrainingModuleDetail(moduleId, moduleId);
      setModule(response.module || null);
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

  const fetchCompanyData = async (showSpinner: boolean) => {
    if (!companyId || !userId) return;
    if (showSpinner) setIsLoading(true);
    setError(null);
    try {
      const response: CompanyResponse = await getCompany(companyId, userId);
      const data = response.data ?? null;
      setCompany(data);

      const cacheKey = `@company_data_${companyId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch company");
      logger.error("[Hook] fetchCompanyData error:", error.message);
      throw error;
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadAndFetch = async () => {
      if (!companyId || !userId) return;

      setIsLoading(true);
      setError(null);

      let hasCache = false;

      // 1. Try to load from cache first
      try {
        const cacheKey = `@company_data_${companyId}`;
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson) {
          const cachedData = JSON.parse(cachedJson) as Company;
          setCompany(cachedData);
          logger.debug("[Hook] ✅ Loaded company data from cache:", companyId);
          hasCache = true;
          setIsLoading(false);
        }
      } catch (err) {
        logger.warn("[Hook] Failed to load cached company data:", err);
      }

      // 2. Fetch fresh data from network
      try {
        await fetchCompanyData(!hasCache);
      } catch (err) {
        if (!hasCache) {
          setError(
            err instanceof Error ? err : new Error("Failed to fetch company"),
          );
        }
      }
    };

    loadAndFetch();
  }, [companyId, userId]);

  return {
    company,
    isLoading,
    error,
    refetch: async () => {
      await fetchCompanyData(true);
    },
  };
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
      setLearningStyle(response.data);
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
      setUsers(response.data?.users || []);
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
      setPlan(response?.data ?? response ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch training plan"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setPlan(null);
    fetchPlan();
  }, [dbUserId, moduleId]);

  return { plan, isLoading, error, refetch: fetchPlan };
};

export interface ResolvedPlanCard {
  planKey: string;
  moduleId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  title: string;
  tips: string;
  totalModules: number;
  modules: Array<{ order: number; title: string; recommended_time: number }>;
  processedModuleIds: string[];
  completedModulesCount: number;
  completedAt?: string | null;
}

interface DashboardStats {
  completedCount: number;
  totalAssigned: number;
  progressPercentage: number;
  nudgeMessage: string;
}

const ASSIGNED_STATUSES = new Set(["ASSIGNED", "IN_PROGRESS", "COMPLETED"]);

const authModulesCache = new Map<string, any[]>();

async function fetchAuthoritativeModules(
  originalModuleId: string,
  userId: string,
): Promise<
  Array<{
    order?: number;
    title?: string;
    processed_module_id?: string;
    recommended_time?: number;
  }>
> {
  // 1. Check in-memory cache
  if (authModulesCache.has(originalModuleId)) {
    return authModulesCache.get(originalModuleId)!;
  }

  // 2. Check AsyncStorage cache
  const cacheKey = `@auth_modules_${originalModuleId}`;
  try {
    const cachedJson = await AsyncStorage.getItem(cacheKey);
    if (cachedJson) {
      const parsed = JSON.parse(cachedJson);
      authModulesCache.set(originalModuleId, parsed);
      // Populate processedModuleMetadata too
      parsed.forEach((m: any) => {
        if (m?.processed_module_id) {
          processedModuleMetadata.set(m.processed_module_id, {
            title: m.title ?? "Module",
            recommended_time: m.recommended_time ?? 0,
          });
        }
      });
      return parsed;
    }
  } catch (err) {
    logger.warn(
      `[resolveIds] Failed to read auth modules cache for ${originalModuleId}:`,
      err,
    );
  }

  // 3. Fetch from network
  try {
    const response = await getTrainingPlan(userId, originalModuleId);
    const authModules: any[] = response?.plan?.modules ?? [];
    authModules.forEach((m) => {
      if (m?.processed_module_id) {
        processedModuleMetadata.set(m.processed_module_id, {
          title: m.title ?? "Module",
          recommended_time: m.recommended_time ?? 0,
        });
      }
    });

    // Save to caches
    authModulesCache.set(originalModuleId, authModules);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(authModules));

    return authModules;
  } catch (err) {
    logger.error(
      `[resolveIds] Failed to fetch authoritative /training-plan for original_module_id="${originalModuleId}":`,
      err,
    );
    return [];
  }
}

async function resolveProcessedModuleIdsForPlan(
  plan: any,
  userId: string,
): Promise<string[]> {
  // Strategy 0: If plan already has root-level processed_module_ids, use them directly
  if (
    Array.isArray(plan?.processed_module_ids) &&
    plan.processed_module_ids.length > 0
  ) {
    return plan.processed_module_ids;
  }

  const planModules: Array<{ title: string; processed_module_id?: string }> =
    plan?.plan_json?.modules ?? [];
  const originalModuleId: string = plan?.module_id ?? "";

  if (planModules.length === 0) {
    // Strategy 0.5: plan_json is empty — fetch the authoritative plan for
    // this original module directly and use its own module order.
    if (originalModuleId) {
      const authModules = await fetchAuthoritativeModules(
        originalModuleId,
        userId,
      );
      if (authModules.length > 0) {
        const sorted = [...authModules].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
        const ids = sorted.map((m) => m.processed_module_id).filter(Boolean);
        if (ids.length > 0) return ids as string[];
      }
    }

    logger.warn(
      `[resolveIds] Plan "${plan.learning_plan_id}" has no plan_json.modules and no IDs`,
    );
    return [];
  }

  // ── Strategy 1: IDs already embedded per module (new plans) ───────────────
  const embedded = planModules
    .map((m: any) => m?.processed_module_id ?? "")
    .filter(Boolean);

  if (embedded.length === planModules.length) {
    logger.debug(
      `[resolveIds] ✅ Plan "${plan.learning_plan_id}" — Strategy 1: embedded IDs (${embedded.length})`,
    );
    return embedded;
  }

  // ── Strategy 1.5: Pre-resolved root-level processed_module_ids (already fetched) ─
  if (
    Array.isArray(plan?.processed_module_ids) &&
    plan.processed_module_ids.length === planModules.length
  ) {
    logger.debug(
      `[resolveIds] ✅ Plan "${plan.learning_plan_id}" — Strategy 1.5: root-level IDs (${plan.processed_module_ids.length})`,
    );
    return plan.processed_module_ids;
  }

  // ── Strategy 2:
  if (originalModuleId) {
    logger.debug(
      `[resolveIds] Plan "${plan.learning_plan_id}" — Strategy 2: fetching ` +
        `authoritative /training-plan for original_module_id="${originalModuleId}"`,
    );
    const authModules = await fetchAuthoritativeModules(
      originalModuleId,
      userId,
    );

    if (authModules.length > 0) {
      const titleToId = new Map<string, string>();
      authModules.forEach((m: any) => {
        const key = (m?.title ?? "").trim().toLowerCase();
        if (key && m?.processed_module_id) {
          titleToId.set(key, m.processed_module_id);
        }
      });

      const aligned = planModules.map((m: any, i: number) => {
        const key = m?.title?.trim().toLowerCase() ?? "";
        const byTitle = titleToId.get(key);
        if (byTitle) {
          logger.debug(
            `[resolveIds] ✅ Module[${i}] "${m.title}" → title match → "${byTitle}"`,
          );
          return byTitle;
        }
        logger.error(
          `[resolveIds] ❌ Module[${i}] "${m.title}" — no title match in ` +
            `authoritative /training-plan response. Leaving unresolved ` +
            `(no positional guess) to avoid mismatched completion state.`,
        );
        return "";
      });

      if (aligned.some(Boolean)) return aligned;
    }
  }

  logger.error(
    `[resolveIds] ❌ Plan "${plan.learning_plan_id}" — all strategies exhausted, no IDs resolved`,
  );
  return [];
}
export async function resolvePlanModules(
  plan: any,
  userId: string,
  progressTitleById: Map<string, string>,
): Promise<{
  modules: Array<{ order: number; title: string; recommended_time: number }>;
  processedModuleIds: string[];
}> {
  const planJsonModules: Array<{
    order: number;
    title: string;
    recommended_time?: number;
    processed_module_id?: string;
  }> = plan?.plan_json?.modules ?? [];

  if (planJsonModules.length > 0) {
    const modules = planJsonModules.map((m: any, i: number) => ({
      order: m.order ?? i + 1,
      title: m.title ?? `Module ${i + 1}`,
      recommended_time: m.recommended_time ?? 0,
      processed_module_id: m.processed_module_id ?? m.processedModuleId ?? "",
    }));
    const processedModuleIds = await resolveProcessedModuleIdsForPlan(
      plan,
      userId,
    );
    return { modules, processedModuleIds };
  }

  // ── Fallback: plan_json is null/empty, use top-level processed_module_ids ──
  const topLevelIds: string[] = Array.isArray(plan?.processed_module_ids)
    ? plan.processed_module_ids.filter(Boolean)
    : [];

  if (topLevelIds.length === 0) {
    logger.error(
      `Plan "${plan.learning_plan_id}" — plan_json is empty/null AND ` +
        `no top-level processed_module_ids either. This plan genuinely has no modules to show.`,
    );
    return { modules: [], processedModuleIds: [] };
  }

  logger.debug(
    `[resolveIds] Plan "${plan.learning_plan_id}" — plan_json is null. Using ` +
      `top-level processed_module_ids (${topLevelIds.length} ids), titles from ` +
      `progress data where available (no network calls).`,
  );

  const modules = topLevelIds.map((pid, i) => ({
    order: i + 1,
    title: progressTitleById.get(pid) ?? `Module ${i + 1}`,
    recommended_time: 0,
  }));

  logger.debug(
    `Plan "${plan.learning_plan_id}" — resolved ${modules.length} ` +
      `modules via plan_json-null fallback (no fetches):`,
    modules.map((m) => m.title),
  );

  return { modules, processedModuleIds: topLevelIds };
}

interface UseGetDashboardSummaryReturn {
  dashboardData: DashboardSummaryResponse | null;
  resolvedPlanCards: ResolvedPlanCard[];
  stats: DashboardStats;
  isLoading: boolean;
  error: Error | null;
  refetch: (showSpinner?: boolean) => Promise<void>;
}

async function processDashboardResponse(
  data: DashboardSummaryResponse,
  userId: string,
): Promise<ResolvedPlanCard[]> {
  const moduleMap = new Map<string, any>();
  (data.modules ?? []).forEach((m: any) => {
    if (m?.module_id) moduleMap.set(m.module_id, m);
  });
  logger.debug(
    "[Hook] Module map built —",
    moduleMap.size,
    "entries:",
    [...moduleMap.values()].map(
      (m) => `${m.module_id.slice(0, 8)}… "${m.title}"`,
    ),
  );

  const allPlans: any[] = data?.plans ?? [];
  logger.debug("[Hook] Total plans received:", allPlans.length);

  // Only render ASSIGNED / IN_PROGRESS / COMPLETED sprints on the home screen
  const activePlans = allPlans.filter((p: any) =>
    ASSIGNED_STATUSES.has(
      String(p?.status ?? "")
        .trim()
        .toUpperCase(),
    ),
  );
  logger.debug("[Hook] Active plans:", activePlans.length);

  const completedProcessedModuleIds = new Set(
    (data?.progress ?? [])
      .filter((p: any) => !!p?.processed_module_id && p?.quiz_score !== null)
      .map((p: any) => p.processed_module_id),
  );
  logger.debug(
    "[Hook] Quiz-completed processed-module IDs:",
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

      let modules = planJsonModules.map((m: any, i: number) => ({
        order: m.order ?? i + 1,
        title: m.title ?? `Module ${i + 1}`,
        recommended_time: m.recommended_time ?? 0,
        processed_module_id: m.processed_module_id ?? m.processedModuleId ?? "",
      }));

      const tips: string = plan.plan_json?.tips ?? "";

      // ── processedModuleIds per step ──────────────────────────────────
      // Strategy 1: embedded in plan_json.modules[i].processed_module_id (new plans, zero extra calls)
      // Strategy 2: GET /processed-modules/original-module/{moduleId} filtered to "default" (older plans)
      const processedModuleIds = await resolveProcessedModuleIdsForPlan(
        plan,
        userId,
      );

      // Fallback: If modules list is empty but we have processed module IDs
      if (modules.length === 0 && processedModuleIds.length > 0) {
        logger.debug(
          `[DEBUG_FALLBACK] plan_id: ${plan.learning_plan_id}, original_module_id: ${plan.module_id}, processedIds:`,
          processedModuleIds,
        );
        const missingIds = processedModuleIds.filter(
          (id) => !processedModuleMetadata.has(id),
        );
        logger.debug(
          `[DEBUG_FALLBACK] missingIds count: ${missingIds.length}, cache size: ${processedModuleMetadata.size}`,
        );
        if (missingIds.length > 0 && plan.module_id) {
          try {
            logger.debug(
              `[Hook] Fetching processed modules metadata fallback for: ${plan.module_id}`,
            );
            const response = await getProcessedModules(plan.module_id, userId);
            logger.debug(
              `[DEBUG_FALLBACK] API response keys:`,
              Object.keys(response ?? {}),
              `data is array:`,
              Array.isArray(response?.data),
              `length:`,
              response?.data?.length,
            );
            const allProcessed: any[] = response?.data ?? [];
            allProcessed.forEach((pm: any) => {
              if (pm?.processed_module_id) {
                processedModuleMetadata.set(pm.processed_module_id, {
                  title: pm.title ?? "Module",
                  recommended_time: pm.recommended_time ?? 0,
                });
              }
            });
          } catch (err) {
            logger.error(
              "[Hook] Failed to fetch processed modules metadata fallback:",
              err,
            );
          }
        }

        modules = processedModuleIds.map((id, i) => {
          const cachedMeta = processedModuleMetadata.get(id);
          return {
            order: i + 1,
            title: cachedMeta?.title ?? `Module ${i + 1}`,
            recommended_time: cachedMeta?.recommended_time ?? 0,
            processed_module_id: id,
          };
        });
      }

      logger.debug(
        `[Hook] Plan "${planKey}" → sprint="${title}" steps=${modules.length} resolvedIds=${processedModuleIds.length}`,
      );
      modules.forEach((m, i) => {
        logger.debug(
          `[Hook]   Step[${i + 1}] "${m.title}" → processedId="${
            processedModuleIds[i] ?? "❌ MISSING"
          }"`,
        );
      });

      // ── Status, derived from actual quiz-submission progress ────────
      const completedModulesCount = processedModuleIds.filter(
        (id) => !!id && completedProcessedModuleIds.has(id),
      ).length;

      let status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
      if (modules.length > 0 && completedModulesCount >= modules.length) {
        status = "COMPLETED";
      } else if (completedModulesCount > 0) {
        status = "IN_PROGRESS";
      } else {
        status = serverStatus === "COMPLETED" ? "COMPLETED" : "NOT_STARTED";
      }

      logger.debug(
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
        completedAt: plan.completed_at || null,
      };
    }),
  );

  return cards;
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
  const fetchPromiseRef = useRef<Promise<any> | null>(null);
  const { setCompanyFromDashboard } = useTenant();

  const fetchDashboardData = useCallback(
    async (showSpinner: boolean) => {
      if (!userId || !companyId) return;

      if (fetchPromiseRef.current) {
        logger.debug(
          "[Hook] fetchDashboardData already in progress, awaiting existing promise...",
        );
        if (showSpinner) setIsLoading(true);
        try {
          await fetchPromiseRef.current;
        } finally {
          if (showSpinner) setIsLoading(false);
        }
        return;
      }

      if (showSpinner) setIsLoading(true);
      setError(null);

      const fetchTask = (async () => {
        try {
          const startTime = Date.now();
          logger.debug(
            "[Hook] GET /employee/dashboard_summary/ →",
            userId,
            "companyId:",
            companyId,
          );

          const apiStart = Date.now();
          const data = await getDashboardSummary(userId, companyId);
          const apiEnd = Date.now();
          logger.debug(
            `[Timing] getDashboardSummary API took ${apiEnd - apiStart}ms`,
          );

          setDashboardData(data);
          setCompanyFromDashboard((data as any)?.company ?? null);

          const moduleMap = new Map<string, any>();
          (data.modules ?? []).forEach((m: any) => {
            if (m?.module_id) moduleMap.set(m.module_id, m);
          });
          logger.debug(
            "[Hook] Module map built —",
            moduleMap.size,
            "entries:",
            [...moduleMap.values()].map(
              (m) => `${m.module_id.slice(0, 8)}… "${m.title}"`,
            ),
          );

          const allPlans: any[] = data?.plans ?? [];
          logger.debug("[Hook] Total plans received:", allPlans.length);

          // Only render ASSIGNED / IN_PROGRESS / COMPLETED sprints on the home screen
          const statusFilteredPlans = allPlans.filter((p: any) =>
            ASSIGNED_STATUSES.has(
              String(p?.status ?? "")
                .trim()
                .toUpperCase(),
            ),
          );

          const baselineEvidenceByModuleId: Record<string, any[]> =
            data?.baseline_evidence_by_module_id ?? {};
          const activePlans = statusFilteredPlans.filter((p: any) => {
            const isBaseline = p?.baseline_assessment === true;
            if (!isBaseline) return true;

            const moduleId = String(p?.module_id ?? "");
            const hasBaselineEvidence =
              Array.isArray(baselineEvidenceByModuleId[moduleId]) &&
              baselineEvidenceByModuleId[moduleId].length > 0;

            if (hasBaselineEvidence) {
              logger.debug(
                `[Hook] ✅ Plan "${p?.learning_plan_id}" — baseline_assessment=true but ` +
                  `baseline evidence found for module "${moduleId}" (completed via web) → showing`,
              );
              return true;
            }

            logger.debug(
              `[Hook] ⏭️ Skipping plan "${p?.learning_plan_id}" — baseline_assessment=true, ` +
                `no baseline evidence for module "${moduleId}" yet (mobile has no baseline-test flow)`,
            );
            return false;
          });
          logger.debug(
            "[Hook] Active plans:",
            activePlans.length,
            `(${statusFilteredPlans.length - activePlans.length} baseline-assessment plans hidden)`,
          );

          const completedProcessedModuleIds = new Set(
            (data?.progress ?? [])
              .filter(
                (p: any) => !!p?.processed_module_id && p?.quiz_score !== null,
              )
              .map((p: any) => p.processed_module_id),
          );
          logger.debug(
            "[Hook] Quiz-completed processed-module IDs:",
            completedProcessedModuleIds.size,
          );

          // Title lookup for the plan_json-null fallback, built once from data
          // already in this response — avoids per-module network calls.
          const progressTitleById = new Map<string, string>();
          (data?.progress ?? []).forEach((p: any) => {
            const pid = p?.processed_module_id;
            const title = p?.processed_modules?.title;
            if (pid && title) progressTitleById.set(pid, title);
          });

          const cards: ResolvedPlanCard[] = await Promise.all(
            activePlans.map(async (plan: any) => {
              const planKey = String(
                plan.learning_plan_id ?? plan.module_id ?? "",
              );
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

              // ── Sprint steps + processedModuleIds ─────────────────────────────

              const { modules, processedModuleIds } = await resolvePlanModules(
                plan,
                userId,
                progressTitleById,
              );

              const tips: string = plan.plan_json?.tips ?? "";

              logger.debug(
                `[Hook] Plan "${planKey}" → sprint="${title}" steps=${modules.length} resolvedIds=${processedModuleIds.length}`,
              );
              modules.forEach((m, i) => {
                logger.debug(
                  `[Hook]   Step[${i + 1}] "${m.title}" → processedId="${
                    processedModuleIds[i] ?? "❌ MISSING"
                  }"`,
                );
              });

              // ── Status, derived from actual quiz-submission progress ────────
              const completedModulesCount = processedModuleIds.filter(
                (id) => !!id && completedProcessedModuleIds.has(id),
              ).length;

              let status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
              if (
                modules.length > 0 &&
                completedModulesCount >= modules.length
              ) {
                status = "COMPLETED";
              } else if (completedModulesCount > 0) {
                status = "IN_PROGRESS";
              } else {
                status =
                  serverStatus === "COMPLETED" ? "COMPLETED" : "NOT_STARTED";
              }

              logger.debug(
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
                completedAt: plan.completed_at || null,
              };
            }),
          );

          setResolvedPlanCards(cards);
          logger.debug(
            "[Hook] ✅ Fresh dashboard summary resolved:",
            cards.length,
          );

          // Save to cache
          const cacheKey = `@dashboard_data_${userId}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));

          if (hasPlaceholderTitles(cards)) {
            reconcilePlaceholderTitles(cards, userId)
              .then(({ cards: reconciled, changed }) => {
                if (changed) {
                  setResolvedPlanCards(reconciled);
                  logger.debug(
                    "Reconciled placeholder module titles in background",
                  );
                }
              })
              .catch((err) =>
                logger.warn("[Hook] Title reconciliation failed:", err),
              );
          }

          logger.debug(
            `[Timing] Total fetchDashboardData took ${Date.now() - startTime}ms`,
          );
          return data;
        } catch (err) {
          const error =
            err instanceof Error
              ? err
              : new Error("Failed to fetch dashboard summary");
          logger.error("[Hook] fetchDashboardData error:", error.message);
          throw error;
        }
      })();

      fetchPromiseRef.current = fetchTask;

      try {
        await fetchTask;
      } finally {
        fetchPromiseRef.current = null;
        if (showSpinner) setIsLoading(false);
      }
    },
    [userId, companyId],
  );

  useEffect(() => {
    const loadAndFetch = async () => {
      if (!userId || !companyId) return;

      setIsLoading(true);
      setError(null);

      let hasCache = false;

      // 1. Try to load from cache first
      try {
        const cacheKey = `@dashboard_data_${userId}`;
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson) {
          const cachedData = JSON.parse(cachedJson) as DashboardSummaryResponse;
          setDashboardData(cachedData);
          const cards = await processDashboardResponse(cachedData, userId);
          setResolvedPlanCards(cards);
          logger.debug(
            "[Hook] ✅ Loaded dashboard data from cache:",
            cards.length,
          );

          if (hasPlaceholderTitles(cards)) {
            reconcilePlaceholderTitles(cards, userId)
              .then(({ cards: reconciled, changed }) => {
                if (changed) setResolvedPlanCards(reconciled);
              })
              .catch((err) =>
                logger.warn(
                  "[Hook] Cached-card title reconciliation failed:",
                  err,
                ),
              );
          }

          hasCache = true;
          // Cache loaded! Dismiss spinner immediately so user sees cached screen
          setIsLoading(false);
        }
      } catch (err) {
        logger.warn("[Hook] Failed to load cached dashboard data:", err);
      }

      // 2. Fetch fresh data from network
      try {
        // If we don't have a cache, keep the spinner visible.
        // If we DO have a cache, fetch silently in the background.
        await fetchDashboardData(!hasCache);
      } catch (err) {
        // If we don't even have cached data, propagate the error to the UI
        if (!hasCache) {
          setError(
            err instanceof Error ? err : new Error("Failed to fetch dashboard"),
          );
        }
      }
    };

    loadAndFetch();
  }, [userId, companyId]);

  useEffect(() => {
    const handleRefresh = () => {
      logger.debug(
        "[Hook] EventBus triggered refresh_dashboard. Refreshing silently...",
      );
      fetchDashboardData(false).catch(() => {});
    };

    const handleModuleCompleted = (data?: { processedModuleId?: string; quizScore?: number; taskId?: string }) => {
      logger.debug("[Hook] Realtime module/task completed event received:", data);
      const targetId = data?.processedModuleId || data?.taskId;

      setResolvedPlanCards((prevCards) => {
        return prevCards.map((card) => {
          const isMatch =
            (targetId && card.processedModuleIds?.includes(targetId)) ||
            card.moduleId === targetId ||
            card.planKey === targetId;

          if (isMatch) {
            const currentCompleted = card.completedModulesCount ?? 0;
            const newCompleted = Math.min(card.totalModules, currentCompleted + 1);
            const newStatus = newCompleted >= card.totalModules ? "COMPLETED" : "IN_PROGRESS";
            return {
              ...card,
              completedModulesCount: newCompleted,
              status: newStatus,
            };
          }
          return card;
        });
      });
    };

    const unsub1 = eventBus.on("refresh_dashboard", handleRefresh);
    const unsub2 = eventBus.on("quiz_completed", handleModuleCompleted);
    const unsub3 = eventBus.on("MODULE_COMPLETED", handleModuleCompleted);
    const unsub4 = eventBus.on("TASK_UPDATED", handleModuleCompleted);
    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
    };
  }, [fetchDashboardData]);

  // ── Stats derived from resolved plan cards (matches Web & Leaderboard) ──
  const stats: DashboardStats = (() => {
    const totalAssigned = resolvedPlanCards.length;
    const completedCount = resolvedPlanCards.filter(
      (c) => c.status === "COMPLETED",
    ).length;

    const progressPercentage =
      totalAssigned > 0
        ? Math.round((completedCount / totalAssigned) * 100)
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
    refetch: useCallback(
      async (showSpinner = true) => {
        await fetchDashboardData(showSpinner);
      },
      [fetchDashboardData],
    ),
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

  const fetchProgressData = useCallback(
    async (showSpinner: boolean) => {
      if (!userId) return;
      if (showSpinner) setIsLoading(true);
      setError(null);
      try {
        const response: ModuleProgress = await getModuleProgress(userId);
        const data = response.progress ?? [];

        setProgress((prevProgress) => {
          const localMap = new Map<string, ModuleProgressEntry>();
          prevProgress.forEach((p) => {
            if (p.processed_module_id) {
              localMap.set(p.processed_module_id, p);
            }
          });

          const mergedData = data.map((networkEntry) => {
            const pid = networkEntry.processed_module_id;
            const localEntry = pid ? localMap.get(pid) : undefined;
            if (
              localEntry &&
              localEntry.quiz_score !== null &&
              localEntry.quiz_score !== undefined &&
              (networkEntry.quiz_score === null ||
                networkEntry.quiz_score === undefined)
            ) {
              return {
                ...networkEntry,
                quiz_score: localEntry.quiz_score,
                pass_status: localEntry.pass_status ?? networkEntry.pass_status,
              };
            }
            return networkEntry;
          });

          const networkPids = new Set(data.map((d) => d.processed_module_id));
          prevProgress.forEach((p) => {
            if (
              p.processed_module_id &&
              !networkPids.has(p.processed_module_id)
            ) {
              mergedData.push(p);
            }
          });

          const cacheKey = `@module_progress_${userId}`;
          AsyncStorage.setItem(cacheKey, JSON.stringify(mergedData)).catch(
            (err) =>
              logger.warn("[Hook] Error saving merged progress to cache:", err),
          );

          return mergedData;
        });

        return data;
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error("Failed to fetch module progress");
        logger.error("[Hook] fetchProgressData error:", error.message);
        throw error;
      } finally {
        if (showSpinner) setIsLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    const loadAndFetch = async () => {
      if (!userId) return;

      setIsLoading(true);
      setError(null);

      let hasCache = false;

      // 1. Try to load from cache first
      try {
        const cacheKey = `@module_progress_${userId}`;
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson) {
          const cachedData = JSON.parse(cachedJson) as ModuleProgressEntry[];
          setProgress(cachedData);
          logger.debug(
            "[Hook] ✅ Loaded module progress from cache:",
            cachedData.length,
          );
          hasCache = true;
          setIsLoading(false);
        }
      } catch (err) {
        logger.warn("[Hook] Failed to load cached module progress:", err);
      }

      // 2. Fetch fresh data from network
      try {
        await fetchProgressData(!hasCache);
      } catch (err) {
        if (!hasCache) {
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to fetch module progress"),
          );
        }
      }
    };

    loadAndFetch();
  }, [userId]);

  useEffect(() => {
    const handleRefresh = () => {
      logger.debug(
        "[Hook] EventBus triggered refresh_dashboard in useModuleProgress. Refreshing silently...",
      );
      fetchProgressData(false).catch(() => {});
    };
    return eventBus.on("refresh_dashboard", handleRefresh);
  }, [fetchProgressData]);

  useEffect(() => {
    const handleQuizCompleted = (eventData: {
      processedModuleId: string;
      quizScore: number;
    }) => {
      if (!userId) return;
      logger.debug(
        "[Hook] EventBus triggered quiz_completed in useModuleProgress:",
        eventData,
      );
      setProgress((prevProgress) => {
        const exists = prevProgress.some(
          (p) => p.processed_module_id === eventData.processedModuleId,
        );
        let updatedProgress: ModuleProgressEntry[];
        if (exists) {
          updatedProgress = prevProgress.map((p) =>
            p.processed_module_id === eventData.processedModuleId
              ? { ...p, quiz_score: eventData.quizScore }
              : p,
          );
        } else {
          updatedProgress = [
            ...prevProgress,
            {
              processed_module_id: eventData.processedModuleId,
              quiz_score: eventData.quizScore,
              created_at: new Date().toISOString(),
            } as any,
          ];
        }

        // Write to cache immediately so any future mount reads the fresh status
        const cacheKey = `@module_progress_${userId}`;
        AsyncStorage.setItem(cacheKey, JSON.stringify(updatedProgress)).catch(
          (err: any) => {
            logger.warn(
              "[Hook] Failed to write updated progress to cache:",
              err,
            );
          },
        );

        return updatedProgress;
      });
    };
    return eventBus.on("quiz_completed", handleQuizCompleted);
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
      .filter((p) => !!p.processed_module_id && p.quiz_score !== null)
      .map((p) => p.processed_module_id),
  );

  return {
    progress,
    completedProcessedModuleIds,
    quizPassedProcessedModuleIds,
    count: progress.length,
    isLoading,
    error,
    refetch: useCallback(async () => {
      await fetchProgressData(true);
    }, [fetchProgressData]),
  };
};

// ==================== TASKS HOOK ====================
interface UseGetTasksReturn {
  tasks: Task[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetTasks = (
  userId: string | null,
  companyId: string | null,
  enabled: boolean = true,
): UseGetTasksReturn => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = async () => {
    if (!userId || !companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: TasksResponse = await getTasks(userId, companyId);
      setTasks(Array.isArray(response.tasks) ? response.tasks : []);
      setTotal(response.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch tasks"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Skip firing this request at all when the caller has no use for it yet
    if (!enabled) return;
    if (userId && companyId) fetchTasks();
  }, [userId, companyId, enabled]);

  return { tasks, total, isLoading, error, refetch: fetchTasks };
};

interface UseGetLeaderboardHighlightReturn {
  leaderboardData: LeaderboardHighlightData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: (showSpinner?: boolean) => Promise<void>;
}

export const useGetLeaderboardHighlight = (
  companyId: string | null,
  userId: string | null,
  topLimit: number = 10,
  enabled: boolean = true,
): UseGetLeaderboardHighlightReturn => {
  const [leaderboardData, setLeaderboardData] =
    useState<LeaderboardHighlightData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchPromiseRef = useRef<Promise<any> | null>(null);

  const fetchLeaderboard = useCallback(
    async (showSpinner: boolean = true) => {
      if (!companyId || !userId) return;

      if (fetchPromiseRef.current) {
        if (showSpinner) setIsLoading(true);
        try {
          await fetchPromiseRef.current;
        } finally {
          if (showSpinner) setIsLoading(false);
        }
        return;
      }

      if (showSpinner) setIsLoading(true);
      setError(null);

      const promise = getLeaderboardHighlight(companyId, userId, topLimit);
      fetchPromiseRef.current = promise;

      try {
        const response = await promise;
        if (response.success && response.data) {
          setLeaderboardData(response.data);
          const cacheKey = `@leaderboard_highlight_${companyId}_${userId}`;
          await AsyncStorage.setItem(cacheKey, JSON.stringify(response.data));
        } else if (response.error) {
          throw new Error(response.error);
        }
      } catch (err) {
        logger.error("[Hook] useGetLeaderboardHighlight error:", err);
        setError(
          err instanceof Error ? err : new Error("Failed to fetch leaderboard"),
        );
      } finally {
        fetchPromiseRef.current = null;
        if (showSpinner) setIsLoading(false);
      }
    },
    [companyId, userId, topLimit],
  );

  useEffect(() => {
    if (!enabled) return;
    const loadAndFetch = async () => {
      if (!companyId || !userId) return;

      setIsLoading(true);
      setError(null);

      let hasCache = false;

      // 1. Try to load from cache first
      try {
        const cacheKey = `@leaderboard_highlight_${companyId}_${userId}`;
        const cachedJson = await AsyncStorage.getItem(cacheKey);
        if (cachedJson) {
          const cachedData = JSON.parse(cachedJson) as LeaderboardHighlightData;
          setLeaderboardData(cachedData);
          logger.debug("[Hook] ✅ Loaded leaderboard from cache");
          hasCache = true;
          setIsLoading(false); // Cache found, stop spinner early
        }
      } catch (err) {
        logger.warn("[Hook] Failed to load cached leaderboard:", err);
      }

      // 2. Fetch fresh data from network
      try {
        await fetchLeaderboard(!hasCache);
      } catch (err) {
        if (!hasCache) {
          setError(
            err instanceof Error
              ? err
              : new Error("Failed to fetch leaderboard"),
          );
        }
      }
    };

    loadAndFetch();
  }, [companyId, userId, topLimit, enabled, fetchLeaderboard]);

  return {
    leaderboardData,
    isLoading,
    error,
    refetch: fetchLeaderboard,
  };
};
