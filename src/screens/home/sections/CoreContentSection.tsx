import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedSection {
  id: string;
  heading: string;
  displayLabel: string;   // what shows on the tab
  sectionClass: string;
  subHeadings: Array<{
    title: string;
    paragraphs: string[];
    listItems: string[];
    orderedItems: string[];
    tableData: { headers: string[]; rows: string[][] } | null;
    blockquote: string | null;
    figcaption: string | null;
  }>;
  rawBullets: string[];   // top-level <ol> items (objectives, summary, activity)
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html
    .replace(/<strong[^>]*>/gi, '').replace(/<\/strong>/gi, '')
    .replace(/<em[^>]*>/gi, '').replace(/<\/em>/gi, '')
    .replace(/<b[^>]*>/gi, '').replace(/<\/b>/gi, '')
    .replace(/<i[^>]*>/gi, '').replace(/<\/i>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&deg;/g, '°').replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function parseTable(tableHtml: string): { headers: string[]; rows: string[][] } {
  const headers: string[] = [];
  const rows: string[][] = [];
  const thMatches = tableHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/gi) ?? [];
  thMatches.forEach(th => headers.push(stripTags(th)));
  const trMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
  trMatches.forEach(tr => {
    const cells = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? [];
    if (cells.length > 0) rows.push(cells.map(td => stripTags(td)));
  });
  return { headers, rows };
}

// ─── Tab label logic ──────────────────────────────────────────────────────────
// Rules (matching your request):
//   • First <section class="learning-objectives"> → "Overview"  (NOT "Objectives")
//   • Numbered sections (Section 1, Section 2 …)  → "Section 1", "Section 2" …
//   • class="activity"                             → "Activity"
//   • class="module-summary"                       → "Summary"
//   • Fallback: first 16 chars of h2

function deriveTabLabel(heading: string, sectionClass: string, sectionIndex: number): string {
  const cls = sectionClass.toLowerCase();
  const h   = heading.toLowerCase();

  if (cls.includes('learning-objectives') || h.includes('learning objective')) return 'Overview';
  if (cls.includes('module-summary')      || h.includes('module summary'))     return 'Summary';
  if (cls.includes('activity')            || h.includes('learning activity'))  return 'Activity';

  // "Section N: ..." headings — extract the number
  const sectionNumMatch = heading.match(/^section\s+(\d+)/i);
  if (sectionNumMatch) return `Section ${sectionNumMatch[1]}`;

  if (heading.length > 18) return heading.slice(0, 16) + '…';
  return heading || `Section ${sectionIndex + 1}`;
}

function getSectionIcon(displayLabel: string): string {
  const l = displayLabel.toLowerCase();
  if (l === 'overview')  return 'target';
  if (l === 'summary')   return 'clipboard-check-outline';
  if (l === 'activity')  return 'pencil-box-outline';
  if (l.startsWith('section')) return 'book-open-page-variant-outline';
  return 'book-open-page-variant-outline';
}

// ─── HTML parser ──────────────────────────────────────────────────────────────
// Parses content HTML from processedModule.content (the API response).
// Each <section> → one tab. h3 elements inside → sub-sections.

