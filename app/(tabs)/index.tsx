import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, Platform, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useApp } from '@/lib/app-context';
import Colors from '@/constants/colors';
import { formatArea, getRouteCenter } from '@/lib/geo-utils';
import { Territory } from '@/lib/types';
import { NativeMapView, NativePolygon, NativeMarker, NativeProviderGoogle, isMapAvailable } from '@/components/MapViewWrapper';

function WebMapFallback({ territories, onSelect }: { territories: Territory[]; onSelect: (t: Territory) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 67, paddingHorizontal: 16, paddingBottom: 120 }}
    >
      <Text style={styles.webMapTitle}>Territory Map</Text>
      <Text style={styles.webMapSub}>Open on your phone to see the interactive map with territories</Text>
      <View style={styles.webTerritoryList}>
        {territories.map(t => (
          <Pressable key={t.id} style={styles.webTerritoryCard} onPress={() => onSelect(t)}>
            <View style={[styles.webTerritoryDot, { backgroundColor: t.color || Colors.dark.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.webTerritoryName}>{t.ownerName}</Text>
              <Text style={styles.webTerritorySub}>{formatArea(t.area)} - {t.activityType}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.dark.textMuted} />
          </Pressable>
        ))}
        {territories.length === 0 && (
          <View style={styles.webEmpty}>
            <Feather name="map" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.webEmptyText}>No territories claimed yet</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { territories, sampleTerritories, profile } = useApp();
  const mapRef = useRef<any>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  const allTerritories = [...territories, ...sampleTerritories];

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === 'web') {
          setUserLocation({ latitude: 19.076, longitude: 72.877 });
          setLocationLoading(false);
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } else {
          setUserLocation({ latitude: 19.076, longitude: 72.877 });
        }
      } catch {
        setUserLocation({ latitude: 19.076, longitude: 72.877 });
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const handleTerritoryPress = (territory: Territory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTerritory(territory);
  };

  const getTerritoryColor = (t: Territory) => {
    if (t.ownerId === profile?.id) return Colors.dark.territory.own;
    return t.color === '#FF5252' ? Colors.dark.territory.rival :
      t.color === '#40C4FF' ? Colors.dark.territory.neutral :
      t.color === '#FF9100' ? 'rgba(255, 145, 0, 0.3)' :
      Colors.dark.territory.rival;
  };

  const getTerritoryBorderColor = (t: Territory) => {
    if (t.ownerId === profile?.id) return Colors.dark.territory.ownBorder;
    return t.color || Colors.dark.territory.rivalBorder;
  };

  if (!isMapAvailable) {
    return (
      <View style={styles.container}>
        <WebMapFallback territories={allTerritories} onSelect={handleTerritoryPress} />
        <TerritorySheet territory={selectedTerritory} profile={profile} onClose={() => setSelectedTerritory(null)} insets={insets} getTerritoryBorderColor={getTerritoryBorderColor} />
        <LeaderboardSheet visible={showLeaderboard} onClose={() => setShowLeaderboard(false)} profile={profile} territories={territories} insets={insets} />
      </View>
    );
  }

  if (locationLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.dark.accent} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NativeMapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? NativeProviderGoogle : undefined}
        initialRegion={{
          latitude: userLocation?.latitude || 19.076,
          longitude: userLocation?.longitude || 72.877,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        mapType="standard"
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={mapDarkStyle}
      >
        {allTerritories.map(t => (
          <React.Fragment key={t.id}>
            <NativePolygon
              coordinates={t.polygon}
              fillColor={getTerritoryColor(t)}
              strokeColor={getTerritoryBorderColor(t)}
              strokeWidth={2}
              tappable
              onPress={() => handleTerritoryPress(t)}
            />
            <NativeMarker
              coordinate={t.polygon[0]}
              onPress={() => handleTerritoryPress(t)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.markerDot, { backgroundColor: getTerritoryBorderColor(t) }]} />
            </NativeMarker>
          </React.Fragment>
        ))}
      </NativeMapView>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <View style={styles.titlePill}>
          <Ionicons name="earth" size={18} color={Colors.dark.accent} />
          <Text style={styles.titleText}>Territory Map</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowLeaderboard(true); }}
        >
          <Ionicons name="trophy" size={20} color={Colors.dark.xp} />
        </Pressable>
      </View>

      <View style={[styles.statsRow, { bottom: 110 }]}>
        <View style={styles.statPill}>
          <Feather name="hexagon" size={14} color={Colors.dark.accent} />
          <Text style={styles.statValue}>{territories.length}</Text>
          <Text style={styles.statLabel}>Yours</Text>
        </View>
        <View style={styles.statPill}>
          <Feather name="globe" size={14} color={Colors.dark.info} />
          <Text style={styles.statValue}>{allTerritories.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.locationBtn, { bottom: 160 }, pressed && styles.iconBtnPressed]}
        onPress={centerOnUser}
      >
        <Ionicons name="locate" size={22} color={Colors.dark.text} />
      </Pressable>

      <TerritorySheet territory={selectedTerritory} profile={profile} onClose={() => setSelectedTerritory(null)} insets={insets} getTerritoryBorderColor={getTerritoryBorderColor} />
      <LeaderboardSheet visible={showLeaderboard} onClose={() => setShowLeaderboard(false)} profile={profile} territories={territories} insets={insets} />
    </View>
  );
}

