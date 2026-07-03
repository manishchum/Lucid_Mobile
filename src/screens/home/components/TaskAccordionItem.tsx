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
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Task,
  SubmissionFormat,
  TaskSubmissionType,
  submitTaskAnswer,
} from "../../../api/users";
import CameraCapture from "../../../components/camera/CamerCapture";
import { useAuth } from "../../../contex/AuthContext";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const FORMAT_META: Record<
  SubmissionFormat,
  { icon: string; color: string; bg: string; label: string }
> = {
  image: {
    icon: "image-outline",
    color: "#7C3AED",
    bg: "#F5F3FF",
    label: "Image",
  },
  audio: {
    icon: "microphone-outline",
    color: "#0891B2",
    bg: "#ECFEFF",
    label: "Audio",
  },
  video: {
    icon: "video-outline",
    color: "#DB2777",
    bg: "#FDF2F8",
    label: "Video",
  },
  text: {
    icon: "text-box-outline",
    color: "#059669",
    bg: "#ECFDF5",
    label: "Text",
  },
};

const OPTIONS_META = {
  icon: "format-list-bulleted",
  color: "#D97706",
  bg: "#FFFBEB",
  label: "Options",
};

const getFormatMeta = (fmt?: SubmissionFormat) =>
  FORMAT_META[fmt ?? "text"] ?? FORMAT_META["text"];

/**
 * Resolves the *effective* submission type the mobile app actually collects.
 * Mobile currently only supports 3 input modes: image / text / options.
 * - If the task has a question with options → "options"
 * - Else if the primary submission_format is "image" → "image"
 * - Else (text, audio, video — audio/video are answered via text for now) → "text"
 */
const resolveEffectiveType = (
  task: Task,
  primaryFormat: SubmissionFormat,
): TaskSubmissionType => {
  const firstQuestion = Array.isArray(task.questions)
    ? task.questions[0]
    : null;
  if (
    firstQuestion &&
    Array.isArray(firstQuestion.options) &&
    firstQuestion.options.length > 0
  ) {
    return "options";
  }
  if (primaryFormat === "image") return "image";
  return "text";
};

const isTaskCompleted = (task: Task): boolean => {
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

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Text area for non-image submissions */
const TextSubmissionInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) => (
  <View style={verifyStyles.textInputWrapper}>
    <MaterialCommunityIcons
      name="pencil-outline"
      size={16}
      color="#94A3B8"
      style={{ marginBottom: 6 }}
    />
    <TextInput
      style={verifyStyles.textInput}
      multiline
      numberOfLines={4}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#CBD5E1"
      textAlignVertical="top"
    />
    <Text style={verifyStyles.charCount}>{value.length} chars</Text>
  </View>
);

