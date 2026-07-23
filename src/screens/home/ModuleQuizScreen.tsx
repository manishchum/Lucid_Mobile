import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
  Dimensions,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contex/AuthContext";
import {
  getEmployeeLearningStyle,
  getExistingAssessment,
  generateModuleQuiz,
  submitQuizForGrading,
  getProcessedModuleById,
} from "../../api/users/Request";
import { useNetworkStatus } from "../../hooks/network/useNetworkStatus";
import NoInternetModal from "../../components/networkModal/NetworkModal";
import { eventBus } from "../../utils/EventBus";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useInAppReview } from "../../hooks/useInAppReview";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PAGE_SIZE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizQuestion {
  question: string;
  bloomLevel: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

type LoadPhase =
  | "idle"
  | "fetching_style"
  | "checking_existing"
  | "generating"
  | "ready"
  | "grading"
  | "error"
  | "grading_error";

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
];

function ConfettiParticle({
  delay,
  color,
  x,
}: {
  delay: number;
  color: string;
  x: number;
}) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 80;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT * 0.65,
          duration: 2400,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad),
        }),
        Animated.timing(translateX, {
          toValue: drift,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 6,
          duration: 2400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(1800),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 6],
    outputRange: ["0deg", "720deg"],
  });
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: x,
        width: 9,
        height: 9,
        borderRadius: 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate: spin }],
      }}
    />
  );
}

function Confetti({ visible }: { visible: boolean }) {
  if (!visible) return null;
  const particles = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    delay: Math.random() * 700,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    x: Math.random() * SCREEN_WIDTH,
  }));
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} {...p} />
      ))}
    </View>
  );
}

const ResultProgressRing = ({
  score,
  max,
  pct,
  passed,
  threshold = 70,
}: {
  score: number;
  max: number;
  pct: number;
  passed: boolean;
  threshold?: number;
}) => {
  const size = 160;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * Math.min(Math.max(pct, 0), 100)) / 100;
  const activeColor = passed ? "#10B981" : "#F59E0B";
  const trackColor = passed ? "#D1FAE5" : "#FEF3C7";

  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center", alignSelf: "center", marginVertical: 20 }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 34, fontWeight: "900", color: "#0F172A", letterSpacing: -1 }}>
          {Math.round(pct)}%
        </Text>
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#64748B", marginTop: 2 }}>
          {score} / {max} Correct
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: passed ? "#10B981" : "#D97706", marginTop: 2 }}>
          Pass Target: {threshold}%
        </Text>
      </View>
    </View>
  );
};

// ─── Option letter badge ──────────────────────────────────────────────────────