function parseHtmlContent(html: string): ParsedSection[] {
  if (!html) return [];

  const sectionRegex = /<section([^>]*)>([\s\S]*?)<\/section>/gi;
  const sectionMatches = [...html.matchAll(sectionRegex)];

  if (sectionMatches.length === 0) {
    return [{
      id: 'main', heading: 'Content', displayLabel: 'Content', sectionClass: '',
      subHeadings: [{
        title: '', paragraphs: [stripTags(html)],
        listItems: [], orderedItems: [],
        tableData: null, blockquote: null, figcaption: null,
      }],
      rawBullets: [],
    }];
  }

  return sectionMatches.map((match, idx) => {
    const sectionAttrs = match[1];
    const sectionHtml  = match[2];

    const classMatch  = sectionAttrs.match(/class="([^"]+)"/);
    const sectionClass = classMatch ? classMatch[1] : '';

    const h2Match = sectionHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const heading = h2Match ? stripTags(h2Match[1]) : `Section ${idx + 1}`;

    const displayLabel = deriveTabLabel(heading, sectionClass, idx);

    // Top-level <ol> (learning objectives list, activity steps, summary bullets)
    const topOlMatch = sectionHtml.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
    const rawBullets: string[] = [];
    if (topOlMatch) {
      const liMatches = topOlMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
      liMatches.forEach(li => rawBullets.push(stripTags(li)));
    }

    // Top-level <ul> (module-summary uses <ul> not <ol>)
    if (rawBullets.length === 0) {
      const topUlMatch = sectionHtml.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
      if (topUlMatch) {
        const liMatches = topUlMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
        liMatches.forEach(li => rawBullets.push(stripTags(li)));
      }
    }

    // Split by h3
    const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
    const h3Matches = [...sectionHtml.matchAll(h3Regex)];

    const subHeadings = h3Matches.map(h3 => {
      const title = stripTags(h3[1]);
      const body  = h3[2] ?? '';

      const pMatches = body.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
      const paragraphs = pMatches.map(p => stripTags(p)).filter(Boolean);

      const ulMatch = body.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
      const listItems: string[] = [];
      if (ulMatch) {
        const liMatches = ulMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
        liMatches.forEach(li => listItems.push(stripTags(li)));
      }

      const olMatch = body.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
      const orderedItems: string[] = [];
      if (olMatch) {
        const liMatches = olMatch[1].match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
        liMatches.forEach(li => orderedItems.push(stripTags(li)));
      }

      const tableMatch = body.match(/<table[^>]*>[\s\S]*?<\/table>/i);
      const tableData = tableMatch ? parseTable(tableMatch[0]) : null;

      const bqMatch = body.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
      const blockquote = bqMatch ? stripTags(bqMatch[1]) : null;

      const fcMatch = body.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i);
      const figcaption = fcMatch ? stripTags(fcMatch[1]) : null;

      return { title, paragraphs, listItems, orderedItems, tableData, blockquote, figcaption };
    });

    // Sections with no h3 — direct paragraphs (module-summary, activity, etc.)
    if (subHeadings.length === 0) {
      const pMatches = sectionHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
      const paragraphs = pMatches.map(p => stripTags(p)).filter(Boolean);
      if (paragraphs.length > 0 || rawBullets.length > 0) {
        subHeadings.push({
          title: '', paragraphs, listItems: [], orderedItems: [],
          tableData: null, blockquote: null, figcaption: null,
        });
      }
    }

    return { id: `section-${idx}`, heading, displayLabel, sectionClass, subHeadings, rawBullets };
  });
}

// ─── Sub-section renderer ─────────────────────────────────────────────────────

