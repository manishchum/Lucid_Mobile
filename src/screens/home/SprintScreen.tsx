import React, { useMemo, useState, useCallback } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	StatusBar,
	LayoutAnimation,
	Platform,
	UIManager,
	Alert,
	Linking,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { APP_ROUTES, STACK_ROUTES } from "../../navigations/Routes";
import { useAuth } from "../../contex/AuthContext";
import { useNetworkStatus } from "../../hooks/network/useNetworkStatus";
import NoInternetModal from "../../components/networkModal/NetworkModal";
import { useModuleProgress, useGetTrainingPlan } from "../../api/users/Hooks";
import { useFeatureGating, FEATURES } from "../../hooks/useFeatureGating";

if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SprintScreen({
	navigation,
	route,
}: {
	navigation: any;
	route: any;
}) {
	const insets = useSafeAreaInsets();
	const { cachedUser } = useAuth();
	const { hasFeature } = useFeatureGating();
	const showStudio = hasFeature(FEATURES.LUCID_STUDIO);

	// ── Route params passed from HomeScreen ──────────────────────────────────
	const moduleId: string = route?.params?.moduleId ?? "";
	const planTitle: string = route?.params?.planTitle ?? "Performance Sprint";
	const tips: string = route?.params?.tips ?? "";
	const rawModules: any[] = route?.params?.modules ?? [];
	// processedModuleIds are resolved on the home screen from the learning-plans
	// API (default learning style). Index-aligned with rawModules[].
	const processedModuleIds: string[] =
		route?.params?.processedModuleIds ?? [];

	const [tipsExpanded, setTipsExpanded] = useState(false);
	const [showNoInternet, setShowNoInternet] = useState(false);

	const isOnline = useNetworkStatus();

  const { plan: trainingPlan } = useGetTrainingPlan(
    cachedUser?.userId ?? null,
    moduleId || null,
  );
  const additionalReadings: Array<{ url: string; title: string }> =
    useMemo(() => {
      const raw = trainingPlan?.additional_readings;

      const toEntry = (item: unknown, idx: number) => {
        if (item && typeof item === "object") {
          const obj = item as { url?: string; title?: string };
          return {
            url: obj.url ?? "",
            title: obj.title ?? `Reading ${idx + 1}`,
          };
        }
        const url = String(item ?? "").trim();
        return { url, title: `Reading ${idx + 1}` };
      };

      if (Array.isArray(raw)) {
        return raw.map(toEntry).filter((r) => r.url.length > 0);
      }

      if (typeof raw === "string" && raw.trim().length > 0) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map(toEntry).filter((r) => r.url.length > 0);
          }
        } catch {}
        return raw
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((url, idx) => ({ url, title: `Reading ${idx + 1}` }));
      }

      return [];
    }, [trainingPlan]);

	const trainingPlanModulesByTitle = useMemo(() => {
		const map = new Map<string, string>();
		const planModules: Array<{
			title?: string;
			order?: number;
			processed_module_id?: string;
		}> = trainingPlan?.plan?.modules ?? [];
		planModules.forEach((m) => {
			const key = (m?.title ?? "").trim().toLowerCase();
			if (key && m?.processed_module_id) {
				map.set(key, m.processed_module_id);
			}
		});
		return map;
	}, [trainingPlan]);

	const trainingPlanModulesByOrder = useMemo(() => {
		const map = new Map<number, string>();
		const planModules: Array<{
			order?: number;
			processed_module_id?: string;
		}> = trainingPlan?.plan?.modules ?? [];
		planModules.forEach((m) => {
			if (typeof m?.order === "number" && m?.processed_module_id) {
				map.set(m.order, m.processed_module_id);
			}
		});
		return map;
	}, [trainingPlan]);

	const resolveProcessedModuleId = (
		index: number,
		mod: { title?: string; order?: number },
	): string => {
		const titleKey = (mod?.title ?? "").trim().toLowerCase();
		const byTitle = titleKey
			? trainingPlanModulesByTitle.get(titleKey)
			: "";
		if (byTitle) return byTitle;

		if (typeof mod?.order === "number") {
			const byOrder = trainingPlanModulesByOrder.get(mod.order);
			if (byOrder) return byOrder;
		}

		return processedModuleIds[index] ?? "";
	};

	const handleOpenReading = async (url: string) => {
		if (!url) return;
		try {
			const canOpen = await Linking.canOpenURL(url);
			if (canOpen) {
				// Opens in the system default browser.
				await Linking.openURL(url);
			} else {
				Alert.alert("Error", "Cannot open this link.");
			}
		} catch (error) {
			console.error("[SprintScreen] Failed to open reading link:", error);
			Alert.alert(
				"Error",
				"Something went wrong while opening this link.",
			);
		}
	};

	const modules = useMemo(
		() =>
			rawModules as Array<{
				order: number;
				title: string;
				recommended_time: number;
			}>,
		[rawModules],
	);

	const totalModules = modules.length;

	// Sprint progress: live count of how many of THIS sprint's modules have a
	// module-progress record
	const { progress: moduleProgressEntries, refetch: refetchModuleProgress } =
		useModuleProgress(cachedUser?.userId ?? null);

	useFocusEffect(
		useCallback(() => {
			refetchModuleProgress();
			// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [cachedUser?.userId]),
	);

	// ── Verified completion sets
	const { completedProcessedModuleIds, quizPassedProcessedModuleIds } =
		useMemo(() => {
			const completed = new Set<string>();
			const quizPassed = new Set<string>();
			moduleProgressEntries.forEach((entry) => {
				if (!entry.processed_module_id) return;
				const entryOriginalModuleId =
					entry.processed_modules?.original_module_id;
				if (
					entryOriginalModuleId &&
					entryOriginalModuleId !== moduleId
				) {
					console.warn(
						` Rejected foreign progress record: ` +
							`processed_module_id="${entry.processed_module_id}" ` +
							`title="${entry.processed_modules?.title}" belongs to ` +
							`original_module_id="${entryOriginalModuleId}", not this ` +
							`sprint's moduleId="${moduleId}".`,
					);
					return;
				}
				completed.add(entry.processed_module_id);
				if (entry.quiz_score !== null) {
					quizPassed.add(entry.processed_module_id);
				}
			});
			return {
				completedProcessedModuleIds: completed,
				quizPassedProcessedModuleIds: quizPassed,
			};
		}, [moduleProgressEntries, moduleId]);

	// Which of this sprint's module slots are done, by index
	const moduleDoneFlags = useMemo(
		() =>
			modules.map((mod, i) => {
				const pid = resolveProcessedModuleId(i, mod);
				const done = !!pid && quizPassedProcessedModuleIds.has(pid);
				if (done) {
					console.log(
						`[SprintScreen] Module[${i}] "${modules[i]?.title}" → ` +
							`processedModuleId="${pid}" → quiz completed → marked DONE`,
					);
				}
				return done;
			}),
		[
			modules,
			processedModuleIds,
			quizPassedProcessedModuleIds,
			trainingPlanModulesByTitle,
			trainingPlanModulesByOrder,
		],
	);
	const completedModulesCount = moduleDoneFlags.filter(Boolean).length;

	const handleToggleTips = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setTipsExpanded((v) => !v);
	};

	/**
	 * handleViewContent — canonical title/order match first, positional
	 * fallback last (see resolveProcessedModuleId above).
	 */
	const handleViewContent = (
		index: number,
		modTitle: string,
		mod?: { order?: number },
	) => {
		if (isOnline === false) {
			setShowNoInternet(true);
			return;
		}

		if (!showStudio) {
			Alert.alert(
				"Not available",
				"Studio content isn't included in your plan yet.",
			);
			return;
		}

		const processedModuleId = resolveProcessedModuleId(index, {
			title: modTitle,
			order: mod?.order,
		});

		if (!processedModuleId) {
			console.warn(
				` No processedModuleId at index ${index} for "${modTitle}"`,
			);
			Alert.alert(
				"Not available",
				"Module content could not be found. Please try again later.",
			);
			return;
		}

		console.log(
			`[SprintScreen] ✅ View Content: Module[${index}] "${modTitle}" → processedModuleId="${processedModuleId}"`,
		);

		navigation.navigate(APP_ROUTES.STUDIO, {
			processedModuleId,
			moduleTitle: modTitle,
			sprintTitle: planTitle,
		});
	};

	/**
	 * handleModuleQuiz — same
	 */
	const handleModuleQuiz = (
		index: number,
		modTitle: string,
		mod?: { order?: number },
	) => {
		if (isOnline === false) {
			setShowNoInternet(true);
			return;
		}

		const processedModuleId = resolveProcessedModuleId(index, {
			title: modTitle,
			order: mod?.order,
		});

		if (!processedModuleId) {
			console.warn(
				`[SprintScreen] ⚠️ No processedModuleId at index ${index} for quiz "${modTitle}"`,
			);
			Alert.alert(
				"Not available",
				"Quiz could not be loaded for this module. Please try again later.",
			);
			return;
		}

		console.log(
			`[SprintScreen] ✅ Module Quiz: Module[${index}] "${modTitle}" → processedModuleId="${processedModuleId}"`,
		);

		navigation.navigate(STACK_ROUTES.MODULE_QUIZ, {
			processedModuleId,
			moduleId,
			moduleTitle: modTitle,
		});
	};

	if (!moduleId) {
		return (
			<View style={[styles.centered, { paddingTop: insets.top + 20 }]}>
				<MaterialCommunityIcons
					name="lightning-bolt"
					size={48}
					color="#CBD5E1"
				/>
				<Text style={styles.emptyTitle}>No Sprint Selected</Text>
				<Text style={styles.emptySubtitle}>
					Go to Home and tap "Start your sprint" on a learning plan to
					begin.
				</Text>
			</View>
		);
	}

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<StatusBar barStyle="dark-content" />
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
				{/* ── Header ──────────────────────────────────────────────────────── */}
				<View style={styles.header}>
					<Text style={styles.headerTitle} numberOfLines={2}>
						{planTitle}
					</Text>
				</View>

				{/* ── Hero Card ───────────────────────────────────────────────────── */}
				<View style={styles.sprintCard}>
					<View style={styles.cardHeader}>
						<View style={styles.iconCircle}>
							<MaterialCommunityIcons
								name="lightning-bolt"
								size={24}
								color="white"
							/>
						</View>
						<View style={{ flex: 1 }}>
							<Text style={styles.cardTitle}>
								Your Roadmap to Mastery
							</Text>
							<Text style={styles.cardMeta}>
								{totalModules} Module
								{totalModules !== 1 ? "s" : ""}
								{` · ${completedModulesCount} / ${totalModules} Completed`}
							</Text>
						</View>
					</View>

					<View style={styles.progressRow}>
						{modules.map((_: any, i: number) => (
							<View
								key={i}
								style={[
									styles.progressSegment,
									{ flex: 1 },
									moduleDoneFlags[i] &&
										styles.progressSegmentFilled,
								]}
							/>
						))}
					</View>

					<Text style={styles.progressFraction}>
						{`${completedModulesCount} of ${totalModules} modules complete`}
					</Text>

					{tips ? (
						<TouchableOpacity
							onPress={handleToggleTips}
							activeOpacity={0.85}
							style={styles.tipsContainer}>
							<View style={styles.tipsRow}>
								<Text style={styles.tipsIcon}>💡</Text>
								<Text
									style={styles.tipsText}
									numberOfLines={
										tipsExpanded ? undefined : 2
									}>
									{tips}
								</Text>
								<MaterialCommunityIcons
									name={
										tipsExpanded
											? "chevron-up"
											: "chevron-down"
									}
									size={16}
									color="rgba(255,255,255,0.7)"
									style={{ marginLeft: 6, flexShrink: 0 }}
								/>
							</View>
							{!tipsExpanded && (
								<Text style={styles.tapToExpand}>
									Tap to read more
								</Text>
							)}
						</TouchableOpacity>
					) : null}
				</View>

				{/* ── Additional Readings ─────────────────────────────────────────── */}
				{additionalReadings.length > 0 && (
					<View style={styles.moduleSection}>
						<View style={styles.readingsHeaderRow}>
							<View style={styles.readingsIconCircle}>
								<MaterialCommunityIcons
									name="book-open-page-variant-outline"
									size={18}
									color="#4F46E5"
								/>
							</View>
							<View style={{ flex: 1 }}>
								<Text style={styles.sectionTitle}>
									Additional Readings
								</Text>
								<Text style={styles.readingsSubtitle}>
									Extra resources curated for this sprint.
								</Text>
							</View>
						</View>

						{additionalReadings.map((reading, idx) => (
							<View
								key={`reading-${idx}`}
								style={styles.readingCard}>
								<View style={{ flex: 1 }}>
									<Text
										style={styles.readingTitle}
										numberOfLines={2}>
										{reading.title}
									</Text>
									<Text
										style={styles.readingUrl}
										numberOfLines={1}>
										{reading.url}
									</Text>
								</View>
								<TouchableOpacity
									style={styles.readingOpenButton}
									onPress={() =>
										handleOpenReading(reading.url)
									}>
									<Text style={styles.readingOpenButtonText}>
										Open
									</Text>
									<MaterialCommunityIcons
										name="open-in-new"
										size={14}
										color="white"
									/>
								</TouchableOpacity>
							</View>
						))}
					</View>
				)}

				{/* ── Module List ─────────────────────────────────────────────────── */}
				<View style={styles.moduleSection}>
					<Text style={styles.sectionTitle}>Your Modules</Text>

					{modules.length === 0 ? (
						<View style={styles.emptyState}>
							<MaterialCommunityIcons
								name="book-open-outline"
								size={40}
								color="#CBD5E1"
							/>
							<Text style={styles.emptyText}>
								No modules assigned yet
							</Text>
						</View>
					) : (
						modules.map((mod, index) => {
							const isDone = moduleDoneFlags[index];
							const pid = resolveProcessedModuleId(index, mod);
							const hasProcessedId = !!pid;
							const isQuizPassed =
								!!pid && quizPassedProcessedModuleIds.has(pid);

							return (
								<View
									key={`${moduleId}-module-${index}`}
									style={[
										styles.moduleCard,
										isDone && styles.moduleCardDone,
									]}>
									{/* Module info row */}
									<View style={styles.cardRow}>
										<View
											style={[
												styles.statusDot,
												isDone && styles.statusDotDone,
											]}>
											<MaterialCommunityIcons
												name={
													isDone
														? "check"
														: "circle-outline"
												}
												size={14}
												color={
													isDone ? "#fff" : "#94A3B8"
												}
											/>
										</View>
										<View style={styles.moduleInfo}>
											<Text style={styles.moduleLabel}>
												MODULE {index + 1} OF{" "}
												{totalModules}
											</Text>
											<Text style={styles.moduleTitle}>
												{mod.title}
											</Text>
										</View>
									</View>

									{/* Button row: View Content + Module Quiz */}
									<View style={styles.buttonRow}>
										{/* View Content */}
										<TouchableOpacity
											style={[
												styles.viewButton,
												!hasProcessedId &&
													styles.viewButtonDisabled,
											]}
											disabled={!hasProcessedId}
											onPress={() =>
												handleViewContent(
													index,
													mod.title,
													mod,
												)
											}>
											<Text style={styles.viewButtonText}>
												View Content
											</Text>
										</TouchableOpacity>

										{/* Module Quiz — disabled + relabelled once quiz is passed */}
										<TouchableOpacity
											style={[
												styles.quizButton,
												(!hasProcessedId ||
													isQuizPassed) &&
													styles.quizButtonDisabled,
												isQuizPassed &&
													styles.quizButtonPassed,
											]}
											disabled={
												!hasProcessedId || isQuizPassed
											}
											onPress={() =>
												handleModuleQuiz(
													index,
													mod.title,
													mod,
												)
											}>
											{isQuizPassed && (
												<MaterialCommunityIcons
													name="check-circle-outline"
													size={14}
													color="#6EE7B7"
													style={{ marginRight: 5 }}
												/>
											)}
											<Text
												style={[
													styles.quizButtonText,
													isQuizPassed &&
														styles.quizButtonTextPassed,
												]}>
												{isQuizPassed
													? "Quiz Attempted"
													: "Module Quiz"}
											</Text>
										</TouchableOpacity>
									</View>
								</View>
							);
						})
					)}
				</View>
			</ScrollView>

			<NoInternetModal
				visible={showNoInternet}
				onDismiss={() => setShowNoInternet(false)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F9FAFB" },
	centered: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
		gap: 12,
	},
	emptyTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: "#374151",
		textAlign: "center",
	},
	emptySubtitle: {
		fontSize: 14,
		color: "#6B7280",
		textAlign: "center",
		lineHeight: 22,
	},

	header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
	headerTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },
	headerSub: { fontSize: 14, color: "#6B7280", marginTop: 2 },

	sprintCard: {
		marginHorizontal: 20,
		marginTop: 16,
		padding: 20,
		backgroundColor: "#4F46E5",
		borderRadius: 20,
		marginBottom: 24,
		gap: 14,
	},
	cardHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
	iconCircle: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "rgba(255,255,255,0.2)",
		alignItems: "center",
		justifyContent: "center",
	},
	cardTitle: { color: "white", fontSize: 17, fontWeight: "700" },
	cardMeta: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 3 },

	progressRow: { flexDirection: "row", gap: 4, height: 6 },
	progressSegment: {
		height: 6,
		borderRadius: 3,
		backgroundColor: "rgba(255,255,255,0.25)",
	},
	progressSegmentFilled: { backgroundColor: "#A5F3FC" },
	progressFraction: {
		color: "rgba(255,255,255,0.65)",
		fontSize: 12,
		fontWeight: "600",
		marginTop: -6,
	},

	tipsContainer: {
		backgroundColor: "rgba(255,255,255,0.12)",
		borderRadius: 10,
		padding: 12,
	},
	tipsRow: { flexDirection: "row", alignItems: "flex-start" },
	tipsIcon: { fontSize: 14, marginRight: 6, marginTop: 1 },
	tipsText: {
		flex: 1,
		color: "rgba(255,255,255,0.92)",
		fontSize: 13,
		lineHeight: 19,
	},
	tapToExpand: {
		marginTop: 6,
		fontSize: 11,
		color: "rgba(255,255,255,0.55)",
		fontWeight: "600",
		textAlign: "right",
	},

	moduleSection: { paddingHorizontal: 20 },
	sectionTitle: {
		fontSize: 20,
		fontWeight: "700",
		color: "#111827",
		marginBottom: 16,
	},

	emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
	emptyText: { fontSize: 14, color: "#94A3B8" },

	// ── Additional Readings ────────────────────────────────────────────────
	readingsHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginBottom: 16,
	},
	readingsIconCircle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: "#EEF2FF",
		alignItems: "center",
		justifyContent: "center",
	},
	readingsSubtitle: {
		fontSize: 12,
		color: "#6B7280",
		marginTop: 2,
	},
	readingCard: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "white",
		borderRadius: 14,
		padding: 14,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		gap: 12,
	},
	readingTitle: {
		fontSize: 14,
		fontWeight: "700",
		color: "#1F2937",
		marginBottom: 3,
	},
	readingUrl: {
		fontSize: 11,
		color: "#94A3B8",
	},
	readingOpenButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: 8,
		backgroundColor: "#4F46E5",
	},
	readingOpenButtonText: {
		color: "white",
		fontSize: 12,
		fontWeight: "700",
	},

	moduleCard: {
		backgroundColor: "white",
		borderRadius: 16,
		padding: 18,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: "#E5E7EB",
		shadowColor: "#000",
		shadowOpacity: 0.03,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
	},
	moduleCardDone: { borderColor: "#D1FAE5", backgroundColor: "#FAFFFE" },

	cardRow: {
		flexDirection: "row",
		gap: 14,
		marginBottom: 14,
		alignItems: "flex-start",
	},
	statusDot: {
		width: 26,
		height: 26,
		borderRadius: 13,
		backgroundColor: "#F1F5F9",
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0,
		marginTop: 2,
	},
	statusDotDone: { backgroundColor: "#10B981" },

	moduleInfo: { flex: 1 },
	moduleLabel: {
		fontSize: 10,
		fontWeight: "700",
		color: "#A5B4FC",
		letterSpacing: 1,
		marginBottom: 4,
	},
	moduleTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: "#1F2937",
		lineHeight: 22,
	},

	// ── Button Row ─────────────────────────────────────────────────────────────
	buttonRow: {
		flexDirection: "row",
		gap: 10,
	},

	// View Content — outlined style
	viewButton: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: 13,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: "#4F46E5",
		backgroundColor: "white",
		minHeight: 46,
	},
	viewButtonDisabled: { borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
	viewButtonText: { fontSize: 13, fontWeight: "700", color: "#4F46E5" },

	// Module Quiz — filled solid style
	quizButton: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		paddingVertical: 13,
		borderRadius: 10,
		backgroundColor: "#4F46E5",
		minHeight: 46,
	},
	quizButtonDisabled: { backgroundColor: "#C7D2FE" },
	quizButtonPassed: {
		backgroundColor: "#7a8b87",
		borderWidth: 1,
		borderColor: "#065F46",
		opacity: 0.75,
	},
	quizButtonText: { fontSize: 13, fontWeight: "700", color: "white" },
	quizButtonTextPassed: { color: "#6EE7B7", fontWeight: "600" },
});
