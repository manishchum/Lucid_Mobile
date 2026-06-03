import { useState, useEffect } from 'react';
import {
  getUserByEmail,
  getUserByPhone,
  getUserRoles,
  getLearningPlans,
  getProcessedModules,
  getProcessedModuleById,
  getTrainingModules,
  getTrainingModuleDetail,
  getModuleProgress,
  getCompany,
  getLearningStyle,
  getCompanyUsers,
  getTrainingPlan,
  getDashboardSummary,
} from './Request';
import {
  User,
  UserResponse,
  UserRolesResponse,
  UserRoleAssignment,
  LearningPlansResponse,
  LearningPlan,
  TrainingModulesResponse,
  TrainingModule,
  ModuleProgress,
  CompanyResponse,
  Company,
  LearningStyleResponse,
  LearningStyle,
  CompanyUsersResponse,
  DashboardSummaryResponse,
} from './Dto';

export const USER_QUERY_KEY = ['user'];

// ==================== USER BY EMAIL HOOK ====================
interface UseGetUserByEmailReturn {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetUserByEmail = (email: string | null): UseGetUserByEmailReturn => {
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
      setError(err instanceof Error ? err : new Error('Failed to fetch user'));
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

export const useGetUserByPhone = (phone: string | null): UseGetUserByPhoneReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = async () => {
    if (!phone) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: UserResponse = await getUserByPhone(phone);
      setUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user'));
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

export const useGetUserRoles = (userId: string | null): UseGetUserRolesReturn => {
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
      setError(err instanceof Error ? err : new Error('Failed to fetch user roles'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, [userId]);

  return { roles, isLoading, error, refetch: fetchRoles };
};

// ==================== LEARNING PLANS HOOK ====================
interface UseGetLearningPlansReturn {
  plans: LearningPlan[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetLearningPlans = (userId: string | null): UseGetLearningPlansReturn => {
  const [plans, setPlans] = useState<LearningPlan[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPlans = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: LearningPlansResponse = await getLearningPlans(userId);
      setPlans(response.plans || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch learning plans'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPlans(); }, [userId]);

  return { plans, isLoading, error, refetch: fetchPlans };
};

// ==================== PROCESSED MODULES HOOK ====================
interface UseGetProcessedModulesReturn {
  modules: any[] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetProcessedModules = (userId: string | null): UseGetProcessedModulesReturn => {
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
      setError(err instanceof Error ? err : new Error('Failed to fetch processed modules'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchModules(); }, [userId]);

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
    if (!processedModuleId || !userId) { setModule(null); return; }
    setIsLoading(true);
    setModule(null);
    setError(null);
    try {
      const response = await getProcessedModuleById(processedModuleId, userId);
      const data = response?.data ?? null;
      if (!data) throw new Error('API returned empty data field');
      setModule(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch processed module'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchModule(); }, [processedModuleId, userId]);

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
      const response: TrainingModulesResponse = await getTrainingModules(sprintId, userId);
      setModules(response.modules || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch training modules'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchModules(); }, [sprintId, userId]);

  return { modules, isLoading, error, refetch: fetchModules };
};

// ==================== TRAINING MODULE DETAIL HOOK ====================
interface UseGetTrainingModuleDetailReturn {
  module: any | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetTrainingModuleDetail = (moduleId: string | null): UseGetTrainingModuleDetailReturn => {
  const [module, setModule] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchModule = async () => {
    if (!moduleId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: TrainingModulesResponse = await getTrainingModuleDetail(moduleId, moduleId);
      setModule(response.modules?.[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch module detail'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchModule(); }, [moduleId]);

  return { module, isLoading, error, refetch: fetchModule };
};

// ==================== MODULE PROGRESS HOOK ====================
interface UseGetModuleProgressReturn {
  progress: ModuleProgress | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetModuleProgress = (
  userId: string | null,
): UseGetModuleProgressReturn => {
  const [progress, setProgress] = useState<ModuleProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProgress = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await getModuleProgress(userId);
      setProgress(response?.data || null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch module progress'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchProgress(); }, [userId]);

  return { progress, isLoading, error, refetch: fetchProgress };
};

// ==================== COMPANY HOOK ====================
interface UseGetCompanyReturn {
  company: Company | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetCompany = (companyId: string | null): UseGetCompanyReturn => {
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompany = async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response: CompanyResponse = await getCompany(companyId, companyId);
      setCompany(response.company);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch company'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCompany(); }, [companyId]);

  return { company, isLoading, error, refetch: fetchCompany };
};

// ==================== LEARNING STYLE HOOK ====================
interface UseGetLearningStyleReturn {
  learningStyle: LearningStyle | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useGetLearningStyle = (userId: string | null): UseGetLearningStyleReturn => {
  const [learningStyle, setLearningStyle] = useState<LearningStyle | null>(null);
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
      setError(err instanceof Error ? err : new Error('Failed to fetch learning style'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLearningStyle(); }, [userId]);

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
      const response: CompanyUsersResponse = await getCompanyUsers(companyId, userId);
      setUsers(response.users || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch company users'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [companyId, userId]);

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
      setError(err instanceof Error ? err : new Error('Failed to fetch training plan'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPlan(); }, [dbUserId, moduleId]);

  return { plan, isLoading, error, refetch: fetchPlan };
};

// ==================== DASHBOARD SUMMARY HOOK ====================
// Powers the HomeScreen — single call replaces separate plans + progress fetches.
// Provides: plans, progress rows, completedCount, totalAssigned, progressPercentage,
// userRank, totalUsers — exactly mirroring the web's loadDashboard() logic.

interface DashboardStats {
  completedCount: number;    // user_rank.modules_completed
  totalAssigned: number;     // number of ASSIGNED/IN_PROGRESS/COMPLETED plans
  progressPercentage: number; // (completedCount / totalAssigned) * 100
  userRank: number | null;
  topPercentile: number | null;
  totalUsers: number;
  nudgeMessage: string;
}

interface UseGetDashboardSummaryReturn {
  dashboardData: DashboardSummaryResponse | null;
  stats: DashboardStats;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const ASSIGNED_STATUSES = new Set(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']);

export const useGetDashboardSummary = (
  userId: string | null,
  companyId: string | null,
): UseGetDashboardSummaryReturn => {
  const [dashboardData, setDashboardData] = useState<DashboardSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboard = async () => {
    if (!userId || !companyId) {
      console.log('[Hook] useGetDashboardSummary skipped — missing userId or companyId');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      console.log('[Hook] useGetDashboardSummary fetching for userId:', userId);
      const data = await getDashboardSummary(userId, companyId);
      console.log('[Hook] Dashboard summary received — plans:', data.plans?.length, 'progress rows:', data.progress?.length);
      setDashboardData(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch dashboard summary');
      console.error('[Hook] useGetDashboardSummary error:', error.message);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, [userId, companyId]);

  // Derive the same stats the web computes in loadDashboard()
  const stats: DashboardStats = (() => {
    if (!dashboardData) {
      return {
        completedCount: 0, totalAssigned: 0, progressPercentage: 0,
        userRank: null, topPercentile: null, totalUsers: 0,
        nudgeMessage: '💪 One step in! Complete your sprints and stand among the top 5%.',
      };
    }

    const completedCount = dashboardData.user_rank?.modules_completed ?? 0;
    const totalAssigned = (dashboardData.plans ?? []).filter(
      (p: any) => ASSIGNED_STATUSES.has(String(p?.status ?? '').trim().toUpperCase())
    ).length;
    const progressPercentage = totalAssigned > 0
      ? Number(((completedCount / totalAssigned) * 100).toFixed(1))
      : 0;

    const nudgeMessage = progressPercentage >= 100
      ? "🎉 Congratulations! You've completed your Performance Sprint!"
      : '💪 One step in! Complete your sprints and stand among the top 5%.';

    return {
      completedCount,
      totalAssigned,
      progressPercentage,
      userRank: dashboardData.user_rank?.rank ?? null,
      topPercentile: dashboardData.user_rank?.top_percentile ?? null,
      totalUsers: dashboardData.total_users ?? 0,
      nudgeMessage,
    };
  })();

  return { dashboardData, stats, isLoading, error, refetch: fetchDashboard };
};