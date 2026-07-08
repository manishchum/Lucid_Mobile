import { useState, useEffect, useMemo } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { simplifyHindiText } from "../screens/home/sections/HindiSimplifier";

export type SupportedLang = "en" | "hi" | "bn" | "ta" | "te" | "mr" | "gu" | "kn";

export interface Flashcard {
  heading: string;
  points: string[];
}

export interface MediaItem {
  id: string;
  type: "video" | "audio" | "image";
  src: string;
  title: string;
  description: string;
}

export interface ParsedSection {
  id: string;
  heading: string;
  displayLabel: string;
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
  rawBullets: string[];
}

// ─── HTML Parser Utilities ───────────────────────────────────────────────────

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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function parseMediaEmbeds(html: string): MediaItem[] {
  const media: MediaItem[] = [];
  if (!html) return media;

  const figureRegex = /<figure([^>]*data-media-type=[^>]*)>/gi;
  const figureMatches = [...html.matchAll(figureRegex)];

  figureMatches.forEach((match, idx) => {
    const attrs = match[1] ?? "";

    const getAttr = (name: string): string => {
      const m = attrs.match(new RegExp(`data-${name}="([^"]*)"`, "i"));
      return m ? decodeHtmlEntities(m[1]) : "";
    };

    const type = getAttr("media-type").toLowerCase();
    if (type === "video" || type === "audio" || type === "image") {
      media.push({
        id: getAttr("media-id") || `media-${idx}`,
        type,
        src: getAttr("media-src"),
        title: getAttr("media-title"),
        description: getAttr("media-description"),
      });
    }
  });

  return media;
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

  const sectionNumMatch = heading.match(/^section\s+(\d+)/i);
  if (sectionNumMatch) return `Section ${sectionNumMatch[1]}`;

  if (heading.length > 18) return heading.slice(0, 16) + "…";
  return heading || `Section ${sectionIndex + 1}`;
}

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

      const preH3Content = sectionHtml.split(/<h3/i)[0] || "";
      const topOlMatch = preH3Content.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
      const rawBullets: string[] = [];
      if (topOlMatch) {
        const liMatches =
          topOlMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
        liMatches.forEach((li) => rawBullets.push(stripTags(li)));
      }

      if (rawBullets.length === 0) {
        const topUlMatch = preH3Content.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
        if (topUlMatch) {
          const liMatches =
            topUlMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
          liMatches.forEach((li) => rawBullets.push(stripTags(li)));
        }
      }

      const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
      const h3Matches = [...sectionHtml.matchAll(h3Regex)];

      const subHeadings = h3Matches.map((h3) => {
        const title = stripTags(h3[1]);
        const rawBody = h3[2] ?? "";

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

// ─── Batch Translation Utilities ─────────────────────────────────────────────

async function translateTextBatch(
  texts: string[],
  targetLang: string = "hi",
): Promise<string[]> {
  const uniqueTexts = Array.from(new Set(texts.map(t => t.trim()).filter(Boolean)));
  if (uniqueTexts.length === 0) return [];

  const translationMap: Record<string, string> = {};
  const chunkSize = 5; // Safe URL limit

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

// ─── Custom translation hook ───────────────────────────────────────────────

const EMPTY_ARRAY: Flashcard[] = [];

export function useModuleTranslation(
  moduleId: string | null,
  htmlContent: string | null,
  flashcardData: Flashcard[] | null,
  targetLang: SupportedLang,
) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedSections, setTranslatedSections] = useState<ParsedSection[] | null>(null);
  const [translatedFlashcards, setTranslatedFlashcards] = useState<Flashcard[] | null>(null);

  const rawSections = useMemo(() => parseHtmlContent(htmlContent ?? ""), [htmlContent]);
  const rawFlashcards = useMemo(() => flashcardData ?? EMPTY_ARRAY, [flashcardData]);

  useEffect(() => {
    if (targetLang === "en") {
      setTranslatedSections(rawSections);
      setTranslatedFlashcards(rawFlashcards);
      setIsTranslating(false);
      return;
    }

    console.log("[Unified Translation] targetLang:", targetLang, "rawSections:", rawSections.length, "rawFlashcards:", rawFlashcards.length);

    let isCurrent = true;

    const translateModule = async () => {
      if (!moduleId) {
        console.warn("[Unified Translation] translateModule called but moduleId is null/empty");
        return;
      }

      setIsTranslating(true);
      try {
        const cacheKey = `lucid_module_unified_trans_v3_${moduleId}_${targetLang}`;
        const cached = await AsyncStorage.getItem(cacheKey);

        if (cached && isCurrent) {
          const { sections, flashcards } = JSON.parse(cached);
          console.log("[Unified Translation] Loaded cached translation from AsyncStorage for lang:", targetLang);
          setTranslatedSections(sections);
          setTranslatedFlashcards(flashcards);
          setIsTranslating(false);
          return;
        }

        // 1. Gather all unique strings from sections and flashcards
        const stringsToTranslate: string[] = [];

        // From sections:
        rawSections.forEach((sec) => {
          if (sec.heading) stringsToTranslate.push(sec.heading);
          sec.subHeadings.forEach((sub) => {
            if (sub.title) stringsToTranslate.push(sub.title);
            sub.paragraphs.forEach((p) => {
              if (p) stringsToTranslate.push(p);
            });
            sub.listItems.forEach((li) => {
              if (li) stringsToTranslate.push(li);
            });
            sub.orderedItems.forEach((oi) => {
              if (oi) stringsToTranslate.push(oi);
            });
            if (sub.tableData) {
              sub.tableData.headers.forEach((h) => {
                if (h) stringsToTranslate.push(h);
              });
              sub.tableData.rows.forEach((row) => {
                row.forEach((cell) => {
                  if (cell) stringsToTranslate.push(cell);
                });
              });
            }
            if (sub.blockquote) stringsToTranslate.push(sub.blockquote);
            if (sub.figcaption) stringsToTranslate.push(sub.figcaption);
          });
          sec.rawBullets.forEach((b) => {
            if (b) stringsToTranslate.push(b);
          });
        });

        // From flashcards:
        rawFlashcards.forEach((card) => {
          if (card.heading) stringsToTranslate.push(card.heading);
          card.points.forEach((p) => {
            if (p) stringsToTranslate.push(p);
          });
        });

        // 2. Translate unique strings in chunks of 5
        const uniqueStrings = Array.from(new Set(stringsToTranslate.map(s => s.trim()).filter(Boolean)));
        
        console.log(`[Unified Translation] Translating ${uniqueStrings.length} unique strings to ${targetLang}...`);
        const translatedStrings = await translateTextBatch(uniqueStrings, targetLang);

        // 3. Map translated strings back
        const translationMap: Record<string, string> = {};
        uniqueStrings.forEach((orig, idx) => {
          translationMap[orig] = translatedStrings[idx] || orig;
        });

        const lookup = (text?: string | null): string => {
          if (!text || !text.trim()) return "";
          const trimmed = text.trim();
          return translationMap[trimmed] || text;
        };

        // 4. Construct translated sections
        const newSections: ParsedSection[] = rawSections.map((sec) => ({
          ...sec,
          heading: lookup(sec.heading),
          subHeadings: sec.subHeadings.map((sub) => ({
            ...sub,
            title: lookup(sub.title),
            paragraphs: sub.paragraphs.map((p) => lookup(p)),
            listItems: sub.listItems.map((li) => lookup(li)),
            orderedItems: sub.orderedItems.map((oi) => lookup(oi)),
            tableData: sub.tableData
              ? {
                  headers: sub.tableData.headers.map((h) => lookup(h)),
                  rows: sub.tableData.rows.map((row) => row.map((cell) => lookup(cell))),
                }
              : null,
            blockquote: sub.blockquote ? lookup(sub.blockquote) : null,
            figcaption: sub.figcaption ? lookup(sub.figcaption) : null,
          })),
          rawBullets: sec.rawBullets.map((b) => lookup(b)),
        }));

        // 5. Construct translated flashcards
        const newFlashcards: Flashcard[] = rawFlashcards.map((card) => ({
          ...card,
          heading: lookup(card.heading),
          points: card.points.map((p) => lookup(p)),
        }));

        if (isCurrent) {
          setTranslatedSections(newSections);
          setTranslatedFlashcards(newFlashcards);
          
          // Save to cache
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ sections: newSections, flashcards: newFlashcards }),
          );
          console.log(`[Unified Translation] Persisted translation cache for ${targetLang} under key: ${cacheKey}`);
        }
      } catch (err: any) {
        console.error("[Unified Translation] Failed:", err);
        Alert.alert("Translation Failed", err?.message || String(err));
      } finally {
        if (isCurrent) {
          setIsTranslating(false);
        }
      }
    };

    translateModule();

    return () => {
      isCurrent = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, htmlContent, JSON.stringify(flashcardData), targetLang]);

  return {
    isTranslating,
    translatedSections,
    translatedFlashcards,
  };
}
