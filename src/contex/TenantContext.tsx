import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useAuth } from "./AuthContext";
import { getDashboardSummary, getCompanyDetails } from "../api/users/Request";
import { useRealtimeSubscription } from "../hooks/useRealtimeSubscription";
import { appStorage } from "../utils/appStorage";

export type Addon =
  | "lucid_studio"
  | "lucid_studio_textual"
  | "lucid_studio_podcast"
  | "lucid_studio_video"
  | "lucid_studio_infographic"
  | "lucid_studio_mindmap"
  | "lucid_studio_flashcard"
  | "chat_in_studio"
  | "task_management"
  | "kpi"
  | "role_play"
  | "sprintverse"
  | "reports"
  | "gamification";

type CompanyInfo = {
  company_id?: string;
  name?: string;
  company_logo?: string | null;
  subscription_tier?: string | null;
  subscription_addons?: string[] | null;
  enabled_languages?: string[] | null;
  translation_languages?: string[] | null;
  languages?: string[] | null;
  learning_style?: boolean | null;
  rawCompany?: any;
};

interface TenantContextType {
  company: CompanyInfo | null;
  addons: Addon[];
  // True until the dashboard summary has been fetched at least once.
  loadingAddons: boolean;
  addonsKnown: boolean;
  setCompanyFromDashboard: (companyLike: any) => void;
  refreshAddons: () => Promise<void>;
}

const KNOWN_ADDONS: Addon[] = [
  "lucid_studio",
  "lucid_studio_textual",
  "lucid_studio_podcast",
  "lucid_studio_video",
  "lucid_studio_infographic",
  "lucid_studio_mindmap",
  "lucid_studio_flashcard",
  "chat_in_studio",
  "task_management",
  "kpi",
  "role_play",
  "sprintverse",
  "reports",
  "gamification",
];

const normalizeAddonKey = (value: string): Addon | null => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  if (["tasks", "task_manager", "task_management"].includes(raw)) {
    return "task_management";
  }

  const normalized = raw as Addon;
  return KNOWN_ADDONS.includes(normalized) ? normalized : null;
};

const normalizeAddons = (values?: string[] | null): Addon[] => {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((v) => normalizeAddonKey(String(v)))
        .filter((v): v is Addon => Boolean(v)),
    ),
  );
};

const TenantContext = createContext<TenantContextType>({
  company: null,
  addons: [],
  loadingAddons: true,
  addonsKnown: false,
  setCompanyFromDashboard: () => {},
  refreshAddons: async () => {},
});

export const useTenant = () => useContext(TenantContext);

export const TenantProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { cachedUser } = useAuth();
  const [company, setCompany] = useState<CompanyInfo | null>(() => {
    if (!cachedUser?.companyId) return null;
    return appStorage.getObject<CompanyInfo>(`@company_${cachedUser.companyId}`);
  });
  const [loadingAddons, setLoadingAddons] = useState(() => {
    if (!cachedUser?.companyId) return true;
    const cached = appStorage.getObject<CompanyInfo>(`@company_${cachedUser.companyId}`);
    return !cached;
  });
  const [addonsKnown, setAddonsKnown] = useState(() => {
    if (!cachedUser?.companyId) return false;
    const cached = appStorage.getObject<CompanyInfo>(`@company_${cachedUser.companyId}`);
    return Array.isArray(cached?.subscription_addons);
  });

  const setCompanyFromDashboard = useCallback((companyLike: any) => {
    if (!companyLike) {
      setAddonsKnown(true);
      setLoadingAddons(false);
      return;
    }

    if (companyLike.company_id) {
      appStorage.setObject(`@company_${companyLike.company_id}`, companyLike);
    }

    setCompany({
      ...companyLike,
      company_id: companyLike.company_id,
      name: companyLike.name,
      company_logo: companyLike.company_logo ?? null,
      subscription_tier: companyLike.subscription_tier ?? null,
      subscription_addons: Array.isArray(companyLike.subscription_addons)
        ? companyLike.subscription_addons
        : null,
      enabled_languages: Array.isArray(companyLike.enabled_languages)
        ? companyLike.enabled_languages
        : null,
      translation_languages: Array.isArray(companyLike.translation_languages)
        ? companyLike.translation_languages
        : null,
      languages: Array.isArray(companyLike.languages)
        ? companyLike.languages
        : null,
      rawCompany: companyLike,
    });

    setAddonsKnown(Array.isArray(companyLike.subscription_addons));
    setLoadingAddons(false);
  }, []);

  const refreshAddons = useCallback(async () => {
    if (!cachedUser?.companyId) return;
    setLoadingAddons(true);
    try {
      // 1. First attempt: Direct company fetch (no cache, instant permissions)
      const directComp = await getCompanyDetails(
        cachedUser.companyId,
        cachedUser.userId,
      );
      if (directComp) {
        setCompanyFromDashboard(directComp);
        return;
      }

      // 2. Fallback attempt: Dashboard summary
      if (cachedUser.userId) {
        const data = await getDashboardSummary(
          cachedUser.userId,
          cachedUser.companyId,
        );
        setCompanyFromDashboard(data?.company ?? null);
      }
    } catch (err) {
      console.warn("refreshAddons failed — failing open:", err);
      setAddonsKnown(false);
      setLoadingAddons(false);
    }
  }, [cachedUser?.userId, cachedUser?.companyId, setCompanyFromDashboard]);

  // Proactive fetch on mount and whenever user/company changes
  useEffect(() => {
    if (!cachedUser?.companyId) {
      setCompany(null);
      setAddonsKnown(false);
      setLoadingAddons(true);
      return;
    }

    refreshAddons();
  }, [cachedUser?.companyId, refreshAddons]);

  // Instant Realtime sync: Listen for company updates in Supabase
  const companyId = cachedUser?.companyId ?? null;
  useRealtimeSubscription({
    table: "companies",
    event: "UPDATE",
    filter: companyId ? `company_id=eq.${companyId}` : undefined,
    channelName: companyId ? `realtime:companies:${companyId}` : undefined,
    enabled: Boolean(companyId),
    onPayload: (payload: any) => {
      console.log(
        "[TenantContext] Real-time company update received:",
        payload?.new?.company_id,
        payload?.new?.subscription_addons,
      );
      if (payload?.new) {
        setCompanyFromDashboard(payload.new);
      }
    },
  });

  const addons = useMemo(
    () => normalizeAddons(company?.subscription_addons),
    [company],
  );

  const value = useMemo(
    () => ({
      company,
      addons,
      loadingAddons,
      addonsKnown,
      setCompanyFromDashboard,
      refreshAddons,
    }),
    [
      company,
      addons,
      loadingAddons,
      addonsKnown,
      setCompanyFromDashboard,
      refreshAddons,
    ],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
};
