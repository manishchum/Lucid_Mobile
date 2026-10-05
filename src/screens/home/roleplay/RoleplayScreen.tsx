import React, { useState, useEffect, useCallback } from "react";
import {
	View,
	Text,
	StyleSheet,
	FlatList,
	TouchableOpacity,
	ActivityIndicator,
	RefreshControl,
	StatusBar,
	Alert,
	Modal,
	Pressable,
	BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Scenario, getUserRoleplayData } from "../../../api/roleplay";
import RoleplayCard from "./components/RoleplayCard";
import { STACK_ROUTES, APP_ROUTES } from "../../../navigations/Routes";
import { useAuth } from "../../../contex/AuthContext";
import { useFeatureGating, FEATURES } from "../../../hooks/useFeatureGating";
import { eventBus } from "../../../utils/EventBus";
import { logger } from "../../../utils/UnifiedLogger";
import { useRealtimeSubscription } from "../../../hooks/useRealtimeSubscription";

export default function RoleplayScreen({ navigation }: { navigation: any }) {
	const { cachedUser } = useAuth();
	const userEmail = cachedUser?.email || "";
	const { hasFeature, addonsKnown } = useFeatureGating();
	const showRoleplay = hasFeature(FEATURES.ROLE_PLAY);

	// Screen-level gating: redirect if roleplay is toggled off
	useEffect(() => {
		if (addonsKnown && !showRoleplay) {
			Alert.alert(
				"Access Restricted",
				"The Roleplay module is not enabled for your company plan.",
				[
					{
						text: "OK",
						onPress: () => navigation.navigate(APP_ROUTES.HOME),
					},
				],
			);
		}
	}, [addonsKnown, showRoleplay, navigation]);

	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);

	const [scenarios, setScenarios] = useState<Scenario[]>([]);
	const [limits, setLimits] = useState<{
		roleplayLimit: number;
		retryLimit: number;
	}>({
		roleplayLimit: 5,
		retryLimit: 3,
	});
	const [remainingAttempts, setRemainingAttempts] = useState<
		Record<string, number>
	>({});

	const loadData = useCallback(async () => {
		if (!userEmail) return;
		try {
			const data = await getUserRoleplayData(userEmail);
			if (data) {
				setScenarios(data.scenarios || []);
				if (data.limits) setLimits(data.limits);
				if (data.remainingAttempts)
					setRemainingAttempts(data.remainingAttempts);
			}
		} catch (e) {
			logger.error("[RoleplayScreen] Error loading data:", e);
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	}, [userEmail]);

	useEffect(() => {
		loadData();
		const unsub = eventBus.on("refresh_roleplay", loadData);
		return () => {
			unsub();
		};
	}, [loadData]);

	// Real-time Supabase subscription for scenario assignments and scenarios
	useRealtimeSubscription({
		table: "scenario_assignments",
		onPayload: () => {
			loadData();
		},
	});

	useRealtimeSubscription({
		table: "scenarios",
		onPayload: () => {
			loadData();
		},
	});

	const handleBack = useCallback(() => {
		if (navigation.canGoBack()) {
			navigation.goBack();
		} else {
			navigation.navigate(APP_ROUTES.HOME as never);
		}
	}, [navigation]);

	useEffect(() => {
		const onBackPress = () => {
			handleBack();
			return true;
		};

		const backSub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
		return () => backSub.remove();
	}, [handleBack]);

	const onRefresh = () => {
		setIsRefreshing(true);
		loadData();
	};

	const handleStartRoleplay = (scenario: Scenario) => {
		navigation.navigate(STACK_ROUTES.ROLEPLAY_CONFIG as never, {
			scenario,
		});
	};

	if (addonsKnown && !showRoleplay) {
		return (
			<SafeAreaView
				style={[
					styles.safeArea,
					{
						justifyContent: "center",
						alignItems: "center",
						padding: 24,
					},
				]}>
				<StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
				<MaterialCommunityIcons
					name="lock-outline"
					size={54}
					color="#94A3B8"
				/>
				<Text
					style={{
						fontSize: 18,
						fontWeight: "700",
						color: "#1E293B",
						marginTop: 16,
					}}>
					Feature Disabled
				</Text>
				<Text
					style={{
						fontSize: 14,
						color: "#64748B",
						textAlign: "center",
						marginTop: 8,
						maxWidth: 280,
					}}>
					Roleplay is not enabled for your organization's subscription
					plan.
				</Text>
				<TouchableOpacity
					onPress={() => navigation.navigate(APP_ROUTES.HOME)}
					style={{
						marginTop: 24,
						backgroundColor: "#6366F1",
						paddingHorizontal: 24,
						paddingVertical: 12,
						borderRadius: 10,
					}}
					activeOpacity={0.8}>
					<Text
						style={{
							color: "#FFFFFF",
							fontWeight: "600",
							fontSize: 15,
						}}>
						Back to Home
					</Text>
				</TouchableOpacity>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

			{/* Navigation Header */}
			<View style={styles.header}>
				<TouchableOpacity
					onPress={handleBack}
					activeOpacity={0.7}
					hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
					<MaterialCommunityIcons
						name="arrow-left"
						size={24}
						color="#0F172A"
					/>
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Roleplay Practice</Text>
				<TouchableOpacity
					onPress={() => setIsInfoModalVisible(true)}
					activeOpacity={0.7}
					hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					accessibilityLabel="Roleplay guidelines">
					<MaterialCommunityIcons
						name="information-outline"
						size={21}
						color="#4F46E5"
					/>
				</TouchableOpacity>
			</View>

			{/* Scenarios Count Info */}
			{!isLoading && scenarios.length > 0 && (
				<View style={styles.infoBanner}>
					<MaterialCommunityIcons
						name="account-voice"
						size={18}
						color="#6366F1"
					/>
					<Text style={styles.infoBannerText}>
						{scenarios.length} scenario
						{scenarios.length !== 1 ? "s" : ""} assigned to you
					</Text>
				</View>
			)}

			{/* Main Content */}
			{isLoading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#6366F1" />
					<Text style={styles.loadingText}>Loading Roleplays...</Text>
				</View>
			) : (
				<FlatList
					data={scenarios}
					keyExtractor={(item) => item.scenario_id}
					renderItem={({ item }) => (
						<RoleplayCard
							scenario={item}
							remainingAttempts={
								remainingAttempts[item.scenario_id]
							}
							onPressStart={handleStartRoleplay}
						/>
					)}
					contentContainerStyle={styles.listContent}
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={onRefresh}
							colors={["#6366F1"]}
						/>
					}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<MaterialCommunityIcons
								name="account-voice-off"
								size={48}
								color="#94A3B8"
							/>
							<Text style={styles.emptyTitle}>
								No Roleplays Assigned Yet
							</Text>
							<Text style={styles.emptySubtext}>
								Scenarios assigned by your administrator will
								appear here.
							</Text>
						</View>
					}
				/>
			)}

			{/* ── Best Experience Info Modal (Bottom Sheet Style) ── */}
			<Modal
				visible={isInfoModalVisible}
				transparent
				animationType="slide"
				statusBarTranslucent
				onRequestClose={() => setIsInfoModalVisible(false)}>
				<Pressable
					style={styles.modalOverlay}
					onPress={() => setIsInfoModalVisible(false)}>
					<Pressable
						style={styles.modalSheet}
						onPress={(e) => e.stopPropagation()}>
						{/* Sheet Handle */}
						<View style={styles.sheetHandle} />

						{/* Modal Header */}
						<View style={styles.modalHeader}>
							<View style={styles.modalTitleRow}>
								<View style={styles.modalIconBadge}>
									<MaterialCommunityIcons
										name="lightbulb-on-outline"
										size={20}
										color="#4F46E5"
									/>
								</View>
								<View>
									<Text style={styles.modalTitle}>
										Roleplay Guidelines
									</Text>
									<Text style={styles.modalSubtitle}>
										For the best session experience
									</Text>
								</View>
							</View>
							<TouchableOpacity
								onPress={() => setIsInfoModalVisible(false)}
								style={styles.modalCloseBtn}
								activeOpacity={0.7}
								hitSlop={{
									top: 8,
									bottom: 8,
									left: 8,
									right: 8,
								}}>
								<MaterialCommunityIcons
									name="close"
									size={20}
									color="#64748B"
								/>
							</TouchableOpacity>
						</View>

						{/* Guidelines List */}
						<View style={styles.tipsList}>
							{/* Tip 1: High-Speed Internet */}
							<View style={styles.tipItem}>
								<View style={styles.tipIconCircle}>
									<MaterialCommunityIcons
										name="wifi-check"
										size={20}
										color="#4F46E5"
									/>
								</View>
								<View style={styles.tipContent}>
									<Text style={styles.tipHeading}>
										High-Speed Internet Zone
									</Text>
									<Text style={styles.tipBody}>
										Stay in a strong Wi-Fi or 4G/5G zone to
										enable instant real-time speech without
										lag or interruptions.
									</Text>
								</View>
							</View>

							{/* Tip 2: Quiet & Closed Environment */}
							<View style={styles.tipItem}>
								<View style={styles.tipIconCircle}>
									<MaterialCommunityIcons
										name="volume-off"
										size={20}
										color="#4F46E5"
									/>
								</View>
								<View style={styles.tipContent}>
									<Text style={styles.tipHeading}>
										Quiet & Closed Environment
									</Text>
									<Text style={styles.tipBody}>
										Practice in a quiet, enclosed room so
										background chatter does not disrupt
										speech transcription or evaluation.
									</Text>
								</View>
							</View>

							{/* Tip 3: Clear Speaking & Audio */}
							<View style={styles.tipItem}>
								<View style={styles.tipIconCircle}>
									<MaterialCommunityIcons
										name="microphone-outline"
										size={20}
										color="#4F46E5"
									/>
								</View>
								<View style={styles.tipContent}>
									<Text style={styles.tipHeading}>
										Clear Natural Speech
									</Text>
									<Text style={styles.tipBody}>
										Speak clearly at your normal
										conversational volume and pace.
										Earphones or headsets provide optimal
										microphone capture.
									</Text>
								</View>
							</View>
						</View>

						{/* Action Button */}
						<TouchableOpacity
							style={styles.modalActionBtn}
							onPress={() => setIsInfoModalVisible(false)}
							activeOpacity={0.85}>
							<Text style={styles.modalActionBtnText}>
								Got It, Let's Practice
							</Text>
						</TouchableOpacity>
					</Pressable>
				</Pressable>
			</Modal>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#F8FAFC",
	},
	header: {
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#E2E8F0",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#0F172A",
	},
	infoBanner: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#EEF2FF",
		marginHorizontal: 16,
		marginTop: 12,
		marginBottom: 4,
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#C7D2FE",
		gap: 8,
	},
	infoBannerText: {
		fontSize: 13,
		fontWeight: "600",
		color: "#4338CA",
	},

	// ── Info Modal / Bottom Sheet ───────────────────────────────────────────────
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(15, 23, 42, 0.55)",
		justifyContent: "flex-end",
	},
	modalSheet: {
		backgroundColor: "#FFFFFF",
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
		paddingHorizontal: 20,
		paddingTop: 12,
		paddingBottom: 32,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.15,
		shadowRadius: 16,
		elevation: 20,
	},
	sheetHandle: {
		width: 38,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#CBD5E1",
		alignSelf: "center",
		marginBottom: 16,
	},
	modalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 20,
	},
	modalTitleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		flex: 1,
	},
	modalIconBadge: {
		width: 40,
		height: 40,
		borderRadius: 12,
		backgroundColor: "#EEF2FF",
		justifyContent: "center",
		alignItems: "center",
	},
	modalTitle: {
		fontSize: 17,
		fontWeight: "700",
		color: "#0F172A",
	},
	modalSubtitle: {
		fontSize: 12,
		color: "#64748B",
		marginTop: 2,
	},
	modalCloseBtn: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: "#F1F5F9",
		justifyContent: "center",
		alignItems: "center",
	},
	tipsList: {
		gap: 14,
		marginBottom: 24,
	},
	tipItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		backgroundColor: "#F8FAFC",
		borderRadius: 14,
		padding: 14,
		borderWidth: 1,
		borderColor: "#E2E8F0",
		gap: 12,
	},
	tipIconCircle: {
		width: 38,
		height: 38,
		borderRadius: 10,
		backgroundColor: "#EEF2FF",
		justifyContent: "center",
		alignItems: "center",
		marginTop: 2,
	},
	tipContent: {
		flex: 1,
	},
	tipHeading: {
		fontSize: 14,
		fontWeight: "700",
		color: "#1E1B4B",
		marginBottom: 3,
	},
	tipBody: {
		fontSize: 12.5,
		color: "#475569",
		lineHeight: 18,
	},
	modalActionBtn: {
		backgroundColor: "#4F46E5",
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#4F46E5",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 4,
	},
	modalActionBtnText: {
		color: "#FFFFFF",
		fontSize: 15,
		fontWeight: "700",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 12,
		fontSize: 14,
		color: "#64748B",
	},
	listContent: {
		paddingHorizontal: 16,
		paddingTop: 12,
		paddingBottom: 24,
	},
	emptyContainer: {
		alignItems: "center",
		justifyContent: "center",
		marginTop: 60,
		paddingHorizontal: 20,
	},
	emptyTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: "#0F172A",
		marginTop: 12,
	},
	emptySubtext: {
		fontSize: 13,
		color: "#64748B",
		textAlign: "center",
		marginTop: 6,
		lineHeight: 18,
	},
});
