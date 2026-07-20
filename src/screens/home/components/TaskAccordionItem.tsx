import { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Task,
  SubmissionFormat,
  TaskQuestion,
  BundleTask,
  FormatAnswer,
  BundleSubmissionEntry,
  submitFormatAnswer,
} from "../../../api/users";
import TaskSubmissionBlock, {
  FormatAnswerLocal,
  emptyAnswer,
  isFormatAnswered,
  getFormatMeta,
  toFormatList,
} from "../../../components/tasks/TaskSubmissionBlock";
import { useAuth } from "../../../contex/AuthContext";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const isTaskCompleted = (task: Task): boolean => {
  if (typeof task.submitted === "boolean") return task.submitted;
  const status = (task.status ?? "").toString().toLowerCase();
  return (
    status.includes("complete") ||
    status.includes("verified") ||
    status.includes("submitted")
  );
};

/** Returns true when due_date (YYYY-MM-DD) is in the past */
const isTaskOverdue = (dueDate: string | null): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
};

const formatDate = (iso: string | null): string => {
  if (!iso) return "No due date";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const questionsForFormat = (
  format: SubmissionFormat,
  questions: TaskQuestion[],
): TaskQuestion[] => (format === "multiple_choice" ? (questions ?? []) : []);

const buildFormatAnswers = (
  formats: SubmissionFormat[],
  questions: TaskQuestion[],
  answersByFormat: Record<string, FormatAnswerLocal>,
): FormatAnswer[] =>
  formats
    .filter((f) => f !== "bundle")
    .map((format) => {
      const val = answersByFormat[format] ?? emptyAnswer();
      const out: FormatAnswer = { format };
      if (format === "text") out.text_answer = val.text?.trim();
      if (format === "image") out.image_url = val.image?.uri;
      if (format === "video") out.video_url = val.video?.uri;
      if (format === "audio") out.audio_url = val.audio?.uri;
      if (format === "multiple_choice") {
        const qs = questionsForFormat(format, questions);
        out.answers = qs.map((q) => {
          const sel = val.optionSelections?.[q.id];
          const selArray = Array.isArray(sel)
            ? sel
            : typeof sel === "string" && sel.length > 0
              ? [sel]
              : [];

          const selectedOption = selArray.join(", ");
          const correctAnswer =
            q.correctAnswer ?? q.correctAnswers?.[0] ?? q.writtenAnswer ?? "";
          return {
            question_id: q.id,
            question: q.question,
            correct_answer: correctAnswer,
            selected_option: selectedOption,
          };
        });
      }
      return out;
    });

// ── Sub-components ─────────────────────────────────────────────────────────────

const FormatSection = ({
  format,
  questions,
  value,
  onChange,
  title,
}: {
  format: SubmissionFormat;
  questions: TaskQuestion[];
  value: FormatAnswerLocal;
  onChange: (next: FormatAnswerLocal) => void;
  title: string;
}) => {
  const meta = getFormatMeta(format);
  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.formatSectionHeader}>
        <MaterialCommunityIcons
          name={meta.icon as any}
          size={14}
          color={meta.color}
        />
        <Text style={[styles.formatSectionLabel, { color: meta.color }]}>
          {meta.label}
        </Text>
      </View>
      <TaskSubmissionBlock
        format={format}
        questions={questionsForFormat(format, questions)}
        value={value}
        onChange={onChange}
        textPlaceholder={`Write your response for "${title}"…`}
      />
    </View>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────

interface TaskAccordionItemProps {
  task: Task;
  userId?: string | null;
  onSubmit?: (task: Task, payload: Record<string, any>) => void;
  /** Called after a successful API submission so the parent can refetch tasks */
  onSubmitted?: (task: Task) => void;
}

export default function TaskAccordionItem({
  task,
  userId,
  onSubmit,
  onSubmitted,
}: TaskAccordionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const [answers, setAnswers] = useState<Record<string, FormatAnswerLocal>>({});
  const [bundleAnswers, setBundleAnswers] = useState<
    Record<number, Record<string, FormatAnswerLocal>>
  >({});
  const [expandedBundleIdx, setExpandedBundleIdx] = useState<
    Record<number, boolean>
  >({});
  const toggleBundleIdx = (idx: number) => {
    LayoutAnimation.configureNext({
      duration: 220,
      update: { type: "easeInEaseOut", property: "opacity" },
    });
    setExpandedBundleIdx((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  let cachedUserId: string | null = null;
  try {
    cachedUserId = useAuth().cachedUser?.userId ?? null;
  } catch {
    cachedUserId = null;
  }
  const effectiveUserId = userId ?? cachedUserId ?? null;

  const submissionFormats: SubmissionFormat[] = Array.isArray(
    task.submission_format,
  )
    ? task.submission_format
    : [];
  const questions: TaskQuestion[] = Array.isArray(task.questions)
    ? task.questions
    : [];
  const bundleTasks: BundleTask[] = Array.isArray(task.bundle_tasks)
    ? task.bundle_tasks
    : [];
  const isBundle =
    submissionFormats.includes("bundle") && bundleTasks.length > 0;

  const primaryMeta = isBundle
    ? getFormatMeta("bundle")
    : getFormatMeta(submissionFormats[0] ?? "text");
  const overdue = isTaskOverdue(task.due_date ?? null);
  const completed = isTaskCompleted(task) || justCompleted;

  const toggle = () => {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "spring", springDamping: 0.8 },
    });
    Animated.timing(rotateAnim, {
      toValue: expanded ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    if (expanded) setVerifying(false);
    setExpanded((p) => !p);
  };

  const getAnswer = (format: string) => answers[format] ?? emptyAnswer();
  const setAnswer = (format: string, next: FormatAnswerLocal) =>
    setAnswers((prev) => ({ ...prev, [format]: next }));

  const getBundleAnswer = (bIdx: number, format: string) =>
    bundleAnswers[bIdx]?.[format] ?? emptyAnswer();
  const setBundleAnswer = (
    bIdx: number,
    format: string,
    next: FormatAnswerLocal,
  ) =>
    setBundleAnswers((prev) => ({
      ...prev,
      [bIdx]: { ...(prev[bIdx] ?? {}), [format]: next },
    }));

  const resetAllAnswers = () => {
    setAnswers({});
    setBundleAnswers({});
    setExpandedBundleIdx({});
  };

  const validate = (): string | null => {
    if (isBundle) {
      for (const bt of bundleTasks) {
        const idx = bundleTasks.indexOf(bt);
        const fmts = toFormatList(bt.submission_format);
        for (const fmt of fmts) {
          const val = getBundleAnswer(idx, fmt);
          if (!isFormatAnswered(fmt, bt.questions ?? [], val)) {
            return `Please complete "${bt.title}" (${getFormatMeta(fmt).label}).`;
          }
        }
      }
      return null;
    }
    for (const fmt of submissionFormats) {
      const val = getAnswer(fmt);
      if (!isFormatAnswered(fmt, questions, val)) {
        return `Please complete the ${getFormatMeta(fmt).label} section.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert("Incomplete", validationError);
      return;
    }
    if (!effectiveUserId) {
      console.warn(
        "[TaskAccordionItem] Missing userId — prop:",
        userId,
        "cachedUser.userId:",
        cachedUserId,
      );
      Alert.alert("Error", "You must be signed in to submit this task.");
      return;
    }

    const resolvedMaxScore: number = (task as any).max_score ?? 1;

    const payload = isBundle
      ? {
          is_bundle: true,
          bundle_answers: bundleTasks.map((bt, idx) => ({
            title: bt.title,
            answers: buildFormatAnswers(
              toFormatList(bt.submission_format),
              bt.questions ?? [],
              bundleAnswers[idx] ?? {},
            ),
          })) as BundleSubmissionEntry[],
        }
      : {
          is_bundle: false,
          answers: buildFormatAnswers(submissionFormats, questions, answers),
        };

    onSubmit?.(task, payload);

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isBundle) {
        for (let idx = 0; idx < bundleTasks.length; idx++) {
          const bt = bundleTasks[idx];
          const fmts = toFormatList(bt.submission_format);
          const subTaskId = idx === 0 ? task.task_id : `${task.task_id}-${idx}`;
          const formatAnswers = buildFormatAnswers(
            fmts,
            bt.questions ?? [],
            bundleAnswers[idx] ?? {},
          );
          for (const fa of formatAnswers) {
            await submitFormatAnswer({
              taskId: subTaskId,
              assignmentId: task.assignment_id,
              userId: effectiveUserId,
              maxScore: resolvedMaxScore,
              score: resolvedMaxScore,
              format: fa.format,
              formatAnswer: fa,
            });
          }
        }
      } else {
        const formatAnswers = buildFormatAnswers(
          submissionFormats,
          questions,
          answers,
        );
        for (const fa of formatAnswers) {
          await submitFormatAnswer({
            taskId: task.task_id,
            assignmentId: task.assignment_id,
            userId: effectiveUserId,
            maxScore: resolvedMaxScore,
            score: resolvedMaxScore,
            format: fa.format,
            formatAnswer: fa,
          });
        }
      }

      setJustCompleted(true);
      setVerifying(false);
      resetAllAnswers();
      onSubmitted?.(task);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setSubmitError(message);
      Alert.alert("Submission failed", message);
    } finally {
      setSubmitting(false);
    }
  };
  const validationMessage = verifying ? validate() : null;

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "90deg"],
  });

  return (
    <View
      style={[
        styles.card,
        overdue && !completed && styles.cardOverdue,
        completed && styles.cardCompleted,
      ]}
    >
      {/* ── HEADER (always visible) ─────────────────────────────────── */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <View style={[styles.typeIconBox, { backgroundColor: primaryMeta.bg }]}>
          <MaterialCommunityIcons
            name={primaryMeta.icon as any}
            size={18}
            color={primaryMeta.color}
          />
        </View>

        <View style={styles.headerTextBlock}>
          <Text style={styles.taskTitle} numberOfLines={expanded ? 0 : 2}>
            {task.title}
          </Text>
          {!expanded && (
            <View style={styles.metaRow}>
              {completed ? (
                <View style={styles.completedBadge}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={12}
                    color="#059669"
                  />
                  <Text style={styles.completedBadgeText}>
                    Completed &amp; Verified
                  </Text>
                </View>
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={11}
                    color={overdue ? "#EF4444" : "#94A3B8"}
                  />
                  <Text
                    style={[styles.metaText, overdue && { color: "#EF4444" }]}
                  >
                    Due {formatDate(task.due_date ?? null)}
                  </Text>
                  {isBundle ? (
                    <View
                      style={[
                        styles.formatBadge,
                        { backgroundColor: primaryMeta.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.formatBadgeText,
                          { color: primaryMeta.color },
                        ]}
                      >
                        {bundleTasks.length} tasks
                      </Text>
                    </View>
                  ) : (
                    submissionFormats.map((fmt) => {
                      const meta = getFormatMeta(fmt);
                      return (
                        <View
                          key={fmt}
                          style={[
                            styles.formatBadge,
                            { backgroundColor: meta.bg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.formatBadgeText,
                              { color: meta.color },
                            ]}
                          >
                            {meta.label}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </>
              )}
            </View>
          )}
        </View>

        <Animated.View
          style={{ transform: [{ rotate: rotateInterpolate }], marginLeft: 8 }}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#94A3B8"
          />
        </Animated.View>
      </TouchableOpacity>

      {/* ── EXPANDED BODY ──────────────────────────────────────────── */}
      {expanded && (
        <View style={styles.body}>
          <View style={styles.divider} />

          {/* Meta chips */}
          <View style={styles.metaChipsRow}>
            <View style={styles.metaChip}>
              <MaterialCommunityIcons
                name="account-group-outline"
                size={13}
                color="#64748B"
              />
              <Text style={styles.metaChipText}>
                {task.audience_display_name}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={13}
                color={overdue ? "#EF4444" : "#64748B"}
              />
              <Text
                style={[styles.metaChipText, overdue && { color: "#EF4444" }]}
              >
                Due {formatDate(task.due_date ?? null)}
              </Text>
            </View>
            {!!task.recurrence && task.recurrence !== "none" && (
              <View style={styles.metaChip}>
                <MaterialCommunityIcons
                  name="repeat"
                  size={13}
                  color="#64748B"
                />
                <Text style={styles.metaChipText}>
                  {task.recurrence.replace(/_/g, " ")}
                </Text>
              </View>
            )}
            {overdue && (
              <View style={[styles.statusPill, { backgroundColor: "#FEF2F2" }]}>
                <Text style={[styles.statusPillText, { color: "#EF4444" }]}>
                  Overdue
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          {!!task.description && task.description !== task.title && (
            <View style={styles.descriptionBox}>
              <Text style={styles.descriptionText}>{task.description}</Text>
            </View>
          )}

          {/* Submission format badges */}
          <Text style={styles.sectionLabel}>SUBMISSION FORMAT</Text>
          <View style={styles.formatsRow}>
            {isBundle ? (
              <View
                style={[styles.formatChip, { backgroundColor: primaryMeta.bg }]}
              >
                <MaterialCommunityIcons
                  name={primaryMeta.icon as any}
                  size={13}
                  color={primaryMeta.color}
                />
                <Text
                  style={[styles.formatChipText, { color: primaryMeta.color }]}
                >
                  {bundleTasks.length} bundled tasks
                </Text>
              </View>
            ) : (
              submissionFormats.map((fmt) => {
                const meta = getFormatMeta(fmt);
                return (
                  <View
                    key={fmt}
                    style={[styles.formatChip, { backgroundColor: meta.bg }]}
                  >
                    <MaterialCommunityIcons
                      name={meta.icon as any}
                      size={13}
                      color={meta.color}
                    />
                    <Text
                      style={[styles.formatChipText, { color: meta.color }]}
                    >
                      {meta.label}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Progress bar */}
          {task.total_target_count > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.sectionLabel}>COMPLETION</Text>
                <Text style={styles.progressFraction}>
                  {task.completion_count}/{task.total_target_count}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        (task.completion_count / task.total_target_count) * 100,
                        100,
                      )}%` as any,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* ── COMPLETED / VERIFICATION PANEL ─────────────────────── */}
          {completed ? (
            <View style={styles.completedPanel}>
              <MaterialCommunityIcons
                name="check-circle"
                size={18}
                color="#059669"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.completedPanelTitle}>Completed</Text>
                <Text style={styles.completedPanelSubtitle}>
                  {task.submission?.submitted_at
                    ? `Submitted ${formatDate(
                        task.submission.submitted_at.slice(0, 10),
                      )}`
                    : "Task submitted successfully"}
                </Text>
              </View>
            </View>
          ) : verifying ? (
            <View style={styles.verifyPanel}>
              <Text style={styles.verifyTitle}>
                {isBundle ? "Complete All Sub-Tasks" : "Submit Your Response"}
              </Text>
              <Text style={styles.verifySubtitle}>
                {isBundle
                  ? "Each task below must be completed before submitting."
                  : "Fill in every section below, then submit for verification."}
              </Text>

              {isBundle
                ? bundleTasks.map((bt, idx) => {
                    const fmts = toFormatList(bt.submission_format);
                    const isOpen = !!expandedBundleIdx[idx];
                    const allAnswered =
                      fmts.length > 0 &&
                      fmts.every((fmt) =>
                        isFormatAnswered(
                          fmt,
                          bt.questions ?? [],
                          getBundleAnswer(idx, fmt),
                        ),
                      );
                    return (
                      <View
                        key={`${bt.title}-${idx}`}
                        style={styles.bundleCard}
                      >
                        <TouchableOpacity
                          style={styles.bundleCardHeader}
                          onPress={() => toggleBundleIdx(idx)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.bundleIndexBadge}>
                            <Text style={styles.bundleIndexBadgeText}>
                              {idx + 1}
                            </Text>
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={styles.bundleCardTitle}
                              numberOfLines={isOpen ? undefined : 2}
                            >
                              {bt.title}
                            </Text>
                            <View style={styles.bundleFormatIconsRow}>
                              {fmts.map((fmt) => {
                                const meta = getFormatMeta(fmt);
                                return (
                                  <View
                                    key={fmt}
                                    style={[
                                      styles.bundleFormatIconChip,
                                      { backgroundColor: meta.bg },
                                    ]}
                                  >
                                    <MaterialCommunityIcons
                                      name={meta.icon as any}
                                      size={11}
                                      color={meta.color}
                                    />
                                    <Text
                                      style={[
                                        styles.bundleFormatIconChipText,
                                        { color: meta.color },
                                      ]}
                                    >
                                      {meta.label}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>

                          {allAnswered && (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={16}
                              color="#059669"
                              style={{ marginRight: 4 }}
                            />
                          )}
                          <MaterialCommunityIcons
                            name={isOpen ? "chevron-up" : "chevron-down"}
                            size={20}
                            color="#94A3B8"
                          />
                        </TouchableOpacity>

                        {isOpen && (
                          <View style={styles.bundleCardBody}>
                            {!!bt.description && (
                              <Text style={styles.bundleCardDescription}>
                                {bt.description}
                              </Text>
                            )}
                            {fmts.map((fmt) => (
                              <FormatSection
                                key={fmt}
                                format={fmt}
                                questions={bt.questions ?? []}
                                value={getBundleAnswer(idx, fmt)}
                                onChange={(next) =>
                                  setBundleAnswer(idx, fmt, next)
                                }
                                title={bt.title}
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                : submissionFormats.map((fmt) => (
                    <FormatSection
                      key={fmt}
                      format={fmt}
                      questions={questions}
                      value={getAnswer(fmt)}
                      onChange={(next) => setAnswer(fmt, next)}
                      title={task.title}
                    />
                  ))}

              <View style={styles.verifyActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setVerifying(false);
                    setSubmitError(null);
                    resetAllAnswers();
                  }}
                  activeOpacity={0.8}
                  disabled={submitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (submitting || !!validationMessage) && { opacity: 0.5 },
                  ]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={submitting || !!validationMessage}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <MaterialCommunityIcons
                      name="send"
                      size={15}
                      color="#fff"
                    />
                  )}
                  <Text style={styles.submitBtnText}>
                    {submitting ? "Submitting…" : "Submit Verification"}
                  </Text>
                </TouchableOpacity>
              </View>

              {!!validationMessage && (
                <Text style={styles.inlineErrorText}>{validationMessage}</Text>
              )}
              {!validationMessage && !!submitError && (
                <Text style={styles.inlineErrorText}>{submitError}</Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.beginBtn}
              onPress={() => {
                setSubmitError(null);
                setVerifying(true);
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="play" size={15} color="#fff" />
              <Text style={styles.beginBtnText}>Begin Verification</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    shadowColor: "#94A3B8",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: "#EF4444",
    borderColor: "#FECACA",
  },
  cardCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
    borderColor: "#D1FAE5",
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  typeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  headerTextBlock: { flex: 1 },
  taskTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    flexWrap: "wrap",
  },
  metaText: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  completedBadgeText: { fontSize: 10, fontWeight: "700", color: "#059669" },
  formatBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  formatBadgeText: { fontSize: 10, fontWeight: "700" },

  // Body
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 12 },

  metaChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  metaChipText: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  statusPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  statusPillText: { fontSize: 10, fontWeight: "700" },

  descriptionBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderLeftWidth: 2,
    borderLeftColor: "#E2E8F0",
  },
  descriptionText: { fontSize: 13, color: "#475569", lineHeight: 18 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.6,
    marginBottom: 7,
  },

  formatsRow: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  formatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  formatChipText: { fontSize: 11, fontWeight: "700" },

  progressSection: { marginBottom: 14 },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  progressFraction: { fontSize: 11, fontWeight: "700", color: "#475569" },
  progressTrack: {
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 4,
  },

  // CTA buttons
  beginBtn: {
    marginTop: 4,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  beginBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  completedPanel: {
    marginTop: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  completedPanelTitle: { fontSize: 14, fontWeight: "800", color: "#047857" },
  completedPanelSubtitle: { fontSize: 12, color: "#059669", marginTop: 1 },

  verifyPanel: {
    marginTop: 4,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
  },
  verifyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 2,
  },
  verifySubtitle: { fontSize: 12, color: "#64748B", marginBottom: 12 },

  formatSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 7,
  },
  formatSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  bundleCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    marginBottom: 12,
    overflow: "hidden",
  },
  bundleCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
  },
  bundleIndexBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  bundleIndexBadgeText: { fontSize: 11, fontWeight: "800", color: "#4338CA" },
  bundleCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#312E81",
    lineHeight: 18,
  },
  bundleFormatIconsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  bundleFormatIconChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  bundleFormatIconChipText: { fontSize: 10, fontWeight: "700" },
  bundleCardBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  bundleCardDescription: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 10,
    marginBottom: 4,
  },

  verifyActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  submitBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  submitBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  inlineErrorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
    marginTop: 10,
    textAlign: "center",
  },
});
