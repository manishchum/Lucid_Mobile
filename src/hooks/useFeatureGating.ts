import { Addon, useTenant } from "../contex/TenantContext";

export type Tier = "tier_1" | "tier_2" | "tier_3";

export const FEATURES = {
  LUCID_STUDIO: "lucidStudio",
  TEXTUAL: "textual",
  PODCAST: "podcast",
  VIDEO: "video",
  INFOGRAPHIC: "infographic",
  MINDMAP: "mindmap",
  FLASHCARD: "flashcard",
  CHAT_IN_STUDIO: "chatInStudio",
  TASK_MANAGEMENT: "taskManagement",
  KPI: "kpi",
  ROLE_PLAY: "rolePlay",
} as const;

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES];

const FEATURE_CONFIG: Record<FeatureName, { requiredAddons: Addon[] }> = {
  [FEATURES.LUCID_STUDIO]: { requiredAddons: ["lucid_studio"] },
  [FEATURES.TEXTUAL]: { requiredAddons: ["lucid_studio_textual"] },
  [FEATURES.PODCAST]: { requiredAddons: ["lucid_studio_podcast"] },
  [FEATURES.VIDEO]: { requiredAddons: ["lucid_studio_video"] },
  [FEATURES.INFOGRAPHIC]: { requiredAddons: ["lucid_studio_infographic"] },
  [FEATURES.MINDMAP]: { requiredAddons: ["lucid_studio_mindmap"] },
  [FEATURES.FLASHCARD]: { requiredAddons: ["lucid_studio_flashcard"] },
  [FEATURES.CHAT_IN_STUDIO]: { requiredAddons: ["chat_in_studio"] },
  [FEATURES.TASK_MANAGEMENT]: { requiredAddons: ["task_management"] },
  [FEATURES.KPI]: { requiredAddons: ["kpi"] },
  [FEATURES.ROLE_PLAY]: { requiredAddons: ["role_play"] },
};

const deriveFrontendTier = (addons: Addon[]): Tier | null => {
  const current = new Set(addons);
  if (current.has("task_management")) return "tier_3";
  if (current.has("chat_in_studio")) return "tier_2";
  if (current.has("lucid_studio")) return "tier_1";
  return null;
};

// Feature mapping on mobile side:
export function useFeatureGating() {
  const { addons, addonsKnown } = useTenant();

  const getAvailableAddons = (): Addon[] => addons;

  const getAvailableTier = (): Tier | null => deriveFrontendTier(addons);

  const hasFeature = (featureName: FeatureName | string): boolean => {
    // Fail open API hasn't told us about addons at all yet - show everything for now..
    if (!addonsKnown) return true;

    const config = FEATURE_CONFIG[featureName as FeatureName];
    if (!config) {
      console.warn(`[useFeatureGating] Unknown feature: ${featureName}`);
      return true;
    }
    return config.requiredAddons.every((addon) => addons.includes(addon));
  };

  return {
    addons,
    addonsKnown,
    getAvailableAddons,
    getAvailableTier,
    hasFeature,
  };
}
