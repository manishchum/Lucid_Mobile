import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../../contex/AuthContext";
import { useTenant } from "../../contex/TenantContext";
import { useCareerJourneys, CareerJourney, SkillNode } from "../../api/career-journey/Hooks";
import { useGetDashboardSummary } from "../../api/users/Hooks";
import { STACK_ROUTES, APP_ROUTES } from "../../navigations/Routes";
import { useActiveSprint } from "../../contex/ActiveSprintContext";

const { width } = Dimensions.get("window");

export default function SprintverseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { cachedUser } = useAuth();
  const { company } = useTenant();
  
  const userId = cachedUser?.userId ?? null;
  const companyId = cachedUser?.companyId ?? null;

  const [selectedJourney, setSelectedJourney] = useState<CareerJourney | null>(null);
  const [activeLevelTab, setActiveLevelTab] = useState<"beginner" | "intermediate" | "advanced">("beginner");

  // Load published career journeys
  const { data: journeys = [], isLoading: loadingJourneys, error: journeysError, refetch: refetchJourneys } = useCareerJourneys(companyId);

  // Load user dashboard plan cards to match modules and enable clicking to start them
  const { resolvedPlanCards = [], refetch: refetchDashboard } = useGetDashboardSummary(userId, companyId);

  // Focus effect for pulling fresh data + hardware back button handling
  useFocusEffect(
    useCallback(() => {
      refetchJourneys();
      if (userId && companyId) {
        refetchDashboard(false);
      }

      const onBackPress = () => {
        if (selectedJourney !== null) {
          setSelectedJourney(null);
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [userId, companyId, selectedJourney, refetchJourneys, refetchDashboard])
  );

  const getLevelsPresent = useCallback((journey: CareerJourney): ("beginner" | "intermediate" | "advanced")[] => {
    const levelsSet = new Set<"beginner" | "intermediate" | "advanced">();
    (journey.skills ?? []).forEach((skill) => {
      if (skill.level) {
        levelsSet.add(skill.level);
      }
    });
    const order: ("beginner" | "intermediate" | "advanced")[] = ["beginner", "intermediate", "advanced"];
    const present = order.filter((lvl) => levelsSet.has(lvl));
    return present.length > 0 ? present : ["beginner"];
  }, []);

  const getJourneySprintsCount = (journey: CareerJourney) => {
    return journey.skills?.length ?? 0;
  };

  const getSkillsByLevel = (journey: CareerJourney, level: "beginner" | "intermediate" | "advanced") => {
    return (journey.skills ?? []).filter((s) => s.level === level);
  };

  const findMatchingPlanCard = (moduleId?: string) => {
    if (!moduleId) return null;
    return resolvedPlanCards.find(
      (card) => String(card.moduleId).toLowerCase() === String(moduleId).toLowerCase()
    );
  };

  const { setActiveSprint, setActiveModule } = useActiveSprint();

  const handleStartSprint = (moduleId: string) => {
    const card = findMatchingPlanCard(moduleId);
    if (card) {
      setActiveSprint({
        moduleId: card.moduleId,
        planId: card.planKey,
        planTitle: card.title,
        modules: card.modules,
        tips: card.tips,
        processedModuleIds: card.processedModuleIds ?? [],
      });
      setActiveModule(null); // Unmount old module
      navigation.navigate("AppTabs", { screen: STACK_ROUTES.SPRINT });
    }
  };

  const renderJourneyCard = ({ item }: { item: CareerJourney }) => {
    const totalSkills = getJourneySprintsCount(item);
    const totalLevels = getLevelsPresent(item).length;
    return (
      <TouchableOpacity
        style={styles.journeyCard}
        activeOpacity={0.85}
        onPress={() => {
          setSelectedJourney(item);
          const present = getLevelsPresent(item);
          setActiveLevelTab(present[0]);
        }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="briefcase-outline" size={24} color="#3b82f6" />
          </View>
          <View style={styles.badgesRow}>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{totalLevels} {totalLevels === 1 ? "Level" : "Levels"}</Text>
            </View>
            <View style={[styles.badgeContainer, { marginLeft: 8 }]}>
              <Text style={styles.badgeText}>{totalSkills} {totalSkills === 1 ? "Skill" : "Skills"}</Text>
            </View>
          </View>
        </View>
        
        <Text style={styles.journeyTitle} numberOfLines={2}>
          {item.title}
        </Text>
        
        {item.description ? (
          <Text style={styles.journeyDescription} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>Explore Career Path</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#3b82f6" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkillCard = (skill: SkillNode, index: number) => {
    const matchingCard = findMatchingPlanCard(skill.moduleId);
    const isAssigned = !!matchingCard;
    const isCompleted = matchingCard?.status === "COMPLETED";

    return (
      <View key={skill.id || index} style={styles.skillCard}>
        <View style={styles.skillHeader}>
          <View style={styles.skillIconWrapper}>
            <MaterialCommunityIcons name="lightning-bolt" size={20} color="#f59e0b" />
          </View>
          {skill.estimatedHours ? (
            <View style={styles.timeBadge}>
              <MaterialCommunityIcons name="clock-outline" size={12} color="#64748b" />
              <Text style={styles.timeBadgeText}>
                {skill.estimatedHours} {skill.timeUnit || "hours"}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.skillTitle}>{skill.title}</Text>
        {skill.description ? (
          <Text style={styles.skillDesc}>{skill.description}</Text>
        ) : null}

        {skill.moduleId ? (
          <View style={styles.actionContainer}>
            {isAssigned ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  isCompleted ? styles.actionButtonCompleted : styles.actionButtonActive,
                ]}
                activeOpacity={0.8}
                onPress={() => handleStartSprint(skill.moduleId!)}
              >
                <MaterialCommunityIcons
                  name={isCompleted ? "checkbox-marked-circle" : "play"}
                  size={16}
                  color="#ffffff"
                />
                <Text style={styles.actionButtonText}>
                  {isCompleted ? "Review Sprint" : "Start Sprint"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.lockedBadge}>
                <MaterialCommunityIcons name="lock-outline" size={14} color="#64748b" />
                <Text style={styles.lockedBadgeText}>Not Assigned</Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  if (loadingJourneys) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loaderText}>Loading Sprintverse Paths...</Text>
      </View>
    );
  }

  if (journeysError && journeys.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={styles.errorText}>Failed to load Sprintverse</Text>
        <Text style={styles.errorSubtext}>{journeysError.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetchJourneys()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (journeys.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="rocket-launch-outline" size={48} color="#64748b" />
        <Text style={styles.errorText}>No career paths published yet</Text>
        <Text style={styles.errorSubtext}>Please wait for the admin to publish SprintVerse paths.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {!selectedJourney ? (
        // List View Mode
        <View style={styles.listView}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtnRow}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color="#6366F1" />
              <Text style={styles.backBtnText}>Back to Home</Text>
            </TouchableOpacity>

            <View style={styles.headerTitleContainer}>
              <MaterialCommunityIcons name="orbit" size={28} color="#3b82f6" style={styles.headerIcon} />
              <Text style={styles.headerTitle}>SprintVerse</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Select a career path to explore its level stages and required skills.
            </Text>
          </View>

          <FlatList
            data={journeys}
            renderItem={renderJourneyCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      ) : (
        // Detail View Mode
        <View style={styles.detailView}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedJourney(null)}
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#64748b" />
              <Text style={styles.backButtonText}>Back to Paths</Text>
            </TouchableOpacity>
            
            <Text style={styles.detailRoleName}>{selectedJourney.title}</Text>
            {selectedJourney.description ? (
              <Text style={styles.detailRoleDesc}>{selectedJourney.description}</Text>
            ) : null}
          </View>

          {/* Level Tabs */}
          <View style={styles.levelTabsContainer}>
            {getLevelsPresent(selectedJourney).map((lvl) => {
              const label = lvl === "beginner" ? "Level 1" : lvl === "intermediate" ? "Level 2" : "Level 3";
              const isActive = activeLevelTab === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.levelTab,
                    isActive && styles.levelTabActive,
                  ]}
                  onPress={() => setActiveLevelTab(lvl)}
                >
                  <Text
                    style={[
                      styles.levelTabText,
                      isActive && styles.levelTabTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Skills Scrollable Area */}
          <ScrollView
            style={styles.skillsScrollView}
            contentContainerStyle={styles.skillsScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {getSkillsByLevel(selectedJourney, activeLevelTab).length > 0 ? (
              getSkillsByLevel(selectedJourney, activeLevelTab).map((skill, index) =>
                renderSkillCard(skill, index)
              )
            ) : (
              <View style={styles.emptySkillsContainer}>
                <MaterialCommunityIcons name="school-outline" size={40} color="#94a3b8" />
                <Text style={styles.emptySkillsText}>
                  No skills configured for {activeLevelTab === "beginner" ? "Level 1" : activeLevelTab === "intermediate" ? "Level 2" : "Level 3"}.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6366F1",
    marginLeft: 4,
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc", // Whole app matching clean light background
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loaderText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "bold",
  },
  errorSubtext: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#3b82f6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "bold",
  },
  listView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  journeyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 20,
    marginBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    justifyContent: "center",
    alignItems: "center",
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgeContainer: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgeText: {
    color: "#3b82f6",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  journeyTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  journeyDescription: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  footerText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  detailView: {
    flex: 1,
  },
  detailHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButtonText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  detailRoleName: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 6,
  },
  detailRoleDesc: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
  },
  levelTabsContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  levelTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  levelTabActive: {
    backgroundColor: "#3b82f6",
  },
  levelTabText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "bold",
  },
  levelTabTextActive: {
    color: "#ffffff",
  },
  skillsScrollView: {
    flex: 1,
  },
  skillsScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  skillCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  skillCardActive: {
    borderColor: "#dbeafe",
  },
  skillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  skillIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fffbeb",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  timeBadgeText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  skillTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 6,
  },
  skillDesc: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
    alignItems: "flex-start",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonActive: {
    backgroundColor: "#3b82f6",
  },
  actionButtonCompleted: {
    backgroundColor: "#10b981",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 6,
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  lockedBadgeText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
    marginLeft: 6,
  },
  emptySkillsContainer: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySkillsText: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
});