/** Single/choice option picker for question-based tasks */
const OptionsSubmissionInput = ({
  question,
  options,
  selected,
  onSelect,
}: {
  question: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string) => void;
}) => (
  <View style={verifyStyles.optionsWrapper}>
    {!!question && <Text style={verifyStyles.optionsQuestion}>{question}</Text>}
    {options.map((opt) => {
      const isSelected = selected === opt;
      return (
        <TouchableOpacity
          key={opt}
          style={[
            verifyStyles.optionRow,
            isSelected && verifyStyles.optionRowSelected,
          ]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.8}
        >
          <View
            style={[
              verifyStyles.radioOuter,
              isSelected && verifyStyles.radioOuterSelected,
            ]}
          >
            {isSelected && <View style={verifyStyles.radioInner} />}
          </View>
          <Text
            style={[
              verifyStyles.optionText,
              isSelected && verifyStyles.optionTextSelected,
            ]}
          >
            {opt}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ── Main component ─────────────────────────────────────────────────────────────

interface TaskAccordionItemProps {
  task: Task;
  userId?: string | null;
  onSubmit?: (
    task: Task,
    payload: {
      text?: string;
      imageUri?: string;
      base64?: string;
      mimeType?: string;
      selectedOption?: string;
    },
  ) => void;
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
  const [textValue, setTextValue] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

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
  const primaryFormat = submissionFormats[0] ?? "text";
  const firstQuestion = Array.isArray(task.questions)
    ? task.questions[0]
    : null;
  const effectiveType = resolveEffectiveType(task, primaryFormat);
  const isImage = effectiveType === "image";
  const isOptions = effectiveType === "options";
  const primaryMeta = isOptions ? OPTIONS_META : getFormatMeta(primaryFormat);
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
    if (expanded) setVerifying(false); // collapse resets verify panel
    setExpanded((p) => !p);
  };

  const handleSubmit = async () => {
    if (isImage && !imageBase64) {
      Alert.alert("Required", "Please take a photo first.");
      return;
    }
    if (isOptions && !selectedOption) {
      Alert.alert("Required", "Please select an option.");
      return;
    }
    if (!isImage && !isOptions && textValue.trim().length < 5) {
      Alert.alert("Required", "Please enter at least 5 characters.");
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

    // Notify parent (kept for backwards-compat / local bookkeeping)
    onSubmit?.(task, {
      text: textValue,
      imageUri: imageUri ?? undefined,
      base64: imageBase64 ?? undefined,
      mimeType: imageMime,
      selectedOption: selectedOption ?? undefined,
    });

    setSubmitting(true);
    try {
      await submitTaskAnswer(effectiveUserId, {
        assignment_id: task.assignment_id,
        task_id: task.task_id,
        user_id: effectiveUserId,
        submission_type: effectiveType,
        max_score: 1,
        score: 1,
        image_url: isImage
          ? `data:${imageMime};base64,${imageBase64}`
          : undefined,
        text_answer: !isImage && !isOptions ? textValue.trim() : undefined,
        selected_options:
          isOptions && selectedOption ? [selectedOption] : undefined,
      });

      setJustCompleted(true);
      setVerifying(false);
      setTextValue("");
      setImageUri(null);
      setImageBase64(null);
      setSelectedOption(null);
      onSubmitted?.(task);
    } catch (err) {
      Alert.alert(
        "Submission failed",
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
                      {primaryMeta.label}
                    </Text>
                  </View>
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
            {submissionFormats.map((fmt) => {
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
                  <Text style={[styles.formatChipText, { color: meta.color }]}>
                    {meta.label}
                  </Text>
                </View>
              );
            })}
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
                  Task submitted successfully
                </Text>
              </View>
            </View>
          ) : verifying ? (
            <View style={styles.verifyPanel}>
              <Text style={styles.verifyTitle}>
                {isImage
                  ? "Submit a Photo"
                  : isOptions
                    ? (firstQuestion?.question ?? "Answer the Question")
                    : "Type Your Response"}
              </Text>
              <Text style={styles.verifySubtitle}>
                {isImage
                  ? "Use your camera to take a live photo"
                  : isOptions
                    ? "Select the option that applies"
                    : "Describe your response in writing"}
              </Text>

              {isImage ? (
                <CameraCapture
                  onCapture={(b64, uri) => {
                    setImageBase64(b64);
                    setImageUri(uri);
                  }}
                />
              ) : isOptions ? (
                <OptionsSubmissionInput
                  question=""
                  options={(firstQuestion?.options as string[]) ?? []}
                  selected={selectedOption}
                  onSelect={setSelectedOption}
                />
              ) : (
                <TextSubmissionInput
                  value={textValue}
                  onChange={setTextValue}
                  placeholder={`Write your response for "${task.title}"…`}
                />
              )}

              <View style={styles.verifyActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setVerifying(false);
                    setTextValue("");
                    setImageUri(null);
                    setImageBase64(null);
                    setSelectedOption(null);
                  }}
                  activeOpacity={0.8}
                  disabled={submitting}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={submitting}
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
            </View>
          ) : (
            <TouchableOpacity
              style={styles.beginBtn}
              onPress={() => setVerifying(true)}
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
});

const verifyStyles = StyleSheet.create({
  textInputWrapper: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  textInput: {
    fontSize: 13,
    color: "#1E293B",
    minHeight: 90,
    lineHeight: 19,
  },
  charCount: {
    textAlign: "right",
    fontSize: 10,
    color: "#CBD5E1",
    marginTop: 4,
    fontWeight: "600",
  },

  optionsWrapper: { gap: 8 },
  optionsQuestion: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionRowSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: { borderColor: "#2563EB" },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  optionText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  optionTextSelected: { color: "#1E3A8A", fontWeight: "700" },
});
