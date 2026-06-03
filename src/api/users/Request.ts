import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  UserResponse,
  UserRolesResponse,
  LearningPlansResponse,
  TrainingModulesResponse,
  ModuleProgress,
  CompanyResponse,
  LearningStyleResponse,
  CompanyUsersResponse,
  TrainingModule,
  PostModuleChatDto,
  PostModuleChatResponseDto,
  DashboardSummaryResponse,
} from './Dto';

const API_BASE_URL = 'https://api.workfloww.ai/api';
const MODULE_CHAT_URL = 'https://api.workfloww.ai/api/module-chat';

const getFirebaseToken = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const authInstance = getAuth();
    const currentUser = authInstance.currentUser;

    if (currentUser) {
      currentUser.getIdToken(true)
        .then(resolve)
        .catch(() => resolve(null));
      return;
    }

    const timeout = setTimeout(() => { unsubscribe(); resolve(null); }, 5000);
    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      clearTimeout(timeout);
      unsubscribe();
      if (user) {
        user.getIdToken(true).then(resolve).catch(() => resolve(null));
      } else {
        resolve(null);
      }
    });
  });
};

export interface ModuleChatMessage {
  role: 'user' | 'assistant';
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
  console.info('[Request] postModuleChat', { processed_module_id: data.processed_module_id });
 
  const response = await fetch(MODULE_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      processed_module_id: data.processed_module_id,
      user_message: data.user_message,
      user_id: data.user_id,
      company_id: data.company_id,
      chat_history: data.chat_history,
    }),
  });
 
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[Request] Error posting module chat:', errorText);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
 
  const result = (await response.json()) as PostModuleChatResponseDto;
  console.info('[Request] postModuleChat success');
  return result;
};

const getHeaders = async (userId?: string): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (userId) headers['X-User-ID'] = userId;
  const token = await getFirebaseToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

const getPublicHeaders = (userId?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (userId) headers['X-User-ID'] = userId;
  return headers;
};

// 1. Get user by email
export const getUserByEmail = async (email: string): Promise<UserResponse> => {
  try {
    const url = `${API_BASE_URL}/users/by-email/${encodeURIComponent(email)}`;
    console.log('[Request] getUserByEmail →', url);
    const response = await fetch(url, { method: 'GET', headers: getPublicHeaders() });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getUserByEmail ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    if (json.user) {
      console.log('[Request] getUserByEmail ✅ user_id:', json.user.user_id);
    } else {
      console.error('[Request] getUserByEmail — user is null:', JSON.stringify(json));
    }
    return json;
  } catch (error) {
    console.error('[Request] Error fetching user by email:', error);
    throw error;
  }
};

// 1b. Get user by phone
export const getUserByPhone = async (phone: string): Promise<UserResponse> => {
  try {
    const url = `${API_BASE_URL}/users/by-phone/${encodeURIComponent(phone)}`;
    console.log('[Request] getUserByPhone →', url);
    const response = await fetch(url, { method: 'GET', headers: getPublicHeaders() });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getUserByPhone ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    if (json.user) {
      console.log('[Request] getUserByPhone ✅ user_id:', json.user.user_id);
    } else {
      console.warn('[Request] getUserByPhone — no user found for phone:', phone);
    }
    return json;
  } catch (error) {
    console.error('[Request] Error fetching user by phone:', error);
    throw error;
  }
};

// 2. Get learning plans by userId
export const getLearningPlans = async (userId: string): Promise<LearningPlansResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/learning-plans/?user_id=${userId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getLearningPlans ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
};

// 3. Get module progress by userId
export const getModuleProgress = async (userId: string): Promise<ModuleProgress> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/module-progress/user/${userId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching module progress:', error);
    throw error;
  }
};

// 4. Get learning style by userId
export const getLearningStyle = async (userId: string): Promise<LearningStyleResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/learning-style?user_id=${userId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching learning style:', error);
    throw error;
  }
};

