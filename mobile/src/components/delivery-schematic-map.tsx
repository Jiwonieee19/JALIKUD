import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export type SchematicPoint = { latitude: number; longitude: number };

type Props = {
  route: SchematicPoint[];
  rider: SchematicPoint | null;
  showRider: boolean;
  progress: number;
  customerName: string;
};

const RED = '#DC2626';
const PAD = 0.14;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function routeBounds(route: SchematicPoint[]) {
  const lats = route.map((p) => p.latitude);
  const lngs = route.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    spanLat: Math.max(maxLat - minLat, 0.0001),
    spanLng: Math.max(maxLng - minLng, 0.0001),
  };
}

function project(p: SchematicPoint, b: ReturnType<typeof routeBounds>) {
  return {
    x: PAD + ((p.longitude - b.minLng) / b.spanLng) * (1 - PAD * 2),
    y: PAD + ((b.maxLat - p.latitude) / b.spanLat) * (1 - PAD * 2),
  };
}

function toXY(route: SchematicPoint[]) {
  const bounds = routeBounds(route);
  return route.map((p) => project(p, bounds));
}

/** Offline demo map: street grid + red route line + rider dot. Pinch/buttons zoom. */
export default function DeliverySchematicMap({ route, rider, showRider, progress, customerName }: Props) {
  const pts = toXY(route);
  // Project the rider onto the same normalization as the full route so the
  // dot actually travels from store to house as `progress` increases.
  const bounds = routeBounds(route);
  const riderXY = rider ? project(rider, bounds) : null;
  const start = pts[0];
  const end = pts[pts.length - 1];

  // Smooth-glide rider: stable Animated.Values created once via useState,
  // eased toward each new position. Parent ticks every 900ms; we animate
  // 850ms so the dot visibly glides instead of jumping.
  const [anim] = useState(() => ({
    x: new Animated.Value(riderXY?.x ?? 0.2),
    y: new Animated.Value(riderXY?.y ?? 0.2),
  }));
  const riderStyle = useMemo(
    () => ({
      left: anim.x.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      top: anim.y.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
    }),
    [anim],
  );
  const targetX = riderXY?.x;
  const targetY = riderXY?.y;
  useMemo(() => {
    if (targetX === undefined || targetY === undefined) return;
    Animated.parallel([
      Animated.timing(anim.x, { toValue: targetX, duration: 850, useNativeDriver: false }),
      Animated.timing(anim.y, { toValue: targetY, duration: 850, useNativeDriver: false }),
    ]).start();
  }, [targetX, targetY, anim]);

  // Zoom + pan state (pinch gesture + +/- buttons). Scale is applied to the
  // inner content layer; pan is clamped so the route can't be lost offscreen.
  const [zoom, setZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [committed, setCommitted] = useState({ zoom: 1, translate: { x: 0, y: 0 } });
  const clampPan = (x: number, y: number, z: number) => {
    const spread = 0.35 * (z - 1);
    return {
      x: Math.min(spread, Math.max(-spread, x)),
      y: Math.min(spread, Math.max(-spread, y)),
    };
  };
  const applyZoom = (next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    const t = clampPan(translate.x, translate.y, z);
    setCommitted({ zoom: z, translate: t });
    setZoom(z);
    setTranslate(t);
  };
  const composed = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onUpdate((e) => {
        const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, committed.zoom * e.scale));
        const t = clampPan(committed.translate.x, committed.translate.y, z);
        setZoom(z);
        setTranslate(t);
      })
      .onEnd(() => {
        setCommitted((c) => ({ ...c, zoom }));
      });
    const drag = Gesture.Pan()
      .onUpdate((e) => {
        const t = clampPan(
          committed.translate.x + e.translationX / 400,
          committed.translate.y + e.translationY / 400,
          committed.zoom,
        );
        setTranslate(t);
      })
      .onEnd(() => {
        setCommitted((c) => ({ ...c, translate }));
      });
    return Gesture.Simultaneous(pinch, drag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed]);

  return (
    <View style={styles.map}>
      <GestureDetector gesture={composed}>
        <View style={styles.gestureFill}>
          <Animated.View
            style={[
              styles.zoomLayer,
              {
                transform: [
                  { scale: zoom },
                  { translateX: translate.x * 400 },
                  { translateY: translate.y * 400 },
                ],
              },
            ]}>
            {[0.2, 0.4, 0.6, 0.8].map((t) => (
              <View key={'v' + t} style={[styles.gridV, { left: (t * 100 + '%') as DimensionValue }]} />
            ))}
            {[0.25, 0.5, 0.75].map((t) => (
              <View key={'h' + t} style={[styles.gridH, { top: (t * 100 + '%') as DimensionValue }]} />
            ))}
            <View style={styles.park} />
            <View style={styles.river} />
            {pts.map((p, i) =>
              i === 0 ? null : (
                <RouteSeg key={i} a={pts[i - 1]} b={p} done={i / (pts.length - 1) <= progress} />
              ),
            )}
            {pts.map((p, i) => (
              <View key={'d' + i} style={[styles.dot, pos(p)]} />
            ))}
            <View style={[styles.pin, pos(start)]}>
              <Text style={styles.pinIcon}>🏪</Text>
              <Text style={styles.pinLabel}>Store</Text>
            </View>
            <View style={[styles.pin, styles.housePin, pos(end)]}>
              <Text style={styles.pinIcon}>🏠</Text>
              <Text style={styles.pinLabel}>{customerName}</Text>
            </View>
            {showRider && riderXY && (
              <Animated.View style={[styles.rider, riderStyle]}>
                <Text style={styles.riderIcon}>🛵</Text>
              </Animated.View>
            )}
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.zoomControls}>
        <Pressable
          style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}
          onPress={() => applyZoom(zoom + 0.5)}>
          <Text style={styles.zoomText}>＋</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}
          onPress={() => applyZoom(zoom - 0.5)}>
          <Text style={styles.zoomText}>－</Text>
        </Pressable>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Not to scale</Text>
      </View>
    </View>
  );
}

