# TerraRun - Territory Conquest Fitness App

## Overview
TerraRun is a mobile fitness application that combines GPS activity tracking with a territory conquest gaming system. Users track their runs, walks, cycling, and hiking activities - when they complete a closed-loop route, the area inside becomes their claimed territory on the map.

## Current State
- Fully functional MVP with 4 main tabs: Map, Track, Activity, Profile
- GPS activity tracking with real-time stats (speed, distance, duration, calories)
- Territory system: closed-loop routes become polygons on the map
- Gamification: XP system, levels, 10 badges, leaderboard
- Notifications system for territory conquests and badge unlocks
- Editable username
- Dark theme with green (#00E676) accent

## Architecture
- **Frontend**: Expo Router with file-based routing, React Native
- **State**: AsyncStorage for local persistence, React Context for shared state
- **Maps**: react-native-maps (native only), web fallback for territory list
- **Fonts**: Rubik (Google Fonts)

## Project Structure
```
app/
  _layout.tsx           - Root layout with providers, fonts, StatusBar
  (tabs)/
    _layout.tsx         - Tab bar with 4 tabs (liquid glass on iOS 26)
    index.tsx           - Map/Territory view (default tab)
    track.tsx           - GPS activity tracking
    activity.tsx        - Activity history
    profile.tsx         - User profile, badges, notifications

components/
  MapViewWrapper.native.tsx - Native react-native-maps exports
  MapViewWrapper.web.tsx    - Web fallback (no-op components)
  ErrorBoundary.tsx
  ErrorFallback.tsx

lib/
  types.ts              - TypeScript interfaces
  geo-utils.ts          - GPS calculations, formatting
  storage.ts            - AsyncStorage CRUD operations
  app-context.tsx       - React Context provider
  query-client.ts       - API client (for future backend)

constants/
  colors.ts             - Dark theme color palette

server/
  index.ts              - Express server (landing page + API)
  routes.ts             - API routes
  storage.ts            - Server-side storage
```

## Key Technical Decisions
- Platform-specific files (.native.tsx / .web.tsx) for react-native-maps to avoid web bundling errors
- react-native-maps pinned to v1.18.0 for Expo Go compatibility
- Web simulation mode generates circular GPS routes for testing
- Rubik font family for energetic fitness aesthetic
- expo-crypto for UUID generation (not uuid package)

## User Preferences
- Dark mode default
- Production-ready quality