function SubSection({ sub }: { sub: ParsedSection['subHeadings'][0] }) {
  return (
    <View style={styles.subSection}>
      {sub.title ? <Text style={styles.h3}>{sub.title}</Text> : null}

      {sub.paragraphs.map((p, i) => (
        <Text key={`p-${i}`} style={styles.para}>{p}</Text>
      ))}

      {sub.listItems.length > 0 && (
        <View style={styles.listBlock}>
          {sub.listItems.map((item, i) => (
            <View key={`ul-${i}`} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{item}</Text>
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
              <Text style={styles.listText}>{item}</Text>
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
              <View key={ri} style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}>
                {row.map((cell, ci) => (
                  <View key={ci} style={[styles.tableCell, ci === 0 && styles.tableCellFirst]}>
                    <Text style={[styles.tableCellText, ci === 0 && styles.tableCellFirstText]}>
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
            name="lightbulb-on-outline" size={16} color="#6366f1"
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
}

export default function CoreContentSection({ isExpanded, onToggle, htmlContent }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  const sections = useMemo(() => parseHtmlContent(htmlContent ?? ''), [htmlContent]);
  const activeSection = sections[activeIdx] ?? null;

  React.useEffect(() => { setActiveIdx(0); }, [htmlContent]);

  return (
    <View style={[styles.card, isExpanded && styles.cardExpanded]}>
      <TouchableOpacity onPress={onToggle} style={styles.header}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="book-open-variant" size={24} color="#6366f1" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title}>Core Content</Text>
          <Text style={styles.subtitle}>
            {sections.length > 0
              ? `${sections.length} section${sections.length > 1 ? 's' : ''} · Tap to read`
              : 'Read the core module content.'}
          </Text>
        </View>
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24} color="#94a3b8"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          {!htmlContent || sections.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="text-box-outline" size={32} color="#CBD5E1" />
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
                        color={isActive ? '#4338ca' : '#94a3b8'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.tabText, isActive && styles.activeTabText]}>
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
                      {activeSection.displayLabel === 'Overview'
                        ? 'Overview'
                        : activeSection.heading}
                    </Text>

                    {/* Numbered items from top-level <ol> or <ul>
                        (objectives list on Overview, bullets on Summary) */}
                    {activeSection.rawBullets.length > 0 && (
                      <View style={styles.objectivesBlock}>
                        {activeSection.rawBullets.map((b, i) => (
                          <View key={i} style={styles.objectiveRow}>
                            <View style={styles.objectiveBadge}>
                              <Text style={styles.objectiveBadgeText}>{i + 1}</Text>
                            </View>
                            <Text style={styles.objectiveText}>{b}</Text>
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
  card: {
    backgroundColor: 'white', borderRadius: 16,
    borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: '#c7d2fe', elevation: 3,
    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  content: { paddingBottom: 20 },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  tabScroll: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabContent: { paddingHorizontal: 12, gap: 2, paddingBottom: 0 },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 10,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  activeTab: { borderBottomColor: '#4338ca' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  activeTabText: { color: '#4338ca' },

  // ── Body ──────────────────────────────────────────────────────────────────
  bodyScroll: { maxHeight: 560 },
  body: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  empty: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  emptyText: { color: '#94A3B8', fontSize: 14 },

  // Section heading
  h2: {
    fontSize: 18, fontWeight: '800', color: '#1e293b',
    marginBottom: 16, lineHeight: 26,
  },

  // ── Objectives / bullet list (top-level ol / ul) ──────────────────────────
  objectivesBlock: { gap: 12, marginBottom: 16 },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  objectiveBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  objectiveBadgeText: { fontSize: 11, fontWeight: '800', color: '#6366f1' },
  objectiveText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 22 },

  // ── Sub-section ───────────────────────────────────────────────────────────
  subSection: { marginBottom: 24 },
  h3: {
    fontSize: 15, fontWeight: '700', color: '#1e293b',
    marginBottom: 10, marginTop: 2, lineHeight: 22,
  },
  para: {
    fontSize: 14, color: '#475569', lineHeight: 23,
    marginBottom: 10,
  },

  // ── Lists ─────────────────────────────────────────────────────────────────
  listBlock: { gap: 8, marginBottom: 12, marginTop: 2, paddingLeft: 2 },
  listRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { color: '#6366f1', fontSize: 16, lineHeight: 22, marginTop: 1 },
  listText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 22 },
  stepBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    marginTop: 1, flexShrink: 0,
  },
  stepBadgeText: { fontSize: 10, fontWeight: '700', color: '#64748b' },

  // ── Table ─────────────────────────────────────────────────────────────────
  tableScroll: {
    marginVertical: 12, borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  tableRow: { flexDirection: 'row' },
  tableRowAlt: { backgroundColor: '#F8FAFC' },
  tableHeaderCell: {
    width: CELL_WIDTH, padding: 10,
    backgroundColor: '#EEF2FF',
    borderRightWidth: 1, borderRightColor: '#e2e8f0',
  },
  tableHeaderText: { fontSize: 12, fontWeight: '700', color: '#4338ca' },
  tableCell: {
    width: CELL_WIDTH, padding: 10,
    borderRightWidth: 1, borderRightColor: '#f1f5f9',
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  tableCellFirst: { backgroundColor: '#fafbff' },
  tableCellText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  tableCellFirstText: { fontWeight: '600', color: '#1e293b' },

  // ── Blockquote ────────────────────────────────────────────────────────────
  blockquote: {
    backgroundColor: '#f0f9ff', borderLeftWidth: 4,
    borderLeftColor: '#6366f1', borderRadius: 8,
    padding: 14, marginTop: 8, marginBottom: 4,
  },
  blockquoteText: { fontSize: 13, color: '#1e40af', lineHeight: 20 },

  // ── Figcaption ────────────────────────────────────────────────────────────
  figcaption: {
    fontSize: 12, color: '#94a3b8',
    textAlign: 'center', fontStyle: 'italic', marginTop: 4,
  },
});