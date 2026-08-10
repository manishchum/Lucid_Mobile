import { useState } from "react";
import { friendlyError } from "../../../utils/friendlyError";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Pressable,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { eventBus } from "../../../utils/EventBus";


// ── Helpers ────────────────────────────────────────────────────────────────

const isTaskCompleted = (task: Task): boolean => {
  if (typeof task.submitted === "boolean") return task.submitted;
  const status = (task.status ?? "").toString().toLowerCase();
  return (
    status.includes("complete") ||
    status.includes("verified") ||
    status.includes("submitted")
  );
};

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

// ── Step number badge───

const StepBadge = ({ index, done }: { index: number; done?: boolean }) => (
  <View style={[s.stepBadge, done && s.stepBadgeDone]}>
    {done ? (
      <MaterialCommunityIcons name="check" size={13} color="#fff" />
    ) : (
      <Text style={s.stepBadgeText}>{index}</Text>
    )}
  </View>
);

const FormatStep = ({
  index,
  title,
  format,
  questions,
  value,
  onChange,
  done,
}: {
  index: number;
  title: string;
  format: SubmissionFormat;
  questions: TaskQuestion[];
  value: FormatAnswerLocal;
  onChange: (next: FormatAnswerLocal) => void;
  done: boolean;
}) => (
  <View style={s.stepRow}>
    <StepBadge index={index} done={done} />
    <View style={{ flex: 1 }}>
      <Text style={s.stepTitle}>{title}</Text>
      <View style={{ marginTop: 10 }}>
        <TaskSubmissionBlock
          format={format}
          questions={questionsForFormat(format, questions)}
          value={value}
          onChange={onChange}
          textPlaceholder="Write your answer here…"
        />
      </View>
    </View>
  </View>
);

