import { StyleSheet } from 'react-native';

const createStyles = () => {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

    // ── Header ────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 15,
      backgroundColor: '#fff',
      borderBottomWidth: 1,
      borderBottomColor: '#F1F5F9',
    },
    greetingText: { fontSize: 24, fontWeight: '800', color: '#1E293B' },
    emailText: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
    logoutBtn: {
      width: 44, height: 44, borderRadius: 12,
      backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center',
    },
    notificationBtn: {
      width: 44, height: 44, borderRadius: 12,
      backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: '#EF4444',
      borderRadius: 9,
      width: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '800',
    },

    sectionWrapper: { marginTop: 20, paddingHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 14 },

    // ── Your Progress Card ────────────────────────────────────────────────
    // Mirrors the web card: left side (icon + text), right side (circle + subtext)
    progressCard: {
      backgroundColor: '#fff',
      borderRadius: 24,
      padding: 20,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#F1F5F9',
      elevation: 3,
      shadowColor: '#64748B',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    progressLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingRight: 12,
    },
    progressIconBox: {
      width: 44, height: 44, borderRadius: 12,
      backgroundColor: '#EFF6FF',
      justifyContent: 'center', alignItems: 'center',
      flexShrink: 0,
    },
    progressTextBlock: { flex: 1 },
    progressCardTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    progressNudge: {
      fontSize: 12, color: '#64748B', fontWeight: '500',
      lineHeight: 17, marginTop: 4, marginBottom: 10,
    },
    completedBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#F1F5F9',
      borderRadius: 6,
      paddingHorizontal: 8, paddingVertical: 4,
    },
    completedBadgeText: { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 0.3 },

    // Right side: circle + "X of Y"
    progressRight: { alignItems: 'center', gap: 6 },
    progressCircleContainer: { justifyContent: 'center', alignItems: 'center' },
    progressCircleInner: { position: 'absolute', alignItems: 'center' },
    progressCirclePercent: { fontSize: 16, fontWeight: '900', color: '#2563EB' },
    progressOfText: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textAlign: 'center' },

    // ── Stats Grid ────────────────────────────────────────────────────────
    statsGrid: { flexDirection: 'row', gap: 12 },
    statCard: {
      flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16,
      alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9',
    },
    statIconBox: {
      width: 40, height: 40, borderRadius: 12,
      justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    statVal: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    statLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

    // ── Plan / Sprint Cards ────────────────────────────────────────────────
    planCard: {
      backgroundColor: '#fff', borderRadius: 24, padding: 18,
      marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9',
    },
    planHeaderRow: { flexDirection: 'row', marginBottom: 14 },
    planContentRow: { flexDirection: 'row', gap: 14, marginBottom: 16, alignItems: 'flex-start' },
    planIconCircle: {
      width: 46, height: 46, borderRadius: 13,
      backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: '#F1F5F9', flexShrink: 0,
    },
    planTitleText: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    planSubText: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },

    // Status badges
    statusBadge: {
      alignSelf: 'flex-start',
      borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4,
    },
    statusBadgeNotStarted:  { backgroundColor: '#F1F5F9' },
    statusBadgeInProgress:  { backgroundColor: '#EFF6FF' },
    statusBadgeCompleted:   { backgroundColor: '#DCFCE7' },
    statusBadgeText:        { fontSize: 11, fontWeight: '700' },
    statusTextNotStarted:   { color: '#64748B' },
    statusTextInProgress:   { color: '#2563EB' },
    statusTextCompleted:    { color: '#16A34A' },

    // CTA buttons — 3 states matching the web
    sprintButton: {
      borderRadius: 14, paddingVertical: 13,
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    },
    sprintButtonStart:    { backgroundColor: '#2563EB' },
    sprintButtonContinue: { borderWidth: 1.5, borderColor: '#2563EB', backgroundColor: '#fff' },
    sprintButtonReview:   { backgroundColor: '#F1F5F9' },
    sprintButtonText:     { fontWeight: '700', fontSize: 14 },
    sprintButtonTextStart:    { color: '#fff' },
    sprintButtonTextContinue: { color: '#2563EB' },
    sprintButtonTextReview:   { color: '#475569' },

    // Empty state
    emptyState: { alignItems: 'center', paddingVertical: 40 },
    emptyStateText: { marginTop: 12, fontSize: 15, color: '#94A3B8', fontWeight: '500' },
  });
};

export default createStyles;