function pos(p: { x: number; y: number }): { left: DimensionValue; top: DimensionValue } {
  return { left: ((p.x * 100 + '%') as DimensionValue), top: ((p.y * 100 + '%') as DimensionValue) };
}

function RouteSeg({ a, b, done }: { a: { x: number; y: number }; b: { x: number; y: number }; done: boolean }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <View
      style={{
        position: 'absolute',
        left: ((a.x * 100 + '%') as DimensionValue),
        top: ((a.y * 100 + '%') as DimensionValue),
        width: ((len * 100 + '%') as DimensionValue),
        height: 4,
        backgroundColor: done ? RED : '#F0A5A5',
        borderRadius: 2,
        transform: [{ translateY: -2 }, { rotate: (ang + 'deg') as `${number}deg` }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#E8EDF3', overflow: 'hidden' },
  gestureFill: { flex: 1 },
  zoomLayer: { flex: 1 },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#FFFFFF', opacity: 0.9 },
  gridH: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#FFFFFF', opacity: 0.9 },
  park: { position: 'absolute', left: '8%', top: '10%', width: '26%', height: '18%', backgroundColor: '#D3E9D2', borderRadius: 14 },
  river: { position: 'absolute', left: '-10%', right: '-10%', top: '68%', height: 26, backgroundColor: '#C9E2F5', borderRadius: 13, transform: [{ rotate: '-8deg' }] },
  dot: { position: 'absolute', width: 7, height: 7, borderRadius: 3.5, backgroundColor: RED, marginLeft: -3.5, marginTop: -3.5 },
  pin: { position: 'absolute', alignItems: 'center', marginLeft: -24, marginTop: -52, width: 48 },
  housePin: { marginTop: -52 },
  pinIcon: { fontSize: 26, textAlign: 'center' },
  pinLabel: { fontSize: 10, fontWeight: '800', color: '#374151', backgroundColor: '#FFF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2, overflow: 'hidden' },
  rider: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', borderWidth: 3, borderColor: RED, alignItems: 'center', justifyContent: 'center', marginLeft: -22, marginTop: -22, elevation: 5 },
  riderIcon: { fontSize: 20 },
  badge: { position: 'absolute', left: 12, bottom: 296, backgroundColor: 'rgba(28,28,30,0.72)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  zoomControls: { position: 'absolute', right: 12, top: 150, gap: 8 },
  zoomButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  zoomText: { color: '#1C1C1E', fontSize: 18, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
