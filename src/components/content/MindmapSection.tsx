// import React, { useState } from 'react';
// import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons';

// interface MindmapNode {
//   id: string;
//   label: string;
//   x: number;
//   y: number;
// }

// interface MindmapEdge {
//   from: string;
//   to: string;
// }

// interface MindmapData {
//   nodes: MindmapNode[];
//   edges: MindmapEdge[];
// }

// interface Props {
//   isExpanded: boolean;
//   onToggle: () => void;
//   mindmapData: MindmapData | null;
// }

// export default function MindmapSection({ isExpanded, onToggle, mindmapData }: Props) {
//   const [selected, setSelected] = useState<MindmapNode | null>(null);

//   const nodes: MindmapNode[] = mindmapData?.nodes ?? [];
//   const edges: MindmapEdge[] = mindmapData?.edges ?? [];

//   // Find children of a node via edges
//   const childrenOf = (nodeId: string) =>
//     edges
//       .filter((e) => e.from === nodeId)
//       .map((e) => nodes.find((n) => n.id === e.to))
//       .filter(Boolean) as MindmapNode[];

//   // Root nodes — those not appearing as a "to" in any edge
//   const childIds = new Set(edges.map((e) => e.to));
//   const roots = nodes.filter((n) => !childIds.has(n.id));

//   return (
//     <View style={styles.card}>
//       <TouchableOpacity onPress={onToggle} style={styles.header}>
//         <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
//           <MaterialCommunityIcons name="sitemap" size={22} color="#0EA5E9" />
//         </View>
//         <Text style={styles.title}>Mind Map</Text>
//         {nodes.length > 0 && (
//           <Text style={styles.nodeCount}>{nodes.length} nodes</Text>
//         )}
//         <MaterialCommunityIcons
//           name={isExpanded ? 'chevron-up' : 'chevron-down'}
//           size={22} color="#94A3B8"
//         />
//       </TouchableOpacity>

//       {isExpanded && (
//         <View style={styles.body}>
//           {nodes.length === 0 ? (
//             <View style={styles.emptyState}>
//               <Text style={styles.emptyText}>No mind map available.</Text>
//             </View>
//           ) : (
//             <>
//               <ScrollView
//                 horizontal
//                 showsHorizontalScrollIndicator
//                 style={styles.scrollArea}
//               >
//                 <ScrollView showsVerticalScrollIndicator style={{ width: 900 }}>
//                   <View style={styles.canvas}>
//                     {nodes.map((node) => {
//                       const isRoot = roots.some((r) => r.id === node.id);
//                       const isSelected = selected?.id === node.id;
//                       return (
//                         <TouchableOpacity
//                           key={node.id}
//                           onPress={() => setSelected(isSelected ? null : node)}
//                           style={[
//                             styles.node,
//                             isRoot && styles.rootNode,
//                             isSelected && styles.activeNode,
//                             { left: node.x, top: node.y },
//                           ]}
//                         >
//                           <Text
//                             style={[
//                               styles.nodeText,
//                               isRoot && styles.rootNodeText,
//                               isSelected && styles.activeNodeText,
//                             ]}
//                             numberOfLines={3}
//                           >
//                             {node.label}
//                           </Text>
//                         </TouchableOpacity>
//                       );
//                     })}
//                   </View>
//                 </ScrollView>
//               </ScrollView>

//               {/* Selected node detail + children */}
//               {selected && (
//                 <View style={styles.detail}>
//                   <View style={styles.detailHeader}>
//                     <Text style={styles.detailTitle}>{selected.label}</Text>
//                     <TouchableOpacity onPress={() => setSelected(null)}>
//                       <MaterialCommunityIcons name="close" size={20} color="#64748B" />
//                     </TouchableOpacity>
//                   </View>
//                   {childrenOf(selected.id).length > 0 && (
//                     <View style={styles.childrenList}>
//                       <Text style={styles.childrenLabel}>Connected to:</Text>
//                       {childrenOf(selected.id).map((child) => (
//                         <TouchableOpacity
//                           key={child.id}
//                           style={styles.childChip}
//                           onPress={() => setSelected(child)}
//                         >
//                           <Text style={styles.childChipText}>{child.label}</Text>
//                         </TouchableOpacity>
//                       ))}
//                     </View>
//                   )}
//                 </View>
//               )}

//               <Text style={styles.hint}>Tap a node to explore connections</Text>
//             </>
//           )}
//         </View>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   card: { backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
//   header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
//   iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
//   title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1E293B' },
//   nodeCount: { fontSize: 12, color: '#64748B', fontWeight: '600', marginRight: 4 },

//   body: { paddingBottom: 16 },
//   emptyState: { alignItems: 'center', paddingVertical: 30 },
//   emptyText: { color: '#94A3B8', fontSize: 14 },

//   scrollArea: { height: 420, backgroundColor: '#F8FAFC' },
//   canvas: { width: 900, height: 500, position: 'relative' },

//   node: {
//     position: 'absolute', maxWidth: 160,
//     padding: 10, backgroundColor: 'white',
//     borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0',
//     elevation: 2, shadowColor: '#000', shadowOpacity: 0.06,
//     shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
//   },
//   rootNode: {
//     backgroundColor: '#EEF2FF', borderColor: '#A5B4FC', borderWidth: 2,
//   },
//   activeNode: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
//   nodeText: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
//   rootNodeText: { color: '#4338CA', fontWeight: '700' },
//   activeNodeText: { color: 'white' },

//   detail: {
//     margin: 12, backgroundColor: '#F8FAFC',
//     borderRadius: 16, padding: 16,
//     borderWidth: 1, borderColor: '#E2E8F0',
//   },
//   detailHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
//   detailTitle: { flex: 1, fontWeight: '700', color: '#0EA5E9', fontSize: 14, lineHeight: 20 },

//   childrenList: { gap: 6 },
//   childrenLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 4 },
//   childChip: {
//     backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6,
//     borderRadius: 20, alignSelf: 'flex-start',
//   },
//   childChipText: { fontSize: 12, fontWeight: '600', color: '#4338CA' },

//   hint: { textAlign: 'center', fontSize: 11, color: '#CBD5E1', paddingVertical: 8 },
// });



import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * MindmapSection — PHASE 2
 *
 * Interactive mind map rendering from `mindmap_data` (nodes + edges) will be
 * implemented in Phase 2 using a graph/canvas library (e.g. react-native-svg
 * with a force-directed layout).
 *
 * For now this section is hidden from the UI — it renders nothing.
 * The `mindmap_data` field is already available on the processedModule object
 * and can be wired in when Phase 2 begins.
 */

interface Props {
  isExpanded: boolean;
  onToggle: () => void;
  mindmapData: any | null; // Will be { nodes: [...], edges: [...] } in Phase 2
}

export default function MindmapSection({ isExpanded, onToggle, mindmapData }: Props) {
  // Phase 2: Uncomment and implement interactive mind map rendering.
  // The mindmapData prop already receives the full nodes+edges structure from the API.
  return null;
}

const styles = StyleSheet.create({});