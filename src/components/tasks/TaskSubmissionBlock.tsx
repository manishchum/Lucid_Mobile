import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import CameraCapture from "../camera/CamerCapture";
import VideoCapture from "../camera/VideoCapture";
import AudioRecorder from "../camera/AudioRecorder";
import { SubmissionFormat, TaskQuestion } from "../../api/users";
import { TextInput } from "react-native";

export interface FormatAnswerLocal {
  text?: string;
  image?: { uri: string; base64: string; mime: string };
  video?: { uri: string; mime: string };
  audio?: { uri: string; mime: string };
  optionSelections?: Record<string, string | string[]>;
}

export const emptyAnswer = (): FormatAnswerLocal => ({ optionSelections: {} });

export const toFormatList = (
  fmt: SubmissionFormat | SubmissionFormat[] | undefined | null,
): SubmissionFormat[] => {
  if (!fmt) return [];
  return Array.isArray(fmt) ? fmt : [fmt];
};

export const isFormatAnswered = (
  format: SubmissionFormat,
  questions: TaskQuestion[],
  value: FormatAnswerLocal | undefined,
): boolean => {
  if (!value) return false;
  switch (format) {
    case "image":
      return !!value.image;
    case "video":
      return !!value.video;
    case "audio":
      return !!value.audio;
    case "text":
      return (value.text ?? "").trim().length >= 5;
    case "multiple_choice":
      if (!questions.length) return false;
      return questions.every((q) => {
        const sel = value.optionSelections?.[q.id];
        return q.type === "multiple"
          ? Array.isArray(sel) && sel.length > 0
          : typeof sel === "string" && sel.length > 0;
      });
    default:
      return false;
  }
};

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
  multiple_choice: {
    icon: "format-list-bulleted",
    color: "#D97706",
    bg: "#FFFBEB",
    label: "Options",
  },
  bundle: {
    icon: "layers-outline",
    color: "#4338CA",
    bg: "#EEF2FF",
    label: "Bundle",
  },
};

export const getFormatMeta = (fmt: SubmissionFormat) =>
  FORMAT_META[fmt] ?? FORMAT_META.text;

const SingleChoice = ({
  question,
  selected,
  onSelect,
}: {
  question: TaskQuestion;
  selected: string | null;
  onSelect: (v: string) => void;
}) => (
  <View style={s.optionsWrapper}>
    {!!question.question && (
      <Text style={s.optionsQuestion}>{question.question}</Text>
    )}
    {question.options.map((opt) => {
      const isSelected = selected === opt;
      return (
        <TouchableOpacity
          key={opt}
          style={[s.optionRow, isSelected && s.optionRowSelected]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.8}
        >
          <View style={[s.radioOuter, isSelected && s.radioOuterSelected]}>
            {isSelected && <View style={s.radioInner} />}
          </View>
          <Text style={[s.optionText, isSelected && s.optionTextSelected]}>
            {opt}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const MultiChoice = ({
  question,
  selected,
  onToggle,
}: {
  question: TaskQuestion;
  selected: string[];
  onToggle: (v: string) => void;
}) => (
  <View style={s.optionsWrapper}>
    {!!question.question && (
      <Text style={s.optionsQuestion}>{question.question}</Text>
    )}
    {question.options.map((opt) => {
      const isSelected = selected.includes(opt);
      return (
        <TouchableOpacity
          key={opt}
          style={[s.optionRow, isSelected && s.optionRowSelected]}
          onPress={() => onToggle(opt)}
          activeOpacity={0.8}
        >
          <View style={[s.checkboxOuter, isSelected && s.radioOuterSelected]}>
            {isSelected && (
              <MaterialCommunityIcons name="check" size={12} color="#2563EB" />
            )}
          </View>
          <Text style={[s.optionText, isSelected && s.optionTextSelected]}>
            {opt}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

interface TaskSubmissionBlockProps {
  format: SubmissionFormat;
  questions: TaskQuestion[];
  value: FormatAnswerLocal;
  onChange: (next: FormatAnswerLocal) => void;
  textPlaceholder?: string;
}

export default function TaskSubmissionBlock({
  format,
  questions,
  value,
  onChange,
  textPlaceholder,
}: TaskSubmissionBlockProps) {
  const meta = getFormatMeta(format);

  if (format === "image") {
    return (
      <CameraCapture
        onCapture={(b64, uri) =>
          onChange({
            ...value,
            image:
              b64 && uri ? { uri, base64: b64, mime: "image/jpeg" } : undefined,
          })
        }
      />
    );
  }

  if (format === "video") {
    return (
      <VideoCapture
        onCapture={(uri, mime) =>
          onChange({ ...value, video: uri && mime ? { uri, mime } : undefined })
        }
      />
    );
  }

  if (format === "audio") {
    return (
      <AudioRecorder
        onCapture={(uri, mime) =>
          onChange({ ...value, audio: uri && mime ? { uri, mime } : undefined })
        }
      />
    );
  }

  if (format === "text") {
    return (
      <View style={s.textInputWrapper}>
        <MaterialCommunityIcons
          name="pencil-outline"
          size={16}
          color="#94A3B8"
          style={{ marginBottom: 6 }}
        />
        <TextInput
          style={s.textInput}
          multiline
          numberOfLines={4}
          value={value.text ?? ""}
          onChangeText={(v) => onChange({ ...value, text: v })}
          placeholder={textPlaceholder ?? "Write your response…"}
          placeholderTextColor="#CBD5E1"
          textAlignVertical="top"
        />
        <Text style={s.charCount}>{(value.text ?? "").length} chars</Text>
      </View>
    );
  }

  if (format === "multiple_choice") {
    if (!questions.length) {
      return (
        <Text style={{ fontSize: 12, color: "#94A3B8" }}>
          No questions configured for this task.
        </Text>
      );
    }
    return (
      <View style={{ gap: 14 }}>
        {questions.map((q) => {
          const sel = value.optionSelections?.[q.id];
          if (q.type === "multiple") {
            const arr = Array.isArray(sel) ? sel : [];
            return (
              <MultiChoice
                key={q.id}
                question={q}
                selected={arr}
                onToggle={(opt) => {
                  const next = arr.includes(opt)
                    ? arr.filter((o) => o !== opt)
                    : [...arr, opt];
                  onChange({
                    ...value,
                    optionSelections: {
                      ...value.optionSelections,
                      [q.id]: next,
                    },
                  });
                }}
              />
            );
          }
          return (
            <SingleChoice
              key={q.id}
              question={q}
              selected={typeof sel === "string" ? sel : null}
              onSelect={(opt) =>
                onChange({
                  ...value,
                  optionSelections: {
                    ...value.optionSelections,
                    [q.id]: opt,
                  },
                })
              }
            />
          );
        })}
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  textInputWrapper: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  textInput: { fontSize: 13, color: "#1E293B", minHeight: 90, lineHeight: 19 },
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  optionRowSelected: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
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
  checkboxOuter: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  optionText: { fontSize: 13, fontWeight: "600", color: "#475569" },
  optionTextSelected: { color: "#1E3A8A", fontWeight: "700" },
});
