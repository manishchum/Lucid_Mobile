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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contex/AuthContext";
import {
  getEmployeeLearningStyle,
  getExistingAssessment,
  generateModuleQuiz,
  submitQuizForGrading,
} from "../../api/users/Request";
import { useNetworkStatus } from "../../hooks/network/useNetworkStatus";
import NoInternetModal from "../../components/networkModal/NetworkModal";

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

  const processedModuleId: string = route?.params?.processedModuleId ?? "";
  const moduleId: string = route?.params?.moduleId ?? ""; // original TrainingModule UUID
  const moduleTitle: string = route?.params?.moduleTitle ?? "Module Quiz";
  const companyId: string = cachedUser?.companyId ?? "";

  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>([]);
  const [gradingResult, setGradingResult] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showNoInternet, setShowNoInternet] = useState(false);

  const isOnline = useNetworkStatus();

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const isSubmittingRef = useRef(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(
    null,
  );
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const totalPages = Math.ceil(questions.length / PAGE_SIZE);
  const pageStart = currentPage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, questions.length);
  const pageQuestions = questions.slice(pageStart, pageEnd);

  const answeredOnPage = pageQuestions.every(
    (_, i) => userAnswers[pageStart + i] !== null,
  );
  const allAnswered =
    questions.length > 0 && userAnswers.every((a) => a !== null);
  const isLastPage = currentPage === totalPages - 1;

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
    if (isOnline === false) {
      setShowNoInternet(true);
      return;
    }
    try {
      setPhase("fetching_style");
      const learningStyle = await getEmployeeLearningStyle(userId);

      setPhase("checking_existing");
      const existing = await getExistingAssessment(
        processedModuleId,
        learningStyle,
        userId,
        moduleId,
      );

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
    } catch {
      setPhase("error");
      setErrorMsg(
        "Something went wrong. Please check your connection and try again.",
      );
    }
  }, [cachedUser?.userId, cachedUser?.companyId, processedModuleId]);

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

  // ─── Page navigation ────────────────────────────────────────────────────────
  const animatePage = (newPage: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 130,
      useNativeDriver: true,
    }).start(() => {
      setCurrentPage(newPage);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNextPage = () => {
    if (!isLastPage) animatePage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 0) animatePage(currentPage - 1);
  };

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const userId = cachedUser?.userId;
    if (!userId || !processedModuleId) return;
    console.log("Not allowing submit as no processed module id is available..");
    if (isOnline === false) {
      setShowNoInternet(true);
      return;
    }
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setPhase("grading");
    try {
      // Integer indices of selected options
      const answerIndices = userAnswers.map((idx) => idx ?? 0);

      // FIX: use processedModuleId (NOT original moduleId) inside modules[].module_id.
      // Web payload: modules: [{ module_id: "94547c82-..." }] where that is the
      // processedModuleId. Sending [] or the original moduleId caused 403.
      const moduleObjects = processedModuleId
        ? [{ module_id: processedModuleId }]
        : [];

      const result = await submitQuizForGrading(
        assessmentId,
        answerIndices,
        questions,
        userId,
        cachedUser?.name ?? cachedUser?.email,
        moduleObjects,
        processedModuleId,
        moduleId,
      );
      if (!result) throw new Error("Empty grading response");

      // Server returns { score, maxScore, feedback } — compute percentage here
      // since the API does not return a `percentage` field directly.
      const rawScore = typeof result?.score === "number" ? result.score : 0;
      const rawMax =
        typeof result?.maxScore === "number"
          ? result.maxScore
          : questions.length;
      const computedPct =
        rawMax > 0 ? Math.round((rawScore / rawMax) * 100) : 0;

      setGradingResult({ ...result, percentage: computedPct });
      if (computedPct >= 70) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3200);
      }
      setPhase("ready");
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "";
      const match = message.match(/Try again in (\d+) seconds?/i);
      if (match) {
        const seconds = parseInt(match[1], 10);
        setRetryAfterSeconds(seconds);
        const minutes = Math.ceil(seconds / 60);
        setErrorMsg(
          `Grading is temporarily rate-limited by the server. Please wait about ${minutes} minute${minutes === 1 ? "" : "s"} and try submitting again — your answers have been kept.`,
        );
      } else {
        setRetryAfterSeconds(null);
        setErrorMsg("Grading failed. Please try again.");
      }
      // Use a dedicated phase (not the quiz-loading "error" phase) so that
      // retrying re-submits the existing answers instead of regenerating
      // an entirely new quiz — which was silently burning extra LLM calls
      // against the same rate limit on every retry.
      setPhase("grading_error");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ─── Retry ──────────────────────────────────────────────────────────────────
  const handleRetry = () => {
    setUserAnswers(new Array(questions.length).fill(null));
    setGradingResult(null);
    setShowConfetti(false);
    setCurrentPage(0);
    fadeAnim.setValue(1);
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
          {moduleTitle}
        </Text>
        {phase === "ready" && !gradingResult && questions.length > 0 && (
          <Text style={styles.headerSub}>
            {userAnswers.filter((a) => a !== null).length} of {questions.length}{" "}
            answered
          </Text>
        )}
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        {renderHeader()}
        <View style={styles.centerBody}>
          <View style={styles.gradingCard}>
            <View style={styles.gradingAccent} />
            <View style={styles.gradingInner}>
              <Text style={styles.gradingEmoji}>🎉</Text>
              <Text style={styles.gradingTitle}>Quiz Submitted!</Text>
              <View style={styles.gradingRow}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.gradingSub}>Grading…</Text>
              </View>
            </View>
          </View>
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
              name={
                retryAfterSeconds
                  ? "clock-alert-outline"
                  : "alert-circle-outline"
              }
              size={44}
              color="#EF4444"
            />
          </View>
          <Text style={styles.errorTitle}>
            {retryAfterSeconds
              ? "Please wait a moment"
              : "Something went wrong"}
          </Text>
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
    const passed = pct >= 70;

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Confetti visible={showConfetti} />
        {renderHeader()}

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Score card */}
          <View style={styles.resultCard}>
            <View
              style={[
                styles.resultAccent,
                { backgroundColor: passed ? "#10B981" : "#F59E0B" },
              ]}
            />
            <View style={styles.resultInner}>
              <Text style={styles.resultEmoji}>{passed ? "🏆" : "📚"}</Text>
              <Text style={styles.resultHeading}>Quiz Complete!</Text>
              <Text
                style={[
                  styles.resultPct,
                  { color: passed ? "#10B981" : "#F59E0B" },
                ]}
              >
                {pct}%
              </Text>
              <Text style={styles.resultScore}>
                {score} / {max} correct
              </Text>
              <View
                style={[
                  styles.resultBadge,
                  { backgroundColor: passed ? "#D1FAE5" : "#FEF3C7" },
                ]}
              >
                <MaterialCommunityIcons
                  name={passed ? "check-decagram" : "book-open-outline"}
                  size={14}
                  color={passed ? "#065F46" : "#92400E"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.resultBadgeText,
                    { color: passed ? "#065F46" : "#92400E" },
                  ]}
                >
                  {passed
                    ? "Passed — Great work!"
                    : "Keep learning — you've got this!"}
                </Text>
              </View>
            </View>
          </View>

          {/* Progress bar visual */}
          <View style={styles.progressCard}>
            <Text style={styles.progressCardLabel}>Your score</Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${pct}%` as any,
                    backgroundColor: passed ? "#10B981" : "#F59E0B",
                  },
                ]}
              />
              <View
                style={[styles.progressThreshold, { left: "30%" as any }]}
              />
            </View>
            <View style={styles.progressLegend}>
              <Text style={styles.progressLegendText}>0%</Text>
              <Text style={styles.progressLegendText}>Pass: 30%</Text>
              <Text style={styles.progressLegendText}>100%</Text>
            </View>
          </View>

          {/* Actions */}
          {/* <TouchableOpacity
            style={styles.retryBtn}
            onPress={handleRetry}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name="refresh"
              size={16}
              color="#4F46E5"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.retryBtnText}>Retake Quiz</Text>
          </TouchableOpacity> */}
          <TouchableOpacity
            style={styles.backBtn2}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.backBtn2Text}>← Back to Sprint</Text>
          </TouchableOpacity>
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

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Page heading */}
          <View style={styles.pageHeadingRow}>
            <Text style={styles.pageHeadingText}>
              Questions {pageStart + 1}–{pageEnd}
            </Text>
            {answeredOnPage && !isLastPage && (
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
          {pageQuestions.map((q, localIdx) => {
            const globalIdx = pageStart + localIdx;
            const selected = userAnswers[globalIdx];

            return (
              <View key={globalIdx} style={styles.questionCard}>
                {/* Question number + bloom */}
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

          {/* Navigation row */}
          <View style={styles.navRow}>
            {currentPage > 0 ? (
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
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {isLastPage ? (
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  !allAnswered && styles.submitBtnDisabled,
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
                  {allAnswered
                    ? "Submit Quiz"
                    : `${questions.length - userAnswers.filter((a) => a !== null).length} left`}
                </Text>
                <MaterialCommunityIcons
                  name={allAnswered ? "send" : "lock-outline"}
                  size={16}
                  color={allAnswered ? "white" : "#9CA3AF"}
                  style={{ marginLeft: 6 }}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.nextBtn, !answeredOnPage && styles.nextBtnSoft]}
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

          {/* Unanswered hint on last page */}
          {isLastPage && !allAnswered && (
            <View style={styles.hintBox}>
              <MaterialCommunityIcons
                name="information-outline"
                size={14}
                color="#6366F1"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.hintText}>
                Answer all {questions.length} questions to enable submission.
                Use the page dots above to revisit earlier pages.
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

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
  container: { flex: 1, backgroundColor: "#F8F9FB" },

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
  headerTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
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
    elevation: 2,
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

  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },

  prevBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#C7D2FE",
  },
  prevBtnText: { fontSize: 14, fontWeight: "700", color: "#4F46E5" },

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
});
