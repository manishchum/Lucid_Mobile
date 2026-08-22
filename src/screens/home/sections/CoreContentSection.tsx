import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { useVideoPlayer, VideoView } from "expo-video";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { simplifyHindiText } from "./HindiSimplifier";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTenant } from "../../../contex/TenantContext";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";

const SCREEN_WIDTH = Dimensions.get("window").width;

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string;
  type: "video" | "audio" | "image";
  src: string;
  title: string;
  description: string;
}

interface ParsedSection {
  id: string;
  heading: string;
  displayLabel: string; // what shows on the tab
  sectionClass: string;
  subHeadings: Array<{
    title: string;
    paragraphs: string[];
    listItems: string[];
    orderedItems: string[];
    tableData: { headers: string[]; rows: string[][] } | null;
    blockquote: string | null;
    figcaption: string | null;
    media: MediaItem[];
  }>;
  rawBullets: string[]; // top-level <ol> items (objectives, summary, activity)
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<strong[^>]*>/gi, "")
    .replace(/<\/strong>/gi, "")
    .replace(/<em[^>]*>/gi, "")
    .replace(/<\/em>/gi, "")
    .replace(/<b[^>]*>/gi, "")
    .replace(/<\/b>/gi, "")
    .replace(/<i[^>]*>/gi, "")
    .replace(/<\/i>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&deg;/g, "°")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMediaEmbeds(html: string): MediaItem[] {
  const media: MediaItem[] = [];
  if (!html) return media;

  // Matches the opening <figure ... data-media-type="..." ...> tag emitted
  // by the module editor for video/audio/image embeds.
  const figureRegex = /<figure([^>]*data-media-type=[^>]*)>/gi;
  const figureMatches = [...html.matchAll(figureRegex)];

  figureMatches.forEach((match, idx) => {
    const attrs = match[1] ?? "";

    const getAttr = (name: string): string => {
      const m = attrs.match(new RegExp(`data-${name}="([^"]*)"`, "i"));
      return m ? decodeHtmlEntities(m[1]) : "";
    };

    const type = getAttr("media-type").toLowerCase();
    const src = getAttr("media-src");
    const title = getAttr("media-title");
    const description = getAttr("media-description");
    const id = getAttr("media-id") || `media-${idx}`;

    if (!src) return;
    if (type === "video" || type === "audio" || type === "image") {
      media.push({ id, type, src, title, description });
    }
  });

  return media;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function parseTable(tableHtml: string): {
  headers: string[];
  rows: string[][];
} {
  const headers: string[] = [];
  const rows: string[][] = [];
  const thMatches = tableHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/gi) ?? [];
  thMatches.forEach((th) => headers.push(stripTags(th)));
  const trMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
  trMatches.forEach((tr) => {
    const cells = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? [];
    if (cells.length > 0) rows.push(cells.map((td) => stripTags(td)));
  });
  return { headers, rows };
}

function MediaVideoPlayer({
  src,
  title,
  description,
  onPlayingChange,
}: {
  src: string;
  title?: string;
  description?: string;
  onPlayingChange: (playing: boolean) => void;
}) {
  const player = useVideoPlayer(src, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (!player) return;
    const playingSub = player.addListener("playingChange", (evt: any) => {
      onPlayingChange(evt.isPlaying ?? evt);
    });
    return () => playingSub.remove();
  }, [player, onPlayingChange]);

  return (
    <View style={styles.mediaWrapper}>
      <VideoView
        style={styles.mediaVideo}
        player={player}
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
        contentFit="contain"
      />
      {!!title && <Text style={styles.mediaTitle}>{title}</Text>}
      {!!description && (
        <Text style={styles.mediaDescription}>{description}</Text>
      )}
    </View>
  );
}

// ─── Tab label logic ──────────────────────────────────────────────────────────
// Rules (matching your request):
//   • First <section class="learning-objectives"> → "Overview"  (NOT "Objectives")
//   • Numbered sections (Section 1, Section 2 …)  → "Section 1", "Section 2" …
//   • class="activity"                             → "Activity"
//   • class="module-summary"                       → "Summary"
//   • Fallback: first 16 chars of h2

