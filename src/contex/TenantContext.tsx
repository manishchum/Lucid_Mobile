import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import { getDashboardSummary } from "../api/users/Request";

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
  | "reports";

type CompanyInfo = {
  company_id?: string;
  name?: string;
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
];

const normalizeAddonKey = (value: string): Addon | null => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_") as Addon;
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
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loadingAddons, setLoadingAddons] = useState(true);
  const [addonsKnown, setAddonsKnown] = useState(false);

  const setCompanyFromDashboard = useCallback((companyLike: any) => {
    if (!companyLike) {
      setAddonsKnown(true);
      setLoadingAddons(false);
      return;
    }

    setCompany({
      ...companyLike,
      company_id: companyLike.company_id,
      name: companyLike.name,
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
    if (!cachedUser?.userId || !cachedUser?.companyId) return;
    setLoadingAddons(true);
    try {
      const data = await getDashboardSummary(
        cachedUser.userId,
        cachedUser.companyId,
      );
      setCompanyFromDashboard(data?.company ?? null);
    } catch (err) {
      console.warn("refreshAddons failed — failing open:", err);
      setAddonsKnown(false);
      setLoadingAddons(false);
    }
  }, [cachedUser?.userId, cachedUser?.companyId, setCompanyFromDashboard]);

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
