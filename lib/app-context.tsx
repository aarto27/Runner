import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Activity, Territory, UserProfile, Notification, ActivityType } from './types';
import * as Storage from './storage';
import { calculatePolygonArea, isClosedLoop, simplifyRoute, calculateTotalDistance, calculateCalories } from './geo-utils';
import { GpsPoint } from './types';

interface AppContextValue {
  profile: UserProfile | null;
  activities: Activity[];
  territories: Territory[];
  sampleTerritories: Territory[];
  notifications: Notification[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  saveNewActivity: (route: GpsPoint[], type: ActivityType, duration: number) => Promise<Activity>;
  updateUsername: (name: string) => Promise<void>;
  markNotifRead: (id: string) => Promise<void>;
  unreadCount: number;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [sampleTerritories, setSampleTerritories] = useState<Territory[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [p, a, t, n, s] = await Promise.all([
        Storage.getProfile(),
        Storage.getActivities(),
        Storage.getTerritories(),
        Storage.getNotifications(),
        Storage.getSampleTerritories(),
      ]);
      setProfile(p);
      setActivities(a);
      setTerritories(t);
      setNotifications(n);
      setSampleTerritories(s);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const saveNewActivity = useCallback(async (route: GpsPoint[], type: ActivityType, duration: number) => {
    const distance = calculateTotalDistance(route);
    const calories = calculateCalories(distance, type, duration);
    const speeds = route.filter(p => p.speed !== undefined).map(p => p.speed!);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : distance / duration;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : avgSpeed * 1.5;

    const activity: Activity = {
      id: Storage.generateId(),
      type,
      startTime: route[0]?.timestamp || Date.now() - duration * 1000,
      endTime: route[route.length - 1]?.timestamp || Date.now(),
      duration,
      distance,
      calories,
      avgSpeed,
      maxSpeed,
      route: simplifyRoute(route),
      xpEarned: 0,
    };

    let xpEarned = Math.round(distance / 100) + Math.round(duration / 60) * 2;
    let territory: Territory | null = null;

    if (isClosedLoop(route)) {
      const polygon = simplifyRoute(route).map(p => ({ latitude: p.latitude, longitude: p.longitude }));
      const area = calculatePolygonArea(polygon);

      if (area > 100 && polygon.length >= 3) {
        territory = {
          id: Storage.generateId(),
          ownerId: profile?.id || 'user',
          ownerName: profile?.username || 'Runner',
          polygon,
          area,
          claimedAt: Date.now(),
          activityId: activity.id,
          activityType: type,
          conquestCount: 1,
          color: '#00E676',
        };

        activity.territoryId = territory.id;
        xpEarned += Math.round(area / 1000) + 50;

        await Storage.saveTerritory(territory);

        await Storage.addNotification({
          id: Storage.generateId(),
          type: 'territory_conquered',
          title: 'Territory Claimed!',
          message: `You conquered a new territory of ${(area / 10000).toFixed(1)} hectares!`,
          timestamp: Date.now(),
          read: false,
        });
      }
    }

    activity.xpEarned = xpEarned;
    await Storage.saveActivity(activity);

    const currentProfile = await Storage.getProfile();
    const allActivities = await Storage.getActivities();
    const allTerritories = await Storage.getTerritories();

    const updatedProfile = await Storage.updateProfile({
      totalDistance: currentProfile.totalDistance + distance,
      totalArea: territory ? currentProfile.totalArea + territory.area : currentProfile.totalArea,
      totalActivities: currentProfile.totalActivities + 1,
      xp: currentProfile.xp + xpEarned,
      territories: allTerritories.filter(t => t.ownerId === currentProfile.id).length,
    });

    const newBadges = Storage.checkNewBadges(updatedProfile, allActivities, allTerritories);
    if (newBadges.length > 0) {
      await Storage.updateProfile({
        badges: [...updatedProfile.badges, ...newBadges],
      });
      for (const badgeId of newBadges) {
        const badge = Storage.getAllBadges().find(b => b.id === badgeId);
        if (badge) {
          await Storage.addNotification({
            id: Storage.generateId(),
            type: 'badge_earned',
            title: 'Badge Earned!',
            message: `You unlocked "${badge.name}" - ${badge.description}`,
            timestamp: Date.now(),
            read: false,
          });
        }
      }
    }

    await loadData();
    return activity;
  }, [profile, loadData]);

  const updateUsername = useCallback(async (name: string) => {
    await Storage.updateProfile({ username: name });
    await loadData();
  }, [loadData]);

  const markNotifRead = useCallback(async (id: string) => {
    await Storage.markNotificationRead(id);
    await loadData();
  }, [loadData]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const value = useMemo(() => ({
    profile,
    activities,
    territories,
    sampleTerritories,
    notifications,
    isLoading,
    refreshData,
    saveNewActivity,
    updateUsername,
    markNotifRead,
    unreadCount,
  }), [profile, activities, territories, sampleTerritories, notifications, isLoading, refreshData, saveNewActivity, updateUsername, markNotifRead, unreadCount]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
