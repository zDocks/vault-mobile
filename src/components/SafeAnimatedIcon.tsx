import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SafeAnimatedIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  animated?: boolean;
}

export const SafeAnimatedIcon: React.FC<SafeAnimatedIconProps> = ({
  size = 120,
  color = '#FFFFFF',
  strokeWidth = 6,
  animated = false,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      // Rotate 360 degrees with authentic mechanical lock clicks (tumbler simulation)
      rotation.value = withRepeat(
        withSequence(
          withTiming(90, { duration: 400, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
          withTiming(90, { duration: 120 }), // tumbler pause click
          withTiming(210, { duration: 450, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
          withTiming(210, { duration: 100 }), // tumbler pause click
          withTiming(360, { duration: 550, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
          withTiming(360, { duration: 250 }) // lock rest
        ),
        -1,
        false
      );
    }
  }, [animated]);

  const animatedWheelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Outer static brackets */}
      <Svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        style={StyleSheet.absoluteFill}
      >
        {/* Top Left Corner */}
        <Path
          d="M 16 34 L 16 26 A 10 10 0 0 1 26 16 L 34 16"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Top Right Corner */}
        <Path
          d="M 66 16 L 74 16 A 10 10 0 0 1 84 26 L 84 34"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Bottom Left Corner */}
        <Path
          d="M 16 66 L 16 74 A 10 10 0 0 0 26 84 L 34 84"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Bottom Right Corner */}
        <Path
          d="M 66 84 L 74 84 A 10 10 0 0 0 84 74 L 84 66"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      {/* Rotating Wheel (Circle + 4 Handles + Center Dot) */}
      <Animated.View
        style={[
          styles.wheelContainer,
          { width: size, height: size },
          animated ? animatedWheelStyle : undefined,
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          {/* Central Safe Ring */}
          <Circle
            cx="50"
            cy="50"
            r="10"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* Central Dot */}
          <Circle cx="50" cy="50" r="2.5" fill={color} />

          {/* 4 Handles/Spokes with rounded tips - smaller & more proportional */}
          <Line
            x1="50"
            y1="40"
            x2="50"
            y2="32"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="50"
            y1="60"
            x2="50"
            y2="68"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="40"
            y1="50"
            x2="32"
            y2="50"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <Line
            x1="60"
            y1="50"
            x2="68"
            y2="50"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
