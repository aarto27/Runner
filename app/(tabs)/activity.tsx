import React, { useMemo } from 'react';
import { View, StyleSheet, Text, FlatList, Pressable, Platform } from 'react-native';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useApp } from '@/lib/app-context';
import Colors from '@/constants/colors';
import { Activity } from '@/lib/types';
import { formatDistance, formatDuration } from '@/lib/geo-utils';

function ActivityIcon({ type, size = 20 }: { type: string; size?: number }) {
  switch (type) {
    case 'run': return <Ionicons name="walk" size={size} color={Colors.dark.accent} />;
    case 'walk': return <Ionicons name="footsteps" size={size} color={Colors.dark.info} />;
    case 'cycle': return <Ionicons name="bicycle" size={size} color={Colors.dark.warning} />;
    case 'hike': return <MaterialCommunityIcons name="hiking" size={size} color={Colors.dark.badge} />;
    default: return <Ionicons name="walk" size={size} color={Colors.dark.accent} />;
  }
}

function ActivityCard({ item, index }: { item: Activity; index: number }) {
  const date = new Date(item.startTime);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={styles.iconCircle}>
            <ActivityIcon type={item.type} size={22} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
            <Text style={styles.cardDate}>{dateStr} at {timeStr}</Text>
          </View>
        </View>

        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{formatDistance(item.distance)}</Text>
            <Text style={styles.cardStatLabel}>Dist</Text>
          </View>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{formatDuration(item.duration)}</Text>
            <Text style={styles.cardStatLabel}>Time</Text>
          </View>
          {item.steps && item.steps > 0 && item.type !== 'cycle' ? (
            <View style={styles.cardStat}>
              <Text style={styles.cardStatValue}>{item.steps.toLocaleString()}</Text>
              <Text style={styles.cardStatLabel}>Steps</Text>
            </View>
          ) : (
            <View style={styles.cardStat}>
              <Text style={[styles.cardStatValue, { color: Colors.dark.xp }]}>+{item.xpEarned}</Text>
              <Text style={styles.cardStatLabel}>XP</Text>
            </View>
          )}
        </View>

        {item.steps && item.steps > 0 && item.type !== 'cycle' && (
          <View style={styles.stepsXpRow}>
            <View style={styles.stepsXpItem}>
              <Ionicons name="footsteps" size={13} color={Colors.dark.textSecondary} />
              <Text style={styles.stepsXpText}>{item.steps.toLocaleString()} steps</Text>
            </View>
            <View style={styles.stepsXpItem}>
              <Ionicons name="star" size={13} color={Colors.dark.xp} />
              <Text style={[styles.stepsXpText, { color: Colors.dark.xp }]}>+{item.xpEarned} XP</Text>
            </View>
          </View>
        )}

        {item.territoryId && (
          <View style={styles.territoryBadge}>
            <Feather name="hexagon" size={12} color={Colors.dark.accent} />
            <Text style={styles.territoryBadgeText}>Territory Claimed</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { activities, profile } = useApp();

  const totalStats = useMemo(() => {
    return {
      distance: activities.reduce((sum, a) => sum + a.distance, 0),
      time: activities.reduce((sum, a) => sum + a.duration, 0),
      calories: activities.reduce((sum, a) => sum + a.calories, 0),
    };
  }, [activities]);

  const renderItem = ({ item, index }: { item: Activity; index: number }) => (
    <ActivityCard item={item} index={index} />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8),
          paddingHorizontal: 16,
          paddingBottom: Platform.OS === 'web' ? 120 : 100,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Activities</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="speedometer" size={18} color={Colors.dark.accent} />
                <Text style={styles.summaryValue}>{formatDistance(totalStats.distance)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons name="time" size={18} color={Colors.dark.info} />
                <Text style={styles.summaryValue}>{formatDuration(totalStats.time)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons name="flame" size={18} color={Colors.dark.warning} />
                <Text style={styles.summaryValue}>{totalStats.calories} cal</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="activity" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyTitle}>No Activities Yet</Text>
            <Text style={styles.emptySub}>Start tracking your first activity to see it here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { marginBottom: 20 },
  headerTitle: { color: Colors.dark.text, fontSize: 28, fontFamily: 'Rubik_700Bold', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.dark.surface, padding: 14, borderRadius: 14 },
  summaryValue: { color: Colors.dark.text, fontSize: 14, fontFamily: 'Rubik_500Medium' },
  card: { backgroundColor: Colors.dark.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.dark.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { color: Colors.dark.text, fontSize: 17, fontFamily: 'Rubik_600SemiBold' },
  cardDate: { color: Colors.dark.textSecondary, fontSize: 13, marginTop: 2 },
  cardStats: { flexDirection: 'row', justifyContent: 'space-between' },
  cardStat: { alignItems: 'center', flex: 1 },
  cardStatValue: { color: Colors.dark.text, fontSize: 16, fontFamily: 'Rubik_600SemiBold' },
  cardStatLabel: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 2 },
  territoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.dark.border },
  territoryBadgeText: { color: Colors.dark.accent, fontSize: 13, fontFamily: 'Rubik_500Medium' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: Colors.dark.text, fontSize: 20, fontFamily: 'Rubik_600SemiBold' },
  emptySub: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
