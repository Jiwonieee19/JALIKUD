import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION = 600;
// Failsafes so the full-screen logo can never trap the app: the native
// splash hide is raced against a timeout, and the overlay force-dismisses
// even if the worklet animation callback never fires on-device.
const HIDE_TIMEOUT_MS = 2000;
const FORCE_DISMISS_MS = 4000;

function hideNativeSplash(onHidden: () => void): void {
  Promise.race([
    SplashScreen.hideAsync(),
    new Promise((resolve) => setTimeout(resolve, HIDE_TIMEOUT_MS)),
  ])
    .catch(() => undefined)
    .finally(onHidden);
}

export function SplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const failsafe = setTimeout(() => setVisible(false), FORCE_DISMISS_MS);
    return () => clearTimeout(failsafe);
  }, []);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  const image = <Image contentFit="contain" style={styles.image} source={require('@/assets/images/jalikud-logo.png')} />;

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        hideNativeSplash(() => setAnimate(true));
      }}
      style={styles.splashOverlay}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 160,
    height: 181,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
