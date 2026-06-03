import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Flashcard {
  heading: string;
  points: string[];
}

interface Props {
  isExpanded: boolean;
  onToggle: () => void;
  flashcardData: Flashcard[] | null;
}

export default function FlashcardsSection({ isExpanded, onToggle, flashcardData }: Props) {
  const [cardIdx, setCardIdx] = useState(0);
  const [isFlipped, setFlipped] = useState(false);

  const cards: Flashcard[] = flashcardData ?? [];
  const total = cards.length;
  const current = cards[cardIdx];

  const goNext = () => {
    setFlipped(false);
    setCardIdx((i) => Math.min(i + 1, total - 1));
  };
  const goPrev = () => {
    setFlipped(false);
    setCardIdx((i) => Math.max(i - 1, 0));
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onToggle} style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: '#ECFDF5' }]}>
          <MaterialCommunityIcons name="cards-outline" size={22} color="#10B981" />
        </View>
        <Text style={styles.title}>Flashcards</Text>
        {total > 0 && <Text style={styles.count}>{total} cards</Text>}
        <MaterialCommunityIcons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={22} color="#94A3B8"
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.body}>
          {total === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No flashcards available.</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setFlipped(!isFlipped)}
                style={[styles.flashcard, isFlipped && styles.cardBack]}
              >
                <Text style={[styles.tag, isFlipped && { color: '#D1FAE5' }]}>
                  {isFlipped ? 'POINTS' : 'TOPIC'}
                </Text>
                {isFlipped ? (
                  <View style={styles.pointsList}>
                    {current.points.map((point, i) => (
                      <View key={i} style={styles.pointRow}>
                        <Text style={styles.pointBullet}>•</Text>
                        <Text style={styles.pointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.mainText}>{current.heading}</Text>
                )}
                <View style={styles.flipBtn}>
                  <MaterialCommunityIcons
                    name="sync" size={14}
                    color={isFlipped ? 'white' : '#10B981'}
                  />
                  <Text style={[styles.flipLabel, isFlipped && { color: 'white' }]}>
                    Tap to flip
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.controls}>
                <TouchableOpacity
                  style={[styles.ctrl, cardIdx === 0 && styles.ctrlDisabled]}
                  onPress={goPrev} disabled={cardIdx === 0}
                >
                  <MaterialCommunityIcons
                    name="chevron-left" size={24}
                    color={cardIdx === 0 ? '#CBD5E1' : '#1E293B'}
                  />
                </TouchableOpacity>
                <Text style={styles.pageCount}>{cardIdx + 1} / {total}</Text>
                <TouchableOpacity
                  style={[styles.ctrl, cardIdx === total - 1 && styles.ctrlDisabled]}
                  onPress={goNext} disabled={cardIdx === total - 1}
                >
                  <MaterialCommunityIcons
                    name="chevron-right" size={24}
                    color={cardIdx === total - 1 ? '#CBD5E1' : '#1E293B'}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1E293B' },
  count: { fontSize: 12, color: '#64748B', fontWeight: '600', marginRight: 4 },

  body: { padding: 20, paddingTop: 0 },
  emptyState: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { color: '#94A3B8', fontSize: 14 },

  flashcard: {
    minHeight: 200, backgroundColor: '#F0FDF4', borderRadius: 24,
    padding: 24, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#D1FAE5', borderStyle: 'dashed',
  },
  cardBack: { backgroundColor: '#10B981', borderColor: '#10B981', borderStyle: 'solid' },
  tag: { fontSize: 11, fontWeight: '800', color: '#10B981', letterSpacing: 1, marginBottom: 12 },
  mainText: { fontSize: 18, fontWeight: '700', color: '#064E3B', textAlign: 'center', lineHeight: 26 },

  pointsList: { width: '100%', gap: 8 },
  pointRow: { flexDirection: 'row', gap: 8 },
  pointBullet: { color: 'white', fontSize: 14, lineHeight: 20 },
  pointText: { flex: 1, color: 'white', fontSize: 14, lineHeight: 20 },

  flipBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  flipLabel: { fontSize: 12, fontWeight: '600', color: '#10B981' },

  controls: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 30, marginTop: 16,
  },
  ctrl: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
  },
  ctrlDisabled: { opacity: 0.4 },
  pageCount: { fontSize: 14, fontWeight: '700', color: '#64748B' },
});