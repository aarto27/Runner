export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike';

export interface GpsPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed?: number;
  altitude?: number;
}

export interface Activity {
  id: string;
  type: ActivityType;
  startTime: number;
  endTime: number;
  duration: number;
  distance: number;
  calories: number;
  avgSpeed: number;
  maxSpeed: number;
  route: GpsPoint[];
  territoryId?: string;
  xpEarned: number;
  steps?: number;
}

export interface Territory {
  id: string;
  ownerId: string;
  ownerName: string;
  polygon: { latitude: number; longitude: number }[];
  area: number;
  claimedAt: number;
  activityId: string;
  activityType: ActivityType;
  conquestCount: number;
  color: string;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  totalDistance: number;
  totalArea: number;
  totalActivities: number;
  xp: number;
  level: number;
  territories: number;
  wins: number;
  losses: number;
  badges: string[];
  joinedAt: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  xp: number;
  territories: number;
  totalArea: number;
}

export interface Notification {
  id: string;
  type: 'territory_stolen' | 'territory_conquered' | 'badge_earned' | 'level_up';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  data?: Record<string, unknown>;
}
