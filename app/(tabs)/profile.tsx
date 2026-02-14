import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Pressable, Platform, TextInput, Modal, Alert } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '@/lib/app-context';
import Colors from '@/constants/colors';
import { formatDistance, formatArea } from '@/lib/geo-utils';
import { getAllBadges } from '@/lib/storage';

const BADGE_ICONS: Record<string, string> = {
  flag: 'flag', 'trending-up': 'trending-up', award: 'award',
  map: 'map', globe: 'globe', zap: 'zap', target: 'target',
  shield: 'shield', grid: 'grid', star: 'star',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, notifications, unreadCount, markNotifRead, updateUsername } = useApp();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [newName, setNewName] = useState('');

  const allBadges = getAllBadges();
  const xpForNextLevel = ((profile?.level || 1)) * 200;
  const xpProgress = ((profile?.xp || 0) % 200) / 200;

  const handleSaveName = async () => {
    if (newName.trim()) {
      await updateUsername(newName.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setShowEditName(false);
  };

  if (!profile) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8), paddingBottom: Platform.OS === 'web' ? 120 : 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Profile</Text>
        <Pressable
          style={({ pressed }) => [styles.notifBtn, pressed && { opacity: 0.7 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowNotifs(true); }}
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.dark.text} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Animated.View entering={FadeInDown.delay(50)} style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{profile.username.charAt(0).toUpperCase()}</Text>
        </View>
        <Pressable onPress={() => { setNewName(profile.username); setShowEditName(true); }} style={styles.nameRow}>
          <Text style={styles.profileName}>{profile.username}</Text>
          <Feather name="edit-2" size={14} color={Colors.dark.textMuted} />
        </Pressable>
        <View style={styles.levelRow}>
          <Text style={styles.levelText}>Level {profile.level}</Text>
          <View style={styles.xpBarContainer}>
            <View style={[styles.xpBarFill, { width: `${xpProgress * 100}%` as any }]} />
          </View>
          <Text style={styles.xpText}>{profile.xp} XP</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="speedometer" size={22} color={Colors.dark.accent} />
          <Text style={styles.statCardValue}>{formatDistance(profile.totalDistance)}</Text>
          <Text style={styles.statCardLabel}>Distance</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="hexagon" size={22} color={Colors.dark.info} />
          <Text style={styles.statCardValue}>{formatArea(profile.totalArea)}</Text>
          <Text style={styles.statCardLabel}>Territory</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="activity" size={22} color={Colors.dark.warning} />
          <Text style={styles.statCardValue}>{profile.totalActivities}</Text>
          <Text style={styles.statCardLabel}>Activities</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="trophy" size={22} color={Colors.dark.xp} />
          <Text style={styles.statCardValue}>{profile.wins}</Text>
          <Text style={styles.statCardLabel}>Wins</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="close-circle" size={22} color={Colors.dark.danger} />
          <Text style={styles.statCardValue}>{profile.losses}</Text>
          <Text style={styles.statCardLabel}>Losses</Text>
        </View>
        <View style={styles.statCard}>
          <Feather name="map-pin" size={22} color={Colors.dark.accent} />
          <Text style={styles.statCardValue}>{profile.territories}</Text>
          <Text style={styles.statCardLabel}>Active</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240)}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.badgeGrid}>
          {allBadges.map(badge => {
            const unlocked = profile.badges.includes(badge.id);
            return (
              <View key={badge.id} style={[styles.badgeItem, !unlocked && styles.badgeItemLocked]}>
                <View style={[styles.badgeIcon, unlocked && styles.badgeIconUnlocked]}>
                  <Feather
                    name={BADGE_ICONS[badge.icon] as any || 'award'}
                    size={20}
                    color={unlocked ? Colors.dark.xp : Colors.dark.textMuted}
                  />
                </View>
                <Text style={[styles.badgeName, !unlocked && styles.badgeNameLocked]}>{badge.name}</Text>
                <Text style={styles.badgeDesc} numberOfLines={2}>{badge.description}</Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <Modal transparent animationType="slide" visible={showNotifs} onRequestClose={() => setShowNotifs(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNotifs(false)}>
          <Pressable style={[styles.notifSheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.notifSheetTitle}>Notifications</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {notifications.length === 0 ? (
                <View style={styles.notifEmpty}>
                  <Ionicons name="notifications-off-outline" size={40} color={Colors.dark.textMuted} />
                  <Text style={styles.notifEmptyText}>No notifications yet</Text>
                </View>
              ) : (
                notifications.map(notif => (
                  <Pressable
                    key={notif.id}
                    style={[styles.notifItem, !notif.read && styles.notifItemUnread]}
                    onPress={() => markNotifRead(notif.id)}
                  >
                    <View style={styles.notifIcon}>
                      <Ionicons
                        name={notif.type === 'territory_conquered' ? 'flag' : notif.type === 'badge_earned' ? 'ribbon' : 'notifications'}
                        size={18}
                        color={notif.type === 'territory_conquered' ? Colors.dark.accent : notif.type === 'badge_earned' ? Colors.dark.xp : Colors.dark.info}
                      />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={styles.notifTitle}>{notif.title}</Text>
                      <Text style={styles.notifMessage}>{notif.message}</Text>
                      <Text style={styles.notifTime}>{new Date(notif.timestamp).toLocaleString()}</Text>
                    </View>
                    {!notif.read && <View style={styles.notifDot} />}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent animationType="fade" visible={showEditName} onRequestClose={() => setShowEditName(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditName(false)}>
          <Pressable style={styles.editNameCard} onPress={e => e.stopPropagation()}>
            <Text style={styles.editNameTitle}>Edit Username</Text>
            <TextInput
              style={styles.editNameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter username"
              placeholderTextColor={Colors.dark.textMuted}
              autoFocus
              maxLength={20}
            />
            <View style={styles.editNameBtns}>
              <Pressable style={styles.editNameCancel} onPress={() => setShowEditName(false)}>
                <Text style={styles.editNameCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.editNameSave} onPress={handleSaveName}>
                <Text style={styles.editNameSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  screenTitle: { color: Colors.dark.text, fontSize: 28, fontFamily: 'Rubik_700Bold' },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark.surface, justifyContent: 'center', alignItems: 'center' },
  notifBadge: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.dark.danger, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Rubik_600SemiBold' },
  profileCard: { backgroundColor: Colors.dark.surface, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.dark.accent, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { color: Colors.dark.background, fontSize: 28, fontFamily: 'Rubik_700Bold' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  profileName: { color: Colors.dark.text, fontSize: 22, fontFamily: 'Rubik_600SemiBold' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
  levelText: { color: Colors.dark.xp, fontSize: 13, fontFamily: 'Rubik_600SemiBold', width: 58 },
  xpBarContainer: { flex: 1, height: 6, backgroundColor: Colors.dark.surfaceLight, borderRadius: 3, overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: Colors.dark.xp, borderRadius: 3 },
  xpText: { color: Colors.dark.textSecondary, fontSize: 12, width: 55, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  statCardValue: { color: Colors.dark.text, fontSize: 17, fontFamily: 'Rubik_600SemiBold' },
  statCardLabel: { color: Colors.dark.textSecondary, fontSize: 12 },
  sectionTitle: { color: Colors.dark.text, fontSize: 20, fontFamily: 'Rubik_600SemiBold', marginTop: 8, marginBottom: 16 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeItem: { width: '48%', backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 14, gap: 6 },
  badgeItemLocked: { opacity: 0.45 },
  badgeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.dark.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  badgeIconUnlocked: { backgroundColor: 'rgba(255, 214, 0, 0.15)' },
  badgeName: { color: Colors.dark.text, fontSize: 14, fontFamily: 'Rubik_600SemiBold' },
  badgeNameLocked: { color: Colors.dark.textMuted },
  badgeDesc: { color: Colors.dark.textSecondary, fontSize: 11, lineHeight: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.dark.border, alignSelf: 'center', marginBottom: 20 },
  notifSheet: { backgroundColor: Colors.dark.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  notifSheetTitle: { color: Colors.dark.text, fontSize: 22, fontFamily: 'Rubik_700Bold', marginBottom: 20, textAlign: 'center' },
  notifEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  notifEmptyText: { color: Colors.dark.textMuted, fontSize: 15 },
  notifItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  notifItemUnread: { backgroundColor: Colors.dark.accentGlow, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -12 },
  notifIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.dark.surfaceLight, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  notifContent: { flex: 1 },
  notifTitle: { color: Colors.dark.text, fontSize: 14, fontFamily: 'Rubik_600SemiBold' },
  notifMessage: { color: Colors.dark.textSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 },
  notifTime: { color: Colors.dark.textMuted, fontSize: 11, marginTop: 4 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.dark.accent, marginTop: 6 },
  editNameCard: { backgroundColor: Colors.dark.surface, borderRadius: 20, padding: 24, marginHorizontal: 32, alignSelf: 'center', width: '85%', position: 'absolute', top: '35%' },
  editNameTitle: { color: Colors.dark.text, fontSize: 18, fontFamily: 'Rubik_600SemiBold', marginBottom: 16 },
  editNameInput: { backgroundColor: Colors.dark.surfaceLight, borderRadius: 12, padding: 14, color: Colors.dark.text, fontSize: 16, fontFamily: 'Rubik_400Regular', marginBottom: 20 },
  editNameBtns: { flexDirection: 'row', gap: 12 },
  editNameCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.dark.surfaceLight, alignItems: 'center' },
  editNameCancelText: { color: Colors.dark.textSecondary, fontFamily: 'Rubik_500Medium' },
  editNameSave: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: Colors.dark.accent, alignItems: 'center' },
  editNameSaveText: { color: Colors.dark.background, fontFamily: 'Rubik_600SemiBold' },
});