function deriveTabLabel(
  heading: string,
  sectionClass: string,
  sectionIndex: number,
): string {
  const cls = sectionClass.toLowerCase();
  const h = heading.toLowerCase();

  if (cls.includes("learning-objectives") || h.includes("learning objective"))
    return "Overview";
  if (cls.includes("module-summary") || h.includes("module summary"))
    return "Summary";
  if (cls.includes("activity") || h.includes("learning activity"))
    return "Activity";

  // "Section N: ..." headings — extract the number
  const sectionNumMatch = heading.match(/^section\s+(\d+)/i);
  if (sectionNumMatch) return `Section ${sectionNumMatch[1]}`;

  if (heading.length > 18) return heading.slice(0, 16) + "…";
  return heading || `Section ${sectionIndex + 1}`;
}

function getSectionIcon(displayLabel: string): string {
  const l = displayLabel.toLowerCase();
  if (l === "overview") return "target";
  if (l === "summary") return "clipboard-check-outline";
  if (l === "activity") return "pencil-box-outline";
  if (l.startsWith("section")) return "book-open-page-variant-outline";
  return "book-open-page-variant-outline";
}

// ─── HTML parser ──────────────────────────────────────────────────────────────
// Parses content HTML from processedModule.content (the API response).
// Each <section> → one tab. h3 elements inside → sub-sections.

function parseHtmlContent(html: string): ParsedSection[] {
  if (!html) return [];

  const sectionRegex = /<section([^>]*)>([\s\S]*?)<\/section>/gi;
  const sectionMatches = [...html.matchAll(sectionRegex)];

  if (sectionMatches.length === 0) {
    const media = parseMediaEmbeds(html);
    const cleanedHtml = html.replace(
      /<figure[^>]*data-media-type=[^>]*>[\s\S]*?<\/figure>/gi,
      "",
    );
    return [
      {
        id: "main",
        heading: "Content",
        displayLabel: "Content",
        sectionClass: "",
        subHeadings: [
          {
            title: "",
            paragraphs: [stripTags(cleanedHtml)],
            listItems: [],
            orderedItems: [],
            tableData: null,
            blockquote: null,
            figcaption: null,
            media,
          },
        ],
        rawBullets: [],
      },
    ];
  }

  return sectionMatches
    .map((match, idx) => {
      const sectionAttrs = match[1];
      const sectionHtml = match[2];

      const classMatch = sectionAttrs.match(/class="([^"]+)"/);
      const sectionClass = classMatch ? classMatch[1] : "";

      const h2Match = sectionHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
      const heading = h2Match ? stripTags(h2Match[1]) : `Section ${idx + 1}`;

      const displayLabel = deriveTabLabel(heading, sectionClass, idx);

      // Top-level <ol> (learning objectives list, activity steps, summary bullets)
      // Extract from the content BEFORE the first <h3> to avoid matching lists inside h3 sub-sections
      const preH3Content = sectionHtml.split(/<h3/i)[0] || "";
      const topOlMatch = preH3Content.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
      const rawBullets: string[] = [];
      if (topOlMatch) {
        const liMatches =
          topOlMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
        liMatches.forEach((li) => rawBullets.push(stripTags(li)));
      }

      // Top-level <ul> (module-summary uses <ul> not <ol>)
      if (rawBullets.length === 0) {
        const topUlMatch = preH3Content.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
        if (topUlMatch) {
          const liMatches =
            topUlMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
          liMatches.forEach((li) => rawBullets.push(stripTags(li)));
        }
      }

      // Split by h3
      const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
      const h3Matches = [...sectionHtml.matchAll(h3Regex)];

      const subHeadings = h3Matches.map((h3) => {
        const title = stripTags(h3[1]);
        const rawBody = h3[2] ?? "";

        // Extract media embeds from the raw body FIRST, then strip those
        // <figure> blocks out before parsing paragraphs/lists/figcaption —
        // otherwise the media embed's own <figcaption> (which duplicates
        // its data-media-title) gets picked up again as a generic
        // section figcaption and the title appears to repeat.
        const media = parseMediaEmbeds(rawBody);
        const body = rawBody.replace(
          /<figure[^>]*data-media-type=[^>]*>[\s\S]*?<\/figure>/gi,
          "",
        );

        const pMatches = body.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
        const paragraphs = pMatches.map((p) => stripTags(p)).filter(Boolean);

        const ulMatch = body.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
        const listItems: string[] = [];
        if (ulMatch) {
          const liMatches =
            ulMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
          liMatches.forEach((li) => listItems.push(stripTags(li)));
        }

        const olMatch = body.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
        const orderedItems: string[] = [];
        if (olMatch) {
          const liMatches =
            olMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
          liMatches.forEach((li) => orderedItems.push(stripTags(li)));
        }

        const tableMatch = body.match(/<table[^>]*>[\s\S]*?<\/table>/i);
        const tableData = tableMatch ? parseTable(tableMatch[0]) : null;

        const bqMatch = body.match(
          /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i,
        );
        const blockquote = bqMatch ? stripTags(bqMatch[1]) : null;

        const fcMatch = body.match(
          /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i,
        );
        const figcaption = fcMatch ? stripTags(fcMatch[1]) : null;

        return {
          title,
          paragraphs,
          listItems,
          orderedItems,
          tableData,
          blockquote,
          figcaption,
          media,
        };
      });

      // Sections with no h3 — direct paragraphs (module-summary, activity, etc.)
      if (subHeadings.length === 0) {
        const media = parseMediaEmbeds(sectionHtml);
        const cleanedSectionHtml = sectionHtml.replace(
          /<figure[^>]*data-media-type=[^>]*>[\s\S]*?<\/figure>/gi,
          "",
        );
        const pMatches =
          cleanedSectionHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
        const paragraphs = pMatches.map((p) => stripTags(p)).filter(Boolean);
        if (
          paragraphs.length > 0 ||
          rawBullets.length > 0 ||
          media.length > 0
        ) {
          subHeadings.push({
            title: "",
            paragraphs,
            listItems: [],
            orderedItems: [],
            tableData: null,
            blockquote: null,
            figcaption: null,
            media,
          });
        }
      }

      return {
        id: `section-${idx}`,
        heading,
        displayLabel,
        sectionClass,
        subHeadings,
        rawBullets,
      };
    })
    .filter((section) => section.sectionClass !== "activity");
}