const BundleStep = ({
  index,
  bt,
  value,
  onChange,
  expanded,
  onToggle,
  done,
}: {
  index: number;
  bt: BundleTask;
  value: FormatAnswerLocal;
  onChange: (next: FormatAnswerLocal) => void;
  expanded: boolean;
  onToggle: () => void;
  done: boolean;
}) => {
  const fmt = (toFormatList(bt.submission_format)[0] ??
    "text") as SubmissionFormat;
  const meta = getFormatMeta(fmt);
  return (
    <View style={s.stepRow}>
      <StepBadge index={index} done={done} />
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={s.bundleStepHeader}
          onPress={onToggle}
          activeOpacity={0.7}
        >
          <Text style={s.stepTitle}>{bt.title}</Text>
          <MaterialCommunityIcons
            name={meta.icon as any}
            size={18}
            color={meta.color}
          />
        </TouchableOpacity>
        {expanded && (
          <View style={{ marginTop: 10 }}>
            {!!bt.description && (
              <Text style={s.stepDescription}>{bt.description}</Text>
            )}
            <TaskSubmissionBlock
              format={fmt}
              questions={bt.questions ?? []}
              value={value}
              onChange={onChange}
              textPlaceholder="Write your answer here…"
            />
          </View>
        )}
      </View>
    </View>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

interface TaskAccordionItemProps {
  task: Task;
  userId?: string | null;
  onSubmit?: (task: Task, payload: Record<string, any>) => void;
  onSubmitted?: (task: Task) => void;
}

export default function TaskAccordionItem({
  task,
  userId,
  onSubmit,
  onSubmitted,
}: TaskAccordionItemProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, FormatAnswerLocal>>({});
  const [bundleAnswers, setBundleAnswers] = useState<
    Record<number, Record<string, FormatAnswerLocal>>
  >({});
  const [expandedBundleIdx, setExpandedBundleIdx] = useState<
    Record<number, boolean>
  >({ 0: true });

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

  const overdue = isTaskOverdue(task.due_date ?? null);
  const completed = isTaskCompleted(task) || justCompleted;

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

  const toggleBundleIdx = (idx: number) =>
    setExpandedBundleIdx((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const resetAllAnswers = () => {
    setAnswers({});
    setBundleAnswers({});
    setExpandedBundleIdx({ 0: true });
  };

  const openModal = () => {
    setSubmitError(null);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setSubmitError(null);
  };

  const validate = (): string | null => {
    if (isBundle) {
      for (const bt of bundleTasks) {
        const idx = bundleTasks.indexOf(bt);
        const fmts = toFormatList(bt.submission_format);
        for (const fmt of fmts) {
          const val = getBundleAnswer(idx, fmt);
          if (!isFormatAnswered(fmt, bt.questions ?? [], val)) {
            return `Please complete "${bt.title}".`;
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
      Alert.alert("Error", "You must be signed in to submit this task.");
      return;
    }

    const resolvedMaxScore: number = isBundle
      ? bundleTasks.length
      : ((task as any).max_score ?? 1);

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
          const childTaskId = `${task.task_id}-${idx}`;
          const formatAnswers = buildFormatAnswers(
            fmts,
            bt.questions ?? [],
            bundleAnswers[idx] ?? {},
          );
          for (const fa of formatAnswers) {
            await submitFormatAnswer({
              taskId: task.task_id,
              childTaskId,
              assignmentId: task.assignment_id,
              userId: effectiveUserId,
              maxScore: resolvedMaxScore,
              score: 1,
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
        const useChildTaskId = formatAnswers.length > 1;
        for (let idx = 0; idx < formatAnswers.length; idx++) {
          const fa = formatAnswers[idx];
          await submitFormatAnswer({
            taskId: task.task_id,
            childTaskId: useChildTaskId ? `${task.task_id}-${idx}` : undefined,
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
      resetAllAnswers();
      onSubmitted?.(task);
      eventBus.emit("TASK_UPDATED", { taskId: task.task_id, status: "completed" });
      eventBus.emit("PROGRESS_NEEDS_RECALCULATION");
      eventBus.emit("refresh_dashboard");
      setModalOpen(false);
    } catch (err) {
      const message = friendlyError(err);
      setSubmitError(message);
      Alert.alert("Submission failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  const validationMessage = validate();

  const primaryMeta = isBundle
    ? getFormatMeta("bundle")
    : getFormatMeta(submissionFormats[0] ?? "text");

  return (
    <>
      <TouchableOpacity
        style={[s.row, completed && s.rowCompleted]}
        onPress={openModal}
        activeOpacity={0.8}
      >
        <View style={[s.typeIconBox, { backgroundColor: primaryMeta.bg }]}>
          <MaterialCommunityIcons
            name={primaryMeta.icon as any}
            size={19}
            color={primaryMeta.color}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle} numberOfLines={1}>
            {task.title}
          </Text>
          <View style={s.rowMetaLine}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={12}
              color={overdue && !completed ? "#EF4444" : "#94A3B8"}
            />
            <Text
              style={[
                s.rowMetaText,
                overdue && !completed && { color: "#EF4444" },
              ]}
            >
              Due {formatDate(task.due_date ?? null)}
            </Text>

            {isBundle ? (
              <View
                style={[s.formatBadge, { backgroundColor: primaryMeta.bg }]}
              >
                <Text style={[s.formatBadgeText, { color: primaryMeta.color }]}>
                  {bundleTasks.length} steps
                </Text>
              </View>
            ) : (
              submissionFormats.map((fmt) => {
                const meta = getFormatMeta(fmt);
                return (
                  <View
                    key={fmt}
                    style={[s.formatBadge, { backgroundColor: meta.bg }]}
                  >
                    <MaterialCommunityIcons
                      name={meta.icon as any}
                      size={10}
                      color={meta.color}
                    />
                    <Text style={[s.formatBadgeText, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </View>
                );
              })
            )}

            {completed && (
              <View style={s.completedPill}>
                <MaterialCommunityIcons
                  name="check"
                  size={11}
                  color="#059669"
                />
                <Text style={s.completedPillText}>Done</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[s.startBtn, completed && s.startBtnDone]}
          onPress={openModal}
          activeOpacity={0.85}
        >
          <Text style={[s.startBtnText, completed && s.startBtnTextDone]}>
            {completed ? "View" : "Start"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={s.sheetOverlay}>
          <Pressable style={s.sheetBackdrop} onPress={closeModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
            style={s.sheetContainer}
          >
            <View style={s.sheetGrabber} />

            <View style={s.modalHeader}>
              <View
                style={[s.modalHeaderIcon, { backgroundColor: primaryMeta.bg }]}
              >
                <MaterialCommunityIcons
                  name={primaryMeta.icon as any}
                  size={18}
                  color={primaryMeta.color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle} numberOfLines={2}>
                  {task.title}
                </Text>
                {!!task.description && task.description !== task.title && (
                  <Text style={s.modalSubtitle} numberOfLines={2}>
                    {task.description}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={closeModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.modalBody}
              contentContainerStyle={{
                paddingBottom: completed ? 16 + insets.bottom : 16,
              }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScrollBeginDrag={Keyboard.dismiss}
              showsVerticalScrollIndicator={false}
            >
              {completed ? (
                <View style={s.completedPanel}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color="#059669"
                  />
                  <Text style={s.completedPanelText}>
                    This task has already been submitted.
                  </Text>
                </View>
              ) : isBundle ? (
                bundleTasks.map((bt, idx) => {
                  const fmts = toFormatList(bt.submission_format);
                  const val = getBundleAnswer(idx, fmts[0] ?? "text");
                  const done = fmts.every((fmt) =>
                    isFormatAnswered(
                      fmt,
                      bt.questions ?? [],
                      getBundleAnswer(idx, fmt),
                    ),
                  );
                  return (
                    <BundleStep
                      key={`${bt.title}-${idx}`}
                      index={idx + 1}
                      bt={bt}
                      value={val}
                      onChange={(next) =>
                        setBundleAnswer(idx, fmts[0] ?? "text", next)
                      }
                      expanded={!!expandedBundleIdx[idx]}
                      onToggle={() => toggleBundleIdx(idx)}
                      done={done}
                    />
                  );
                })
              ) : (
                submissionFormats.map((fmt, idx) => (
                  <FormatStep
                    key={fmt}
                    index={idx + 1}
                    title={
                      questions.length && fmt === "multiple_choice"
                        ? (questions[0]?.question ?? task.title)
                        : task.title
                    }
                    format={fmt}
                    questions={questions}
                    value={getAnswer(fmt)}
                    onChange={(next) => setAnswer(fmt, next)}
                    done={isFormatAnswered(fmt, questions, getAnswer(fmt))}
                  />
                ))
              )}

              {!completed && !!submitError && (
                <Text style={s.inlineError}>{submitError}</Text>
              )}
            </ScrollView>

            {!completed && (
              <View
                style={[s.modalFooter, { paddingBottom: 20 + insets.bottom }]}
              >
                <TouchableOpacity
                  style={[
                    s.submitBtn,
                    (submitting || !!validationMessage) && { opacity: 0.5 },
                  ]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={submitting || !!validationMessage}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="send"
                        size={15}
                        color="#fff"
                      />
                      <Text style={s.submitBtnText}>Submit</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: "#94A3B8",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowCompleted: { borderColor: "#D1FAE5", backgroundColor: "#FAFFFE" },
  typeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  rowMetaLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    flexWrap: "wrap",
  },
  rowMetaText: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },
  formatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  formatBadgeText: { fontSize: 10, fontWeight: "700" },
  completedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  completedPillText: { fontSize: 10, fontWeight: "700", color: "#059669" },

  startBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  startBtnDone: { backgroundColor: "#F1F5F9" },
  startBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  startBtnTextDone: { color: "#475569" },

  // Bottom-sheet modal — ~70% of screen height, scrollable body
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  sheetContainer: {
    maxHeight: SCREEN_HEIGHT * 0.7,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 10,
  },
  modalHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  modalSubtitle: { fontSize: 12, color: "#64748B", marginTop: 3 },
  modalBody: { paddingHorizontal: 20, paddingTop: 16 },

  stepRow: { flexDirection: "row", gap: 12, marginBottom: 22 },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  stepBadgeDone: { backgroundColor: "#10B981" },
  stepBadgeText: { fontSize: 12, fontWeight: "800", color: "#2563EB" },
  stepTitle: { fontSize: 14, fontWeight: "700", color: "#1E293B", flex: 1 },
  stepDescription: { fontSize: 12, color: "#64748B", marginBottom: 8 },
  bundleStepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  completedPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  completedPanelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#047857",
    flex: 1,
  },

  inlineError: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
    marginTop: 4,
    textAlign: "center",
  },

  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  submitBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
