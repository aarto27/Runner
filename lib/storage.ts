import AsyncStorage from '@react-native-async-storage/async-storage';
import { Activity, Territory, UserProfile, Notification, Badge } from './types';
import * as Crypto from 'expo-crypto';

const KEYS = {
  PROFILE: 'terrarun_profile',
  ACTIVITIES: 'terrarun_activities',
  TERRITORIES: 'terrarun_territories',
  NOTIFICATIONS: 'terrarun_notifications',
  SAMPLE_TERRITORIES: 'terrarun_sample_territories',
};

const ALL_BADGES: Badge[] = [
  { id: 'first_territory', name: 'First Conquest', description: 'Claim your first territory', icon: 'flag' },
  { id: 'distance_10k', name: '10K Runner', description: 'Complete a 10km activity', icon: 'trending-up' },
  { id: 'distance_marathon', name: 'Marathon Legend', description: 'Run 42.2km total', icon: 'award' },
  { id: 'territories_5', name: 'Land Baron', description: 'Own 5 territories', icon: 'map' },
  { id: 'territories_10', name: 'Empire Builder', description: 'Own 10 territories', icon: 'globe' },
  { id: 'activities_10', name: 'Dedicated', description: 'Complete 10 activities', icon: 'zap' },
  { id: 'activities_50', name: 'Relentless', description: 'Complete 50 activities', icon: 'target' },
  { id: 'conqueror', name: 'Conqueror', description: 'Steal a territory from another user', icon: 'shield' },
  { id: 'area_1km2', name: 'City Block', description: 'Own 1 km\u00B2 of territory', icon: 'grid' },
  { id: 'xp_1000', name: 'Seasoned Warrior', description: 'Earn 1000 XP', icon: 'star' },
];

export function getAllBadges(): Badge[] {
  return ALL_BADGES;
}

export function generateId(): string {
  return Crypto.randomUUID();
}

function getDefaultProfile(): UserProfile {
  return {
    id: generateId(),
    username: 'Runner',
    avatar: '',
    totalDistance: 0,
    totalArea: 0,
    totalActivities: 0,
    xp: 0,
    level: 1,
    territories: 0,
    wins: 0,
    losses: 0,
    badges: [],
    joinedAt: Date.now(),
  };
}

export async function getProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(KEYS.PROFILE);
  if (!raw) {
    const profile = getDefaultProfile();
    await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
    return profile;
  }
  return JSON.parse(raw);
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const profile = await getProfile();
  const updated = { ...profile, ...updates };
  updated.level = Math.floor(updated.xp / 200) + 1;
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(updated));
  return updated;
}

export async function getActivities(): Promise<Activity[]> {
  const raw = await AsyncStorage.getItem(KEYS.ACTIVITIES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveActivity(activity: Activity): Promise<void> {
  const activities = await getActivities();
  activities.unshift(activity);
  await AsyncStorage.setItem(KEYS.ACTIVITIES, JSON.stringify(activities));
}

export async function getTerritories(): Promise<Territory[]> {
  const raw = await AsyncStorage.getItem(KEYS.TERRITORIES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveTerritory(territory: Territory): Promise<void> {
  const territories = await getTerritories();
  territories.push(territory);
  await AsyncStorage.setItem(KEYS.TERRITORIES, JSON.stringify(territories));
}

export async function updateTerritory(id: string, updates: Partial<Territory>): Promise<void> {
  const territories = await getTerritories();
  const idx = territories.findIndex(t => t.id === id);
  if (idx >= 0) {
    territories[idx] = { ...territories[idx], ...updates };
    await AsyncStorage.setItem(KEYS.TERRITORIES, JSON.stringify(territories));
  }
}

export async function getNotifications(): Promise<Notification[]> {
  const raw = await AsyncStorage.getItem(KEYS.NOTIFICATIONS);
  return raw ? JSON.parse(raw) : [];
}

export async function addNotification(notification: Notification): Promise<void> {
  const notifications = await getNotifications();
  notifications.unshift(notification);
  if (notifications.length > 50) notifications.pop();
  await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

export async function markNotificationRead(id: string): Promise<void> {
  const notifications = await getNotifications();
  const n = notifications.find(n => n.id === id);
  if (n) {
    n.read = true;
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }
}

export async function getSampleTerritories(): Promise<Territory[]> {
  const raw = await AsyncStorage.getItem(KEYS.SAMPLE_TERRITORIES);
  if (raw) return JSON.parse(raw);

  const samples: Territory[] = [
    {
      id: generateId(),
      ownerId: 'npc_1',
      ownerName: 'SpeedDemon',
      polygon: [
        { latitude: 19.076, longitude: 72.877 },
        { latitude: 19.078, longitude: 72.879 },
        { latitude: 19.080, longitude: 72.877 },
        { latitude: 19.078, longitude: 72.875 },
      ],
      area: 45000,
      claimedAt: Date.now() - 86400000 * 3,
      activityId: 'sample_1',
      activityType: 'run',
      conquestCount: 2,
      color: '#FF5252',
    },
    {
      id: generateId(),
      ownerId: 'npc_2',
      ownerName: 'TrailBlazer',
      polygon: [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7148, longitude: -74.004 },
        { latitude: 40.7158, longitude: -74.007 },
        { latitude: 40.7138, longitude: -74.009 },
      ],
      area: 62000,
      claimedAt: Date.now() - 86400000 * 7,
      activityId: 'sample_2',
      activityType: 'cycle',
      conquestCount: 5,
      color: '#40C4FF',
    },
    {
      id: generateId(),
      ownerId: 'npc_3',
      ownerName: 'MountainKing',
      polygon: [
        { latitude: 51.5074, longitude: -0.1278 },
        { latitude: 51.5094, longitude: -0.1258 },
        { latitude: 51.5114, longitude: -0.1278 },
        { latitude: 51.5094, longitude: -0.1298 },
      ],
      area: 38000,
      claimedAt: Date.now() - 86400000 * 1,
      activityId: 'sample_3',
      activityType: 'hike',
      conquestCount: 1,
      color: '#FF9100',
    },
  ];

  await AsyncStorage.setItem(KEYS.SAMPLE_TERRITORIES, JSON.stringify(samples));
  return samples;
}

export function checkNewBadges(profile: UserProfile, activities: Activity[], territories: Territory[]): string[] {
  const newBadges: string[] = [];
  const has = (id: string) => profile.badges.includes(id);

  if (!has('first_territory') && territories.length > 0) newBadges.push('first_territory');
  if (!has('distance_10k') && activities.some(a => a.distance >= 10000)) newBadges.push('distance_10k');
  if (!has('distance_marathon') && profile.totalDistance >= 42200) newBadges.push('distance_marathon');
  if (!has('territories_5') && territories.length >= 5) newBadges.push('territories_5');
  if (!has('territories_10') && territories.length >= 10) newBadges.push('territories_10');
  if (!has('activities_10') && activities.length >= 10) newBadges.push('activities_10');
  if (!has('activities_50') && activities.length >= 50) newBadges.push('activities_50');
  if (!has('conqueror') && profile.wins > 0) newBadges.push('conqueror');
  if (!has('area_1km2') && profile.totalArea >= 1000000) newBadges.push('area_1km2');
  if (!has('xp_1000') && profile.xp >= 1000) newBadges.push('xp_1000');

  return newBadges;
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