type SupportedLang = string;

interface LanguageOption {
  code: SupportedLang;
  label: string; // Native name shown in UI
  englishName: string;
}

const LANGUAGES: LanguageOption[] = [
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

const TAB_LABEL_TRANSLATIONS: Record<string, Record<string, string>> = {
  hi: {
    Overview: "अवलोकन",
    Summary: "सारांश",
    Activity: "गतिविधि",
    Section: "भाग",
  },
  bn: {
    Overview: "সংক্ষিপ্ত বিবরণ",
    Summary: "সারসংক্ষেপ",
    Activity: "কার্যকলাপ",
    Section: "বিভাগ",
  },
  ta: {
    Overview: "கண்ணோட்டம்",
    Summary: "சுருக்கம்",
    Activity: "செயல்பாடு",
    Section: "பகுதி",
  },
  te: {
    Overview: "అవలోకనం",
    Summary: "సారాంశం",
    Activity: "కార్యకలాపం",
    Section: "విభాగం",
  },
  mr: {
    Overview: "आढावा",
    Summary: "सारांश",
    Activity: "कृती",
    Section: "विभाग",
  },
  gu: {
    Overview: "અવલોકન",
    Summary: "સારાંશ",
    Activity: "પ્રવૃત્તિ",
    Section: "વિભાગ",
  },
  kn: {
    Overview: "ಅವಲೋಕನ",
    Summary: "ಸಾರಾಂಶ",
    Activity: "ಚಟುವಟಿಕೆ",
    Section: "ಭಾಗ",
  },
};

const TRANSLATING_MESSAGES: Record<SupportedLang, { native: string; english: string }> = {
  en: { native: "Translating...", english: "Translating..." },
  hi: { native: "अनुवाद किया जा रहा है...", english: "Translating module content to Hindi..." },
  bn: { native: "অনুবাদ করা হচ্ছে...", english: "Translating module content to Bengali..." },
  ta: { native: "மொழிபெயர்க்கப்படுகிறது...", english: "Translating module content to Tamil..." },
  te: { native: "అनुవదించబడుతోంది...", english: "Translating module content to Telugu..." },
  mr: { native: "भाषांतर होत आहे...", english: "Translating module content to Marathi..." },
  gu: { native: "અનુવાદ થઈ રહ્યો છે...", english: "Translating module content to Gujarati..." },
  kn: { native: "ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ...", english: "Translating module content to Kannada..." },
};

async function translateText(
  text: string,
  targetLang: string = "hi",
): Promise<string> {
  if (!text || !text.trim()) return "";
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text.trim())}`;
    const response = await fetch(url);
    if (!response.ok) return text;
    const data = await response.json();
    const translated = (data[0] || []).map((piece: any) => piece[0]).join("");
    return targetLang === "hi" ? simplifyHindiText(translated) : translated;
  } catch (err) {
    console.error("[Translation] Error:", err);
    return text;
  }
}

async function translateTextBatch(
  texts: string[],
  targetLang: string = "hi",
): Promise<string[]> {
  const uniqueTexts = Array.from(new Set(texts.map(t => t.trim()).filter(Boolean)));
  if (uniqueTexts.length === 0) return [];

  const translationMap: Record<string, string> = {};
  const chunkSize = 5;

  for (let i = 0; i < uniqueTexts.length; i += chunkSize) {
    const chunk = uniqueTexts.slice(i, i + chunkSize);
    try {
      const joinedTexts = chunk.join("\n");
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(joinedTexts)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const segments = data[0] || [];

      segments.forEach((seg: any) => {
        if (seg && seg[0] !== undefined && seg[1] !== undefined) {
          const translatedText = String(seg[0]).replace(/\n$/, "");
          const originalText = String(seg[1]).replace(/\n$/, "");
          if (originalText.trim()) {
            translationMap[originalText.trim()] = translatedText.trim();
          }
        }
      });

      // Positional fallback to prevent missing mappings
      chunk.forEach((originalText, index) => {
        const trimmed = originalText.trim();
        if (!translationMap[trimmed] && segments[index]) {
          const trans = String(segments[index][0] || "").replace(/\n$/, "").trim();
          if (trans) {
            translationMap[trimmed] = trans;
          }
        }
      });
    } catch (err) {
      console.error("[Translation Batch] Error translating chunk:", err, chunk);
      chunk.forEach((text) => {
        translationMap[text.trim()] = text;
      });
    }
  }

  return texts.map((t) => {
    const trimmed = t.trim();
    if (!trimmed) return "";
    let trans = translationMap[trimmed] || t;
    if (targetLang === "hi") {
      trans = simplifyHindiText(trans);
    }
    return trans;
  });
}

async function translateAllSectionsBatch(
  sections: ParsedSection[],
  targetLang: string = "hi",
): Promise<ParsedSection[]> {
  const stringsToTranslate: string[] = [];

  const add = (text?: string | null) => {
    if (text && text.trim()) {
      stringsToTranslate.push(text.trim());
    }
  };

  sections.forEach((sec) => {
    add(sec.heading);
    
    const langDict = TAB_LABEL_TRANSLATIONS[targetLang];
    const isPreTranslated = langDict && (
      langDict[sec.displayLabel] || 
      (sec.displayLabel.startsWith("Section ") && langDict["Section"])
    );
    if (!isPreTranslated) {
      add(sec.displayLabel);
    }

    sec.rawBullets.forEach((bullet) => add(bullet));

    sec.subHeadings.forEach((sub) => {
      add(sub.title);
      sub.paragraphs?.forEach((p) => add(p));
      sub.listItems?.forEach((item) => add(item));
      sub.orderedItems?.forEach((item) => add(item));
      add(sub.blockquote);
      add(sub.figcaption);
      if (sub.tableData) {
        sub.tableData.headers.forEach((h) => add(h));
        sub.tableData.rows.forEach((row) => {
          row.forEach((cell) => add(cell));
        });
      }
    });
  });

  const uniqueStrings = Array.from(new Set(stringsToTranslate));
  const translatedStrings = await translateTextBatch(uniqueStrings, targetLang);

  const translationCache: Record<string, string> = {};
  uniqueStrings.forEach((orig, idx) => {
    translationCache[orig] = translatedStrings[idx] || orig;
  });

  const lookup = (text?: string | null): string => {
    if (!text || !text.trim()) return "";
    const trimmed = text.trim();
    return translationCache[trimmed] || text;
  };

  return sections.map((sec) => {
    const translatedSec: ParsedSection = {
      ...sec,
      rawBullets: sec.rawBullets.map((b) => lookup(b)),
      subHeadings: sec.subHeadings.map((sub) => {
        const translatedSub = { ...sub };
        if (sub.title) translatedSub.title = lookup(sub.title);
        if (sub.paragraphs) translatedSub.paragraphs = sub.paragraphs.map((p) => lookup(p));
        if (sub.listItems) translatedSub.listItems = sub.listItems.map((item) => lookup(item));
        if (sub.orderedItems) translatedSub.orderedItems = sub.orderedItems.map((item) => lookup(item));
        if (sub.blockquote) translatedSub.blockquote = lookup(sub.blockquote);
        if (sub.figcaption) translatedSub.figcaption = lookup(sub.figcaption);
        if (sub.tableData) {
          translatedSub.tableData = {
            headers: sub.tableData.headers.map((h) => lookup(h)),
            rows: sub.tableData.rows.map((row) => row.map((cell) => lookup(cell))),
          };
        }
        return translatedSub;
      }),
    };

    if (sec.heading) {
      translatedSec.heading = lookup(sec.heading);
    }

    if (sec.displayLabel) {
      const langDict = TAB_LABEL_TRANSLATIONS[targetLang];
      if (langDict && langDict[sec.displayLabel]) {
        translatedSec.displayLabel = langDict[sec.displayLabel];
      } else if (langDict && sec.displayLabel.startsWith("Section ")) {
        const num = sec.displayLabel.replace("Section ", "");
        translatedSec.displayLabel = `${langDict["Section"]} ${num}`;
      } else {
        translatedSec.displayLabel = lookup(sec.displayLabel);
      }
    }

    return translatedSec;
  });
}

function renderFormattedText(text: string, textStyle: any) {
  const colonIndex = text.indexOf(":");
  if (colonIndex > 0 && colonIndex < 40) {
    const boldPart = text.substring(0, colonIndex + 1);
    const normalPart = text.substring(colonIndex + 1);
    return (
      <Text style={textStyle}>
        <Text style={{ fontWeight: "700", color: "#1e293b" }}>{boldPart}</Text>
        {normalPart}
      </Text>
    );
  }
  return <Text style={textStyle}>{text}</Text>;
}

// ─── Media embed renderer (video / audio / image) ─────────────────────────────

function MediaEmbedView({ media }: { media: MediaItem }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const onAudioStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPositionMillis(status.positionMillis ?? 0);
    setDurationMillis(status.durationMillis ?? 0);
    setIsPlaying(status.isPlaying ?? false);
    if (status.didJustFinish) {
      setIsPlaying(false);
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  };

  const toggleAudioPlayback = async () => {
    try {
      if (!soundRef.current) {
        setIsLoadingAudio(true);
        const { sound } = await Audio.Sound.createAsync(
          { uri: media.src },
          { shouldPlay: true },
          onAudioStatusUpdate,
        );
        soundRef.current = sound;
        setIsLoadingAudio(false);
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.error("[CoreContentSection] Audio playback error:", err);
      setIsLoadingAudio(false);
      Alert.alert("Playback error", "Unable to play this audio file.");
    }
  };

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    if (isVideoPlaying) {
      activateKeepAwakeAsync("CoreContentVideo").catch(() => {});
    } else {
      deactivateKeepAwake("CoreContentVideo").catch(() => {});
    }
    return () => {
      deactivateKeepAwake("CoreContentVideo").catch(() => {});
    };
  }, [isVideoPlaying]);

  if (media.type === "video") {
    return (
      <MediaVideoPlayer
        src={media.src}
        title={media.title}
        description={media.description}
        onPlayingChange={setIsVideoPlaying}
      />
    );
  }

  if (media.type === "image") {
    return (
      <View style={styles.mediaWrapper}>
        <Image
          source={{ uri: media.src }}
          style={styles.mediaImage}
          resizeMode="cover"
        />
        {!!media.title && <Text style={styles.mediaTitle}>{media.title}</Text>}
        {!!media.description && (
          <Text style={styles.mediaDescription}>{media.description}</Text>
        )}
      </View>
    );
  }

  // audio
  const progress =
    durationMillis > 0 ? Math.min(positionMillis / durationMillis, 1) : 0;

  return (
    <View style={styles.mediaWrapper}>
      <View style={styles.audioPlayer}>
        <TouchableOpacity
          onPress={toggleAudioPlayback}
          style={styles.audioPlayButton}
          disabled={isLoadingAudio}
        >
          {isLoadingAudio ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialCommunityIcons
              name={isPlaying ? "pause" : "play"}
              size={20}
              color="white"
            />
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {!!media.title && (
            <Text style={styles.mediaTitle} numberOfLines={1}>
              {media.title}
            </Text>
          )}
          <View style={styles.audioProgressTrack}>
            <View
              style={[
                styles.audioProgressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.audioTimeText}>
            {formatTime(positionMillis)}
            {durationMillis > 0 ? ` / ${formatTime(durationMillis)}` : ""}
          </Text>
        </View>
      </View>
      {!!media.description && (
        <Text style={styles.mediaDescription}>{media.description}</Text>
      )}
    </View>
  );
}

// ─── Sub-section renderer ─────────────────────────────────────────────────────

function SubSection({ sub }: { sub: ParsedSection["subHeadings"][0] }) {
  return (
    <View style={styles.subSection}>
      {sub.title ? <Text style={styles.h3}>{sub.title}</Text> : null}

      {sub.media && sub.media.length > 0 && (
        <View style={styles.mediaList}>
          {sub.media.map((m) => (
            <MediaEmbedView key={m.id} media={m} />
          ))}
        </View>
      )}

      {sub.paragraphs.map((p, i) => (
        <Text key={`p-${i}`} style={styles.para}>
          {p}
        </Text>
      ))}

      {sub.listItems.length > 0 && (
        <View style={styles.listBlock}>
          {sub.listItems.map((item, i) => (
            <View key={`ul-${i}`} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              {renderFormattedText(item, styles.listText)}
            </View>
          ))}
        </View>
      )}

      {sub.orderedItems.length > 0 && (
        <View style={styles.listBlock}>
          {sub.orderedItems.map((item, i) => (
            <View key={`ol-${i}`} style={styles.listRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{i + 1}</Text>
              </View>
              {renderFormattedText(item, styles.listText)}
            </View>
          ))}
        </View>
      )}

      {sub.tableData && sub.tableData.rows.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tableScroll}
        >
          <View>
            {sub.tableData.headers.length > 0 && (
              <View style={styles.tableRow}>
                {sub.tableData.headers.map((h, i) => (
                  <View key={i} style={styles.tableHeaderCell}>
                    <Text style={styles.tableHeaderText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}
            {sub.tableData.rows.map((row, ri) => (
              <View
                key={ri}
                style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}
              >
                {row.map((cell, ci) => (
                  <View
                    key={ci}
                    style={[
                      styles.tableCell,
                      ci === 0 && styles.tableCellFirst,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tableCellText,
                        ci === 0 && styles.tableCellFirstText,
                      ]}
                    >
                      {cell}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {sub.blockquote && (
        <View style={styles.blockquote}>
          <MaterialCommunityIcons
            name="lightbulb-on-outline"
            size={16}
            color="#6366f1"
            style={{ marginBottom: 6 }}
          />
          <Text style={styles.blockquoteText}>{sub.blockquote}</Text>
        </View>
      )}

      {sub.figcaption && (
        <Text style={styles.figcaption}>{sub.figcaption}</Text>
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  isExpanded: boolean;
  onToggle: () => void;
  htmlContent: string | null;
  moduleId?: string | null;
  lang?: SupportedLang;
  onLangChange?: (lang: SupportedLang) => void;
  sections?: ParsedSection[] | null;
  isTranslating?: boolean;
}

export default function CoreContentSection({
  isExpanded,
  onToggle,
  htmlContent,
  moduleId = null,
  lang: langProp,
  onLangChange,
  sections: translatedSectionsProp,
  isTranslating: isTranslatingProp = false,
}: Props) {
  const { company } = useTenant();
  const [activeIdx, setActiveIdx] = useState(0);
  const [localLang, setLocalLang] = useState<SupportedLang>("en");

  const lang = langProp ?? localLang;
  const setLang = onLangChange ?? setLocalLang;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const availableLanguages = useMemo(() => {
    if (!company) return LANGUAGES;

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

    if (!Array.isArray(candidates) || candidates.length === 0) return LANGUAGES;

    const validLangCodes = new Set(LANGUAGES.map((l) => l.code));
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

    const filtered = LANGUAGES.filter((l) => normalized.has(l.code));
    return filtered.length > 0 ? filtered : LANGUAGES;
  }, [company]);

  const rawSections = useMemo(
    () => parseHtmlContent(htmlContent ?? ""),
    [htmlContent],
  );

  const sections = translatedSectionsProp ?? rawSections;
  const isTranslating = isTranslatingProp;

  useEffect(() => {
    setActiveIdx(0);
    setIsDropdownOpen(false);
  }, [htmlContent, sections]);

  const activeSection = sections[activeIdx] ?? null;

  const handleLanguageChange = (newLang: SupportedLang) => {
    setLang(newLang);
  };

  return (
    <View style={[styles.card, isExpanded && styles.cardExpanded]}>
      <TouchableOpacity onPress={onToggle} style={styles.header}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons
            name="book-open-variant"
            size={24}
            color="#6366f1"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Playbook</Text>
          {/* <Text style={styles.subtitle}>
            {sections.length > 0
              ? `${sections.length} section${sections.length > 1 ? "s" : ""} · Tap to read`
              : "Read the core module content."}
          </Text> */}
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color="#94a3b8"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>


          {isTranslating && lang !== "en" ? (
            <View style={styles.translatingOverlay}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.translatingText}>
                {TRANSLATING_MESSAGES[lang]?.native || "Translating..."}
              </Text>
              <Text style={styles.translatingSubtext}>
                {TRANSLATING_MESSAGES[lang]?.english || "Translating module content..."}
              </Text>
            </View>
          ) : !htmlContent || sections.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="text-box-outline"
                size={32}
                color="#CBD5E1"
              />
              <Text style={styles.emptyText}>No content available.</Text>
            </View>
          ) : (
            <>
              {/* ── Section tabs ─────────────────────────────────────────────
                  Overview → Section 1 → Section 2 → … → Activity → Summary
                  Scrolls horizontally when there are many sections. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabScroll}
                contentContainerStyle={styles.tabContent}
              >
                {sections.map((sec, i) => {
                  const isActive = activeIdx === i;
                  const icon = getSectionIcon(sec.displayLabel);
                  return (
                    <TouchableOpacity
                      key={sec.id}
                      onPress={() => setActiveIdx(i)}
                      style={[styles.tab, isActive && styles.activeTab]}
                    >
                      <MaterialCommunityIcons
                        name={icon as any}
                        size={13}
                        color={isActive ? "#4338ca" : "#94a3b8"}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.tabText,
                          isActive && styles.activeTabText,
                        ]}
                      >
                        {sec.displayLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* ── Active section body ───────────────────────────────────── */}
              {activeSection && (
                <ScrollView
                  style={styles.bodyScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  <View style={styles.body}>
                    {/* Section heading — for "Overview" we show "Overview", not raw h2 */}
                    <Text style={styles.h2}>
                      {rawSections[activeIdx]?.displayLabel === "Overview"
                        ? activeSection.displayLabel
                        : activeSection.heading}
                    </Text>

                    {/* Numbered items from top-level <ol> or <ul>
                        (objectives list on Overview, bullets on Summary) */}
                    {activeSection.rawBullets.length > 0 && (
                      <View style={styles.objectivesBlock}>
                        {activeSection.rawBullets.map((b, i) => (
                          <View key={i} style={styles.objectiveRow}>
                            <View style={styles.objectiveBadge}>
                              <Text style={styles.objectiveBadgeText}>
                                {i + 1}
                              </Text>
                            </View>
                            {renderFormattedText(b, styles.objectiveText)}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* h3 sub-sections */}
                    {activeSection.subHeadings.map((sub, i) => (
                      <SubSection key={i} sub={sub} />
                    ))}
                  </View>
                </ScrollView>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_WIDTH = Math.max(120, (SCREEN_WIDTH - 64) / 3);

const styles = StyleSheet.create({
  mediaList: { marginBottom: 12, gap: 12 },
  mediaWrapper: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#f8fafc",
    marginBottom: 4,
    overflow: "hidden",
    alignSelf: "stretch",
  },
  mediaVideo: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
    backgroundColor: "#020617",
  },
  mediaImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  mediaTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 8,
  },
  mediaDescription: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  audioPlayer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  audioProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
    marginTop: 6,
  },
  audioProgressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#6366f1",
  },
  audioTimeText: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  cardExpanded: {
    borderColor: "#c7d2fe",
    // elevation: 3,
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  header: { flexDirection: "row", alignItems: "center", padding: 16 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#1e293b" },
  subtitle: { fontSize: 13, color: "#64748b", marginTop: 2 },
  content: { paddingBottom: 20 },

  // ── Language Selector ─────────────────────────────────────────────────────
  langSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fafafc",
  },
  langLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginRight: 8,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    minWidth: 140,
    gap: 6,
  },
  dropdownButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownMenu: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "85%",
    maxWidth: 320,
    maxHeight: "60%",
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  dropdownMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
    marginBottom: 8,
  },
  dropdownMenuTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  dropdownScroll: {
    maxHeight: 280,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginVertical: 2,
  },
  dropdownItemActive: {
    backgroundColor: "#eef2ff",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },
  dropdownItemTextActive: {
    color: "#6366f1",
    fontWeight: "600",
  },

  // ── Translating Loader ────────────────────────────────────────────────────
  translatingOverlay: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  translatingText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 12,
  },
  translatingSubtext: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabScroll: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tabContent: { paddingHorizontal: 12, gap: 2, paddingBottom: 0 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    marginBottom: -1,
  },
  activeTab: { borderBottomColor: "#4338ca" },
  tabText: { fontSize: 12, fontWeight: "600", color: "#94a3b8" },
  activeTabText: { color: "#4338ca" },

  // ── Body ──────────────────────────────────────────────────────────────────
  bodyScroll: { maxHeight: 560 },
  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  empty: { paddingVertical: 30, alignItems: "center", gap: 10 },
  emptyText: { color: "#94A3B8", fontSize: 14 },

  // Section heading
  h2: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 16,
    lineHeight: 26,
  },

  // ── Objectives / bullet list (top-level ol / ul) ──────────────────────────
  objectivesBlock: { gap: 12, marginBottom: 16 },
  objectiveRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  objectiveBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  objectiveBadgeText: { fontSize: 11, fontWeight: "800", color: "#6366f1" },
  objectiveText: { flex: 1, fontSize: 14, color: "#475569", lineHeight: 22 },

  // ── Sub-section ───────────────────────────────────────────────────────────
  subSection: { marginBottom: 24 },
  h3: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 10,
    marginTop: 2,
    lineHeight: 22,
  },
  para: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 23,
    marginBottom: 10,
  },

  // ── Lists ─────────────────────────────────────────────────────────────────
  listBlock: { gap: 8, marginBottom: 12, marginTop: 2, paddingLeft: 2 },
  listRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  bullet: { color: "#6366f1", fontSize: 16, lineHeight: 22, marginTop: 1 },
  listText: { flex: 1, fontSize: 14, color: "#475569", lineHeight: 22 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  stepBadgeText: { fontSize: 10, fontWeight: "700", color: "#64748b" },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableScroll: {
    marginVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tableRow: { flexDirection: "row" },
  tableRowAlt: { backgroundColor: "#F8FAFC" },
  tableHeaderCell: {
    width: CELL_WIDTH,
    padding: 10,
    backgroundColor: "#EEF2FF",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  tableHeaderText: { fontSize: 12, fontWeight: "700", color: "#4338ca" },
  tableCell: {
    width: CELL_WIDTH,
    padding: 10,
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  tableCellFirst: { backgroundColor: "#fafbff" },
  tableCellText: { fontSize: 13, color: "#374151", lineHeight: 19 },
  tableCellFirstText: { fontWeight: "600", color: "#1e293b" },

  // ── Blockquote ────────────────────────────────────────────────────────────
  blockquote: {
    backgroundColor: "#f0f9ff",
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  blockquoteText: { fontSize: 13, color: "#1e40af", lineHeight: 20 },

  // ── Figcaption ────────────────────────────────────────────────────────────
  figcaption: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 4,
  },
});
