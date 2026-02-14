import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Text, Pressable, Platform, Alert, Linking } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { Pedometer } from 'expo-sensors';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, FadeIn, FadeInDown } from 'react-native-reanimated';
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

type PermissionState = 'loading' | 'undetermined' | 'granted' | 'denied_can_ask' | 'denied_permanent';

export default function TrackScreen() {
  const insets = useSafeAreaInsets();
  const { saveNewActivity } = useApp();
  const mapRef = useRef<any>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const pedometerSub = useRef<{ remove: () => void } | null>(null);

  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [route, setRoute] = useState<GpsPoint[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [pedometerAvailable, setPedometerAvailable] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('loading');
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
    checkPermissions();
    checkPedometer();
    return () => {
      if (locationSub.current) locationSub.current.remove();
      if (pedometerSub.current) pedometerSub.current.remove();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const checkPedometer = async () => {
    if (Platform.OS === 'web') {
      setPedometerAvailable(false);
      return;
    }
    try {
      const available = await Pedometer.isAvailableAsync();
      setPedometerAvailable(available);
    } catch {
      setPedometerAvailable(false);
    }
  };

  const checkPermissions = async () => {
    if (Platform.OS === 'web') {
      setPermissionState('granted');
      return;
    }

    try {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();

      if (status === 'granted') {
        setPermissionState('granted');
      } else if (status === 'denied' && !canAskAgain) {
        setPermissionState('denied_permanent');
      } else if (status === 'denied') {
        setPermissionState('denied_can_ask');
      } else {
        setPermissionState('undetermined');
      }
    } catch {
      setPermissionState('undetermined');
    }
  };

  const requestLocationPermission = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionState('granted');
      } else if (!canAskAgain) {
        setPermissionState('denied_permanent');
      } else {
        setPermissionState('denied_can_ask');
      }
    } catch {
      setPermissionState('denied_can_ask');
    }
  };

  const openSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS !== 'web') {
      try {
        Linking.openSettings();
      } catch {
        Alert.alert('Settings', 'Please open your device settings and enable location for TerraRun.');
      }
    }
  };

  const startPedometer = async () => {
    if (!pedometerAvailable || Platform.OS === 'web') return;

    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      if (status !== 'granted') return;

      setSteps(0);
      const sub = Pedometer.watchStepCount(result => {
        setSteps(result.steps);
      });
      pedometerSub.current = sub;
    } catch (e) {
      console.error('Pedometer error:', e);
    }
  };

  const stopPedometer = () => {
    if (pedometerSub.current) {
      pedometerSub.current.remove();
      pedometerSub.current = null;
    }
  };

  const startTracking = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRoute([]);
    setElapsed(0);
    setCurrentSpeed(0);
    setSteps(0);
    setIsTracking(true);
    setIsPaused(false);

    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    startPedometer();

    if (Platform.OS === 'web') {
      const genRoute = generateWebSimulation();
      let idx = 0;
      const webInterval = setInterval(() => {
        if (idx < genRoute.length) {
          setRoute(prev => [...prev, genRoute[idx]]);
          setCurrentSpeed(genRoute[idx].speed || 0);
          setSteps(prev => prev + Math.floor(Math.random() * 5) + 3);
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
  }, [pedometerAvailable]);

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
    stopPedometer();
  }, []);

  const resumeTracking = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    startPedometer();

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
  }, [pedometerAvailable]);

  const stopTracking = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (timerRef.current) clearInterval(timerRef.current);
    if (locationSub.current) locationSub.current.remove();
    stopPedometer();
    setIsTracking(false);
    setIsPaused(false);

    if (route.length < 3) {
      Alert.alert('Too Short', 'Your activity was too short to save. Try going a bit further!');
      return;
    }

    setIsSaving(true);
    try {
      await saveNewActivity(route, activityType, elapsed, steps);
      setRoute([]);
      setElapsed(0);
      setCurrentSpeed(0);
      setSteps(0);
    } catch (e) {
      console.error('Save activity error:', e);
    } finally {
      setIsSaving(false);
    }
  }, [route, activityType, elapsed, steps, saveNewActivity]);

  const distance = route.length > 1 ? calculateTotalDistance(route) : 0;
  const showSteps = activityType !== 'cycle';

  if (permissionState === 'loading') {
    return (
      <View style={[styles.permContainer, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
        <Animated.View entering={FadeIn}>
          <View style={styles.permLoadingDot} />
        </Animated.View>
      </View>
    );
  }

  if (permissionState !== 'granted') {
    return (
      <View style={[styles.permContainer, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
        <Animated.View entering={FadeInDown.springify()} style={styles.permCard}>
          <View style={styles.permIconCircle}>
            <Ionicons name="location" size={36} color={Colors.dark.accent} />
          </View>

          <Text style={styles.permTitle}>Enable Location</Text>
          <Text style={styles.permSub}>
            TerraRun needs access to your location to track your activities, map your routes, and claim territories.
          </Text>

          <View style={styles.permFeatures}>
            <View style={styles.permFeatureRow}>
              <Ionicons name="navigate" size={18} color={Colors.dark.accent} />
              <Text style={styles.permFeatureText}>Real-time GPS route tracking</Text>
            </View>
            <View style={styles.permFeatureRow}>
              <Ionicons name="map" size={18} color={Colors.dark.info} />
              <Text style={styles.permFeatureText}>Map your running routes</Text>
            </View>
            <View style={styles.permFeatureRow}>
              <Ionicons name="flag" size={18} color={Colors.dark.warning} />
              <Text style={styles.permFeatureText}>Claim territory with closed loops</Text>
            </View>
          </View>

          {permissionState === 'denied_permanent' ? (
            <>
              <Text style={styles.permDeniedText}>
                Location access was denied. Please enable it in your device settings to use TerraRun.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.8 }]}
                onPress={openSettings}
              >
                <Ionicons name="settings-outline" size={20} color={Colors.dark.background} />
                <Text style={styles.permBtnText}>Open Settings</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.8 }]}
              onPress={requestLocationPermission}
            >
              <Ionicons name="location" size={20} color={Colors.dark.background} />
              <Text style={styles.permBtnText}>Allow Location Access</Text>
            </Pressable>
          )}

          <Text style={styles.permPrivacy}>
            Your location data stays on your device and is never shared.
          </Text>
        </Animated.View>
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
            {showSteps ? (
              <View style={styles.statBox}>
                <Text style={styles.statBigValue}>{steps.toLocaleString()}</Text>
                <Text style={styles.statSmallLabel}>Steps</Text>
              </View>
            ) : (
              <View style={styles.statBox}>
                <Text style={styles.statBigValue}>{formatSpeed(currentSpeed)}</Text>
                <Text style={styles.statSmallLabel}>Speed</Text>
              </View>
            )}
          </View>
        )}

        {isTracking && showSteps && (
          <View style={styles.speedRow}>
            <Ionicons name="speedometer-outline" size={14} color={Colors.dark.textSecondary} />
            <Text style={styles.speedRowText}>{formatSpeed(currentSpeed)}</Text>
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
  permContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.dark.background, padding: 24 },
  permLoadingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.dark.accent },
  permCard: { backgroundColor: Colors.dark.surface, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', maxWidth: 360 },
  permIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.dark.accentGlow, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  permTitle: { color: Colors.dark.text, fontSize: 24, fontFamily: 'Rubik_700Bold', marginBottom: 10, textAlign: 'center' },
  permSub: { color: Colors.dark.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  permFeatures: { width: '100%', gap: 14, marginBottom: 28 },
  permFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  permFeatureText: { color: Colors.dark.text, fontSize: 14, fontFamily: 'Rubik_400Regular' },
  permDeniedText: { color: Colors.dark.warning, fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  permBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.dark.accent, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 30, width: '100%', justifyContent: 'center' },
  permBtnText: { color: Colors.dark.background, fontFamily: 'Rubik_600SemiBold', fontSize: 16 },
  permPrivacy: { color: Colors.dark.textMuted, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  preTrackContainer: { position: 'absolute', left: 16, right: 16 },
  activitySelector: { flexDirection: 'row', backgroundColor: 'rgba(10, 14, 23, 0.9)', borderRadius: 16, padding: 4, gap: 4 },
  activityOption: { flex: 1, flexDirection: 'column', alignItems: 'center', paddingVertical: 12, borderRadius: 12, gap: 4 },
  activityOptionActive: { backgroundColor: Colors.dark.surfaceLight },
  activityLabel: { color: Colors.dark.textSecondary, fontSize: 11, fontFamily: 'Rubik_500Medium' },
  activityLabelActive: { color: Colors.dark.accent },
  startMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.dark.accent, justifyContent: 'center', alignItems: 'center' },
  bottomPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10, 14, 23, 0.92)', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statBox: { alignItems: 'center', flex: 1 },
  statBigValue: { color: Colors.dark.text, fontSize: 22, fontFamily: 'Rubik_600SemiBold' },
  statSmallLabel: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 4 },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  speedRowText: { color: Colors.dark.textSecondary, fontSize: 13, fontFamily: 'Rubik_400Regular' },
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
