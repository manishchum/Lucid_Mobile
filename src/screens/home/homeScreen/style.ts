import { StyleSheet } from 'react-native';

const createStyles = () => {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FFF' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

    // ── Header ────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      justifyContent: "flex-end",
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

    // ── Consolidated Hero ──────────────────────────────────────────────────
    welcomeContainer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
      backgroundColor: '#fff',
    },
    welcomeHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    welcomeTextColumn: {
      flex: 1,
      justifyContent: 'center',
    },
    welcomeSub: {
      fontSize: 15,
      fontWeight: '600',
      color: '#64748B',
      marginBottom: 4,
    },
    welcomeName: {
      fontSize: 32,
      fontWeight: '900',
      color: '#0F172A',
      letterSpacing: -1,
      marginBottom: 6,
    },
    welcomeTagline: {
      fontSize: 13,
      fontWeight: '500',
      color: '#94A3B8',
    },
    ringWrapper: {
      marginLeft: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Stats Grid ────────────────────────────────────────────────────────
    statsGrid: { flexDirection: 'row', gap: 12 },
    statCard: {
      flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 16,
      alignItems: 'center', borderWidth: 1, borderColor: "#e2e8f0",
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

    // ── Leaderboard Styles ────────────────────────────────────────────────
    leaderboardBtn: {
      width: 44, height: 44, borderRadius: 12,
      backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center',
    },
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)',
      justifyContent: 'flex-end',
    },
    leaderboardContainer: {
      backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
      height: '85%', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 30,
      shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
      elevation: 10,
    },
    leaderboardHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    leaderboardTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    closeBtn: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9',
      justifyContent: 'center', alignItems: 'center',
    },
    leaderboardLoader: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
    },
    retryBtn: {
      marginTop: 14, paddingHorizontal: 20, paddingVertical: 8,
      backgroundColor: '#2563eb', borderRadius: 8,
    },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    userRankCard: {
      backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
      borderRadius: 16, padding: 14, marginTop: 15,
    },
    userRankTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
    userRankStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 10 },
    userRankStatItem: { alignItems: 'center' },
    userRankStatValue: { fontSize: 18, fontWeight: '900', color: '#2563eb' },
    userRankStatLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 2 },
    userRankDivider: { width: 1, height: 28, backgroundColor: '#cbd5e1' },
    leaderboardList: { flex: 1, marginTop: 15 },
    leaderboardRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    leaderboardRowMe: {
      backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 10,
      borderBottomWidth: 0, marginVertical: 2, borderWidth: 1, borderColor: '#bfdbfe',
    },
    rankIconContainer: { width: 32, alignItems: 'center', justifyContent: 'center' },
    rankCircleBadge: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: '#f1f5f9',
      justifyContent: 'center', alignItems: 'center',
    },
    rankCircleBadgeText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    leaderboardAvatar: {
      width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0',
      justifyContent: 'center', alignItems: 'center', marginHorizontal: 10,
    },
    leaderboardAvatarText: { fontSize: 14, fontWeight: '700', color: '#475569' },
    rowUserName: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
    rowUserModules: { fontSize: 11, color: '#64748b', marginTop: 2 },
    rowProgressBarTrack: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginTop: 6, overflow: 'hidden' },
    rowProgressBarFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 },
    rowUserPercentage: { fontSize: 14, fontWeight: '800', color: '#3b82f6' },
    rowUserSubText: { fontSize: 9, fontWeight: '600', color: '#94a3b8', marginTop: 1 },
    meBadge: {
      backgroundColor: '#3b82f6', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5,
    },
    meBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
    outOfTopLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
    leaderboardFooter: {
      flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f1f5f9',
      paddingTop: 15, marginTop: 10, justifyContent: 'space-around',
    },
    footerStatBox: { alignItems: 'center' },
    footerStatValue: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
    footerStatLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginTop: 3 },
  });
};

export default createStyles;