// 5. Get user roles by userId
export const getUserRoles = async (userId: string): Promise<UserRolesResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/roles/users/${userId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching user roles:', error);
    throw error;
  }
};

// 6. Get training modules by company ID
export const getTrainingModules = async (companyId: string, userId: string): Promise<TrainingModulesResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/training-modules/company/${companyId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching training modules:', error);
    throw error;
  }
};

// 7. Get training module detail by moduleId
export const getTrainingModuleDetail = async (moduleId: string, userId: string): Promise<{ module: TrainingModule }> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/training-modules/${moduleId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching training module detail:', error);
    throw error;
  }
};

// 8. Get company details by companyId
export const getCompany = async (companyId: string, userId: string): Promise<CompanyResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/companies/${companyId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching company:', error);
    throw error;
  }
};

// 9. Get company users by companyId
export const getCompanyUsers = async (companyId: string, userId: string): Promise<CompanyUsersResponse> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(`${API_BASE_URL}/users/company/${companyId}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching company users:', error);
    throw error;
  }
};

// 10. POST /training-plan
// body.user_id must equal the Firebase JWT Bearer token's sub claim.
// We read uid directly from getAuth().currentUser — the same user whose
// token getHeaders() attaches — so they are always guaranteed to match.
export const getTrainingPlan = async (
  dbUserId: string,  // DB UUID → X-User-ID header for backend DB lookups
  moduleId: string,
): Promise<any> => {
  try {
    const currentUser = getAuth().currentUser;
    if (!currentUser) throw new Error('No authenticated Firebase user');

    // uid == JWT sub, headers has Authorization: Bearer <same token>
    const [headers] = await Promise.all([getHeaders(dbUserId)]);
    const response = await fetch(`${API_BASE_URL}/training-plan`, {
      method: 'POST',
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
    console.error('[Request] Error fetching training plan:', error);
    throw error;
  }
};

// 11. Get processed modules by original module ID
export const getProcessedModules = async (originalModuleId: string, userId: string): Promise<any> => {
  try {
    const headers = await getHeaders(userId);
    const response = await fetch(
      `${API_BASE_URL}/processed-modules/original-module/${originalModuleId}`,
      { method: 'GET', headers }
    );
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getProcessedModules ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching processed modules:', error);
    throw error;
  }
};

// 12. Get a single processed module by its specific processed_module_id
export const getProcessedModuleById = async (processedModuleId: string, userId: string): Promise<any> => {
  try {
    const headers = await getHeaders(userId);
    const url = `${API_BASE_URL}/processed-modules/${processedModuleId}`;
    console.log('[v0] [Request] Fetching processed module:', { url, processedModuleId });
    
    const response = await fetch(url, { method: 'GET', headers });
    
    if (!response.ok) {
      const body = await response.text();
      console.error(`[v0] [Request] ❌ getProcessedModuleById HTTP ${response.status}:`, body.substring(0, 200));
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const json = await response.json();
    
    if (!json || !json.data) {
      throw new Error('API response missing "data" field');
    }

    console.log('[v0] [Request] ✅ Processed module fetched:', json.data?.title);
    return json;
  } catch (error) {
    console.error('[v0] [Request] ❌ Error fetching processed module:', error);
    throw error;
  }
};

// ── 13. Dashboard Summary ──────────────────────────────────────────────────────
// Single call that powers the entire HomeScreen — same as web's dashboard_summary.
// Returns: plans, progress, user_rank (modules_completed, rank, top_percentile), total_users.
export const getDashboardSummary = async (
  userId: string,
  companyId: string,
): Promise<DashboardSummaryResponse> => {
  try {
    const headers = await getHeaders(userId);
    headers['X-Company-ID'] = companyId;
    const url = `${API_BASE_URL}/employee/dashboard_summary/${encodeURIComponent(userId)}`;
    console.log('[Request] getDashboardSummary →', url);
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      const body = await response.text();
      console.error(`[Request] getDashboardSummary ${response.status}:`, body);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[Request] Error fetching dashboard summary:', error);
    throw error;
  }
};