/**
 * LiquifyToolBar — 左右液化/恢复工具 + 中部滑杆，带滑动动画
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { LIQUIFY_BRUSH_SIZE } from '../constants/liquify';

export type LiquifyTool = 'push' | 'restore';

interface LiquifyToolBarProps {
  onLiquifyPress?: () => void;
  onRestorePress?: () => void;
  onBrushSizeChange?: (size: number) => void;
  onBrushSizeSlidingStart?: () => void;
  onBrushSizeSlidingComplete?: () => void;
  initialBrushSize?: number;
  minBrushSize?: number;
  maxBrushSize?: number;
  initialTool?: LiquifyTool;
  activeTool?: LiquifyTool;
}

const LiquifyToolBar: React.FC<LiquifyToolBarProps> = ({
  onLiquifyPress,
  onRestorePress,
  onBrushSizeChange,
  onBrushSizeSlidingStart,
  onBrushSizeSlidingComplete,
  initialBrushSize = LIQUIFY_BRUSH_SIZE.default,
  minBrushSize = LIQUIFY_BRUSH_SIZE.min,
  maxBrushSize = LIQUIFY_BRUSH_SIZE.max,
  initialTool = 'push',
  activeTool,
}) => {
  const [brushSize, setBrushSize] = useState(initialBrushSize);
  const [internalTool, setInternalTool] = useState<LiquifyTool>(initialTool);
  const resolvedTool = activeTool ?? internalTool;
  const [containerWidth, setContainerWidth] = useState(0);
  const [innerWidth, setInnerWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(resolvedTool === 'push' ? 0 : 1)).current;

  useEffect(() => {
    if (activeTool && activeTool !== internalTool) {
      setInternalTool(activeTool);
    }
  }, [activeTool, internalTool]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: resolvedTool === 'push' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [resolvedTool, slideAnim]);

  const handleLiquifyPress = () => {
    if (!activeTool) {
      setInternalTool('push');
    }
    onLiquifyPress?.();
  };
  const handleRestorePress = () => {
    if (!activeTool) {
      setInternalTool('restore');
    }
    onRestorePress?.();
  };
  const handleSizeChange = (value: number) => {
    setBrushSize(value);
    onBrushSizeChange?.(value);
  };

  // 布局计算
  const TOOL_WIDTH_RATIO = 0.14;
  const AVAILABLE_PCT = 1 - TOOL_WIDTH_RATIO * 2;
  const SLIDER_PCT = 0.6;
  const INNER_PADDING = 10;
  const GAP = -2;
  const HIGHLIGHT_PADDING = 15;
  const HIGHLIGHT_GAP = 4;
  const sliderWidthPx = Math.max(0, Math.round(innerWidth * SLIDER_PCT));
  const sliderLeftWhenLiquify =
    INNER_PADDING + Math.max(0, Math.round(innerWidth * TOOL_WIDTH_RATIO) + GAP);
  const sliderLeftWhenRestore = Math.max(
    sliderLeftWhenLiquify,
    INNER_PADDING +
      Math.round(innerWidth - innerWidth * TOOL_WIDTH_RATIO - sliderWidthPx - GAP)
  );
  const sliderLeftAnim = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [sliderLeftWhenLiquify, sliderLeftWhenRestore],
  });
  const sliderRightWhenLiquify = sliderLeftWhenLiquify + sliderWidthPx;
  const sliderRightWhenRestore = sliderLeftWhenRestore + sliderWidthPx;
  const contentStart = INNER_PADDING;
  const contentEnd = containerWidth > 0 ? containerWidth - INNER_PADDING : 0;
  const leftToolEnd = contentStart + innerWidth * TOOL_WIDTH_RATIO;
  const rightToolStart = contentEnd - innerWidth * TOOL_WIDTH_RATIO;
  const highlightPushLeft = Math.max(0, contentStart - HIGHLIGHT_PADDING);
  const highlightPushRight = Math.max(
    highlightPushLeft,
    Math.min(rightToolStart - HIGHLIGHT_GAP, sliderRightWhenLiquify + HIGHLIGHT_PADDING)
  );
  const highlightRestoreRight = Math.min(
    containerWidth > 0 ? containerWidth : sliderRightWhenRestore + HIGHLIGHT_PADDING,
    contentEnd + HIGHLIGHT_PADDING
  );
  const highlightRestoreLeft = Math.max(
    leftToolEnd + HIGHLIGHT_GAP,
    sliderLeftWhenRestore - HIGHLIGHT_PADDING
  );
  const highlightLeftAnim = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [highlightPushLeft, highlightRestoreLeft],
  });
  const highlightWidthAnim = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      Math.max(0, highlightPushRight - highlightPushLeft),
      Math.max(0, highlightRestoreRight - highlightRestoreLeft),
    ],
  });

  return (
    <View style={styles.container}>
      <View
        style={styles.centerContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width || 0;
          if (w && Math.abs(w - containerWidth) > 0.5) setContainerWidth(w);
          const inner = Math.max(0, w - INNER_PADDING * 2);
          if (Math.abs(inner - innerWidth) > 0.5) setInnerWidth(inner);
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.highlight, { left: highlightLeftAnim, width: highlightWidthAnim }]}
        />
        <TouchableOpacity
          style={[styles.toolButton, styles.leftToolButton]}
          onPress={handleLiquifyPress}
        >
          <Image
            source={require('../../assets/mingcute_pencil-line.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        {innerWidth > 0 ? (
          <>
            <View style={[styles.sliderSpacer, { width: innerWidth * AVAILABLE_PCT }]} />
            <Animated.View
              style={[
                styles.sliderContainerAbs,
                { width: sliderWidthPx, left: sliderLeftAnim },
              ]}
            >
              <Slider
                style={styles.slider}
                minimumValue={minBrushSize}
              maximumValue={maxBrushSize}
              value={brushSize}
              onValueChange={handleSizeChange}
              onSlidingStart={onBrushSizeSlidingStart}
              onSlidingComplete={onBrushSizeSlidingComplete}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#9E9E9E"
              thumbTintColor="#FFFFFF"
            />
          </Animated.View>
          </>
        ) : (
          <View style={styles.sliderContainerFlex}>
            <Slider
              style={styles.slider}
              minimumValue={minBrushSize}
              maximumValue={maxBrushSize}
              value={brushSize}
              onValueChange={handleSizeChange}
              onSlidingStart={onBrushSizeSlidingStart}
              onSlidingComplete={onBrushSizeSlidingComplete}
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#9E9E9E"
              thumbTintColor="#FFFFFF"
            />
          </View>
        )}
        <TouchableOpacity
          style={[styles.toolButton, styles.rightToolButton]}
          onPress={handleRestorePress}
        >
          <Image
            source={require('../../assets/tabler_eraser.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 35,
    height: 71,
    width: '100%',
  },
  centerContainer: {
    flex: 1,
    height: 48,
    backgroundColor: '#f3f3f3',
    borderRadius: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(200,200,200,0.9)',
    borderRadius: 43,
    zIndex: 0,
  },
  toolButton: {
    width: '15%',
    height: '100%',
    justifyContent: 'center',
    zIndex: 2,
  },
  leftToolButton: {
    alignItems: 'flex-end',
    paddingLeft: 42,
  },
  rightToolButton: {
    alignItems: 'flex-start',
    paddingRight: 42,
  },
  sliderContainerFlex: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    zIndex: 1,
    paddingHorizontal: 10,
  },
  sliderContainerAbs: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
    paddingHorizontal: 6,
  },
  sliderSpacer: {
    flex: 1,
    height: '100%',
  },
  slider: {
    width: '100%',
    height: 38,
  },
  icon: {
    width: 24,
    height: 24,
  },
});

export default LiquifyToolBar;
export type { LiquifyToolBarProps };
