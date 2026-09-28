import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GC } from "./GamificationColors";

interface DrillProps {
  drillData: any;
  isCompleted: boolean;
  earnedXp?: number;
  onComplete: (wrong_attempts: number, completion_time_seconds: number) => void;
}

export default function AuditSpotterDrill({
  drillData,
  isCompleted,
  earnedXp,
  onComplete,
}: DrillProps) {
  const [startTime] = useState(Date.now());
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(isCompleted);
  const [result, setResult] = useState<"correct" | "wrong" | null>(
    isCompleted ? "correct" : null
  );

  const documentTitle = drillData?.document_title || "Internal Memo";
  const sections: any[] = drillData?.sections || [];
  const totalRedFlags: number = drillData?.total_red_flags || 0;

  const toggleFlag = (id: string) => {
    if (submitted) return;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    const correctFlags = new Set(
      sections.filter((s) => s.is_red_flag).map((s) => s.id)
    );
    const userFlags = flagged;

    const allCorrect =
      userFlags.size === correctFlags.size &&
      [...userFlags].every((id) => correctFlags.has(id));

    setSubmitted(true);
    if (allCorrect) {
      setResult("correct");
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimeout(() => onComplete(wrongAttempts, elapsed), 600);
    } else {
      setWrongAttempts((p) => p + 1);
      setResult("wrong");
      setTimeout(() => {
        setSubmitted(false);
        setResult(null);
        setFlagged(new Set());
      }, 1800);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.docHeader}>
        <MaterialCommunityIcons name="file-document-outline" size={20} color={GC.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.docTitle}>{documentTitle}</Text>
          <Text style={styles.docSubtitle}>
            Spot {totalRedFlags} red flag{totalRedFlags !== 1 ? "s" : ""} — tap to flag
          </Text>
        </View>
        <View style={styles.flagCountBadge}>
          <Text style={styles.flagCountText}>{flagged.size}/{totalRedFlags}</Text>
        </View>
      </View>

      {sections.map((sec) => {
        const isFlagged = flagged.has(sec.id);
        const showResult = submitted;
        const isCorrectFlag = sec.is_red_flag && showResult;
        const isFalseFlag = !sec.is_red_flag && isFlagged && showResult;

        return (
          <TouchableOpacity
            key={sec.id}
            onPress={() => toggleFlag(sec.id)}
            style={[
              styles.section,
              isFlagged && styles.sectionFlagged,
              isCorrectFlag && isFlagged && styles.sectionCorrect,
              isFalseFlag && styles.sectionWrong,
              isCorrectFlag && !isFlagged && submitted && styles.sectionMissed,
            ]}
            activeOpacity={0.85}
          >
            <Text style={styles.sectionText}>{sec.text}</Text>
            {isFlagged && (
              <MaterialCommunityIcons name="flag" size={16} color={
                isCorrectFlag ? GC.success : GC.danger
              } />
            )}
            {isCorrectFlag && !isFlagged && submitted && (
              <MaterialCommunityIcons name="flag-outline" size={16} color={GC.gold} />
            )}
            {sec.is_red_flag && isFlagged && sec.flag_reason && submitted && (
              <Text style={styles.flagReason}>{sec.flag_reason}</Text>
            )}
          </TouchableOpacity>
        );
      })}

      {!isCompleted && !submitted && (
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>SUBMIT FLAGS</Text>
          <MaterialCommunityIcons name="send" size={18} color={GC.bg} />
        </TouchableOpacity>
      )}

      {result === "wrong" && (
        <View style={styles.wrongBanner}>
          <MaterialCommunityIcons name="close-circle" size={16} color={GC.danger} />
          <Text style={styles.wrongBannerText}>
            Not quite! Review and try again.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  docHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: GC.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: GC.border,
  },
  docTitle: {
    color: GC.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  docSubtitle: {
    color: GC.textMuted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  flagCountBadge: {
    backgroundColor: GC.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: GC.danger,
  },
  flagCountText: {
    color: GC.danger,
    fontSize: 13,
    fontWeight: "900",
  },
  section: {
    backgroundColor: GC.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: GC.border,
    gap: 8,
  },
  sectionFlagged: {
    borderColor: GC.danger,
    backgroundColor: "#200808",
  },
  sectionCorrect: {
    borderColor: GC.success,
    backgroundColor: "#052E16",
  },
  sectionWrong: {
    borderColor: GC.danger,
    backgroundColor: "#2D0808",
  },
  sectionMissed: {
    borderColor: GC.gold,
    backgroundColor: "#1C1200",
  },
  sectionText: {
    color: GC.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "500",
  },
  flagReason: {
    color: GC.success,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    lineHeight: 18,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GC.danger,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
  },
  submitBtnText: {
    color: GC.textPrimary,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  wrongBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2D0808",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: GC.danger,
  },
  wrongBannerText: {
    color: GC.danger,
    fontSize: 13,
    fontWeight: "700",
  },
});
