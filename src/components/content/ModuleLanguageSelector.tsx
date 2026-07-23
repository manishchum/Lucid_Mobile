import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTenant } from "../../contex/TenantContext";

export interface LanguageOption {
  code: string;
  label: string; // Native name shown in UI
  englishName: string;
}

export const ALL_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", englishName: "English" },
  { code: "hi", label: "हिन्दी", englishName: "Hindi" },
  { code: "de", label: "Deutsch", englishName: "German" },
  { code: "ru", label: "Русский", englishName: "Russian" },
  { code: "fr", label: "Français", englishName: "French" },
  { code: "it", label: "Italiano", englishName: "Italian" },
  { code: "es", label: "Español", englishName: "Spanish" },
  { code: "pl", label: "Polski", englishName: "Polish" },
  { code: "uk", label: "Українська", englishName: "Ukrainian" },
  { code: "ro", label: "Română", englishName: "Romanian" },
  { code: "nl", label: "Nederlands", englishName: "Dutch" },
  { code: "bn", label: "বাংলা", englishName: "Bengali" },
  { code: "ta", label: "தமிழ்", englishName: "Tamil" },
  { code: "te", label: "తెలుగు", englishName: "Telugu" },
  { code: "mr", label: "मराठी", englishName: "Marathi" },
  { code: "kn", label: "ಕನ್ನಡ", englishName: "Kannada" },
  { code: "pa", label: "ਪੰਜਾਬੀ", englishName: "Punjabi" },
  { code: "gu", label: "ગુજરાતી", englishName: "Gujarati" },
  { code: "ur", label: "اردو", englishName: "Urdu" },
  { code: "or", label: "ଓଡ଼ିଆ", englishName: "Odia" },
];

const NAME_TO_CODE: Record<string, string> = {
  english: "en",
  hindi: "hi",
  hinglish: "hi",
  german: "de",
  russian: "ru",
  french: "fr",
  italian: "it",
  spanish: "es",
  polish: "pl",
  ukrainian: "uk",
  ukraine: "uk",
  romanian: "ro",
  dutch: "nl",
  bengali: "bn",
  tamil: "ta",
  telugu: "te",
  marathi: "mr",
  kannada: "kn",
  punjabi: "pa",
  gujarati: "gu",
  urdu: "ur",
  odia: "or",
};

interface Props {
  selectedLang: string;
  onSelectLang: (code: string) => void;
}

export default function ModuleLanguageSelector({
  selectedLang,
  onSelectLang,
}: Props) {
  const { company } = useTenant();
  const [modalVisible, setModalVisible] = useState(false);

  const availableLanguages = useMemo(() => {
    if (!company) return ALL_LANGUAGES;

    let candidates =
      (company as any).enabled_languages ||
      (company as any).translation_languages ||
      (company as any).enabledLanguages ||
      (company as any).enabledLanguageCodes ||
      company.languages ||
      (company as any).supported_languages ||
      (company as any).allowed_languages ||
      (company as any).selected_languages ||
      [];

    if (!Array.isArray(candidates) || candidates.length === 0) {
      candidates = Array.isArray(company.subscription_addons)
        ? company.subscription_addons
        : [];
    }

    if (!Array.isArray(candidates) || candidates.length === 0) return ALL_LANGUAGES;

    const validLangCodes = new Set(ALL_LANGUAGES.map((l) => l.code));
    const normalized = new Set<string>();

    for (const raw of candidates) {
      if (!raw) continue;
      const s = String(raw).trim().toLowerCase();

      if (validLangCodes.has(s)) {
        normalized.add(s);
        continue;
      }

      if (NAME_TO_CODE[s]) {
        normalized.add(NAME_TO_CODE[s]);
        continue;
      }
    }

    normalized.add("en");

    const filtered = ALL_LANGUAGES.filter((l) => normalized.has(l.code));
    return filtered.length > 0 ? filtered : ALL_LANGUAGES;
  }, [company]);

  const currentOption =
    availableLanguages.find((l) => l.code === selectedLang) ??
    availableLanguages[0];

  // Don't show selector if 1 or 0 languages available
  if (availableLanguages.length <= 1) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.pillBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="translate" size={16} color="#4F46E5" />
        <Text style={styles.pillText}>{currentOption.label}</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color="#4F46E5" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Select Content Language</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableLanguages}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const active = item.code === selectedLang;
                return (
                  <TouchableOpacity
                    style={[styles.item, active && styles.itemActive]}
                    onPress={() => {
                      onSelectLang(item.code);
                      setModalVisible(false);
                    }}
                  >
                    <Text
                      style={[styles.itemText, active && styles.itemTextActive]}
                    >
                      {item.label}{" "}
                      {item.code !== "en" ? `(${item.englishName})` : ""}
                    </Text>
                    {active && (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color="#4F46E5"
                      />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 340,
    maxHeight: 440,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: "#EEF2FF",
  },
  itemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  itemTextActive: {
    color: "#4F46E5",
    fontWeight: "800",
  },
});
