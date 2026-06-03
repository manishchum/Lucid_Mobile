import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PodcastSection({ isExpanded, onToggle }: any) {
  const [isPlaying, setPlaying] = useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onToggle} style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: '#FFF7ED' }]}>
          <MaterialCommunityIcons name="headphones" size={22} color="#F59E0B" />
        </View>
        <Text style={styles.title}>Podcast</Text>
        <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color="#94A3B8" />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.body}>
          <Text style={styles.audioLabel}>Module Overview • 5:22</Text>
          <View style={styles.playerRow}>
            <TouchableOpacity onPress={() => setPlaying(!isPlaying)} style={styles.playCircle}>
              <MaterialCommunityIcons name={isPlaying ? "pause" : "play"} size={28} color="white" />
            </TouchableOpacity>
            <View style={styles.progressArea}>
              <View style={styles.track}><View style={[styles.fill, { width: '40%' }]} /></View>
              <View style={styles.timeRow}><Text style={styles.time}>1:45</Text><Text style={styles.time}>-3:37</Text></View>
            </View>
          </View>
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
  body: { padding: 20, paddingTop: 0 },
  audioLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 15 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  playCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  progressArea: { flex: 1 },
  track: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#F59E0B' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { fontSize: 11, color: '#94A3B8', fontWeight: '600' }
});