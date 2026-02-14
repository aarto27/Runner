import { GpsPoint } from './types';

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function calculateTotalDistance(points: GpsPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateDistance(
      points[i - 1].latitude, points[i - 1].longitude,
      points[i].latitude, points[i].longitude
    );
  }
  return total;
}

export function calculateCalories(distanceMeters: number, type: string, durationSeconds: number): number {
  const met: Record<string, number> = {
    run: 9.8, walk: 3.5, cycle: 7.5, hike: 6.0
  };
  const weightKg = 70;
  const hours = durationSeconds / 3600;
  return Math.round((met[type] || 5) * weightKg * hours);
}

export function isClosedLoop(points: GpsPoint[], thresholdMeters: number = 100): boolean {
  if (points.length < 10) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const dist = calculateDistance(first.latitude, first.longitude, last.latitude, last.longitude);
  return dist <= thresholdMeters;
}

export function calculatePolygonArea(polygon: { latitude: number; longitude: number }[]): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = polygon[i].longitude * (Math.PI / 180) * 6371000 * Math.cos(polygon[i].latitude * Math.PI / 180);
    const yi = polygon[i].latitude * (Math.PI / 180) * 6371000;
    const xj = polygon[j].longitude * (Math.PI / 180) * 6371000 * Math.cos(polygon[j].latitude * Math.PI / 180);
    const yj = polygon[j].latitude * (Math.PI / 180) * 6371000;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area) / 2;
}

export function simplifyRoute(points: GpsPoint[], tolerance: number = 0.00005): GpsPoint[] {
  if (points.length <= 2) return points;
  const result = douglasPeucker(points, tolerance);
  return result;
}

function douglasPeucker(points: GpsPoint[], tolerance: number): GpsPoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;

  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(point: GpsPoint, lineStart: GpsPoint, lineEnd: GpsPoint): number {
  const dx = lineEnd.longitude - lineStart.longitude;
  const dy = lineEnd.latitude - lineStart.latitude;

  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      (point.longitude - lineStart.longitude) ** 2 +
      (point.latitude - lineStart.latitude) ** 2
    );
  }

  const t = ((point.longitude - lineStart.longitude) * dx + (point.latitude - lineStart.latitude) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));

  const closestX = lineStart.longitude + clampedT * dx;
  const closestY = lineStart.latitude + clampedT * dy;

  return Math.sqrt((point.longitude - closestX) ** 2 + (point.latitude - closestY) ** 2);
}

export function getRouteCenter(points: { latitude: number; longitude: number }[]): { latitude: number; longitude: number } {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const sum = points.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  );
  return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
}

export function getRouteBounds(points: { latitude: number; longitude: number }[]) {
  if (points.length === 0) return { latDelta: 0.01, lonDelta: 0.01 };
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }
  return {
    latDelta: Math.max((maxLat - minLat) * 1.3, 0.005),
    lonDelta: Math.max((maxLon - minLon) * 1.3, 0.005),
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) return `${Math.round(sqMeters)} m\u00B2`;
  const hectares = sqMeters / 10000;
  if (hectares < 100) return `${hectares.toFixed(1)} ha`;
  return `${(sqMeters / 1000000).toFixed(2)} km\u00B2`;
}

export function formatSpeed(metersPerSecond: number): string {
  const kmh = metersPerSecond * 3.6;
  return `${kmh.toFixed(1)} km/h`;
}