function TerritorySheet({ territory, profile, onClose, insets, getTerritoryBorderColor }: any) {
  if (!territory) return null;
  return (
    <Modal transparent animationType="slide" visible={!!territory} onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.territorySheet, { paddingBottom: insets.bottom + 20 }]} onPress={(e: any) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View style={[styles.ownerDot, { backgroundColor: getTerritoryBorderColor(territory) }]} />
            <Text style={styles.sheetOwner}>{territory.ownerName}</Text>
            {territory.ownerId === profile?.id && (
              <View style={styles.yoursBadge}><Text style={styles.yoursBadgeText}>YOURS</Text></View>
            )}
          </View>
          <View style={styles.sheetStats}>
            <View style={styles.sheetStatItem}>
              <Text style={styles.sheetStatValue}>{formatArea(territory.area)}</Text>
              <Text style={styles.sheetStatLabel}>Area</Text>
            </View>
            <View style={styles.sheetStatItem}>
              <Text style={styles.sheetStatValue}>{territory.activityType}</Text>
              <Text style={styles.sheetStatLabel}>Activity</Text>
            </View>
            <View style={styles.sheetStatItem}>
              <Text style={styles.sheetStatValue}>{territory.conquestCount}</Text>
              <Text style={styles.sheetStatLabel}>Conquests</Text>
            </View>
          </View>
          <Text style={styles.sheetDate}>
            Claimed {new Date(territory.claimedAt).toLocaleDateString()}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LeaderboardSheet({ visible, onClose, profile, territories, insets }: any) {
  const leaderboardData = [
    { rank: 1, name: profile?.username || 'Runner', xp: profile?.xp || 0, territories: territories.length, isUser: true },
    { rank: 2, name: 'SpeedDemon', xp: 2450, territories: 8, isUser: false },
    { rank: 3, name: 'TrailBlazer', xp: 1890, territories: 6, isUser: false },
    { rank: 4, name: 'MountainKing', xp: 1200, territories: 4, isUser: false },
    { rank: 5, name: 'NightRunner', xp: 980, territories: 3, isUser: false },
  ].sort((a, b) => b.xp - a.xp).map((e, i) => ({ ...e, rank: i + 1 }));

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.leaderboardSheet, { paddingBottom: insets.bottom + 20 }]} onPress={(e: any) => e.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.leaderboardTitle}>Leaderboard</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {leaderboardData.map((entry: any) => (
              <View key={entry.rank} style={[styles.leaderRow, entry.isUser && styles.leaderRowHighlight]}>
                <Text style={[styles.leaderRank, entry.rank <= 3 && { color: Colors.dark.rank[entry.rank - 1] }]}>
                  #{entry.rank}
                </Text>
                <View style={styles.leaderInfo}>
                  <Text style={[styles.leaderName, entry.isUser && { color: Colors.dark.accent }]}>{entry.name}</Text>
                  <Text style={styles.leaderSub}>{entry.territories} territories</Text>
                </View>
                <Text style={styles.leaderXP}>{entry.xp} XP</Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const mapDarkStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0e1626' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.background },
  loadingText: { color: Colors.dark.textSecondary, marginTop: 12, fontSize: 14 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titlePill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10, 14, 23, 0.85)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  titleText: { color: Colors.dark.text, fontFamily: 'Rubik_600SemiBold', fontSize: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(10, 14, 23, 0.85)', justifyContent: 'center', alignItems: 'center' },
  iconBtnPressed: { opacity: 0.7 },
  statsRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10, 14, 23, 0.85)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  statValue: { color: Colors.dark.text, fontFamily: 'Rubik_600SemiBold', fontSize: 15 },
  statLabel: { color: Colors.dark.textSecondary, fontSize: 12 },
  locationBtn: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(10, 14, 23, 0.85)', justifyContent: 'center', alignItems: 'center' },
  markerDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  territorySheet: { backgroundColor: Colors.dark.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.dark.border, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  ownerDot: { width: 14, height: 14, borderRadius: 7 },
  sheetOwner: { color: Colors.dark.text, fontSize: 20, fontFamily: 'Rubik_600SemiBold', flex: 1 },
  yoursBadge: { backgroundColor: Colors.dark.accentGlow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  yoursBadgeText: { color: Colors.dark.accent, fontSize: 11, fontFamily: 'Rubik_600SemiBold' },
  sheetStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  sheetStatItem: { alignItems: 'center', flex: 1 },
  sheetStatValue: { color: Colors.dark.text, fontSize: 18, fontFamily: 'Rubik_600SemiBold' },
  sheetStatLabel: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 4 },
  sheetDate: { color: Colors.dark.textMuted, fontSize: 13, textAlign: 'center' },
  leaderboardSheet: { backgroundColor: Colors.dark.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' },
  leaderboardTitle: { color: Colors.dark.text, fontSize: 22, fontFamily: 'Rubik_700Bold', marginBottom: 20, textAlign: 'center' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  leaderRowHighlight: { backgroundColor: Colors.dark.accentGlow, borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -12 },
  leaderRank: { color: Colors.dark.textSecondary, fontSize: 16, fontFamily: 'Rubik_600SemiBold', width: 36 },
  leaderInfo: { flex: 1 },
  leaderName: { color: Colors.dark.text, fontSize: 15, fontFamily: 'Rubik_500Medium' },
  leaderSub: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 2 },
  leaderXP: { color: Colors.dark.xp, fontSize: 15, fontFamily: 'Rubik_600SemiBold' },
  webMapTitle: { color: Colors.dark.text, fontSize: 28, fontFamily: 'Rubik_700Bold', marginBottom: 8 },
  webMapSub: { color: Colors.dark.textSecondary, fontSize: 14, marginBottom: 24, lineHeight: 20 },
  webTerritoryList: { gap: 10 },
  webTerritoryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 16, gap: 12 },
  webTerritoryDot: { width: 12, height: 12, borderRadius: 6 },
  webTerritoryName: { color: Colors.dark.text, fontSize: 16, fontFamily: 'Rubik_500Medium' },
  webTerritorySub: { color: Colors.dark.textSecondary, fontSize: 13, marginTop: 2 },
  webEmpty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  webEmptyText: { color: Colors.dark.textMuted, fontSize: 15 },
});
