import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, Platform, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, FadeIn } from 'react-native-reanimated';
import { useApp } from '@/lib/app-context';
import Colors from '@/constants/colors';
import { GpsPoint, ActivityType } from '@/lib/types';
import { formatDistance, formatDuration, formatSpeed, calculateTotalDistance } from '@/lib/geo-utils';
import { NativeMapView, NativePolyline, NativeMarker, NativeProviderGoogle, isMapAvailable } from '@/components/MapViewWrapper';

const ACTIVITY_OPTIONS: { type: ActivityType; icon: string; iconSet: 'ionicons' | 'mci'; label: string }[] = [
  { type: 'run', icon: 'walk', iconSet: 'ionicons', label: 'Run' },
  { type: 'walk', icon: 'footsteps', iconSet: 'ionicons', label: 'Walk' },
  { type: 'cycle', icon: 'bicycle', iconSet: 'ionicons', label: 'Cycle' },
  { type: 'hike', icon: 'hiking', iconSet: 'mci', label: 'Hike' },
];

export default function TrackScreen() {
  const insets = useSafeAreaInsets();
  const { saveNewActivity } = useApp();
  const mapRef = useRef<any>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [route, setRoute] = useState<GpsPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (isTracking && !isPaused) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 300 });
    }
  }, [isTracking, isPaused, pulseAnim]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        setHasPermission(true);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
    return () => {
      if (locationSub.current) locationSub.current.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTracking = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRoute([]);
    setElapsed(0);
    setCurrentSpeed(0);
    setIsTracking(true);
    setIsPaused(false);

    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    if (Platform.OS === 'web') {
      const genRoute = generateWebSimulation();
      let idx = 0;
      const webInterval = setInterval(() => {
        if (idx < genRoute.length) {
          setRoute(prev => [...prev, genRoute[idx]]);
          setCurrentSpeed(genRoute[idx].speed || 0);
          idx++;
        }
      }, 2000);
      locationSub.current = { remove: () => clearInterval(webInterval) } as any;
      return;
    }

    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
        (loc) => {
          const point: GpsPoint = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: loc.timestamp,
            speed: loc.coords.speed || 0,
            altitude: loc.coords.altitude || undefined,
          };
          setRoute(prev => [...prev, point]);
          setCurrentSpeed(loc.coords.speed || 0);

          if (mapRef.current && isMapAvailable) {
            mapRef.current.animateToRegion({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }, 500);
          }
        }
      );
      locationSub.current = sub;
    } catch (e) {
      console.error('Location tracking error:', e);
    }
  }, []);

  const pauseTracking = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPaused(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
  }, []);

  const resumeTracking = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    if (Platform.OS !== 'web') {
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
          (loc) => {
            const point: GpsPoint = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              timestamp: loc.timestamp,
              speed: loc.coords.speed || 0,
            };
            setRoute(prev => [...prev, point]);
            setCurrentSpeed(loc.coords.speed || 0);
          }
        );
        locationSub.current = sub;
      } catch (e) {
        console.error('Resume tracking error:', e);
      }
    }
  }, []);

  const stopTracking = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (timerRef.current) clearInterval(timerRef.current);
    if (locationSub.current) locationSub.current.remove();
    setIsTracking(false);
    setIsPaused(false);

    if (route.length < 3) {
      Alert.alert('Too Short', 'Your activity was too short to save. Try going a bit further!');
      return;
    }

    setIsSaving(true);
    try {
      await saveNewActivity(route, activityType, elapsed);
      setRoute([]);
      setElapsed(0);
      setCurrentSpeed(0);
    } catch (e) {
      console.error('Save activity error:', e);
    } finally {
      setIsSaving(false);
    }
  }, [route, activityType, elapsed, saveNewActivity]);

  const distance = route.length > 1 ? calculateTotalDistance(route) : 0;

  if (hasPermission === false) {
    return (
      <View style={[styles.permContainer, { paddingTop: insets.top }]}>
        <Ionicons name="location-outline" size={64} color={Colors.dark.textMuted} />
        <Text style={styles.permTitle}>Location Access Required</Text>
        <Text style={styles.permSub}>TerraRun needs your location to track activities and claim territories.</Text>
        <Pressable style={styles.permBtn} onPress={async () => {
          const { status } = await Location.requestForegroundPermissionsAsync();
          setHasPermission(status === 'granted');
        }}>
          <Text style={styles.permBtnText}>Enable Location</Text>
        </Pressable>
      </View>
    );
  }

  const mapContent = isMapAvailable ? (
    <NativeMapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? NativeProviderGoogle : undefined}
      showsUserLocation
      showsMyLocationButton={false}
      customMapStyle={mapDarkStyle}
      initialRegion={{
        latitude: route[0]?.latitude || 19.076,
        longitude: route[0]?.longitude || 72.877,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      {route.length > 1 && (
        <NativePolyline
          coordinates={route.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
          strokeColor={Colors.dark.accent}
          strokeWidth={4}
        />
      )}
      {route.length > 0 && (
        <NativeMarker coordinate={{ latitude: route[0].latitude, longitude: route[0].longitude }}>
          <View style={styles.startMarker}>
            <Ionicons name="flag" size={14} color="#fff" />
          </View>
        </NativeMarker>
      )}
    </NativeMapView>
  ) : (
    <View style={[StyleSheet.absoluteFill, styles.webMapPlaceholder]}>
      <Ionicons name="map-outline" size={80} color={Colors.dark.surfaceLight} />
      {isTracking && (
        <View style={styles.webTrackingInfo}>
          <View style={styles.webTrackDot} />
          <Text style={styles.webTrackText}>
            {route.length} GPS points recorded
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {mapContent}

      {!isTracking && (
        <Animated.View entering={FadeIn} style={[styles.preTrackContainer, { top: insets.top + (Platform.OS === 'web' ? 67 : 8) }]}>
          <View style={styles.activitySelector}>
            {ACTIVITY_OPTIONS.map(opt => (
              <Pressable
                key={opt.type}
                style={[styles.activityOption, activityType === opt.type && styles.activityOptionActive]}
                onPress={() => { Haptics.selectionAsync(); setActivityType(opt.type); }}
              >
                {opt.iconSet === 'mci' ? (
                  <MaterialCommunityIcons name={opt.icon as any} size={22} color={activityType === opt.type ? Colors.dark.accent : Colors.dark.textSecondary} />
                ) : (
                  <Ionicons name={opt.icon as any} size={22} color={activityType === opt.type ? Colors.dark.accent : Colors.dark.textSecondary} />
                )}
                <Text style={[styles.activityLabel, activityType === opt.type && styles.activityLabelActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      )}

      <View style={[styles.bottomPanel, { paddingBottom: Platform.OS === 'web' ? 100 : 100 }]}>
        {isTracking && (
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statBigValue}>{formatDuration(elapsed)}</Text>
              <Text style={styles.statSmallLabel}>Duration</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBigValue}>{formatDistance(distance)}</Text>
              <Text style={styles.statSmallLabel}>Distance</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBigValue}>{formatSpeed(currentSpeed)}</Text>
              <Text style={styles.statSmallLabel}>Speed</Text>
            </View>
          </View>
        )}

        <View style={styles.controlRow}>
          {isTracking && (
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
              onPress={isPaused ? resumeTracking : pauseTracking}
            >
              <Ionicons name={isPaused ? 'play' : 'pause'} size={24} color={Colors.dark.text} />
            </Pressable>
          )}

          <Animated.View style={isTracking ? pulseStyle : undefined}>
            <Pressable
              style={({ pressed }) => [
                styles.mainBtn,
                isTracking ? styles.mainBtnStop : styles.mainBtnStart,
                pressed && { opacity: 0.8 },
                isSaving && { opacity: 0.5 },
              ]}
              onPress={isTracking ? stopTracking : startTracking}
              disabled={isSaving}
            >
              {isTracking ? (
                <Ionicons name="stop" size={32} color="#fff" />
              ) : (
                <Ionicons name="play" size={32} color="#fff" style={{ marginLeft: 3 }} />
              )}
            </Pressable>
          </Animated.View>

          {isTracking && <View style={{ width: 52 }} />}
        </View>
      </View>
    </View>
  );
}

function generateWebSimulation(): GpsPoint[] {
  const centerLat = 19.076;
  const centerLon = 72.877;
  const points: GpsPoint[] = [];
  const numPoints = 30;
  const radius = 0.003;

  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * 0.0005;
    points.push({
      latitude: centerLat + Math.sin(angle) * radius + jitter,
      longitude: centerLon + Math.cos(angle) * radius + jitter,
      timestamp: Date.now() + i * 2000,
      speed: 2 + Math.random() * 3,
    });
  }
  return points;
}

const mapDarkStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'water', elementType: 'geometry.fill', stylers: [{ color: '#0e1626' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  permContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.background, padding: 40 },
  permTitle: { color: Colors.dark.text, fontSize: 22, fontFamily: 'Rubik_600SemiBold', marginTop: 20, textAlign: 'center' },
  permSub: { color: Colors.dark.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  permBtn: { backgroundColor: Colors.dark.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30, marginTop: 24 },
  permBtnText: { color: Colors.dark.background, fontFamily: 'Rubik_600SemiBold', fontSize: 16 },
  preTrackContainer: { position: 'absolute', left: 16, right: 16 },
  activitySelector: { flexDirection: 'row', backgroundColor: 'rgba(10, 14, 23, 0.9)', borderRadius: 16, padding: 4, gap: 4 },
  activityOption: { flex: 1, flexDirection: 'column', alignItems: 'center', paddingVertical: 12, borderRadius: 12, gap: 4 },
  activityOptionActive: { backgroundColor: Colors.dark.surfaceLight },
  activityLabel: { color: Colors.dark.textSecondary, fontSize: 11, fontFamily: 'Rubik_500Medium' },
  activityLabelActive: { color: Colors.dark.accent },
  startMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.dark.accent, justifyContent: 'center', alignItems: 'center' },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10, 14, 23, 0.92)', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  statBox: { alignItems: 'center', flex: 1 },
  statBigValue: { color: Colors.dark.text, fontSize: 22, fontFamily: 'Rubik_600SemiBold' },
  statSmallLabel: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 4 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 },
  mainBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  mainBtnStart: { backgroundColor: Colors.dark.accent },
  mainBtnStop: { backgroundColor: Colors.dark.danger },
  secondaryBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.dark.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  webMapPlaceholder: { backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center' },
  webTrackingInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  webTrackDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.dark.accent },
  webTrackText: { color: Colors.dark.textSecondary, fontSize: 14 },
});