const LETTERS = ["A", "B", "C", "D", "E"];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ModuleQuizScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: any;
}) {
  const insets = useSafeAreaInsets();
  const { cachedUser } = useAuth();

  const { requestReview } = useInAppReview();

  const processedModuleId: string = route?.params?.processedModuleId ?? "";
  const moduleId: string = route?.params?.moduleId ?? ""; // original TrainingModule UUID
  const moduleTitle: string = route?.params?.moduleTitle ?? "Module Quiz";
  const routeThreshold = route?.params?.passingThreshold ?? route?.params?.thresholdValue ?? route?.params?.threshold;
  const companyId: string = cachedUser?.companyId ?? "";

  const [passingThreshold, setPassingThreshold] = useState<number>(
    typeof routeThreshold === "number" ? routeThreshold : 70
  );
  const userId = cachedUser?.userId ?? "";

  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [gradingResult, setGradingResult] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showNoInternet, setShowNoInternet] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const isMountedRef = useRef(true);
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const isOnline = useNetworkStatus();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (phase === "grading") {
      pulseAnim.setValue(0.8);
      opacityAnim.setValue(1);

      animation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.25,
              duration: 1200,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.quad),
            }),
            Animated.timing(pulseAnim, {
              toValue: 0.8,
              duration: 1200,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.quad),
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacityAnim, {
              toValue: 0.3,
              duration: 1200,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.quad),
            }),
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 1200,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.quad),
            }),
          ]),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(0.8);
      opacityAnim.setValue(1);
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [phase]);

  // Pagination & Horizontal Pager
  const [currentPage, setCurrentPage] = useState(0);
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH);
  const isSubmittingRef = useRef(false);

  const horizontalScrollRef = useRef<ScrollView>(null);
  const resultScrollRef = useRef<ScrollView>(null);

  const totalPages = Math.ceil(questions.length / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, questions.length);
  const pageQuestions = questions.slice(pageStart, pageEnd);

  const answeredCount = userAnswers.filter((a) => a !== null).length;
  const remainingCount = questions.length - answeredCount;
  const allAnswered = questions.length > 0 && remainingCount === 0;
  const answeredOnPage = pageQuestions.every(
    (_, i) => userAnswers[pageStart + i] !== null,
  );
  const isLastPage = currentPage === totalPages - 1;

  const animatePage = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages) return;
    setCurrentPage(newPage);
    horizontalScrollRef.current?.scrollTo({
      x: newPage * containerWidth,
      animated: true,
    });
  };

  const handleNextPage = () => {
    if (!isLastPage) animatePage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 0) animatePage(currentPage - 1);
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / containerWidth);
    if (pageIndex !== currentPage && pageIndex >= 0 && pageIndex < totalPages) {
      setCurrentPage(pageIndex);
    }
  };

  // ─── Load quiz ──────────────────────────────────────────────────────────────
  const loadQuiz = useCallback(async () => {
    const userId = cachedUser?.userId;
    if (!userId || !processedModuleId) {
      setPhase("error");
      setErrorMsg(
        "Missing user or module information. Please go back and try again.",
      );
      return;
    }

    try {
      // Fetch dynamic threshold from module if not supplied in route params
      if (!routeThreshold && processedModuleId && userId) {
        try {
          const pm = await getProcessedModuleById(processedModuleId, userId);
          if (pm?.threshold_value && typeof pm.threshold_value === "number") {
            console.log(`[Quiz] Dynamic passing threshold loaded from module: ${pm.threshold_value}%`);
            setPassingThreshold(pm.threshold_value);
          }
        } catch (e) {
          console.warn("[Quiz] Dynamic threshold fetch error:", e);
        }
      }

      setPhase("fetching_style");
      const learningStyle = await getEmployeeLearningStyle(userId);

      setPhase("checking_existing");
      const existing = await getExistingAssessment(
        processedModuleId,
        learningStyle,
        userId,
        moduleId,
      );

      if (existing?.thresholdValue) {
        setPassingThreshold(existing.thresholdValue);
      }

      if (existing?.questions?.length > 0) {
        setQuestions(existing.questions);
        setUserAnswers(new Array(existing.questions.length).fill(null));
        setAssessmentId(existing.assessmentId ?? "");
        setCurrentPage(0);
        setPhase("ready");
        return;
      }

      setPhase("generating");
      const generated = await generateModuleQuiz(
        processedModuleId,
        learningStyle,
        userId,
        companyId,
      );
      if (generated?.thresholdValue) {
        setPassingThreshold(generated.thresholdValue);
      }
      if (!generated || generated.questions.length === 0) {
        setPhase("error");
        setErrorMsg(
          "Could not generate quiz questions. Please try again later.",
        );
        return;
      }
      setQuestions(generated.questions);
      setUserAnswers(new Array(generated.questions.length).fill(null));
      setAssessmentId(generated.assessmentId ?? "");
      setCurrentPage(0);
      setPhase("ready");
    } catch (_err) {
      setPhase("error");
      setErrorMsg(
        "Something went wrong. Please check your connection and try again.",
      );
    }
  }, [cachedUser?.userId, cachedUser?.companyId, processedModuleId, routeThreshold]);

  useEffect(() => {
    loadQuiz();
  }, [loadQuiz]);

  // ─── Answer selection ───────────────────────────────────────────────────────
  const handleSelectOption = (questionIndex: number, optionIdx: number) => {
    setUserAnswers((prev) => {
      const updated = [...prev];
      updated[questionIndex] = optionIdx;
      return updated;
    });
  };



  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const userId = cachedUser?.userId;
    if (!userId || !processedModuleId) return;
    if (isOnline === false) {
      setShowNoInternet(true);
      return;
    }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    // 1. Grade the quiz LOCALLY instantly using dynamic passingThreshold!
    const answerIndices = userAnswers.map((idx) => idx ?? 0);
    const score = answerIndices.reduce((acc, selectedIdx, i) => {
      return acc + (selectedIdx === questions[i]?.correctIndex ? 1 : 0);
    }, 0);
    const maxScore = questions.length;
    const computedPct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed = computedPct >= passingThreshold;
    console.log(`[Quiz Submit] Score: ${score}/${maxScore} (${computedPct}%), Dynamic Threshold: ${passingThreshold}%, Passed: ${passed}`);

    // Transition to results screen instantly (within ~10ms!)
    const localResult = {
      score,
      maxScore,
      percentage: computedPct,
      feedback: "Submitting details to server in the background...",
    };
    setGradingResult(localResult);
    if (passed) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3200);
      // Trigger native in-app review at the "Aha! Moment" after confetti starts
      setTimeout(() => {
        console.log("[Quiz] Requesting in-app review...");
        requestReview();
      }, 1500);
    }
    setPhase("ready");

    // 2. Emit global event updates instantly so lists refresh in real-time
    eventBus.emit("refresh_dashboard");
    eventBus.emit("quiz_completed", { processedModuleId, quizScore: score });

    // 3. Write progress to cache instantly so returns are immediate and synced
    try {
      const cacheKey = `@module_progress_${userId}`;
      const cachedJson = await AsyncStorage.getItem(cacheKey);
      let progressList = [];
      if (cachedJson) {
        progressList = JSON.parse(cachedJson);
      }
      const exists = progressList.some((p: any) => p.processed_module_id === processedModuleId);
      let updatedProgress;
      if (exists) {
        updatedProgress = progressList.map((p: any) =>
          p.processed_module_id === processedModuleId
            ? { ...p, quiz_score: score }
            : p
        );
      } else {
        updatedProgress = [
          ...progressList,
          {
            processed_module_id: processedModuleId,
            quiz_score: score,
            created_at: new Date().toISOString(),
          },
        ];
      }
      await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedProgress));
      console.log("[Quiz Submit] Local cache updated instantly.");
    } catch (err) {
      console.warn("[Quiz Submit] Failed to write initial score to cache:", err);
    }

    // 4. Submit to server in the background
    (async () => {
      try {
        const moduleObjects = [{ module_id: processedModuleId }];
        const serverResult = await submitQuizForGrading(
          assessmentId,
          answerIndices,
          questions,
          userId,
          cachedUser?.name ?? cachedUser?.email,
          moduleObjects,
          processedModuleId,
          moduleId,
        );
        if (serverResult && isMountedRef.current) {
          console.log("[Quiz Submit] Background grading succeeded, merging feedback.");
          setGradingResult((prev: any) => ({
            ...prev,
            feedback: serverResult.feedback ?? prev.feedback,
          }));
        }
      } catch (err: any) {
        console.warn("[Quiz Submit] Background grading failed or rate limited:", err);
      } finally {
        isSubmittingRef.current = false;
      }
    })();
  };

  // ─── Retry ──────────────────────────────────────────────────────────────────
  const handleRetry = () => {
    setUserAnswers(new Array(questions.length).fill(null));
    setGradingResult(null);
    setShowConfetti(false);
    setCurrentPage(0);
    horizontalScrollRef.current?.scrollTo({ x: 0, animated: false });
  };

  // ─── Shared header ──────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons name="arrow-left" size={20} color="#374151" />
      </TouchableOpacity>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Quiz
        </Text>
        {/* {phase === "ready" && !gradingResult && questions.length > 0 && (
          <Text style={styles.headerSub}>
            {userAnswers.filter((a) => a !== null).length} of {questions.length}{" "}
            answered
          </Text>
        )} */}
      </View>
      {phase === "ready" && !gradingResult && questions.length > 0 && (
        <View style={styles.pageChip}>
          <Text style={styles.pageChipText}>
            {currentPage + 1}/{totalPages}
          </Text>
        </View>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────
  const loadingLabels: Partial<Record<LoadPhase, string>> = {
    fetching_style: "Personalising your quiz…",
    checking_existing: "Checking for saved quiz…",
    generating: "Generating quiz with AI…",
    idle: "Starting…",
  };

  if (
    phase !== "ready" &&
    phase !== "error" &&
    phase !== "grading" &&
    phase !== "grading_error"
  ) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        {renderHeader()}
        <View style={styles.centerBody}>
          <View style={styles.loadingCircle}>
            <MaterialCommunityIcons name="brain" size={40} color="#4F46E5" />
          </View>
          <ActivityIndicator
            size="large"
            color="#4F46E5"
            style={{ marginTop: 20 }}
          />
          <Text style={styles.loadingTitle}>
            {loadingLabels[phase] ?? "Loading…"}
          </Text>
          <Text style={styles.loadingSub}>
            {phase === "generating"
              ? "This may take 10–20 seconds the first time"
              : "Please wait a moment"}
          </Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GRADING
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "grading") {
    return (
      <View style={[styles.immersiveGradingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
        <View style={styles.immersiveCenter}>
          <Animated.View
            style={[
              styles.pulseCircleOuter,
              {
                transform: [{ scale: pulseAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <View style={styles.pulseCircleInner}>
              <MaterialCommunityIcons name="brain" size={48} color="#7C3AED" />
            </View>
          </Animated.View>
          <Text style={styles.immersiveTitle}>Analyzing your results...</Text>
          <Text style={styles.immersiveSubtitle}>Calculating your score and feedback</Text>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ERROR
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        {renderHeader()}
        <View style={styles.centerBody}>
          <View style={styles.errorIconCircle}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={44}
              color="#EF4444"
            />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={loadQuiz}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={16}
              color="white"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === "grading_error") {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        {renderHeader()}
        <View style={styles.centerBody}>
          <View style={styles.errorIconCircle}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={44}
              color="#EF4444"
            />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleSubmit}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={16}
              color="white"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESULTS
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === "ready" && gradingResult !== null) {
    const score = gradingResult?.score ?? 0;
    const max = gradingResult?.maxScore ?? questions.length;
    const pct = gradingResult?.percentage ?? 0;
    const passed = pct >= passingThreshold;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Confetti visible={showConfetti} />
        {renderHeader()}

        {/* Curved Elliptical Top Header Background */}
        <View style={[
          styles.headerAccentBackground,
          { backgroundColor: passed ? "#D1FAE5" : "#FEF3C7" }
        ]} />

        <ScrollView
          ref={resultScrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Achievement Badge Container */}
          <View style={styles.achievementBadgeContainer}>
            <Text style={styles.badgeEmoji}>{passed ? "🏆" : "💪"}</Text>
            <Text style={styles.badgeHeading}>
              {passed ? "Achievement Unlocked!" : "Keep Growing!"}
            </Text>
            <Text style={styles.badgeSub}>
              {passed ? "You've successfully mastered this module quiz." : "You're getting closer! Re-review options below."}
            </Text>

            {/* Circular Progress Ring */}
            <ResultProgressRing score={score} max={max} pct={pct} passed={passed} threshold={passingThreshold} />

            {/* Result Pips Row */}
            <View style={styles.pipsLabelRow}>
              <Text style={styles.pipsLabel}>Performance Breakdown</Text>
            </View>
            <View style={styles.pipsContainer}>
              {questions.map((q, idx) => {
                const isCorrect = userAnswers[idx] === q.correctIndex;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pipCircle,
                      { backgroundColor: isCorrect ? "#10B981" : "#EF4444" }
                    ]}
                  >
                    <Text style={styles.pipNumText}>{idx + 1}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Action CTAs */}
          <View style={styles.actionsWrap}>
            <TouchableOpacity
              style={styles.primaryCTA}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primaryCTAText}>Back to Sprint</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryCTA}
              onPress={() => setShowReview(!showReview)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name={showReview ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#475569"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.secondaryCTAText}>
                {showReview ? "Hide Review" : "Review Answers"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Detailed Question Review Panel */}
          {showReview && (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewSectionTitle}>Detailed Review</Text>
              {questions.map((q, idx) => {
                const selectedIdx = userAnswers[idx];
                const isCorrect = selectedIdx === q.correctIndex;
                return (
                  <View key={idx} style={styles.reviewQuestionCard}>
                    <View style={styles.reviewQuestionHeader}>
                      <View style={[
                        styles.reviewQNum,
                        { backgroundColor: isCorrect ? "#ECFDF5" : "#FEF2F2" }
                      ]}>
                        <Text style={[
                          styles.reviewQNumText,
                          { color: isCorrect ? "#10B981" : "#EF4444" }
                        ]}>
                          Q{idx + 1}
                        </Text>
                      </View>
                      <Text style={[
                        styles.reviewResultStatus,
                        { color: isCorrect ? "#10B981" : "#EF4444" }
                      ]}>
                        {isCorrect ? "Correct" : "Incorrect"}
                      </Text>
                    </View>
                    
                    <Text style={styles.reviewQuestionText}>{q.question}</Text>
                    
                    <View style={styles.reviewOptionsList}>
                      {q.options.map((option, optIdx) => {
                        const isUserSelected = selectedIdx === optIdx;
                        const isCorrectOpt = optIdx === q.correctIndex;
                        
                        let optStyle = styles.reviewOptionRow as any;
                        let optTextStyle = styles.reviewOptionText as any;
                        let rightIcon = null;
                        
                        if (isCorrectOpt) {
                          optStyle = [styles.reviewOptionRow, styles.reviewOptionCorrect];
                          optTextStyle = [styles.reviewOptionText, styles.reviewOptionTextCorrect];
                          rightIcon = <MaterialCommunityIcons name="check-circle" size={16} color="#10B981" />;
                        } else if (isUserSelected && !isCorrectOpt) {
                          optStyle = [styles.reviewOptionRow, styles.reviewOptionIncorrect];
                          optTextStyle = [styles.reviewOptionText, styles.reviewOptionTextIncorrect];
                          rightIcon = <MaterialCommunityIcons name="close-circle" size={16} color="#EF4444" />;
                        }

                        return (
                          <View key={optIdx} style={optStyle}>
                            <Text style={optTextStyle}>{LETTERS[optIdx]}. {option}</Text>
                            {rightIcon}
                          </View>
                        );
                      })}
                    </View>

                    {q.explanation && (
                      <View style={styles.explanationBox}>
                        <View style={styles.explanationTitleRow}>
                          <MaterialCommunityIcons name="information-outline" size={14} color="#4F46E5" />
                          <Text style={styles.explanationTitle}>Explanation</Text>
                        </View>
                        <Text style={styles.explanationText}>{q.explanation}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVE QUIZ
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {renderHeader()}

      {/* Overall progress bar */}
      <View style={styles.overallProgressTrack}>
        <View
          style={[
            styles.overallProgressFill,
            {
              width:
                `${(userAnswers.filter((a) => a !== null).length / questions.length) * 100}%` as any,
            },
          ]}
        />
      </View>

      {/* Page indicator dots */}
      {totalPages > 1 && (
        <View style={styles.pageDots}>
          {Array.from({ length: totalPages }, (_, i) => {
            const pageAnswered = questions
              .slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)
              .every((_, qi) => userAnswers[i * PAGE_SIZE + qi] !== null);
            return (
              <TouchableOpacity
                key={i}
                onPress={() => animatePage(i)}
                style={[
                  styles.pageDot,
                  i === currentPage && styles.pageDotActive,
                  pageAnswered && i !== currentPage && styles.pageDotDone,
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Native Horizontal Paging Carousel for 100% Zero-Flicker Transitions */}
      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        style={{ flex: 1 }}
      >
        {Array.from({ length: totalPages }, (_, pageIdx) => {
          const pStart = pageIdx * PAGE_SIZE;
          const pEnd = Math.min(pStart + PAGE_SIZE, questions.length);
          const pQuestions = questions.slice(pStart, pEnd);
          const pAnswered = pQuestions.every(
            (_, i) => userAnswers[pStart + i] !== null,
          );

          return (
            <View key={pageIdx} style={{ width: containerWidth }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: 24 },
                ]}
                keyboardShouldPersistTaps="handled"
              >
                {/* Module title card (welcome card) only on the first page */}
                {pageIdx === 0 && (
                  <View style={styles.moduleTitleCard}>
                    <View style={styles.moduleTitleBadge}>
                      <MaterialCommunityIcons
                        name="book-open-page-variant"
                        size={14}
                        color="#4F46E5"
                      />
                      <Text style={styles.moduleTitleBadgeText}>
                        Module Details
                      </Text>
                    </View>
                    <Text style={styles.moduleTitleText}>{moduleTitle}</Text>
                  </View>
                )}
                {/* Page heading */}
                <View style={styles.pageHeadingRow}>
                  <Text style={styles.pageHeadingText}>
                    Questions {pStart + 1}–{pEnd}
                  </Text>
                  {pAnswered && pageIdx < totalPages - 1 && (
                    <View style={styles.pageCompletePill}>
                      <MaterialCommunityIcons
                        name="check"
                        size={11}
                        color="#065F46"
                      />
                      <Text style={styles.pageCompleteText}>Page done</Text>
                    </View>
                  )}
                </View>

                {/* Questions on this page */}
                {pQuestions.map((q, localIdx) => {
                  const globalIdx = pStart + localIdx;
                  const selected = userAnswers[globalIdx];

                  return (
                    <View key={globalIdx} style={styles.questionCard}>
                      {/* Question number */}
                      <View style={styles.questionMeta}>
                        <View style={styles.qNumCircle}>
                          <Text style={styles.qNumText}>{globalIdx + 1}</Text>
                        </View>
                        {selected !== null && (
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={16}
                            color="#10B981"
                            style={{ marginLeft: "auto" }}
                          />
                        )}
                      </View>

                      {/* Question text */}
                      <Text style={styles.questionText}>{q.question}</Text>

                      {/* Options */}
                      <View style={styles.optionsWrap}>
                        {q.options.map((option, optIdx) => {
                          const isSelected = selected === optIdx;
                          return (
                            <TouchableOpacity
                              key={optIdx}
                              style={[
                                styles.optionRow,
                                isSelected && styles.optionRowSelected,
                              ]}
                              onPress={() => handleSelectOption(globalIdx, optIdx)}
                              activeOpacity={0.7}
                            >
                              <View
                                style={[
                                  styles.optionLetter,
                                  isSelected && styles.optionLetterSelected,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.optionLetterText,
                                    isSelected && styles.optionLetterTextSelected,
                                  ]}
                                >
                                  {LETTERS[optIdx]}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.optionText,
                                  isSelected && styles.optionTextSelected,
                                ]}
                                numberOfLines={4}
                              >
                                {option}
                              </Text>
                              {isSelected && (
                                <MaterialCommunityIcons
                                  name="radiobox-marked"
                                  size={18}
                                  color="#4F46E5"
                                  style={{ marginLeft: 8, flexShrink: 0 }}
                                />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                {/* Unanswered hint on last page */}
                {pageIdx === totalPages - 1 && !allAnswered && (
                  <View style={styles.hintBox}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={14}
                      color="#6366F1"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.hintText}>
                      Answer all {questions.length} questions to enable submission.
                      Use page dots or swipe to review earlier pages.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* Fixed Bottom Navigation Card — ALWAYS VISIBLE */}
      <View
        style={[
          styles.bottomBarCard,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {/* Status indicator row */}
        <View style={styles.bottomStatusRow}>
          <View style={[styles.statusPill, allAnswered && styles.statusPillDone]}>
            <MaterialCommunityIcons
              name={allAnswered ? "check-circle-outline" : "help-circle-outline"}
              size={13}
              color={allAnswered ? "#059669" : "#4F46E5"}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.statusPillText,
                allAnswered && styles.statusPillTextDone,
              ]}
            >
              {allAnswered
                ? "All questions answered — ready to submit!"
                : `${remainingCount} of ${questions.length} questions remaining`}
            </Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.navRow}>
          {/* Left: Previous Button (only rendered when currentPage > 0) */}
          {currentPage > 0 && (
            <TouchableOpacity
              style={styles.prevBtn}
              onPress={handlePrevPage}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={16}
                color="#4F46E5"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.prevBtnText}>Previous</Text>
            </TouchableOpacity>
          )}

          {/* Right: Next Page or Submit Quiz Button */}
          {isLastPage ? (
            <TouchableOpacity
              style={[
                styles.submitBtn,
                !allAnswered && styles.submitBtnDisabled,
                currentPage === 0 && { flex: 1 },
              ]}
              onPress={allAnswered ? handleSubmit : undefined}
              activeOpacity={allAnswered ? 0.85 : 1}
            >
              <Text
                style={[
                  styles.submitBtnText,
                  !allAnswered && styles.submitBtnTextDisabled,
                ]}
              >
                Submit Quiz
              </Text>
              <MaterialCommunityIcons
                name={allAnswered ? "send" : "lock-outline"}
                size={15}
                color={allAnswered ? "white" : "#9CA3AF"}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.nextBtn,
                !answeredOnPage && styles.nextBtnSoft,
                currentPage === 0 && { flex: 1 },
              ]}
              onPress={handleNextPage}
              activeOpacity={0.85}
            >
              <Text style={styles.nextBtnText}>Next Page</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={16}
                color="white"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <NoInternetModal
        visible={showNoInternet}
        onDismiss={() => setShowNoInternet(false)}
        contextMessage="Your answers are saved locally — they won't be lost. Reconnect and try again."
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  headerSub: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  pageChip: {
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pageChipText: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },

  overallProgressTrack: { height: 3, backgroundColor: "#E5E7EB" },
  overallProgressFill: {
    height: 3,
    backgroundColor: "#4F46E5",
    borderRadius: 2,
  },

  pageDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    gap: 6,
    // borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: "#F3F4F6",
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E5E7EB",
  },
  pageDotActive: { width: 20, backgroundColor: "#4F46E5" },
  pageDotDone: { backgroundColor: "#10B981" },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  centerBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  loadingCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginTop: 16,
    textAlign: "center",
  },
  loadingSub: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 6,
    textAlign: "center",
  },

  gradingCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  gradingAccent: { height: 5, backgroundColor: "#10B981" },
  gradingInner: { padding: 36, alignItems: "center" },
  gradingEmoji: { fontSize: 42, marginBottom: 8 },
  gradingTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },
  gradingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  gradingSub: { fontSize: 15, fontWeight: "600", color: "#10B981" },

  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  errorMsg: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },

  resultCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  resultAccent: { height: 5 },
  resultInner: { padding: 28, alignItems: "center" },
  resultEmoji: { fontSize: 48, marginBottom: 8 },
  resultHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  resultPct: { fontSize: 56, fontWeight: "900", lineHeight: 64 },
  resultScore: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 16,
  },
  resultBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  resultBadgeText: { fontSize: 13, fontWeight: "700" },

  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  progressCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  progressFill: {
    height: 10,
    borderRadius: 6,
    position: "absolute",
    top: 0,
    left: 0,
  },
  progressThreshold: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 10,
    backgroundColor: "#D1D5DB",
  },
  progressLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progressLegendText: { fontSize: 10, color: "#9CA3AF" },

  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: "#4F46E5",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  retryBtnText: { fontSize: 15, fontWeight: "700", color: "#4F46E5" },
  backBtn2: { alignItems: "center", paddingVertical: 12 },
  backBtn2Text: { fontSize: 14, fontWeight: "600", color: "#9CA3AF" },

  pageHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  pageHeadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    flex: 1,
  },
  pageCompletePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 3,
  },
  pageCompleteText: { fontSize: 11, fontWeight: "700", color: "#065F46" },

  questionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    // elevation: 2,
    borderWidth:1,
    borderColor: "#E5E7EB",
  },
  questionMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  qNumCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  qNumText: { fontSize: 12, fontWeight: "800", color: "#4F46E5" },
  bloomBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bloomText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },

  questionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 23,
    marginBottom: 16,
  },

  optionsWrap: { gap: 8 },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    padding: 12,
    gap: 10,
  },
  optionRowSelected: {
    borderColor: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionLetterSelected: { backgroundColor: "#4F46E5" },
  optionLetterText: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  optionLetterTextSelected: { color: "#FFFFFF" },
  optionText: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 20 },
  optionTextSelected: { color: "#3730A3", fontWeight: "600" },

  bottomBarCard: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },

  bottomStatusRow: {
    marginBottom: 10,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  statusPillDone: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4338CA",
  },
  statusPillTextDone: {
    color: "#047857",
    fontWeight: "700",
  },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  prevBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
  },
  prevBtnDisabled: {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
  },
  prevBtnText: { fontSize: 14, fontWeight: "700", color: "#4F46E5" },
  prevBtnTextDisabled: { color: "#9CA3AF" },

  moduleTitleCard: {
    backgroundColor: "#4F46E5",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    // shadowColor: "#4F46E5",
    // shadowOpacity: 0.04,
    // shadowRadius: 10,
    // shadowOffset: { width: 0, height: 4 },
    // elevation: 2,
  },
  moduleTitleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
    marginBottom: 10,
  },
  moduleTitleBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4F46E5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  moduleTitleText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 24,
  },

  nextBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    paddingVertical: 14,
  },
  nextBtnSoft: { backgroundColor: "#6366F1" },
  nextBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  submitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    borderRadius: 14,
    paddingVertical: 14,
  },
  submitBtnDisabled: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  submitBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  submitBtnTextDisabled: { color: "#9CA3AF" },

  hintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  hintText: { flex: 1, fontSize: 12, color: "#4338CA", lineHeight: 18 },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignSelf: "stretch",
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  // ─── Immersive Grading Loading State Styles ───
  immersiveGradingContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  immersiveCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  pulseCircleOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  pulseCircleInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  immersiveTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E1B4B",
    marginTop: 32,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  immersiveSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    fontWeight: "500",
  },

  // ─── Achievement Card / Elliptical Background Styles ───
  headerAccentBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 250,
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    opacity: 0.4,
    transform: [{ scaleX: 1.6 }],
  },
  achievementBadgeContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  badgeEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  badgeHeading: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  badgeSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 8,
    lineHeight: 18,
    fontWeight: "500",
  },

  // Pips
  pipsLabelRow: {
    alignSelf: "stretch",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginTop: 20,
    paddingTop: 16,
    marginBottom: 10,
    alignItems: "center",
  },
  pipsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  pipCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pipNumText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Action CTAs
  actionsWrap: {
    flexDirection: "column",
    gap: 12,
    marginBottom: 24,
  },
  primaryCTA: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  primaryCTAText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryCTA: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  secondaryCTAText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },

  // Detailed Review Panel
  reviewSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  reviewQuestionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  reviewQuestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  reviewQNum: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewQNumText: {
    fontSize: 12,
    fontWeight: "800",
  },
  reviewResultStatus: {
    fontSize: 12,
    fontWeight: "700",
  },
  reviewQuestionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 22,
    marginBottom: 16,
  },
  reviewOptionsList: {
    gap: 8,
    marginBottom: 14,
  },
  reviewOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 12,
    gap: 10,
  },
  reviewOptionCorrect: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
  },
  reviewOptionIncorrect: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  reviewOptionText: {
    flex: 1,
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
  },
  reviewOptionTextCorrect: {
    color: "#065F46",
    fontWeight: "700",
  },
  reviewOptionTextIncorrect: {
    color: "#991B1B",
    fontWeight: "700",
  },
  explanationBox: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: "#4F46E5",
  },
  explanationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#4F46E5",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  explanationText: {
    fontSize: 13,
    color: "#3730A3",
    lineHeight: 19,
    fontWeight: "500",
  },
});
