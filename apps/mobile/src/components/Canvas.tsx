import * as React from 'react'; // 引入 React 以使用函数组件与 hooks
import {
  Canvas as SkiaCanvas, // SkiaCanvas 是 Skia 提供的画布组件
  Image as SkiaImage, // SkFallback：未构建网格时仍可绘制原图
  useImage, // useImage hook 负责加载并缓存图片资源
  Skia,
  Group, // Group 提供变换分组能力
  Circle,
  Vertices,
  TileMode,
  FilterMode,
  MipmapMode,
  VertexMode,
  BlendMode,
  ImageFormat,
  type SkImage,
} from '@shopify/react-native-skia'; // 从 Skia 库导入绘图相关 API
import { View, StyleSheet, Animated as RNAnimated, Easing, Platform, AppState } from 'react-native'; // View 用于布局包装，StyleSheet 管理样式
import {
  Gesture, // Gesture 构造各种手势对象
  GestureDetector, // GestureDetector 绑定手势到某个视图
  State,
  type GestureTouchEvent,
  type GestureUpdateEvent,
  type PanGestureHandlerEventPayload, // Pan 手势事件类型
  type PinchGestureHandlerEventPayload, // Pinch 手势事件类型
} from 'react-native-gesture-handler'; // 来自 RNGH 的手势识别工具
import Animated, {
  SharedValue, // SharedValue 用于跨线程共享数值
  runOnJS, // runOnJS 允许在 worklet 中回调 JS 函数
  runOnUI,
  useAnimatedReaction, // useAnimatedReaction 监听 SharedValue 变化
  useAnimatedStyle, // useAnimatedStyle 创建动画驱动的样式
  useSharedValue, // useSharedValue 初始化共享值
  withTiming,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated'; // 来自 Reanimated 的动画工具集
// 已移除 MediaPipe/FaceMesh 相关可视化，保留基础画布与手势能力
// 使用 legacy API 以兼容当前写文件逻辑，避免新 API 警告
import * as FileSystem from 'expo-file-system/legacy';
import RNFS from 'react-native-fs';
import {
  LiquifyEngine,
  type LiquifyEngineConfig,
  type LiquifyBrushParams,
  type ExportedMesh,
} from '../services/liquify/engine';
import LiquifyDisplacementView, {
  type LiquifyBrushCommandPayload,
  type LiquifyDisplacementViewHandle,
} from '../native/LiquifyDisplacementView';
import { FEATURE_FLAGS } from '../constants';
import i18n from '../constants/i18n';
import type { LiquifyBrushMetrics } from '../types/liquify';
import { LIQUIFY_BRUSH_SIZE } from '../constants/liquify';

interface CanvasProps {
  width: number; // 画布宽度
  height: number; // 画布高度
  backgroundImage?: string; // 背景图片的资源路径，可能为空
  originalImage?: string; // 原图路径（用于“查看原图”预览）
  zoomLevel: SharedValue<number>; // 缩放比例共享值
  panOffsetX: SharedValue<number>; // 水平平移偏移共享值
  panOffsetY: SharedValue<number>; // 垂直平移偏移共享值
  landmarkOverlays?: LandmarkOverlay[];
  showLandmarks?: boolean;
  // 液化相关
  mode?: 'view' | 'liquify';
  liquifyTool?: 'push' | 'restore';
  liquifyBrushSize?: number; // 画笔像素半径（相对于画布）
  liquifyDensity?: number;
  liquifyIntensity?: number;
  liquifySmoothing?: number;
  liquifyMaxMagnitude?: number;
  liquifyFalloff?: number;
  liquifyNativeFalloff?: number;
  liquifyStrengthScale?: number;
  liquifyCenterDampen?: number;
  liquifyEdgeBoost?: number;
  liquifyStepFactor?: number;
  liquifyDecayCurve?: number;
  liquifyCenterResponseMin?: number;
  liquifyCenterResponseMax?: number;
  liquifyEdgeResponseMin?: number;
  liquifyEdgeResponseMax?: number;
  liquifyStepFactorMin?: number;
  liquifyStepFactorMax?: number;
  liquifyGradientScaleMax?: number;
  liquifyRestoreBoost?: number;
  liquifyRestoreToOriginal?: boolean;
  liquifySoftK?: number;
  liquifyRippleStart?: number;
  liquifyRippleEnd?: number;
  liquifyRippleMix?: number;
  liquifyRippleSmooth?: number;
  liquifyPerformanceMode?: boolean;
  // 黑白贴图相关参数
  bwThresholdRatio?: number;
  bwMaskBlurFactor?: number;
  bwMaskAlphaGain?: number;
  bwSharpenAmount?: number;
  liquifyPreviewShowWeights?: boolean;
  liquifyPreviewShowVectors?: boolean;
  liquifyPreviewShowBrushProfile?: boolean;
  previewIndicatorVisible?: boolean;
  showOriginal?: boolean;
  onLiquifyRenderPathChange?: (path: 'native' | 'skia') => void;
  onLiquifyMetricsChange?: (metrics: LiquifyBrushMetrics) => void;
  onLiquifyHistoryChange?: (state: {
    canUndo: boolean;
    canRedo: boolean;
    historyLength: number;
    index: number;
  }) => void;
}

type NormalizedPoint = { x: number; y: number };

export interface LandmarkOverlay {
  id: string;
  color: string;
  points: NormalizedPoint[];
}

type ApplyGrayscaleOverlayOptions = {
  applyPreview?: boolean;
};

export interface CanvasHandle {
  resetLiquify: () => void;
  undoLiquify: () => void;
  redoLiquify: () => void;
  refreshLiquify: () => void;
  rehydrateLiquify: () => void;
  exportLiquifiedImage: () => Promise<string | null>;
  applyGrayscaleOverlay: (options?: ApplyGrayscaleOverlayOptions) => Promise<string | null>;
}

const FOCAL_MARKER_SIZE = 18; // 双指缩放时质心标记的尺寸
const FOCAL_MARKER_RADIUS = FOCAL_MARKER_SIZE / 2; // 质心标记半径
// 提示：网格/描边已移除，如需后续叠加其他图层可在此定义样式常量
const GRID_STROKE_WIDTH = 1.25;
const LANDMARK_DOT_RADIUS = 2.4;

// clamp 是 Reanimated 中的 worklet，用于限制数值在指定区间
const clamp = (value: number, lower: number, upper: number) => {
  'worklet'; // 声明该函数体在 UI 线程执行
  return Math.min(Math.max(value, lower), upper); // 先限制下限再限制上限
};
const clampNumber = (value: number, lower: number, upper: number) =>
  Math.min(Math.max(value, lower), upper);

// 为了让“慢推/快推”强度一致：这里的笔刷参数不再随 speed / deltaTime 波动，
// 只保留与半径/压力相关的轻量调制（压力在手指操作时通常为 1）。
const computeBrushBlendValue = (_pressure: number) => 0.85;

const computeBrushSoftnessValue = (radiusNorm: number) => {
  const normalizedRadius = clampNumber(radiusNorm, 0.01, 0.6) / 0.6;
  const radiusBias = (1 - normalizedRadius) * 0.55;
  return clampNumber(0.2 + radiusBias, 0.1, 0.65);
};

const computeCenterResponseValue = (base: number, minValue: number, maxValue: number) =>
  clampNumber(base, minValue, maxValue);

const computeEdgeResponseValue = (base: number, minValue: number, maxValue: number) =>
  clampNumber(base, minValue, maxValue);

const computeStepFactorValue = (base: number, minValue: number, maxValue: number) =>
  clampNumber(base, minValue, maxValue);

const computeGradientLimitValue = (radiusNorm: number, pressure: number) => {
  const radius = clampNumber(radiusNorm, 0.01, 0.45);
  const pressureCurve = clampNumber(pressure, 0.05, 2);
  const base = radius * (0.55 + pressureCurve * 0.25);
  return clampNumber(base, 0.015, 0.55);
};

type TouchPoint = { x: number; y: number };

const computeCentroid = (touches: TouchPoint[]) => {
  'worklet';
  const count = touches.length;
  if (count === 0) {
    return { x: 0, y: 0 };
  }

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < count; i += 1) {
    const touch = touches[i];
    sumX += touch.x;
    sumY += touch.y;
  }

  const inverse = 1 / count;
  return {
    x: sumX * inverse,
    y: sumY * inverse,
  };
};

type ExtendedPanGestureEvent = PanGestureHandlerEventPayload & {
  timestamp?: number;
  time?: number;
  pressure?: number;
  force?: number;
  stylusData?: {
    pressure?: number;
  };
};

const MIN_LIQUIFY_DELTA_TIME = 1 / 240;
const LIQUIFY_MAX_SUBSTEPS = 8;
const LIQUIFY_MAX_STEP_RADIUS_RATIO = 0.25;
const LIQUIFY_FLUSH_INTERVAL_MS = 16;
const LIQUIFY_NATIVE_FLUSH_INTERVAL_MS = 28;
const NATIVE_SNAPSHOT_KEEP_COUNT = 12;

type PointerInfo = {
  u: number;
  v: number;
  adjustedX: number;
  adjustedY: number;
  zoom: number;
  invZoom: number;
  fittedWidth: number;
  fittedHeight: number;
};

type PreviewPoint = {
  normalizedX: number;
  normalizedY: number;
  objectX: number;
  objectY: number;
};

const PREVIEW_WINDOW_SIZE = 120;
const PREVIEW_WINDOW_MARGIN = 12;
const PREVIEW_BORDER_WIDTH = 1;
const PREVIEW_BORDER_RADIUS = 10;
const ORIGINAL_PREVIEW_SNAPSHOT_INDEX = 999;
const NATIVE_HISTORY_SNAPSHOT_START_INDEX = 1000;

type EngineApplyCommand = {
  u: number;
  v: number;
  params: LiquifyBrushParams & { applySmoothing?: boolean };
};

type RecordedStroke = {
  engineCommands: EngineApplyCommand[];
  nativeCommands: LiquifyBrushCommandPayload[];
};

type DisplacementSnapshot = {
  cols: number;
  rows: number;
  deformX: Float32Array;
  deformY: Float32Array;
};

const LIQUIFY_DRAFT_VERSION = 1;
const LIQUIFY_DRAFT_FILE_PREFIX = 'liquify-draft-v1';
const LIQUIFY_DRAFT_PERSIST_DELAY_MS = 220;
const LIQUIFY_NATIVE_STATE_FILE_PREFIX = 'liquify-native-state-v1';
const LIQUIFY_DEBUG_LOGS = false;
const LIQUIFY_RECOVERY_LOGS = true;

const liquifyDebugLog = (...args: unknown[]) => {
  if (!LIQUIFY_DEBUG_LOGS) {
    return;
  }
  console.log(...args);
};

const liquifyRecoveryWarn = (tag: string, payload?: Record<string, unknown>) => {
  if (!LIQUIFY_RECOVERY_LOGS) {
    return;
  }
  if (payload) {
    console.warn(tag, payload);
    return;
  }
  console.warn(tag);
};

type LiquifyDraftPayload = {
  version: typeof LIQUIFY_DRAFT_VERSION;
  imagePath: string;
  historyIndex: number;
  savedAt: number;
  strokes: RecordedStroke[];
};

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildLiquifyDraftFilePath = (imagePath?: string) => {
  if (!imagePath) {
    return null;
  }
  const normalizedPath = imagePath.trim();
  if (!normalizedPath) {
    return null;
  }
  const rootDir = RNFS.DocumentDirectoryPath || RNFS.CachesDirectoryPath;
  if (!rootDir) {
    return null;
  }
  const hash = hashString(normalizedPath).toString(16);
  return `${rootDir}/${LIQUIFY_DRAFT_FILE_PREFIX}-${hash}.json`;
};

const buildLiquifyNativeStateFilePath = (imagePath?: string) => {
  if (!imagePath) {
    return null;
  }
  const normalizedPath = imagePath.trim();
  if (!normalizedPath) {
    return null;
  }
  const rootDir = RNFS.DocumentDirectoryPath || RNFS.CachesDirectoryPath;
  if (!rootDir) {
    return null;
  }
  const hash = hashString(normalizedPath).toString(16);
  return `${rootDir}/${LIQUIFY_NATIVE_STATE_FILE_PREFIX}-${hash}.bin`;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const LIQUIFY_TOOL_SET = new Set(['push', 'pull', 'expand', 'shrink', 'smooth', 'restore']);
const isLiquifyTool = (value: unknown): value is LiquifyBrushParams['tool'] =>
  typeof value === 'string' && LIQUIFY_TOOL_SET.has(value);

const cloneEngineParamsFromDraft = (value: unknown): (LiquifyBrushParams & { applySmoothing?: boolean }) | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (!isLiquifyTool(raw.tool)) {
    return null;
  }
  if (!isFiniteNumber(raw.radius) || !isFiniteNumber(raw.strength)) {
    return null;
  }
  const params: LiquifyBrushParams & { applySmoothing?: boolean } = {
    tool: raw.tool,
    radius: raw.radius,
    strength: raw.strength,
  };
  if (
    raw.vector &&
    typeof raw.vector === 'object' &&
    isFiniteNumber((raw.vector as Record<string, unknown>).dx) &&
    isFiniteNumber((raw.vector as Record<string, unknown>).dy)
  ) {
    params.vector = {
      dx: (raw.vector as Record<string, number>).dx,
      dy: (raw.vector as Record<string, number>).dy,
    };
  }
  if (typeof raw.applySmoothing === 'boolean') {
    params.applySmoothing = raw.applySmoothing;
  }
  if (isFiniteNumber(raw.brushBlend)) {
    params.brushBlend = raw.brushBlend;
  }
  if (isFiniteNumber(raw.brushSoftness)) {
    params.brushSoftness = raw.brushSoftness;
  }
  if (isFiniteNumber(raw.centerDampen)) {
    params.centerDampen = raw.centerDampen;
  }
  if (isFiniteNumber(raw.edgeBoost)) {
    params.edgeBoost = raw.edgeBoost;
  }
  if (isFiniteNumber(raw.stepFactor)) {
    params.stepFactor = raw.stepFactor;
  }
  if (isFiniteNumber(raw.decayCurve)) {
    params.decayCurve = raw.decayCurve;
  }
  if (isFiniteNumber(raw.gradientLimit)) {
    params.gradientLimit = raw.gradientLimit;
  }
  return params;
};

const cloneEngineCommandFromDraft = (value: unknown): EngineApplyCommand | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (!isFiniteNumber(raw.u) || !isFiniteNumber(raw.v)) {
    return null;
  }
  const params = cloneEngineParamsFromDraft(raw.params);
  if (!params) {
    return null;
  }
  return {
    u: raw.u,
    v: raw.v,
    params,
  };
};

const cloneNativeCommandFromDraft = (value: unknown): LiquifyBrushCommandPayload | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (!isLiquifyTool(raw.tool)) {
    return null;
  }
  if (
    !isFiniteNumber(raw.x) ||
    !isFiniteNumber(raw.y) ||
    !isFiniteNumber(raw.dx) ||
    !isFiniteNumber(raw.dy) ||
    !isFiniteNumber(raw.radius) ||
    !isFiniteNumber(raw.strength)
  ) {
    return null;
  }
  const command: LiquifyBrushCommandPayload = {
    x: raw.x,
    y: raw.y,
    dx: raw.dx,
    dy: raw.dy,
    radius: raw.radius,
    strength: raw.strength,
    tool: raw.tool,
  };
  if (isFiniteNumber(raw.pressure)) {
    command.pressure = raw.pressure;
  }
  return command;
};

const cloneStrokeForDraft = (stroke: RecordedStroke): RecordedStroke => ({
  engineCommands: stroke.engineCommands.map((cmd) => ({
    u: cmd.u,
    v: cmd.v,
    params: {
      ...cmd.params,
      vector: cmd.params.vector ? { ...cmd.params.vector } : undefined,
    },
  })),
  nativeCommands: stroke.nativeCommands.map((cmd) => ({ ...cmd })),
});

const cloneStrokeFromDraft = (value: unknown): RecordedStroke | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const rawEngine = Array.isArray(raw.engineCommands) ? raw.engineCommands : [];
  const rawNative = Array.isArray(raw.nativeCommands) ? raw.nativeCommands : [];
  const engineCommands = rawEngine
    .map((cmd) => cloneEngineCommandFromDraft(cmd))
    .filter((cmd): cmd is EngineApplyCommand => Boolean(cmd));
  const nativeCommands = rawNative
    .map((cmd) => cloneNativeCommandFromDraft(cmd))
    .filter((cmd): cmd is LiquifyBrushCommandPayload => Boolean(cmd));
  if (!engineCommands.length && !nativeCommands.length) {
    return null;
  }
  return {
    engineCommands,
    nativeCommands,
  };
};

// CanvasComponent 暴露给外部的画布组件，负责处理缩放 / 平移等交互逻辑
const CanvasComponent = React.forwardRef<CanvasHandle, CanvasProps>((props, _ref) => {
  const {
    width, // 传入的画布宽度
    height, // 传入的画布高度
    backgroundImage, // 背景图资源
    originalImage, // 原图资源（用于“查看原图”）
    zoomLevel, // 缩放共享值
    panOffsetX, // 水平偏移共享值
    panOffsetY, // 垂直偏移共享值
    landmarkOverlays = [],
    showLandmarks = true,
    mode = 'view',
    liquifyTool = 'push',
    liquifyBrushSize = LIQUIFY_BRUSH_SIZE.default,
    liquifyDensity = 60,
    liquifyIntensity = 0.5,
    liquifySmoothing = 0.4,
    liquifyMaxMagnitude = 0.7,
    liquifyFalloff = 0.4,
    liquifyNativeFalloff = 0.5,
    liquifyStrengthScale = 1,
    liquifyCenterDampen = 0.6,
    liquifyEdgeBoost = 1.15,
    liquifyStepFactor = 0.8,
    liquifyDecayCurve = 1.3,
    liquifyPreviewShowWeights = false,
    liquifyPreviewShowVectors = false,
    liquifyPreviewShowBrushProfile = false,
    previewIndicatorVisible = false,
    showOriginal = false,
    liquifyCenterResponseMin = 0.2,
    liquifyCenterResponseMax = 1.5,
  liquifyEdgeResponseMin = 0.6,
  liquifyEdgeResponseMax = 2.4,
  liquifyStepFactorMin = 0.05,
  liquifyStepFactorMax = 3,
  liquifyGradientScaleMax = 1.5,
  liquifyRestoreBoost = 1.35,
  liquifyRestoreToOriginal = false,
  liquifySoftK = 0.25,
  liquifyRippleStart = 1.3,
  liquifyRippleEnd = 2.3,
    liquifyRippleMix = 0.3,
    liquifyRippleSmooth = 0.22,
    liquifyPerformanceMode = false,
    bwThresholdRatio = 0.15,
    bwMaskBlurFactor = 0.45,
    bwMaskAlphaGain = 2,
    bwSharpenAmount = 0,
    onLiquifyRenderPathChange,
    onLiquifyMetricsChange,
    onLiquifyHistoryChange,
  } = props;
  const previewEnabled =
    Boolean(liquifyPreviewShowWeights) ||
    Boolean(liquifyPreviewShowVectors) ||
    Boolean(liquifyPreviewShowBrushProfile);
  const isOriginalView = Boolean(showOriginal);
  const metricsEnabled = Boolean(onLiquifyMetricsChange);
  const strokeHistoryRef = React.useRef<RecordedStroke[]>([]);
  const historyIndexRef = React.useRef(0);
  const currentStrokeRef = React.useRef<RecordedStroke | null>(null);
  const isReplayingRef = React.useRef(false);
  const displacementSnapshotsRef = React.useRef<DisplacementSnapshot[]>([]);
  const nativeHistorySnapshotIdsRef = React.useRef<Array<number | null>>([]);
  const nativeReusableSnapshotIdsRef = React.useRef<number[]>([]);
  const nativeSnapshotNextIdRef = React.useRef(NATIVE_HISTORY_SNAPSHOT_START_INDEX);
  const lastBackgroundImageRef = React.useRef<string | null>(backgroundImage ?? null);
  const nativeLiquifyRef = React.useRef<LiquifyDisplacementViewHandle | null>(null);
  const liquifyEngineRef = React.useRef<LiquifyEngine | null>(null);
  const lastLiquifyTimestampRef = React.useRef<number | null>(null);
  const liquifyStrokeDistanceRef = React.useRef(0);
  const liquifyDraftPathRef = React.useRef<string | null>(buildLiquifyDraftFilePath(backgroundImage));
  const liquifyNativeStatePathRef = React.useRef<string | null>(buildLiquifyNativeStateFilePath(backgroundImage));
  const liquifyDraftTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const liquifyDraftRevisionRef = React.useRef(0);
  const liquifyDraftSavedRevisionRef = React.useRef(-1);
  const liquifyDraftRestoredImageRef = React.useRef<string | null>(null);
  const restoringDraftRef = React.useRef(false);
  const restoringNativeStateRef = React.useRef(false);
  const [canvasTransform, setCanvasTransform] = React.useState({
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const latestTransform = React.useRef(canvasTransform);
  const transformRaf = React.useRef<number | null>(null);
  const [meshVersion, setMeshVersion] = React.useState(0);
  const meshRaf = React.useRef<number | null>(null);
  const adaptiveFactor = React.useMemo(() => {
    const zoom = Math.max(canvasTransform.zoom, 0.1);
    return clampNumber(zoom, 0.3, 1);
  }, [canvasTransform.zoom]);
  const normalizedDensity = React.useMemo(() => {
    const base = clampNumber(Math.round(liquifyDensity), 64, 256);
    // 缩放越小，密度按平方衰减，降低采样但保持覆盖范围
    const scaled = Math.max(24, Math.round(base * adaptiveFactor * adaptiveFactor));
    return clampNumber(scaled, 24, base);
  }, [liquifyDensity, adaptiveFactor]);
  const strokeStatsRef = React.useRef({
    flushCount: 0,
    commandCount: 0,
    substepCount: 0,
    durationMs: 0,
    density: 0,
    adaptive: 1,
    meshRefresh: 0,
    renderPath: 'skia' as 'skia' | 'native',
  });
  const meshRefreshCounterRef = React.useRef(0);
  const smoothingValue = React.useMemo(
    () => clampNumber(liquifySmoothing, 0, 1),
    [liquifySmoothing]
  );
  const smoothingStrengthValue = React.useMemo(
    () => 0.12 + smoothingValue * 0.65,
    [smoothingValue]
  );
  const smoothingIterations = React.useMemo(() => {
    const base = smoothingValue > 0.65 ? 2 : 1;
    const adaptCut = adaptiveFactor < 0.7 ? 1 : 0;
    return Math.max(0, base - adaptCut);
  }, [smoothingValue, adaptiveFactor]);
  const nativeSmoothingStrengthValue = React.useMemo(
    () => clampNumber(0.12 + smoothingValue * 0.6, 0.05, 0.9),
    [smoothingValue]
  );
  const nativeSmoothingIterationsValue = React.useMemo(() => {
    if (smoothingValue < 0.08) return 0;
    if (smoothingValue < 0.45) return 1;
    if (smoothingValue < 0.8) return 2;
    return 3;
  }, [smoothingValue]);
  const falloffValue = React.useMemo(
    () => clampNumber(liquifyFalloff, 0.05, 0.85),
    [liquifyFalloff]
  );
  const intensityValue = React.useMemo(
    () => clampNumber(liquifyIntensity, 0, 1),
    [liquifyIntensity]
  );
  const displacementScale = React.useMemo(
    () => 0.35 + intensityValue * 1.3,
    [intensityValue]
  );
  const maxMagnitude = React.useMemo(
    () => clampNumber(liquifyMaxMagnitude, 0.15, 2),
    [liquifyMaxMagnitude]
  );
  const nativeBrushFalloff = React.useMemo(
    () => clampNumber(liquifyNativeFalloff, 0.05, 1),
    [liquifyNativeFalloff]
  );
  const centerResponseMinValue = React.useMemo(
    () => clampNumber(liquifyCenterResponseMin, 0.05, 2.8),
    [liquifyCenterResponseMin]
  );
  const centerResponseMaxValue = React.useMemo(
    () =>
      clampNumber(
        Math.max(liquifyCenterResponseMax, centerResponseMinValue + 0.05),
        centerResponseMinValue + 0.05,
        3.5
      ),
    [liquifyCenterResponseMax, centerResponseMinValue]
  );
  const edgeResponseMinValue = React.useMemo(
    () => clampNumber(liquifyEdgeResponseMin, 0.2, 2),
    [liquifyEdgeResponseMin]
  );
  const edgeResponseMaxValue = React.useMemo(
    () =>
      clampNumber(
        Math.max(liquifyEdgeResponseMax, edgeResponseMinValue + 0.05),
        edgeResponseMinValue + 0.05,
        4
      ),
    [liquifyEdgeResponseMax, edgeResponseMinValue]
  );
  const stepFactorMinValue = React.useMemo(() => {
    const base = clampNumber(liquifyStepFactorMin, 0.01, 2);
    const scaled = base * (1 + (1 - adaptiveFactor) * 0.35);
    return clampNumber(scaled, 0.01, 2.5);
  }, [liquifyStepFactorMin, adaptiveFactor]);
  const stepFactorMaxValue = React.useMemo(() => {
    const base = Math.max(liquifyStepFactorMax, stepFactorMinValue + 0.01);
    const scaled = base * (1 + (1 - adaptiveFactor) * 0.4);
    return clampNumber(scaled, stepFactorMinValue + 0.01, 6);
  }, [liquifyStepFactorMax, stepFactorMinValue, adaptiveFactor]);
  const useNativeLiquify = React.useMemo(() => {
    return Platform.OS === 'android' && FEATURE_FLAGS.ENABLE_NATIVE_LIQUIFY_ANDROID;
  }, []);
  const maxLiquifyHistory = 2048;
  const markLiquifyDraftDirty = React.useCallback(() => {
    liquifyDraftRevisionRef.current += 1;
  }, []);
  const notifyHistoryChange = React.useCallback(() => {
    const length = strokeHistoryRef.current.length;
    const index = historyIndexRef.current;
    onLiquifyHistoryChange?.({
      canUndo: index > 0,
      canRedo: index < length,
      historyLength: length,
      index,
    });
  }, [onLiquifyHistoryChange]);

  const clearLiquifyDraftPersistTimer = React.useCallback(() => {
    if (liquifyDraftTimerRef.current != null) {
      clearTimeout(liquifyDraftTimerRef.current);
      liquifyDraftTimerRef.current = null;
    }
  }, []);

  const clearLiquifyDraftFile = React.useCallback(async (imagePath?: string | null) => {
    const targetPath = buildLiquifyDraftFilePath(imagePath ?? backgroundImage);
    if (!targetPath) {
      return;
    }
    try {
      const exists = await RNFS.exists(targetPath);
      if (exists) {
        await RNFS.unlink(targetPath);
      }
    } catch (error) {
      console.warn('[LiquifyDraft][clear-failed]', {
        imagePath: imagePath ?? backgroundImage,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [backgroundImage]);

  const clearLiquifyNativeStateFile = React.useCallback(async (imagePath?: string | null) => {
    const targetPath = buildLiquifyNativeStateFilePath(imagePath ?? backgroundImage);
    if (!targetPath) {
      return;
    }
    try {
      const exists = await RNFS.exists(targetPath);
      if (exists) {
        await RNFS.unlink(targetPath);
      }
    } catch (error) {
      console.warn('[LiquifyNativeState][clear-failed]', {
        imagePath: imagePath ?? backgroundImage,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [backgroundImage]);

  const persistNativeLiquifyStateNow = React.useCallback((reason: 'debounced' | 'background' | 'manual') => {
    if (!useNativeLiquify || !backgroundImage) {
      return;
    }
    const nativeHandle = nativeLiquifyRef.current;
    if (!nativeHandle) {
      return;
    }
    const statePath = buildLiquifyNativeStateFilePath(backgroundImage);
    liquifyNativeStatePathRef.current = statePath;
    if (!statePath) {
      return;
    }
    const historyLength = strokeHistoryRef.current.length;
    const historyIndex = historyIndexRef.current;
    if (historyLength <= 0 || historyIndex <= 0) {
      void clearLiquifyNativeStateFile(backgroundImage);
      return;
    }
    nativeHandle.saveDisplacementState(statePath);
    liquifyDebugLog('[LiquifyNativeState][saved]', {
      reason,
      imagePath: backgroundImage,
      historyLength,
      historyIndex,
    });
  }, [backgroundImage, clearLiquifyNativeStateFile, useNativeLiquify]);

  const persistLiquifyDraftNow = React.useCallback(async (reason: 'debounced' | 'background' | 'manual') => {
    if (!backgroundImage) {
      return;
    }
    const draftPath = buildLiquifyDraftFilePath(backgroundImage);
    if (!draftPath) {
      return;
    }
    liquifyDraftPathRef.current = draftPath;
    const currentRevision = liquifyDraftRevisionRef.current;
    if (!restoringDraftRef.current && liquifyDraftSavedRevisionRef.current === currentRevision) {
      return;
    }
    const history = strokeHistoryRef.current;
    if (!history.length) {
      await clearLiquifyDraftFile(backgroundImage);
      if (useNativeLiquify) {
        await clearLiquifyNativeStateFile(backgroundImage);
      }
      liquifyDraftSavedRevisionRef.current = currentRevision;
      return;
    }
    const clampedIndex = Math.max(0, Math.min(historyIndexRef.current, history.length));
    const payload: LiquifyDraftPayload = {
      version: LIQUIFY_DRAFT_VERSION,
      imagePath: backgroundImage,
      historyIndex: clampedIndex,
      savedAt: Date.now(),
      strokes: history.map((stroke) => cloneStrokeForDraft(stroke)),
    };
    try {
      await RNFS.writeFile(draftPath, JSON.stringify(payload), 'utf8');
      liquifyDraftSavedRevisionRef.current = currentRevision;
      liquifyDebugLog('[LiquifyDraft][saved]', {
        reason,
        imagePath: backgroundImage,
        historyLength: history.length,
        historyIndex: clampedIndex,
      });
      if (reason !== 'debounced') {
        persistNativeLiquifyStateNow(reason);
      }
    } catch (error) {
      console.warn('[LiquifyDraft][save-failed]', {
        reason,
        imagePath: backgroundImage,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    backgroundImage,
    clearLiquifyDraftFile,
    clearLiquifyNativeStateFile,
    persistNativeLiquifyStateNow,
    useNativeLiquify,
  ]);

  const schedulePersistLiquifyDraft = React.useCallback((delayMs: number = LIQUIFY_DRAFT_PERSIST_DELAY_MS) => {
    if (!backgroundImage) {
      return;
    }
    if (useNativeLiquify) {
      return;
    }
    clearLiquifyDraftPersistTimer();
    liquifyDraftTimerRef.current = setTimeout(() => {
      liquifyDraftTimerRef.current = null;
      void persistLiquifyDraftNow('debounced');
    }, Math.max(0, Math.round(delayMs)));
  }, [backgroundImage, clearLiquifyDraftPersistTimer, persistLiquifyDraftNow, useNativeLiquify]);

  const requestMeshRefresh = React.useCallback(() => {
    if (meshRaf.current != null) {
      return;
    }
    meshRefreshCounterRef.current += 1;
    meshRaf.current = requestAnimationFrame(() => {
      meshRaf.current = null;
      setMeshVersion((v) => v + 1);
    });
  }, []);

  const recordEngineCommands = React.useCallback((commands: EngineApplyCommand[]) => {
    if (isReplayingRef.current) {
      return;
    }
    const stroke = currentStrokeRef.current;
    if (!stroke || !commands.length) {
      return;
    }
    stroke.engineCommands.push(...commands);
  }, []);

  const recordNativeCommands = React.useCallback((commands: LiquifyBrushCommandPayload[]) => {
    if (isReplayingRef.current) {
      return;
    }
    const stroke = currentStrokeRef.current;
    if (!stroke || !commands.length) {
      return;
    }
    stroke.nativeCommands.push(...commands);
  }, []);

  const allocateNativeSnapshotId = React.useCallback(() => {
    const reusableId = nativeReusableSnapshotIdsRef.current.pop();
    if (typeof reusableId === 'number') {
      return reusableId;
    }
    const snapshotId = nativeSnapshotNextIdRef.current;
    nativeSnapshotNextIdRef.current += 1;
    return snapshotId;
  }, []);

  const releaseNativeSnapshotId = React.useCallback((snapshotId: number | null | undefined) => {
    if (typeof snapshotId !== 'number') {
      return;
    }
    nativeLiquifyRef.current?.deleteSnapshot(snapshotId);
    nativeReusableSnapshotIdsRef.current.push(snapshotId);
  }, []);

  const trimNativeSnapshotWindow = React.useCallback(() => {
    if (!useNativeLiquify) {
      return;
    }
    const snapshotIds = nativeHistorySnapshotIdsRef.current;
    const keepFrom = Math.max(0, snapshotIds.length - NATIVE_SNAPSHOT_KEEP_COUNT);
    for (let i = 0; i < keepFrom; i += 1) {
      const snapshotId = snapshotIds[i];
      if (typeof snapshotId !== 'number') {
        continue;
      }
      releaseNativeSnapshotId(snapshotId);
      snapshotIds[i] = null;
    }
  }, [releaseNativeSnapshotId, useNativeLiquify]);

  const syncEngineToHistoryIndex = React.useCallback((targetIndex: number) => {
    const engine = liquifyEngineRef.current;
    if (!engine) {
      return;
    }
    const clampedIndex = Math.max(0, Math.min(targetIndex, strokeHistoryRef.current.length));
    if (clampedIndex <= 0) {
      engine.reset();
      return;
    }
    const snapshot = displacementSnapshotsRef.current[clampedIndex - 1];
    if (snapshot) {
      engine.loadDisplacement(snapshot);
      return;
    }
    engine.reset();
    for (let i = 0; i < clampedIndex; i += 1) {
      const stroke = strokeHistoryRef.current[i];
      stroke.engineCommands.forEach((cmd) => {
        engine.applyBrush(cmd.u, cmd.v, cmd.params);
      });
    }
  }, []);

  const restoreNativeLiquifyStateFromDisk = React.useCallback(async (reason: 'surface' | 'active' | 'draft') => {
    if (!useNativeLiquify || !backgroundImage) {
      liquifyRecoveryWarn('[LiquifyRestore][skip]', {
        reason,
        detail: 'native_disabled_or_no_image',
        useNativeLiquify,
        hasImage: Boolean(backgroundImage),
      });
      return false;
    }
    if (restoringNativeStateRef.current) {
      liquifyRecoveryWarn('[LiquifyRestore][skip]', {
        reason,
        detail: 'already_restoring',
      });
      return false;
    }
    if (strokeHistoryRef.current.length <= 0 || historyIndexRef.current <= 0) {
      liquifyRecoveryWarn('[LiquifyRestore][skip]', {
        reason,
        detail: 'empty_history',
        historyLength: strokeHistoryRef.current.length,
        historyIndex: historyIndexRef.current,
      });
      return false;
    }
    const nativeHandle = nativeLiquifyRef.current;
    if (!nativeHandle) {
      liquifyRecoveryWarn('[LiquifyRestore][skip]', {
        reason,
        detail: 'native_handle_missing',
      });
      return false;
    }
    const statePath = buildLiquifyNativeStateFilePath(backgroundImage);
    liquifyNativeStatePathRef.current = statePath;
    if (!statePath) {
      liquifyRecoveryWarn('[LiquifyRestore][skip]', {
        reason,
        detail: 'state_path_empty',
      });
      return false;
    }
    try {
      const maxAttempts = reason === 'draft' ? 1 : 6;
      const retryDelayMs = 80;
      let exists = false;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        exists = await RNFS.exists(statePath);
        if (exists) {
          break;
        }
        if (attempt < maxAttempts - 1) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, retryDelayMs);
          });
        }
      }
      if (!exists) {
        liquifyRecoveryWarn('[LiquifyRestore][missing-state-file]', {
          reason,
          statePath,
          attempts: maxAttempts,
        });
        return false;
      }
      restoringNativeStateRef.current = true;
      nativeHandle.loadDisplacementState(statePath);
      syncEngineToHistoryIndex(historyIndexRef.current);
      notifyHistoryChange();
      liquifyDebugLog('[LiquifyNativeState][restored]', {
        reason,
        imagePath: backgroundImage,
        historyLength: strokeHistoryRef.current.length,
        historyIndex: historyIndexRef.current,
      });
      return true;
    } catch (error) {
      liquifyRecoveryWarn('[LiquifyRestore][exception]', {
        reason,
        imagePath: backgroundImage,
        statePath,
        message: error instanceof Error ? error.message : String(error),
      });
      console.warn('[LiquifyNativeState][restore-failed]', {
        reason,
        imagePath: backgroundImage,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      restoringNativeStateRef.current = false;
    }
  }, [backgroundImage, notifyHistoryChange, syncEngineToHistoryIndex, useNativeLiquify]);

  const rebuildNativeStateFromHistory = React.useCallback(
    (targetIndex: number) => {
      if (!useNativeLiquify) {
        return 0;
      }
      const nativeHandle = nativeLiquifyRef.current;
      if (!nativeHandle) {
        return 0;
      }
      const history = strokeHistoryRef.current;
      const clampedTarget = Math.max(0, Math.min(targetIndex, history.length));
      nativeHandle.beginBatchUpdate();
      try {
        nativeHandle.reset();
        nativeHistorySnapshotIdsRef.current = [];
        nativeReusableSnapshotIdsRef.current = [];
        nativeSnapshotNextIdRef.current = NATIVE_HISTORY_SNAPSHOT_START_INDEX;

        const keepFrom = Math.max(0, clampedTarget - NATIVE_SNAPSHOT_KEEP_COUNT);
        const snapshotSlots: Array<number | null> = new Array(history.length).fill(null);
        for (let i = 0; i < clampedTarget; i += 1) {
          const stroke = history[i];
          if (stroke.nativeCommands.length) {
            nativeHandle.enqueueBrushBatch(stroke.nativeCommands);
          }
          if (i < keepFrom) {
            continue;
          }
          const snapshotId = allocateNativeSnapshotId();
          nativeHandle.saveSnapshot(snapshotId);
          snapshotSlots[i] = snapshotId;
        }

        nativeHistorySnapshotIdsRef.current = snapshotSlots;
        return clampedTarget;
      } finally {
        nativeHandle.endBatchUpdate();
      }
    },
    [allocateNativeSnapshotId, useNativeLiquify]
  );

  const commitStrokeToHistory = React.useCallback((stroke: RecordedStroke | null) => {
    if (!stroke) {
      return;
    }
    if (!stroke.engineCommands.length && !stroke.nativeCommands.length) {
      return;
    }
    const history = strokeHistoryRef.current;
    const index = historyIndexRef.current;
    if (index < history.length) {
      history.splice(index);
      displacementSnapshotsRef.current.splice(index);
      const removedSnapshotIds = nativeHistorySnapshotIdsRef.current.splice(index);
      removedSnapshotIds.forEach((snapshotId) => {
        releaseNativeSnapshotId(snapshotId);
      });
    }
    history.push(stroke);
    if (history.length > maxLiquifyHistory) {
      // 丢弃最旧的笔划，保持历史长度上限，防止内存/重放爆炸
      history.shift();
      displacementSnapshotsRef.current.shift();
      const droppedSnapshotId = nativeHistorySnapshotIdsRef.current.shift();
      releaseNativeSnapshotId(droppedSnapshotId);
    }
    historyIndexRef.current = history.length;
    const engine = liquifyEngineRef.current;
    if (useNativeLiquify && engine && stroke.engineCommands.length) {
      // Android 原生渲染路径下，实时阶段只记录命令；提交历史时一次性补算 JS 网格快照。
      stroke.engineCommands.forEach((cmd) => {
        engine.applyBrush(cmd.u, cmd.v, cmd.params);
      });
    }
    const exported = engine?.exportDisplacement();
    if (exported) {
      const snapshot: DisplacementSnapshot = {
        cols: exported.cols,
        rows: exported.rows,
        deformX: new Float32Array(exported.deformX),
        deformY: new Float32Array(exported.deformY),
      };
      displacementSnapshotsRef.current.push(snapshot);
    }
    historyIndexRef.current = history.length;
    if (useNativeLiquify) {
      const nativeHandle = nativeLiquifyRef.current;
      const snapshotId = allocateNativeSnapshotId();
      nativeHandle?.saveSnapshot(snapshotId);
      nativeHistorySnapshotIdsRef.current.push(snapshotId);
      trimNativeSnapshotWindow();
    }
    const stats = strokeStatsRef.current;
    const meshDelta = meshRefreshCounterRef.current - stats.meshRefresh;
    // 实际使用的密度（已包含缩放衰减）
    const effectiveDensity = normalizedDensity;
    const strokeLog = {
      renderPath: stats.renderPath,
      density: effectiveDensity,
      adaptive: stats.adaptive,
      flushes: stats.flushCount,
      commands: stats.commandCount,
      substeps: stats.substepCount,
      durationMs: Number(stats.durationMs.toFixed(2)),
      meshRefresh: meshDelta,
      historyLength: history.length,
      historyIndex: historyIndexRef.current,
      zoom: zoomLevel.value,
      panX: panOffsetX.value,
      panY: panOffsetY.value,
      brushSize: liquifyBrushSize,
      intensity: liquifyIntensity,
      smoothing: liquifySmoothing,
    };
    liquifyDebugLog('[LiquifyStroke]', strokeLog);
    if (strokeLog.durationMs > 250 || strokeLog.commands > 180 || strokeLog.substeps > 180) {
      console.warn('[LiquifyStroke][heavy]', {
        durationMs: strokeLog.durationMs,
        commands: strokeLog.commands,
        substeps: strokeLog.substeps,
        zoom: strokeLog.zoom,
        density: strokeLog.density,
      });
    }
    markLiquifyDraftDirty();
    schedulePersistLiquifyDraft();
    notifyHistoryChange();
  }, [
    allocateNativeSnapshotId,
    liquifyBrushSize,
    liquifyIntensity,
    markLiquifyDraftDirty,
    liquifySmoothing,
    maxLiquifyHistory,
    normalizedDensity,
    notifyHistoryChange,
    schedulePersistLiquifyDraft,
    trimNativeSnapshotWindow,
    releaseNativeSnapshotId,
    useNativeLiquify,
  ]);

  const startStrokeRecording = React.useCallback(() => {
    if (isReplayingRef.current) {
      return;
    }
    if (currentStrokeRef.current) {
      // 在新笔开始前补提上一笔，防止手势切换造成“丢笔/并笔”。
      commitStrokeToHistory(currentStrokeRef.current);
    }
    currentStrokeRef.current = { engineCommands: [], nativeCommands: [] };
    strokeStatsRef.current = {
      flushCount: 0,
      commandCount: 0,
      substepCount: 0,
      durationMs: 0,
      density: normalizedDensity,
      adaptive: adaptiveFactor,
      meshRefresh: meshRefreshCounterRef.current,
      renderPath: useNativeLiquify ? 'native' : 'skia',
    };
  }, [adaptiveFactor, commitStrokeToHistory, normalizedDensity, useNativeLiquify]);

  const finalizeStrokeRecording = React.useCallback(() => {
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    commitStrokeToHistory(stroke);
  }, [commitStrokeToHistory]);

  const enqueueNativeHistoryRange = React.useCallback((startIndex: number, endIndex: number) => {
    const nativeHandle = nativeLiquifyRef.current;
    if (!nativeHandle) {
      return;
    }
    const history = strokeHistoryRef.current;
    const from = Math.max(0, Math.min(startIndex, history.length));
    const to = Math.max(from, Math.min(endIndex, history.length));
    for (let i = from; i < to; i += 1) {
      const commands = history[i]?.nativeCommands;
      if (commands && commands.length) {
        nativeHandle.enqueueBrushBatch(commands);
      }
    }
  }, []);

  const replayLiquifyStrokes = React.useCallback(
    (targetIndex: number) => {
      const engine = liquifyEngineRef.current;
      const nativeHandle = nativeLiquifyRef.current;
      const strokes = strokeHistoryRef.current;
      const clampedIndex = Math.max(0, Math.min(targetIndex, strokes.length));
      const previousIndex = historyIndexRef.current;
      isReplayingRef.current = true;
      try {
        currentStrokeRef.current = null;
        const snapshot = displacementSnapshotsRef.current[clampedIndex - 1];
        const hasSnapshot = snapshot && !useNativeLiquify;
        if (engine) {
          engine.reset();
        }
        if (useNativeLiquify) {
          let resolvedIndex = clampedIndex;
          if (clampedIndex <= 0) {
            nativeHandle?.resetPreserveSnapshots();
            resolvedIndex = 0;
          } else if (nativeHandle) {
            let anchorIndex = -1;
            let anchorSnapshotId: number | null = null;
            for (let i = clampedIndex - 1; i >= 0; i -= 1) {
              const candidateId = nativeHistorySnapshotIdsRef.current[i];
              if (typeof candidateId === 'number') {
                anchorIndex = i;
                anchorSnapshotId = candidateId;
                break;
              }
            }
            nativeHandle.beginBatchUpdate();
            try {
              nativeHandle.resetPreserveSnapshots();
              if (typeof anchorSnapshotId === 'number') {
                nativeHandle.restoreSnapshot(anchorSnapshotId);
                if (anchorIndex + 1 < clampedIndex) {
                  enqueueNativeHistoryRange(anchorIndex + 1, clampedIndex);
                }
                resolvedIndex = clampedIndex;
              } else {
                resolvedIndex = 0;
              }
            } finally {
              nativeHandle.endBatchUpdate();
            }
          }
          if (resolvedIndex <= 0 && clampedIndex > 0) {
            resolvedIndex = rebuildNativeStateFromHistory(clampedIndex);
          }
          historyIndexRef.current = resolvedIndex;
          syncEngineToHistoryIndex(resolvedIndex);
        } else if (engine && hasSnapshot) {
          engine.loadDisplacement(snapshot);
        } else if (engine) {
          for (let i = 0; i < clampedIndex; i += 1) {
            const stroke = strokes[i];
            stroke.engineCommands.forEach((cmd) => {
              engine.applyBrush(cmd.u, cmd.v, cmd.params);
            });
          }
        }
        if (!useNativeLiquify) {
          historyIndexRef.current = clampedIndex;
        }
        if (!useNativeLiquify && engine) {
          requestMeshRefresh();
        }
        if (historyIndexRef.current !== previousIndex) {
          markLiquifyDraftDirty();
          schedulePersistLiquifyDraft();
        }
        notifyHistoryChange();
      } finally {
        isReplayingRef.current = false;
      }
    },
    [
      enqueueNativeHistoryRange,
      markLiquifyDraftDirty,
      notifyHistoryChange,
      rebuildNativeStateFromHistory,
      requestMeshRefresh,
      schedulePersistLiquifyDraft,
      syncEngineToHistoryIndex,
      useNativeLiquify,
    ]
  );

  const undoLiquifyStroke = React.useCallback(() => {
    if (historyIndexRef.current <= 0) {
      return;
    }
    replayLiquifyStrokes(historyIndexRef.current - 1);
  }, [replayLiquifyStrokes]);

  const redoLiquifyStroke = React.useCallback(() => {
    if (historyIndexRef.current >= strokeHistoryRef.current.length) {
      return;
    }
    replayLiquifyStrokes(historyIndexRef.current + 1);
  }, [replayLiquifyStrokes]);

  const refreshLiquify = React.useCallback(() => {
    if (!backgroundImage) {
      return;
    }
    replayLiquifyStrokes(historyIndexRef.current);
  }, [backgroundImage, replayLiquifyStrokes]);

  const rehydrateLiquify = React.useCallback(() => {
    if (!backgroundImage) {
      return;
    }
    if (useNativeLiquify) {
      const resolvedIndex = rebuildNativeStateFromHistory(historyIndexRef.current);
      historyIndexRef.current = resolvedIndex;
      syncEngineToHistoryIndex(resolvedIndex);
      notifyHistoryChange();
      return;
    }
    replayLiquifyStrokes(historyIndexRef.current);
  }, [
    backgroundImage,
    notifyHistoryChange,
    rebuildNativeStateFromHistory,
    replayLiquifyStrokes,
    syncEngineToHistoryIndex,
    useNativeLiquify,
  ]);

  const restoreLiquifyDraftFromDisk = React.useCallback(async () => {
    if (!backgroundImage) {
      return false;
    }
    if (restoringDraftRef.current) {
      return false;
    }
    if (liquifyDraftRestoredImageRef.current === backgroundImage) {
      return false;
    }
    if (currentStrokeRef.current) {
      return false;
    }
    if (strokeHistoryRef.current.length > 0 || historyIndexRef.current > 0) {
      liquifyDraftRestoredImageRef.current = backgroundImage;
      return false;
    }
    const draftPath = buildLiquifyDraftFilePath(backgroundImage);
    liquifyDraftPathRef.current = draftPath;
    if (!draftPath) {
      liquifyDraftRestoredImageRef.current = backgroundImage;
      return false;
    }
    try {
      const exists = await RNFS.exists(draftPath);
      if (!exists) {
        liquifyDraftRestoredImageRef.current = backgroundImage;
        return false;
      }
      const raw = await RNFS.readFile(draftPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LiquifyDraftPayload>;
      if (
        parsed.version !== LIQUIFY_DRAFT_VERSION ||
        parsed.imagePath !== backgroundImage ||
        !Array.isArray(parsed.strokes)
      ) {
        console.warn('[LiquifyDraft][invalid]', {
          imagePath: backgroundImage,
          reason: 'version_or_shape_mismatch',
        });
        liquifyDraftRestoredImageRef.current = backgroundImage;
        return false;
      }
      const restoredHistory = parsed.strokes
        .map((stroke) => cloneStrokeFromDraft(stroke))
        .filter((stroke): stroke is RecordedStroke => Boolean(stroke));
      if (!restoredHistory.length) {
        liquifyDraftRestoredImageRef.current = backgroundImage;
        return false;
      }
      const rawIndex = isFiniteNumber(parsed.historyIndex) ? parsed.historyIndex : restoredHistory.length;
      const restoredIndex = Math.max(0, Math.min(Math.round(rawIndex), restoredHistory.length));
      restoringDraftRef.current = true;
      strokeHistoryRef.current = restoredHistory;
      historyIndexRef.current = restoredIndex;
      currentStrokeRef.current = null;
      displacementSnapshotsRef.current = [];
      nativeHistorySnapshotIdsRef.current = [];
      nativeReusableSnapshotIdsRef.current = [];
      nativeSnapshotNextIdRef.current = NATIVE_HISTORY_SNAPSHOT_START_INDEX;
      markLiquifyDraftDirty();
      liquifyDraftSavedRevisionRef.current = liquifyDraftRevisionRef.current;
      liquifyDraftRestoredImageRef.current = backgroundImage;
      requestAnimationFrame(() => {
        void (async () => {
          try {
            if (useNativeLiquify) {
              const restoredNative = await restoreNativeLiquifyStateFromDisk('draft');
                if (!restoredNative) {
                  liquifyRecoveryWarn('[LiquifyRestore][fallback-rehydrate]', {
                    reason: 'draft',
                    imagePath: backgroundImage,
                    historyLength: strokeHistoryRef.current.length,
                    historyIndex: restoredIndex,
                  });
                  replayLiquifyStrokes(restoredIndex);
                }
              } else {
                replayLiquifyStrokes(restoredIndex);
              }
          } finally {
            restoringDraftRef.current = false;
          }
        })();
      });
      liquifyDebugLog('[LiquifyDraft][restored]', {
        imagePath: backgroundImage,
        historyLength: restoredHistory.length,
        historyIndex: restoredIndex,
      });
      return true;
    } catch (error) {
      restoringDraftRef.current = false;
      liquifyDraftRestoredImageRef.current = backgroundImage;
      console.warn('[LiquifyDraft][restore-failed]', {
        imagePath: backgroundImage,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }, [
    backgroundImage,
    markLiquifyDraftDirty,
    replayLiquifyStrokes,
    restoreNativeLiquifyStateFromDisk,
    useNativeLiquify,
  ]);

  const flushTransform = React.useCallback(() => {
    transformRaf.current = null;
    setCanvasTransform(latestTransform.current);
  }, []);

  const queueTransformUpdate = React.useCallback(
    (zoom: number, panX: number, panY: number) => {
      const prev = latestTransform.current;
      if (
        Math.abs(prev.zoom - zoom) < 0.001 &&
        Math.abs(prev.panX - panX) < 0.3 &&
        Math.abs(prev.panY - panY) < 0.3
      ) {
        return;
      }
      latestTransform.current = { zoom, panX, panY };
      if (transformRaf.current == null) {
        transformRaf.current = requestAnimationFrame(flushTransform);
      }
    },
    [flushTransform]
  );

  React.useEffect(
    () => () => {
      if (transformRaf.current != null) {
        cancelAnimationFrame(transformRaf.current);
        transformRaf.current = null;
      }
      if (meshRaf.current != null) {
        cancelAnimationFrame(meshRaf.current);
        meshRaf.current = null;
      }
      if (liquifyDraftTimerRef.current != null) {
        clearTimeout(liquifyDraftTimerRef.current);
        liquifyDraftTimerRef.current = null;
      }
    },
  []
  );

  React.useEffect(() => {
    liquifyDraftPathRef.current = buildLiquifyDraftFilePath(backgroundImage);
    liquifyNativeStatePathRef.current = buildLiquifyNativeStateFilePath(backgroundImage);
    liquifyDraftRestoredImageRef.current = null;
    liquifyDraftSavedRevisionRef.current = -1;
    clearLiquifyDraftPersistTimer();
  }, [backgroundImage, clearLiquifyDraftPersistTimer]);

  React.useEffect(() => {
    notifyHistoryChange();
  }, [notifyHistoryChange]);

  React.useEffect(() => {
    if (!backgroundImage) {
      return;
    }
    void restoreLiquifyDraftFromDisk();
  }, [backgroundImage, restoreLiquifyDraftFromDisk]);

  const handleNativeSurfaceReady = React.useCallback(() => {
    if (!useNativeLiquify || !backgroundImage) {
      return;
    }
    if (strokeHistoryRef.current.length <= 0 || historyIndexRef.current <= 0) {
      return;
    }
    requestAnimationFrame(() => {
      void (async () => {
        const restoredNative = await restoreNativeLiquifyStateFromDisk('surface');
        if (!restoredNative) {
          liquifyRecoveryWarn('[LiquifyRestore][fallback-rehydrate]', {
            reason: 'surface',
            imagePath: backgroundImage,
            historyLength: strokeHistoryRef.current.length,
            historyIndex: historyIndexRef.current,
          });
          rehydrateLiquify();
        }
      })();
    });
  }, [backgroundImage, rehydrateLiquify, restoreNativeLiquifyStateFromDisk, useNativeLiquify]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        finalizeStrokeRecording();
        clearLiquifyDraftPersistTimer();
        void persistLiquifyDraftNow('background');
        return;
      }
      if (nextState !== 'active') {
        return;
      }
      if (strokeHistoryRef.current.length <= 0) {
        void restoreLiquifyDraftFromDisk();
        return;
      }
      if (useNativeLiquify) {
        return;
      }
    });
    return () => subscription.remove();
  }, [
    clearLiquifyDraftPersistTimer,
    finalizeStrokeRecording,
    persistLiquifyDraftNow,
    restoreLiquifyDraftFromDisk,
    useNativeLiquify,
  ]);

  React.useEffect(() => {
    const config: LiquifyEngineConfig = {
      cols: normalizedDensity,
      rows: normalizedDensity,
      maxMagnitude,
      falloff: falloffValue,
      smoothingStrength: clampNumber(smoothingStrengthValue, 0.05, 0.9),
      smoothingIterations,
    };
    if (!liquifyEngineRef.current) {
      liquifyEngineRef.current = new LiquifyEngine(config);
    } else {
      liquifyEngineRef.current.reconfigure(config);
    }
    requestMeshRefresh();
  }, [
    normalizedDensity,
    maxMagnitude,
    falloffValue,
    smoothingStrengthValue,
    smoothingIterations,
    requestMeshRefresh,
  ]);

  const applyTransforms = React.useCallback(
    (zoom: number, panX: number, panY: number) => {
      queueTransformUpdate(zoom, panX, panY);
    },
    [queueTransformUpdate]
  );

  useAnimatedReaction(
    () => ({
      zoom: zoomLevel.value, // 收集当前缩放值
      panX: panOffsetX.value, // 收集当前水平偏移
      panY: panOffsetY.value, // 收集当前垂直偏移
    }),
    ({ zoom, panX, panY }) => {
      'worklet'; // 反应体在 UI 线程执行
      runOnJS(applyTransforms)(zoom, panX, panY); // 将最新数值同步回 JS 状态
    },
    [applyTransforms] // 依赖回调保证引用稳定
  );

  // Load background image
  // useImage 会在后台异步拉取图片并缓存，返回 Skia 可直接绘制的 image 对象
  const image = useImage(backgroundImage); // 根据背景路径加载 Skia 图片
  const originalSkiaImage = useImage(originalImage ?? backgroundImage); // 原图资源用于“查看原图”覆盖层

  // 缩放相关的起始状态
  const pinchLastFocalX = useSharedValue(0); // 追踪上一帧的质心 X，便于计算拖拽位移
  const pinchLastFocalY = useSharedValue(0); // 追踪上一帧的质心 Y，便于计算拖拽位移
  const pinchLastScale = useSharedValue(1); // 记录上一帧的缩放比例，用于计算增量
  const contentWidth = useSharedValue(width); // SkiaImage 在缩放为 1 时的实际渲染宽度
  const contentHeight = useSharedValue(height); // SkiaImage 在缩放为 1 时的实际渲染高度
  const contentOffsetX = useSharedValue(0); // 渲染内容相对于容器左侧的起始偏移
  const contentOffsetY = useSharedValue(0); // 渲染内容相对于容器顶部的起始偏移
  // isPinching 用于在 Pan 与 Pinch 之间协调状态，避免手势串扰
  const isPinching = useSharedValue(false); // 标识当前是否在执行双指缩放
  // focalMarkerX/Y 负责控制屏幕上质心标记的位置
  const focalMarkerX = useSharedValue(0); // 质心标记的屏幕 X 坐标
  const focalMarkerY = useSharedValue(0); // 质心标记的屏幕 Y 坐标
  const brushIndicatorX = useSharedValue(width / 2);
  const brushIndicatorY = useSharedValue(height / 2);
  const brushIndicatorOpacity = useSharedValue(mode === 'liquify' ? 0.35 : 0);
  const brushIdleOpacity = useSharedValue(mode === 'liquify' ? 0.35 : 0);
  const brushRadiusValue = useSharedValue(liquifyBrushSize);
  const [imageLayout, setImageLayout] = React.useState({
    fittedWidth: width,
    fittedHeight: height,
    offsetX: 0,
    offsetY: 0,
    intrinsicWidth: 0,
    intrinsicHeight: 0,
  });
  const originalPreviewActiveRef = React.useRef(false);
  const liquifyLayerOpacity = useSharedValue(isOriginalView ? 0 : 1);
  const originalOverlayOpacity = React.useRef(new RNAnimated.Value(0)).current;
  const [previewPoint, setPreviewPoint] = React.useState<PreviewPoint | null>(null);
  const [previewVisible, setPreviewVisible] = React.useState(false);
  const previewVisibleRef = React.useRef(false);
  const [pendingAppliedPreview, setPendingAppliedPreview] = React.useState<SkImage | null>(null);
  const [pendingAppliedPath, setPendingAppliedPath] = React.useState<string | null>(null);
  const isApplyingOverlayRef = React.useRef(false);
  const liquifyLogPath = `${RNFS.CachesDirectoryPath}/liquify-debug.log`;
  const clearPendingAppliedPreview = React.useCallback(() => {
    setPendingAppliedPreview(null);
    setPendingAppliedPath(null);
  }, []);

  const appendLiquifyDebug = React.useCallback(
    async (entry: Record<string, unknown>) => {
      const line = JSON.stringify({
        ts: Date.now(),
        ...entry,
      });
      try {
        await RNFS.appendFile(liquifyLogPath, `${line}\n`, 'utf8');
      } catch (err) {
        try {
          await RNFS.writeFile(liquifyLogPath, `${line}\n`, 'utf8');
        } catch (err2) {
          console.warn('[LiquifyLog] write failed', err2);
        }
      }
    },
    [liquifyLogPath]
  );

  // 平移起始状态
  // 记录上一次 pan 结束的偏移量，作为下一次拖动的基准点
  const panStartX = useSharedValue(0); // 单指平移的起始水平偏移
  const panStartY = useSharedValue(0); // 单指平移的起始垂直偏移

  const MIN_ZOOM = 0.5; // 最小缩放比
  const MAX_ZOOM = 8; // 最大缩放比（放大更大）
  const SCALE_FACTOR = 1; // 缩放灵敏度，<1 时会减缓缩放节奏
  React.useEffect(() => {
    brushRadiusValue.value = liquifyBrushSize;
  }, [liquifyBrushSize, brushRadiusValue]);
  React.useEffect(() => {
    const idle = mode === 'liquify' ? 0.35 : 0;
    brushIdleOpacity.value = idle;
    brushIndicatorOpacity.value = idle;
  }, [mode, brushIdleOpacity, brushIndicatorOpacity]);
  React.useEffect(() => {
    if (mode !== 'liquify') {
      return;
    }
    if (previewIndicatorVisible) {
      brushIndicatorOpacity.value = 0.9;
    } else {
      brushIndicatorOpacity.value = brushIdleOpacity.value;
    }
  }, [mode, previewIndicatorVisible, brushIndicatorOpacity, brushIdleOpacity]);
  React.useEffect(() => {
    brushIndicatorX.value = width / 2;
    brushIndicatorY.value = height / 2;
  }, [width, height, brushIndicatorX, brushIndicatorY]);
  React.useEffect(() => {
    return () => {
      pendingAppliedPreview?.dispose();
    };
  }, [pendingAppliedPreview]);
  const getPointerInfo = React.useCallback(
    (cx: number, cy: number): PointerInfo | null => {
      const { fittedWidth, fittedHeight, offsetX, offsetY } = imageLayout;
      if (fittedWidth <= 0 || fittedHeight <= 0) {
        return null;
      }
      const currentTransform = latestTransform.current;
      const zoom = Math.max(currentTransform.zoom, 0.01);
      const invZoom = 1 / zoom;
      const adjustedX = (cx - currentTransform.panX) * invZoom;
      const adjustedY = (cy - currentTransform.panY) * invZoom;
      const localX = adjustedX - offsetX;
      const localY = adjustedY - offsetY;
      if (localX < 0 || localX > fittedWidth || localY < 0 || localY > fittedHeight) {
        return null;
      }
      return {
        u: localX / fittedWidth,
        v: localY / fittedHeight,
        adjustedX,
        adjustedY,
        zoom,
        invZoom,
        fittedWidth,
        fittedHeight,
      };
    },
    [imageLayout]
  );
  const showPreviewAt = React.useCallback(
    (cx: number, cy: number) => {
      if (!previewEnabled) {
        return;
      }
      previewVisibleRef.current = true;
      setPreviewVisible(true);
      const info = getPointerInfo(cx, cy);
      if (!info) {
        setPreviewPoint(null);
        return;
      }
      setPreviewPoint({
        normalizedX: info.u,
        normalizedY: info.v,
        objectX: info.adjustedX,
        objectY: info.adjustedY,
      });
    },
    [getPointerInfo, previewEnabled]
  );
  const movePreviewTo = React.useCallback(
    (cx: number, cy: number) => {
      if (!previewEnabled) {
        return;
      }
      if (!previewVisibleRef.current) {
        return;
      }
      const info = getPointerInfo(cx, cy);
      if (!info) {
        return;
      }
      setPreviewPoint({
        normalizedX: info.u,
        normalizedY: info.v,
        objectX: info.adjustedX,
        objectY: info.adjustedY,
      });
    },
    [getPointerInfo, previewEnabled]
  );
  const hidePreview = React.useCallback(() => {
    previewVisibleRef.current = false;
    setPreviewVisible(false);
    setPreviewPoint(null);
  }, []);
  React.useEffect(() => {
    if (mode !== 'liquify') {
      hidePreview();
    }
  }, [mode, hidePreview]);

  const renderPath: 'native' | 'skia' = useNativeLiquify ? 'native' : 'skia';
  React.useEffect(() => {
    onLiquifyRenderPathChange?.(renderPath);
  }, [onLiquifyRenderPathChange, renderPath]);
  const nativeViewport = React.useMemo(() => {
    if (!useNativeLiquify || imageLayout.fittedWidth <= 0 || imageLayout.fittedHeight <= 0) {
      return null;
    }
    const zoom = canvasTransform.zoom;
    const panX = canvasTransform.panX;
    const panY = canvasTransform.panY;
    const startX = panX + imageLayout.offsetX * zoom;
    const startY = panY + imageLayout.offsetY * zoom;
    const displayedWidth = imageLayout.fittedWidth * zoom;
    const displayedHeight = imageLayout.fittedHeight * zoom;
    return {
      viewWidth: width,
      viewHeight: height,
      destX: startX,
      destY: startY,
      destWidth: displayedWidth,
      destHeight: displayedHeight,
    };
  }, [useNativeLiquify, canvasTransform, imageLayout, width, height]);
  const previewSpan = React.useMemo(() => {
    const { fittedWidth, fittedHeight } = imageLayout;
    const zoom = Math.max(canvasTransform.zoom, 0.01);
    if (fittedWidth <= 0 || fittedHeight <= 0) {
      return null;
    }
    return {
      spanX: PREVIEW_WINDOW_SIZE / (fittedWidth * zoom),
      spanY: PREVIEW_WINDOW_SIZE / (fittedHeight * zoom),
    };
  }, [imageLayout, canvasTransform.zoom]);
  const previewTransforms = React.useMemo(() => {
    if (!previewPoint) {
      return null;
    }
    const zoom = Math.max(canvasTransform.zoom, 0.01);
    const translateX = PREVIEW_WINDOW_SIZE / 2 - zoom * previewPoint.objectX;
    const translateY = PREVIEW_WINDOW_SIZE / 2 - zoom * previewPoint.objectY;
    return {
      translateX,
      translateY,
      zoom,
    };
  }, [previewPoint, canvasTransform.zoom]);
  const shouldRenderPreview = previewVisible && previewPoint != null && previewSpan != null;
  const shouldRenderSkiaPreview =
    shouldRenderPreview && !useNativeLiquify && previewTransforms != null && image != null;
  const normalizedBrushRadius = React.useMemo(() => {
    const { fittedWidth, fittedHeight } = imageLayout;
    const zoom = Math.max(canvasTransform.zoom, 0.01);
    const radiusPxImageSpace = Math.max(liquifyBrushSize, 1) / zoom;
    const rx = fittedWidth > 0 ? clampNumber(radiusPxImageSpace / fittedWidth, 0, 1) : 0;
    const ry = fittedHeight > 0 ? clampNumber(radiusPxImageSpace / fittedHeight, 0, 1) : 0;
    return { x: rx, y: ry };
  }, [imageLayout, canvasTransform.zoom, liquifyBrushSize]);
  const nativePreviewConfig = React.useMemo(() => {
    if (!useNativeLiquify || !previewSpan || !previewEnabled) {
      return undefined;
    }
    if (!previewPoint || !previewVisible) {
      return {
        visible: false,
        size: PREVIEW_WINDOW_SIZE,
        offsetX: PREVIEW_WINDOW_MARGIN,
        offsetY: PREVIEW_WINDOW_MARGIN,
        centerX: 0,
        centerY: 0,
        spanX: previewSpan.spanX,
        spanY: previewSpan.spanY,
        cornerRadius: PREVIEW_BORDER_RADIUS,
      };
    }
    return {
      visible: true,
      size: PREVIEW_WINDOW_SIZE,
      offsetX: PREVIEW_WINDOW_MARGIN,
      offsetY: PREVIEW_WINDOW_MARGIN,
      centerX: clampNumber(previewPoint.normalizedX, 0, 1),
      centerY: clampNumber(previewPoint.normalizedY, 0, 1),
      spanX: previewSpan.spanX,
      spanY: previewSpan.spanY,
      cornerRadius: PREVIEW_BORDER_RADIUS,
    };
  }, [useNativeLiquify, previewSpan, previewPoint, previewVisible, previewEnabled]);

  const currentBrushCenter = React.useMemo(() => {
    if (!previewPoint) {
      return null;
    }
    return {
      x: clampNumber(previewPoint.normalizedX, 0, 1),
      y: clampNumber(previewPoint.normalizedY, 0, 1),
    };
  }, [previewPoint]);
  const previewBrushRadius = React.useMemo(() => {
    if (!currentBrushCenter) {
      return null;
    }
    return normalizedBrushRadius;
  }, [currentBrushCenter, normalizedBrushRadius]);

  const mesh = React.useMemo(() => {
    if (useNativeLiquify) {
      return null;
    }
    const engine = liquifyEngineRef.current;
    if (!engine || !image) {
      return null;
    }
    const { fittedWidth, fittedHeight, offsetX, offsetY, intrinsicWidth, intrinsicHeight } = imageLayout;
    if (fittedWidth <= 0 || fittedHeight <= 0 || intrinsicWidth <= 0 || intrinsicHeight <= 0) {
      return null;
    }
    const { cols, rows, deformX, deformY, indices } = engine.exportDisplacement();
    const vertexCount = cols * rows;
    const verts: { x: number; y: number }[] = new Array(vertexCount);
    const uvs: { x: number; y: number }[] = new Array(vertexCount);
    for (let y = 0; y < rows; y += 1) {
      const v = rows === 1 ? 0 : y / (rows - 1);
      for (let x = 0; x < cols; x += 1) {
        const u = cols === 1 ? 0 : x / (cols - 1);
        const idx = y * cols + x;
        const px = offsetX + u * fittedWidth;
        const py = offsetY + v * fittedHeight;
        const srcU = clampNumber(u + deformX[idx], 0, 1);
        const srcV = clampNumber(v + deformY[idx], 0, 1);
        verts[idx] = { x: px, y: py };
        uvs[idx] = { x: srcU * intrinsicWidth, y: srcV * intrinsicHeight };
      }
    }
    return {
      verts,
      uvs,
      indices: Array.from(indices),
    };
  }, [useNativeLiquify, image, imageLayout, meshVersion]);

  const meshPaint = React.useMemo(() => {
    if (useNativeLiquify || !image) {
      return null;
    }
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    const shader = image.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None
    );
    paint.setShader(shader);
    return paint;
  }, [useNativeLiquify, image]);

  // ========= 液化形变引擎 =========
  const resetLiquifyStroke = React.useCallback((timestamp?: number | null) => {
    if (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0) {
      lastLiquifyTimestampRef.current = timestamp;
    } else {
      lastLiquifyTimestampRef.current = null;
    }
    liquifyStrokeDistanceRef.current = 0;
  }, []);

  const endLiquifyStroke = React.useCallback(() => {
    lastLiquifyTimestampRef.current = null;
    liquifyStrokeDistanceRef.current = 0;
  }, []);

  const computeEffectiveStrength = React.useCallback(
    (baseStrength: number, pressure: number) => {
      const pressureCurve = Math.pow(clampNumber(pressure, 0.05, 2), 0.7);
      // 让力度与速度无关：仅保留压力的轻量缩放（手指通常 pressure=1，即不变）。
      const amplified = baseStrength * (0.5 + pressureCurve * 0.5);
      return clampNumber(amplified, 0, 3);
    },
    []
  );

  const applyBrushDeform = React.useCallback(
    (
      cxPx: number,
      cyPx: number,
      dPxX: number,
      dPxY: number,
      eventTimestamp?: number,
      pressureValue?: number
    ) => {
      const t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const engine = liquifyEngineRef.current;
      const nativeHandle = nativeLiquifyRef.current;
      if (!engine && !nativeHandle) {
        return;
      }
      const pointInfo = getPointerInfo(cxPx, cyPx);
      if (!pointInfo) {
        return;
      }
      const { fittedWidth, fittedHeight, u, v, adjustedX, adjustedY, zoom: currentZoom, invZoom } =
        pointInfo;
      const radiusPxImageSpace = Math.max(liquifyBrushSize, 1) / currentZoom;
      const rNorm = radiusPxImageSpace / Math.max(fittedWidth, fittedHeight);
      const isRestore = liquifyTool === 'restore';
      const dUx = (dPxX * invZoom) / fittedWidth;
      const dUy = (dPxY * invZoom) / fittedHeight;
      const magnitude = Math.sqrt(dUx * dUx + dUy * dUy);
      if (!isRestore && magnitude < 0.00002) {
        return;
      }
      const segmentVectorDx = dUx;
      const segmentVectorDy = dUy;
      // 让“慢推/快推”强度一致：strength 不再随单帧位移/速度变化，仅由全局强度参数控制。
      const baseStrength = clampNumber(displacementScale, 0, 3);
      const pressure = clampNumber(pressureValue ?? 1, 0.05, 2);
      const wantsMetrics = Boolean(onLiquifyMetricsChange);
      const brushBlendValue = computeBrushBlendValue(pressure);
      const brushSoftnessValue = computeBrushSoftnessValue(rNorm);
      const centerResponseValue = computeCenterResponseValue(
        liquifyCenterDampen,
        centerResponseMinValue,
        centerResponseMaxValue
      );
      const edgeResponseValue = computeEdgeResponseValue(
        liquifyEdgeBoost,
        edgeResponseMinValue,
        edgeResponseMaxValue
      );
      const stepFactorValue = computeStepFactorValue(liquifyStepFactor, stepFactorMinValue, stepFactorMaxValue);
      const gradientLimitValue = computeGradientLimitValue(rNorm, pressure);
      const effectiveStrength = computeEffectiveStrength(baseStrength * liquifyStrengthScale, pressure);
      const engineCommands: EngineApplyCommand[] = [];
      let nativeCommands: LiquifyBrushCommandPayload[] = [];
      if (useNativeLiquify) {
        const engineCommand: EngineApplyCommand = {
          u,
          v,
          params: {
            tool: liquifyTool,
            radius: rNorm,
            strength: effectiveStrength,
            vector: { dx: segmentVectorDx, dy: segmentVectorDy },
            brushBlend: brushBlendValue,
            brushSoftness: brushSoftnessValue,
            centerDampen: centerResponseValue,
            edgeBoost: edgeResponseValue,
            stepFactor: stepFactorValue,
            decayCurve: liquifyDecayCurve,
            gradientLimit: gradientLimitValue,
            applySmoothing: true,
          },
        };
        engineCommands.push(engineCommand);
        nativeCommands = [{
          x: clampNumber(engineCommand.u, 0, 1),
          y: clampNumber(engineCommand.v, 0, 1),
          dx: engineCommand.params.vector?.dx ?? 0,
          dy: engineCommand.params.vector?.dy ?? 0,
          radius: engineCommand.params.radius,
          strength: engineCommand.params.strength ?? baseStrength,
          tool: liquifyTool,
          pressure,
        }];
      } else {
        const maxStepUv = Math.max(rNorm * LIQUIFY_MAX_STEP_RADIUS_RATIO, 1e-5);
        const effectiveStepLen = magnitude * stepFactorValue;
        const desiredSubsteps =
          !isRestore && effectiveStepLen > maxStepUv
            ? Math.ceil(effectiveStepLen / Math.max(maxStepUv, 1e-6))
            : 1;
        const substeps = clampNumber(desiredSubsteps, 1, LIQUIFY_MAX_SUBSTEPS);

        if (substeps <= 1) {
          engineCommands.push({
            u,
            v,
            params: {
              tool: liquifyTool,
              radius: rNorm,
              strength: effectiveStrength,
              vector: { dx: segmentVectorDx, dy: segmentVectorDy },
              brushBlend: brushBlendValue,
              brushSoftness: brushSoftnessValue,
              centerDampen: centerResponseValue,
              edgeBoost: edgeResponseValue,
              stepFactor: stepFactorValue,
              decayCurve: liquifyDecayCurve,
              gradientLimit: gradientLimitValue,
              applySmoothing: true,
            },
          });
        } else {
          const startX = cxPx - dPxX;
          const startY = cyPx - dPxY;
          const stepUx = segmentVectorDx / substeps;
          const stepUy = segmentVectorDy / substeps;
          for (let i = 1; i <= substeps; i += 1) {
            const t = i / substeps;
            const centerPxX = startX + dPxX * t;
            const centerPxY = startY + dPxY * t;
            const stepInfo = getPointerInfo(centerPxX, centerPxY);
            if (!stepInfo) {
              continue;
            }
            engineCommands.push({
              u: stepInfo.u,
              v: stepInfo.v,
              params: {
                tool: liquifyTool,
                radius: rNorm,
                strength: effectiveStrength,
                vector: { dx: stepUx, dy: stepUy },
                brushBlend: brushBlendValue,
                brushSoftness: brushSoftnessValue,
                centerDampen: centerResponseValue,
                edgeBoost: edgeResponseValue,
                stepFactor: stepFactorValue,
                decayCurve: liquifyDecayCurve,
                gradientLimit: gradientLimitValue,
                applySmoothing: i === substeps,
              },
            });
          }
        }
      }

      if (!useNativeLiquify && engine && engineCommands.length) {
        engineCommands.forEach((cmd) => {
          engine.applyBrush(cmd.u, cmd.v, cmd.params);
        });
      }

      if (!useNativeLiquify) {
        nativeCommands = engineCommands.map((cmd) => ({
          x: clampNumber(cmd.u, 0, 1),
          y: clampNumber(cmd.v, 0, 1),
          dx: cmd.params.vector?.dx ?? 0,
          dy: cmd.params.vector?.dy ?? 0,
          radius: cmd.params.radius,
          strength: cmd.params.strength ?? baseStrength,
          tool: liquifyTool,
          pressure,
        }));
      }

      if (useNativeLiquify && nativeHandle && nativeCommands.length) {
        nativeHandle.enqueueBrushBatch(nativeCommands);
      }

      recordEngineCommands(engineCommands);
      if (useNativeLiquify) {
        recordNativeCommands(nativeCommands);
      }

      if (wantsMetrics) {
        const nowMs =
          typeof eventTimestamp === 'number' && Number.isFinite(eventTimestamp) && eventTimestamp > 0
            ? eventTimestamp
            : Date.now();
        const lastTimestamp = lastLiquifyTimestampRef.current ?? nowMs;
        const deltaMs = Math.max(0, nowMs - lastTimestamp);
        const deltaTime = Math.max(deltaMs / 1000, MIN_LIQUIFY_DELTA_TIME);
        lastLiquifyTimestampRef.current = nowMs;
        const pixelDistance = Math.sqrt(dPxX * dPxX + dPxY * dPxY);
        const previousDistance = liquifyStrokeDistanceRef.current;
        const accumulatedDistance = previousDistance + pixelDistance;
        liquifyStrokeDistanceRef.current = accumulatedDistance;
        const speed = deltaTime > 0 ? pixelDistance / deltaTime : 0;
        onLiquifyMetricsChange?.({
          position: { normalizedX: u, normalizedY: v },
          radius: { normalized: rNorm, pixels: radiusPxImageSpace },
          falloff: nativeBrushFalloff,
          decayCurve: liquifyDecayCurve,
          delta: {
            dxNorm: segmentVectorDx,
            dyNorm: segmentVectorDy,
            lengthNorm: magnitude,
            dxPx: dPxX,
            dyPx: dPxY,
            lengthPx: pixelDistance,
          },
          dynamics: {
            pressure,
            speedPxPerSec: speed,
            deltaTime,
            strokeDistance: accumulatedDistance,
          },
          computed: {
            effectiveStrength,
            brushBlend: brushBlendValue,
            brushSoftness: brushSoftnessValue,
            centerResponse: centerResponseValue,
            edgeResponse: edgeResponseValue,
            stepFactor: stepFactorValue,
          },
        });
      }
      if (previewVisibleRef.current) {
        setPreviewPoint({
          normalizedX: u,
          normalizedY: v,
          objectX: adjustedX,
          objectY: adjustedY,
        });
      }
      if (!useNativeLiquify && engine) {
        requestMeshRefresh();
      }
      const t1 = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const stats = strokeStatsRef.current;
      stats.flushCount += 1;
      stats.commandCount += engineCommands.length;
      stats.substepCount += engineCommands.length;
      stats.durationMs += t1 - t0;
    },
    [
      useNativeLiquify,
      imageLayout,
      liquifyBrushSize,
      liquifyTool,
      displacementScale,
      liquifyStrengthScale,
      requestMeshRefresh,
      computeEffectiveStrength,
      getPointerInfo,
      nativeBrushFalloff,
      liquifyDecayCurve,
      centerResponseMinValue,
      centerResponseMaxValue,
      edgeResponseMinValue,
      edgeResponseMaxValue,
      stepFactorMinValue,
      stepFactorMaxValue,
      onLiquifyMetricsChange,
      liquifyCenterDampen,
      liquifyEdgeBoost,
      liquifyStepFactor,
      recordEngineCommands,
      recordNativeCommands,
    ]
  );

  const exportLiquifiedImage = React.useCallback(async (): Promise<string | null> => {
    // 避免“刚松手就导出”时最后一笔未入历史，导致导出图落后一笔。
    finalizeStrokeRecording();
    const targetImage = image;
    const { intrinsicWidth, intrinsicHeight } = imageLayout;
    if (!targetImage || !intrinsicWidth || !intrinsicHeight) {
      return null;
    }
    const srcWidthPx = Math.max(1, Math.round(intrinsicWidth));
    const srcHeightPx = Math.max(1, Math.round(intrinsicHeight));
    liquifyDebugLog('[LiquifyExportImage]', {
      skiaWidth: targetImage.width(),
      skiaHeight: targetImage.height(),
      srcWidthPx,
      srcHeightPx,
    });
    const MAX_OUTPUT_DIM = 2048;
    const srcMaxDim = Math.max(srcWidthPx, srcHeightPx);
    const scale = srcMaxDim > MAX_OUTPUT_DIM ? MAX_OUTPUT_DIM / srcMaxDim : 1;
    const widthPx = Math.max(1, Math.round(srcWidthPx * scale));
    const heightPx = Math.max(1, Math.round(srcHeightPx * scale));
    if (scale !== 1) {
      liquifyDebugLog('[LiquifySketchScale]', {
        srcWidthPx,
        srcHeightPx,
        widthPx,
        heightPx,
        scale: Number(scale.toFixed(4)),
      });
    }

    if (useNativeLiquify) {
      const nativeHandle = nativeLiquifyRef.current;
      const exportDir = RNFS.CachesDirectoryPath || RNFS.DocumentDirectoryPath;
      if (!nativeHandle || !exportDir) {
        liquifyRecoveryWarn('[LiquifyExport][native-unavailable]', {
          imagePath: backgroundImage,
          hasNativeHandle: Boolean(nativeHandle),
          hasExportDir: Boolean(exportDir),
        });
        return null;
      }
      const nativePath = `${exportDir}/liquify-native-${Date.now()}.png`;
      if (__DEV__) {
        console.warn('[LiquifyExport][native-start]', {
          imagePath: backgroundImage,
          nativePath,
          sourceSize: `${srcWidthPx}x${srcHeightPx}`,
          exportMaxDim: MAX_OUTPUT_DIM,
        });
      }
      try {
        const existed = await RNFS.exists(nativePath);
        if (existed) {
          await RNFS.unlink(nativePath);
        }
      } catch {
        // ignore stale cleanup error
      }
      nativeHandle.exportWarpedImage(nativePath, MAX_OUTPUT_DIM);
      const waitStart = Date.now();
      const waitTimeoutMs = 5000;
      while (Date.now() - waitStart < waitTimeoutMs) {
        try {
          const exists = await RNFS.exists(nativePath);
          if (exists) {
            const stat = await RNFS.stat(nativePath);
            const size = Number(stat.size ?? 0);
            if (Number.isFinite(size) && size > 0) {
              if (__DEV__) {
                console.warn('[LiquifyExport][native-file]', {
                  nativePath,
                  size,
                  modified: stat.mtime,
                });
              }
              return nativePath;
            }
          }
        } catch {
          // ignore polling race
        }
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 36);
        });
      }
      liquifyRecoveryWarn('[LiquifyExport][native-timeout]', {
        imagePath: backgroundImage,
        nativePath,
        waitTimeoutMs,
        historyLength: strokeHistoryRef.current.length,
        historyIndex: historyIndexRef.current,
      });
      return null;
    }

    const snapshotIndex = Math.max(0, Math.min(historyIndexRef.current, displacementSnapshotsRef.current.length) - 1);
    const snapshot = displacementSnapshotsRef.current[snapshotIndex];
    const exportEngine = new LiquifyEngine({
      cols: normalizedDensity,
      rows: normalizedDensity,
      maxMagnitude,
      falloff: falloffValue,
      smoothingStrength: clampNumber(smoothingStrengthValue, 0.05, 0.9),
      smoothingIterations,
    });
    // 原生液化路径下，导出时强制按历史命令重建，避免快照与当前会话状态不一致导致“少步骤”。
    const canUseSnapshot = !useNativeLiquify && Boolean(snapshot);
    if (canUseSnapshot && snapshot) {
      exportEngine.loadDisplacement(snapshot);
    } else {
      const strokeCount = Math.min(historyIndexRef.current, strokeHistoryRef.current.length);
      for (let i = 0; i < strokeCount; i += 1) {
        const stroke = strokeHistoryRef.current[i];
        stroke.engineCommands.forEach((cmd) => {
          exportEngine.applyBrush(cmd.u, cmd.v, cmd.params);
        });
      }
    }
    const { cols, rows, deformX, deformY, indices } = exportEngine.exportDisplacement();
    const vertexCount = cols * rows;
    const verts: { x: number; y: number }[] = new Array(vertexCount);
    const uvs: { x: number; y: number }[] = new Array(vertexCount);
    for (let y = 0; y < rows; y += 1) {
      const v = rows === 1 ? 0 : y / (rows - 1);
      for (let x = 0; x < cols; x += 1) {
        const u = cols === 1 ? 0 : x / (cols - 1);
        const idx = y * cols + x;
        const px = u * widthPx;
        const py = v * heightPx;
        const srcU = clampNumber(u + deformX[idx], 0, 1);
        const srcV = clampNumber(v + deformY[idx], 0, 1);
        verts[idx] = { x: px, y: py };
        uvs[idx] = { x: srcU * srcWidthPx, y: srcV * srcHeightPx };
      }
    }
    const surface = Skia.Surface.MakeOffscreen(widthPx, heightPx);
    if (!surface) {
      throw new Error(i18n.t('errors.canvasOffscreenCreate'));
    }
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    const shader = targetImage.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None
    );
    paint.setShader(shader);
    const skVertices = Skia.MakeVertices(
      VertexMode.Triangles,
      verts,
      uvs,
      undefined,
      Array.from(indices)
    );
    const surfaceCanvas = surface.getCanvas();
    surfaceCanvas.drawVertices(skVertices, BlendMode.SrcOver, paint);
    const surfaceSnapshot = surface.makeImageSnapshot();
    const base64 = surfaceSnapshot.encodeToBase64(ImageFormat.PNG);
    const fsAny = FileSystem as any;
    const targetDir =
      fsAny.cacheDirectory ||
      fsAny.documentDirectory ||
      fsAny?.Paths?.cache?.toString?.() ||
      fsAny?.Paths?.document?.toString?.();
    if (!targetDir) {
      throw new Error(i18n.t('errors.canvasCacheDir'));
    }
    const filePath = `${targetDir}liquify-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(filePath, base64, {
      encoding: fsAny.EncodingType?.Base64 ?? 'base64',
    });
    return filePath;
  }, [
    backgroundImage,
    finalizeStrokeRecording,
    image,
    imageLayout,
    normalizedDensity,
    maxMagnitude,
    falloffValue,
    smoothingStrengthValue,
    smoothingIterations,
    useNativeLiquify,
  ]);

  const resetLiquifyInternal = React.useCallback(() => {
    strokeHistoryRef.current = [];
    historyIndexRef.current = 0;
    currentStrokeRef.current = null;
    displacementSnapshotsRef.current = [];
    nativeHistorySnapshotIdsRef.current = [];
    nativeReusableSnapshotIdsRef.current = [];
    nativeSnapshotNextIdRef.current = NATIVE_HISTORY_SNAPSHOT_START_INDEX;
    notifyHistoryChange();
    liquifyEngineRef.current?.reset();
    if (useNativeLiquify) {
      nativeLiquifyRef.current?.reset();
    }
    if (!useNativeLiquify) {
      requestMeshRefresh();
    }
  }, [notifyHistoryChange, requestMeshRefresh, useNativeLiquify]);

  React.useEffect(() => {
    const sourcePath = backgroundImage ?? null;
    if (sourcePath === lastBackgroundImageRef.current) {
      return;
    }
    lastBackgroundImageRef.current = sourcePath;
    resetLiquifyInternal();
  }, [backgroundImage, resetLiquifyInternal]);

  const applyGrayscaleOverlay = React.useCallback(
    async (options?: ApplyGrayscaleOverlayOptions): Promise<string | null> => {
      const shouldApplyPreview = options?.applyPreview ?? true;
      if (!shouldApplyPreview) {
        clearPendingAppliedPreview();
      }
    // 将“真实位移区域”作为 mask，仅在该区域应用黑白摄影效果（不调用任何网络 API）。
    if (isApplyingOverlayRef.current) {
      throw new Error(i18n.t('errors.canvasBwGenerating'));
    }
    isApplyingOverlayRef.current = true;
    let ownedInputImage: SkImage | null = null;
    // 避免“刚抬手就点按钮”导致最后一笔尚未落盘，从而第一次点击无效。
    finalizeStrokeRecording();
    const samplePixel = (img: SkImage, label: string) => {
      try {
        const info = img.getImageInfo();
        const w = img.width();
        const h = img.height();
        const x = Math.max(0, Math.min(w - 1, Math.floor(w / 2)));
        const y = Math.max(0, Math.min(h - 1, Math.floor(h / 2)));
        const px = img.readPixels(x, y, { ...info, width: 1, height: 1 });
        if (!px) {
          liquifyDebugLog('[LiquifyBWPixel]', { label, x, y, ok: false });
          return;
        }
        if (px instanceof Uint8Array) {
          liquifyDebugLog('[LiquifyBWPixel]', {
            label,
            x,
            y,
            rgba: [px[0], px[1], px[2], px[3]],
            colorType: info.colorType,
            alphaType: info.alphaType,
          });
          return;
        }
        liquifyDebugLog('[LiquifyBWPixel]', {
          label,
          x,
          y,
          rgbaF: [px[0], px[1], px[2], px[3]],
          colorType: info.colorType,
          alphaType: info.alphaType,
        });
      } catch (err: any) {
        console.warn('[LiquifyBWPixel][error]', { label, message: err?.message || String(err) });
      }
    };
    let targetImage = image;
    const { intrinsicWidth, intrinsicHeight } = imageLayout;
    try {
      if (!targetImage) {
        throw new Error(i18n.t('errors.canvasSkiaNotReady'));
      }
      if (!intrinsicWidth || !intrinsicHeight) {
        throw new Error(i18n.t('errors.canvasNotReady'));
      }

      if (useNativeLiquify) {
        try {
          const nonTexture = targetImage.makeNonTextureImage();
          if (nonTexture && nonTexture !== targetImage) {
            ownedInputImage = nonTexture;
            targetImage = nonTexture;
            liquifyDebugLog('[LiquifyBWInput]', { convertedToNonTexture: true });
          } else {
            liquifyDebugLog('[LiquifyBWInput]', { convertedToNonTexture: false });
          }
        } catch (err: any) {
          console.warn('[LiquifyBWInput][nonTexture-fail]', { message: err?.message || String(err) });
        }
      }

      const strokeCount = Math.min(historyIndexRef.current, strokeHistoryRef.current.length);
      if (strokeCount <= 0) {
        throw new Error(i18n.t('errors.canvasNoLiquifyArea'));
      }

      const srcWidthPx = Math.max(1, Math.round(intrinsicWidth));
      const srcHeightPx = Math.max(1, Math.round(intrinsicHeight));
      liquifyDebugLog('[LiquifyBWImage]', {
        skiaWidth: targetImage.width(),
        skiaHeight: targetImage.height(),
        srcWidthPx,
        srcHeightPx,
      });
      const MAX_OUTPUT_DIM = 2048;
      const srcMaxDim = Math.max(srcWidthPx, srcHeightPx);
      const scale = srcMaxDim > MAX_OUTPUT_DIM ? MAX_OUTPUT_DIM / srcMaxDim : 1;
      const widthPx = Math.max(1, Math.round(srcWidthPx * scale));
      const heightPx = Math.max(1, Math.round(srcHeightPx * scale));
      if (scale !== 1) {
        liquifyDebugLog('[LiquifyBWScale]', {
          srcWidthPx,
          srcHeightPx,
          widthPx,
          heightPx,
          scale: Number(scale.toFixed(4)),
        });
      }

    // 1) 复现当前位移场
    const snapshotIndex = Math.max(
      0,
      Math.min(historyIndexRef.current, displacementSnapshotsRef.current.length) - 1
    );
    const snapshot = displacementSnapshotsRef.current[snapshotIndex];
    const exportEngine = new LiquifyEngine({
      cols: normalizedDensity,
      rows: normalizedDensity,
      maxMagnitude,
      falloff: falloffValue,
      smoothingStrength: clampNumber(smoothingStrengthValue, 0.05, 0.9),
      smoothingIterations,
    });
    // 原生液化路径下，导出时强制按历史命令重建，避免快照与当前会话状态不一致导致“少步骤”。
    const canUseSnapshot = !useNativeLiquify && Boolean(snapshot);
    if (canUseSnapshot && snapshot) {
      exportEngine.loadDisplacement(snapshot);
    } else {
      for (let i = 0; i < strokeCount; i += 1) {
        const stroke = strokeHistoryRef.current[i];
        stroke.engineCommands.forEach((cmd) => {
          exportEngine.applyBrush(cmd.u, cmd.v, cmd.params);
        });
      }
    }

    // 2) 先导出“已液化的彩色图”（后续在其基础上做局部黑白合成）
    const { cols, rows, deformX, deformY, indices } = exportEngine.exportDisplacement();
    const vertexCount = cols * rows;
    const verts: { x: number; y: number }[] = new Array(vertexCount);
    const uvs: { x: number; y: number }[] = new Array(vertexCount);
    for (let y = 0; y < rows; y += 1) {
      const v = rows === 1 ? 0 : y / (rows - 1);
      for (let x = 0; x < cols; x += 1) {
        const u = cols === 1 ? 0 : x / (cols - 1);
        const idx = y * cols + x;
        const px = u * widthPx;
        const py = v * heightPx;
        const srcU = clampNumber(u + deformX[idx], 0, 1);
        const srcV = clampNumber(v + deformY[idx], 0, 1);
        verts[idx] = { x: px, y: py };
        uvs[idx] = { x: srcU * srcWidthPx, y: srcV * srcHeightPx };
      }
    }
      const liquifySurface = Skia.Surface.MakeOffscreen(widthPx, heightPx);
      if (!liquifySurface) {
        throw new Error(i18n.t('errors.canvasOffscreenCreate'));
      }
    const liquifyCanvas = liquifySurface.getCanvas();
    // 先铺底，避免最终 PNG 因透明背景在原生视图里看起来像“全黑/黑屏”
    liquifyCanvas.clear(Skia.Color('#FFFFFF'));
    const liquifyPaint = Skia.Paint();
    liquifyPaint.setAntiAlias(true);
    const shader = targetImage.makeShaderOptions(
      TileMode.Clamp,
      TileMode.Clamp,
      FilterMode.Linear,
      MipmapMode.None
    );
    liquifyPaint.setShader(shader);
    const skVertices = Skia.MakeVertices(
      VertexMode.Triangles,
      verts,
      uvs,
      undefined,
      Array.from(indices)
    );
    liquifyCanvas.drawVertices(skVertices, BlendMode.SrcOver, liquifyPaint);
    liquifySurface.flush();
    const liquifiedSnapshot = liquifySurface.makeImageSnapshot();
    liquifySurface.dispose();
    samplePixel(liquifiedSnapshot, 'liquified');

    // 3) 计算“真实位移区域”（基于位移幅值，而不是涂抹轨迹）
    const magsPx: number[] = new Array(vertexCount);
    let maxMagPx = 0;
    for (let i = 0; i < vertexCount; i += 1) {
      const magPx = Math.hypot(deformX[i] * srcWidthPx, deformY[i] * srcHeightPx);
      magsPx[i] = magPx;
      maxMagPx = Math.max(maxMagPx, magPx);
    }
    if (maxMagPx <= 0) {
      throw new Error(i18n.t('errors.canvasNoDisplacementArea'));
    }
    const cellWidthPx = cols > 1 ? widthPx / (cols - 1) : widthPx;
    const cellHeightPx = rows > 1 ? heightPx / (rows - 1) : heightPx;
    const buildMaskForThreshold = (threshold: number) => {
      const activeCells: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
      let bboxMinX = widthPx;
      let bboxMinY = heightPx;
      let bboxMaxX = 0;
      let bboxMaxY = 0;
      for (let y = 0; y < rows - 1; y += 1) {
        for (let x = 0; x < cols - 1; x += 1) {
          const idx0 = y * cols + x;
          const idx1 = idx0 + 1;
          const idx2 = idx0 + cols;
          const idx3 = idx2 + 1;
          const cellMagPx = Math.max(magsPx[idx0], magsPx[idx1], magsPx[idx2], magsPx[idx3]);
          if (cellMagPx <= threshold) {
            continue;
          }
          const u0 = cols === 1 ? 0 : x / (cols - 1);
          const v0 = rows === 1 ? 0 : y / (rows - 1);
          const u1 = cols === 1 ? 1 : (x + 1) / (cols - 1);
          const v1 = rows === 1 ? 1 : (y + 1) / (rows - 1);
          const x0 = u0 * widthPx;
          const y0 = v0 * heightPx;
          const x1 = u1 * widthPx;
          const y1 = v1 * heightPx;
          activeCells.push({ x0, y0, x1, y1 });
          bboxMinX = Math.min(bboxMinX, x0);
          bboxMinY = Math.min(bboxMinY, y0);
          bboxMaxX = Math.max(bboxMaxX, x1);
          bboxMaxY = Math.max(bboxMaxY, y1);
        }
      }
      const activeCellCount = activeCells.length;
      const areaCoverage =
        activeCells.reduce((sum, rect) => sum + (rect.x1 - rect.x0) * (rect.y1 - rect.y0), 0) /
        Math.max(widthPx * heightPx, 1);
      const bbox =
        activeCellCount && bboxMaxX >= bboxMinX && bboxMaxY >= bboxMinY
          ? {
              x: bboxMinX,
              y: bboxMinY,
              w: bboxMaxX - bboxMinX,
              h: bboxMaxY - bboxMinY,
            }
          : null;
      return { activeCells, activeCellCount, areaCoverage, bbox, threshold };
    };
    const absoluteThresholdPx = 1;
    const relativeThresholdPx = maxMagPx * bwThresholdRatio;
    const baseThreshold = Math.min(Math.max(absoluteThresholdPx, relativeThresholdPx), maxMagPx * 0.9);
    let maskResult = buildMaskForThreshold(baseThreshold);
    let bboxCoverage = maskResult.bbox
      ? (maskResult.bbox.w * maskResult.bbox.h) / Math.max(widthPx * heightPx, 1)
      : 0;
    // 若覆盖过大（导致整图变灰），提高阈值：以 80 分位的位移作为下限。
    if (maskResult.areaCoverage > 0.35 || bboxCoverage > 0.6) {
      const sorted = [...magsPx].sort((a, b) => b - a);
      const p80 = sorted[Math.max(0, Math.floor(sorted.length * 0.2) - 1)] ?? maxMagPx;
      const bumped = Math.max(baseThreshold, p80, maxMagPx * 0.35, 2);
      const adjusted = buildMaskForThreshold(bumped);
      liquifyDebugLog('[LiquifyMaskAdjust]', {
        prevCoverage: Number(maskResult.areaCoverage.toFixed(4)),
        prevThresholdPx: Number(baseThreshold.toFixed(3)),
        newThresholdPx: Number(bumped.toFixed(3)),
        newCoverage: Number(adjusted.areaCoverage.toFixed(4)),
      });
      maskResult = adjusted;
      bboxCoverage = maskResult.bbox
        ? (maskResult.bbox.w * maskResult.bbox.h) / Math.max(widthPx * heightPx, 1)
        : 0;
    }
    liquifyDebugLog('[LiquifyMask]', {
      maxMagPx: Number(maxMagPx.toFixed(3)),
      thresholdPx: Number(maskResult.threshold.toFixed(3)),
      bboxCount: maskResult.bbox ? 1 : 0,
      bbox: maskResult.bbox
        ? {
            x: Number(maskResult.bbox.x.toFixed(1)),
            y: Number(maskResult.bbox.y.toFixed(1)),
            w: Number(maskResult.bbox.w.toFixed(1)),
            h: Number(maskResult.bbox.h.toFixed(1)),
          }
        : null,
      coverage: Number(maskResult.areaCoverage.toFixed(4)),
      bboxCoverage: Number(bboxCoverage.toFixed(4)),
    });
    const { activeCells, activeCellCount } = maskResult;
      if (!activeCellCount) {
        liquifiedSnapshot.dispose();
        throw new Error(i18n.t('errors.canvasNoSignificantDisplacement'));
      }

    // 4) 生成“黑白摄影”版本（基于已液化的输出图，而不是原图）
    const fullRect = Skia.XYWHRect(0, 0, widthPx, heightPx);
    // 注意：Skia ColorMatrix 的 offset 单位为 0-1（参考 RN Skia 自带测试用例），不是 0-255。
    // 黑白摄影：先灰度，再轻微提高对比/亮度（可后续做成可调参数）。
    // 为避免背景亮度被抬高，这里保持对比 1、亮度 0，只做去色。
    const bwContrast = 1;
    const bwBrightness = 0;
    const bwOffset = 0.5 * (1 - bwContrast) + bwBrightness;
    const lumaR = 0.2126;
    const lumaG = 0.7152;
    const lumaB = 0.0722;
    const grayscaleMatrix = [
      lumaR, lumaG, lumaB, 0, 0,
      lumaR, lumaG, lumaB, 0, 0,
      lumaR, lumaG, lumaB, 0, 0,
      0, 0, 0, 1, 0,
    ];
    const toneMatrix = [
      bwContrast, 0, 0, 0, bwOffset,
      0, bwContrast, 0, 0, bwOffset,
      0, 0, bwContrast, 0, bwOffset,
      0, 0, 0, 1, 0,
    ];
    const bwColorFilter = Skia.ColorFilter.MakeCompose(
      Skia.ColorFilter.MakeMatrix(toneMatrix),
      Skia.ColorFilter.MakeMatrix(grayscaleMatrix)
    );
      const grayscaleSurface = Skia.Surface.MakeOffscreen(widthPx, heightPx);
      if (!grayscaleSurface) {
        liquifiedSnapshot.dispose();
        throw new Error(i18n.t('errors.canvasOffscreenCreate'));
      }
    const grayscaleCanvas = grayscaleSurface.getCanvas();
    grayscaleCanvas.clear(Skia.Color('#FFFFFF'));
    const grayscalePaint = Skia.Paint();
    grayscalePaint.setAntiAlias(true);
    grayscalePaint.setColorFilter(bwColorFilter);
    grayscaleCanvas.drawImageRect(liquifiedSnapshot, fullRect, fullRect, grayscalePaint);
    grayscaleSurface.flush();
    const grayscaleSnapshot = grayscaleSurface.makeImageSnapshot();
    // 4.1) 选用锐化卷积提升黑白区域边缘对比（可调）。若失败或强度很低则直接用灰度图。
    const sharpenAmountRaw = Number(bwSharpenAmount);
    const sharpenAmount = Number.isFinite(sharpenAmountRaw) ? clampNumber(sharpenAmountRaw, 0, 1) : 0;
    // 注意：MatrixConvolution 在部分设备上会抛类型错误，这里直接跳过锐化，改为纯灰度，避免 HostFunction 崩溃。
    const grayscaleForBlend = grayscaleSnapshot;
    grayscaleSurface.dispose();
    samplePixel(grayscaleForBlend, 'grayscale');

    // 5) 生成“连续”mask（用三角网格插值，避免出现小格子）
      const maskSurface = Skia.Surface.MakeOffscreen(widthPx, heightPx);
      if (!maskSurface) {
        liquifiedSnapshot.dispose();
        grayscaleSnapshot.dispose();
        throw new Error(i18n.t('errors.canvasOffscreenCreate'));
      }
    const maskCanvas = maskSurface.getCanvas();
    maskCanvas.clear(Skia.Color('transparent'));
    const maskPaint = Skia.Paint();
    maskPaint.setAntiAlias(true);
    maskPaint.setColor(Skia.Color('#FFFFFFFF'));
    activeCells.forEach((rect) => {
      maskCanvas.drawRect(
        Skia.XYWHRect(rect.x0, rect.y0, Math.max(0, rect.x1 - rect.x0), Math.max(0, rect.y1 - rect.y0)),
        maskPaint
      );
    });
    maskSurface.flush();
    const baseMaskSnapshot = maskSurface.makeImageSnapshot();
    maskSurface.dispose();
    samplePixel(baseMaskSnapshot, 'mask-base');

    const cellSizePx = Math.max(cellWidthPx, cellHeightPx);
    const maskBlurSigma = Math.max(1, cellSizePx * bwMaskBlurFactor);
      const softMaskSurface = Skia.Surface.MakeOffscreen(widthPx, heightPx);
      if (!softMaskSurface) {
        baseMaskSnapshot.dispose();
        liquifiedSnapshot.dispose();
        grayscaleForBlend.dispose?.();
        throw new Error(i18n.t('errors.canvasOffscreenCreate'));
      }
    const softMaskCanvas = softMaskSurface.getCanvas();
    softMaskCanvas.clear(Skia.Color('transparent'));
    const softMaskPaint = Skia.Paint();
    softMaskPaint.setAntiAlias(true);
    softMaskPaint.setImageFilter(
      Skia.ImageFilter.MakeBlur(maskBlurSigma, maskBlurSigma, TileMode.Decal, null)
    );
    softMaskCanvas.drawImageRect(baseMaskSnapshot, fullRect, fullRect, softMaskPaint);
    softMaskSurface.flush();
    const maskSnapshot = softMaskSurface.makeImageSnapshot();
    softMaskSurface.dispose();
    baseMaskSnapshot.dispose();
    samplePixel(maskSnapshot, 'mask-soft');

    // 6) 用 mask 把黑白图裁成“只在位移区域有效”
      const maskedBwSurface = Skia.Surface.MakeOffscreen(widthPx, heightPx);
      if (!maskedBwSurface) {
        maskSnapshot.dispose();
        liquifiedSnapshot.dispose();
        throw new Error(i18n.t('errors.canvasOffscreenCreate'));
      }
    const maskedBwCanvas = maskedBwSurface.getCanvas();
    maskedBwCanvas.clear(Skia.Color('transparent'));
    const maskedBwBasePaint = Skia.Paint();
    maskedBwBasePaint.setAntiAlias(true);
    maskedBwCanvas.drawImageRect(grayscaleForBlend, fullRect, fullRect, maskedBwBasePaint);
    const dstInPaint = Skia.Paint();
    dstInPaint.setAntiAlias(true);
    dstInPaint.setBlendMode(BlendMode.DstIn);
    // 把 mask 的 alpha “顶满”（中心更不透明），避免黑白区域还能透出肤色。
    const maskAlphaGain = bwMaskAlphaGain;
    dstInPaint.setColorFilter(
      Skia.ColorFilter.MakeMatrix([
        1, 0, 0, 0, 0,
        0, 1, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, maskAlphaGain, 0,
      ])
    );
    maskedBwCanvas.drawImageRect(maskSnapshot, fullRect, fullRect, dstInPaint);
    maskedBwSurface.flush();
    const maskedBwSnapshot = maskedBwSurface.makeImageSnapshot();
    maskedBwSurface.dispose();
    samplePixel(maskedBwSnapshot, 'bw-masked');

    // 7) 在彩色图上叠加“已裁剪的黑白图”
      const outputSurface = Skia.Surface.MakeOffscreen(widthPx, heightPx);
      if (!outputSurface) {
        maskSnapshot.dispose();
        maskedBwSnapshot.dispose();
        liquifiedSnapshot.dispose();
        grayscaleForBlend.dispose?.();
        throw new Error(i18n.t('errors.canvasOffscreenCreate'));
      }
    const outputCanvas = outputSurface.getCanvas();
    outputCanvas.clear(Skia.Color('#FFFFFF'));
    const outputBasePaint = Skia.Paint();
    outputBasePaint.setAntiAlias(true);
    outputCanvas.drawImageRect(liquifiedSnapshot, fullRect, fullRect, outputBasePaint);
    const outputOverlayPaint = Skia.Paint();
    outputOverlayPaint.setAntiAlias(true);
    outputCanvas.drawImageRect(maskedBwSnapshot, fullRect, fullRect, outputOverlayPaint);

    outputSurface.flush();
    const finalSnapshot = outputSurface.makeImageSnapshot();
    outputSurface.dispose();
    samplePixel(finalSnapshot, 'final');
    const base64 = finalSnapshot.encodeToBase64(ImageFormat.PNG);
    const fsAny = FileSystem as any;
    const targetDir =
      fsAny.cacheDirectory ||
      fsAny.documentDirectory ||
      fsAny?.Paths?.cache?.toString?.() ||
      fsAny?.Paths?.document?.toString?.();
    if (!targetDir) {
      throw new Error(i18n.t('errors.canvasCacheDir'));
    }
    const filePath = `${targetDir}liquify-bw-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(filePath, base64, {
      encoding: fsAny.EncodingType?.Base64 ?? 'base64',
    });

      liquifiedSnapshot.dispose();
      grayscaleForBlend.dispose?.();
      maskSnapshot.dispose();
      maskedBwSnapshot.dispose();
      if (ownedInputImage) {
        ownedInputImage.dispose();
        ownedInputImage = null;
      }

      if (shouldApplyPreview) {
        // 为避免“切图时闪回/重复液化”，先用 overlay 覆盖展示，待父组件切换到新图后再 resetLiquify。
        setPendingAppliedPreview(finalSnapshot);
        setPendingAppliedPath(filePath);
      } else {
        finalSnapshot.dispose();
      }
      return filePath;
    } finally {
      if (ownedInputImage) {
        ownedInputImage.dispose();
        ownedInputImage = null;
      }
      isApplyingOverlayRef.current = false;
    }
    },
    [
      bwMaskAlphaGain,
      bwMaskBlurFactor,
      bwSharpenAmount,
      bwThresholdRatio,
      clearPendingAppliedPreview,
      falloffValue,
      finalizeStrokeRecording,
      image,
      imageLayout,
      maxMagnitude,
      normalizedDensity,
      smoothingIterations,
      smoothingStrengthValue,
      useNativeLiquify,
    ]
  );

  React.useImperativeHandle(
    _ref,
    () => ({
      resetLiquify() {
        clearPendingAppliedPreview();
        resetLiquifyInternal();
        markLiquifyDraftDirty();
        liquifyDraftRestoredImageRef.current = backgroundImage ?? null;
        clearLiquifyDraftPersistTimer();
        void clearLiquifyDraftFile(backgroundImage);
        void clearLiquifyNativeStateFile(backgroundImage);
      },
      undoLiquify: undoLiquifyStroke,
      redoLiquify: redoLiquifyStroke,
      refreshLiquify,
      rehydrateLiquify,
      exportLiquifiedImage,
      applyGrayscaleOverlay,
    }),
    [
      applyGrayscaleOverlay,
      backgroundImage,
      clearLiquifyDraftFile,
      clearLiquifyNativeStateFile,
      clearLiquifyDraftPersistTimer,
      clearPendingAppliedPreview,
      exportLiquifiedImage,
      markLiquifyDraftDirty,
      notifyHistoryChange,
      redoLiquifyStroke,
      rehydrateLiquify,
      refreshLiquify,
      resetLiquifyInternal,
      undoLiquifyStroke,
      useNativeLiquify,
    ]
  );

  const landmarkDots = React.useMemo(() => {
    if (!showLandmarks || !landmarkOverlays.length) {
      return [];
    }
    const { fittedWidth, fittedHeight, offsetX, offsetY } = imageLayout;
    if (fittedWidth <= 0 || fittedHeight <= 0) {
      return [];
    }
    const engine = liquifyEngineRef.current;
    return landmarkOverlays.flatMap((overlay) =>
      overlay.points
        .map((pt, index) => {
          // 若为 Skia 路径，则需要把“源点”映射到“输出坐标”，才能让标记跟随形变。
          const mapped = engine ? engine.mapSourceToOutput(pt.x, pt.y, 4) : { u: pt.x, v: pt.y };
          const x = offsetX + mapped.u * fittedWidth;
          const y = offsetY + mapped.v * fittedHeight;
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
          }
          return {
            id: `${overlay.id}-${index}`,
            x,
            y,
            color: overlay.color,
          };
        })
        .filter(Boolean)
    ) as Array<{ id: string; x: number; y: number; color: string }>;
  }, [imageLayout, landmarkOverlays, showLandmarks, meshVersion]);

  const clampPanOffsets = (candidateX: number, candidateY: number, zoom: number) => {
    'worklet';
    const baseWidth = contentWidth.value;
    const baseHeight = contentHeight.value;
    const baseOffsetX = contentOffsetX.value;
    const baseOffsetY = contentOffsetY.value;

    const scaledWidth = baseWidth * zoom;
    const scaledHeight = baseHeight * zoom;
    const scaledOffsetX = baseOffsetX * zoom;
    const scaledOffsetY = baseOffsetY * zoom;

    let minX: number;
    let maxX: number;
    let minY: number;
    let maxY: number;

    if (scaledWidth <= width) {
      const centeredX = (width - scaledWidth) / 2 - scaledOffsetX;
      minX = centeredX;
      maxX = centeredX;
    } else {
      minX = width - (scaledOffsetX + scaledWidth);
      maxX = -scaledOffsetX;
    }

    if (scaledHeight <= height) {
      const centeredY = (height - scaledHeight) / 2 - scaledOffsetY;
      minY = centeredY;
      maxY = centeredY;
    } else {
      const verticalSlack = Math.min(height * 0.15, scaledHeight * 0.15);
      minY = height - (scaledOffsetY + scaledHeight) - verticalSlack;
      maxY = -scaledOffsetY + verticalSlack;
    }

    return {
      x: clamp(candidateX, minX, maxX),
      y: clamp(candidateY, minY, maxY),
    };
  };

  const enforcePanBounds = () => {
    'worklet';
    const bounded = clampPanOffsets(panOffsetX.value, panOffsetY.value, zoomLevel.value);
    panOffsetX.value = bounded.x;
    panOffsetY.value = bounded.y;
    panStartX.value = bounded.x;
    panStartY.value = bounded.y;
  };

  React.useEffect(() => {
    if (!image) {
      if (!backgroundImage) {
        contentWidth.value = width;
        contentHeight.value = height;
        contentOffsetX.value = 0;
        contentOffsetY.value = 0;
        setImageLayout({
          fittedWidth: width,
          fittedHeight: height,
          offsetX: 0,
          offsetY: 0,
          intrinsicWidth: 0,
          intrinsicHeight: 0,
        });
        runOnUI(enforcePanBounds)();
      }
      return;
    }

    const nativeImage: any = image;
    const intrinsicWidth =
      typeof nativeImage?.width === 'function'
        ? nativeImage.width()
        : typeof nativeImage?.width === 'number'
          ? nativeImage.width
          : 0;
    const intrinsicHeight =
      typeof nativeImage?.height === 'function'
        ? nativeImage.height()
        : typeof nativeImage?.height === 'number'
          ? nativeImage.height
          : 0;

    if (intrinsicWidth <= 0 || intrinsicHeight <= 0) {
      if (!backgroundImage) {
        contentWidth.value = width;
        contentHeight.value = height;
        contentOffsetX.value = 0;
        contentOffsetY.value = 0;
        setImageLayout({
          fittedWidth: width,
          fittedHeight: height,
          offsetX: 0,
          offsetY: 0,
          intrinsicWidth,
          intrinsicHeight,
        });
        runOnUI(enforcePanBounds)();
      }
      return;
    }

    const imageAspect = intrinsicWidth / intrinsicHeight;
    const containerAspect = width / height;

    if (imageAspect > containerAspect) {
      const fittedWidth = width;
      const fittedHeight = width / imageAspect;
      contentWidth.value = fittedWidth;
      contentHeight.value = fittedHeight;
      contentOffsetX.value = 0;
      contentOffsetY.value = (height - fittedHeight) / 2;
      setImageLayout({
        fittedWidth,
        fittedHeight,
        offsetX: 0,
        offsetY: (height - fittedHeight) / 2,
        intrinsicWidth,
        intrinsicHeight,
      });
    } else {
      const fittedHeight = height;
      const fittedWidth = height * imageAspect;
      contentWidth.value = fittedWidth;
      contentHeight.value = fittedHeight;
      contentOffsetX.value = (width - fittedWidth) / 2;
      contentOffsetY.value = 0;
      setImageLayout({
        fittedWidth,
        fittedHeight,
        offsetX: (width - fittedWidth) / 2,
        offsetY: 0,
        intrinsicWidth,
        intrinsicHeight,
      });
    }

    runOnUI(enforcePanBounds)();
  }, [backgroundImage, image, width, height]);

  React.useEffect(() => {
    if (!liquifyEngineRef.current) {
      return;
    }
    liquifyEngineRef.current.reset();
    requestMeshRefresh();
  }, [backgroundImage, requestMeshRefresh]);

  React.useEffect(() => {
    if (!pendingAppliedPath || !backgroundImage) {
      return;
    }
    if (backgroundImage !== pendingAppliedPath) {
      return;
    }
    requestAnimationFrame(() => {
      resetLiquifyInternal();
      clearPendingAppliedPreview();
    });
  }, [backgroundImage, clearPendingAppliedPreview, pendingAppliedPath, resetLiquifyInternal]);

  /**
   * 单指平移手势
   * 严格限制为单指操作，避免与双指手势冲突
   * 包含手指数量变化检测，防止手势切换时的跳变
   */
  const singleFingerPan = Gesture.Pan()
    .maxPointers(1) // 限制最多允许一根手指
    .onBegin(() => {
      if (isPinching.value) {
        return; // 若双指缩放正在进行则忽略单指事件
      }
      panStartX.value = panOffsetX.value; // 记录当前水平偏移作为起点
      panStartY.value = panOffsetY.value; // 记录当前垂直偏移作为起点
    })
    .onUpdate((event: PanGestureHandlerEventPayload) => {
      if (isPinching.value) {
        return; // 避免缩放过程中叠加平移
      }
      panOffsetX.value = panStartX.value + event.translationX; // 根据手势位移更新水平偏移
      panOffsetY.value = panStartY.value + event.translationY; // 根据手势位移更新垂直偏移
    })
    .onEnd(() => {
      enforcePanBounds(); // 操作结束后统一收敛到合法边界
    });

  /**
   * Pinch 缩放手势处理
   * 双指操作：同时支持缩放和平移
   * - 捏合/分开：缩放
   * - 整体移动：平移
   * - 可以同时进行，实现自由操控
   * - 包含手指数量变化检测和缩放灵敏度调整
   */
  const pinchGesture = Gesture.Pinch()
    .onTouchesDown((event: GestureTouchEvent) => {
      'worklet';
      if (event.numberOfTouches < 2) {
        return;
      }

      const centroid = computeCentroid(event.allTouches);
      pinchLastFocalX.value = centroid.x;
      pinchLastFocalY.value = centroid.y;
      pinchLastScale.value = 1;
      focalMarkerX.value = centroid.x;
      focalMarkerY.value = centroid.y;
      isPinching.value = true;
    })
    .onTouchesMove((event: GestureTouchEvent) => {
      'worklet';
      if (event.numberOfTouches < 2 || event.state === State.ACTIVE) {
        return;
      }

      const centroid = computeCentroid(event.allTouches);
      const deltaX = centroid.x - pinchLastFocalX.value;
      const deltaY = centroid.y - pinchLastFocalY.value;
      panOffsetX.value += deltaX;
      panOffsetY.value += deltaY;
      pinchLastFocalX.value = centroid.x;
      pinchLastFocalY.value = centroid.y;
      focalMarkerX.value = centroid.x;
      focalMarkerY.value = centroid.y;
    })
    .onTouchesUp((event: GestureTouchEvent) => {
      'worklet';
      if (event.numberOfTouches < 2) {
        pinchLastScale.value = 1;
        isPinching.value = false;
        enforcePanBounds();
        return;
      }

      const centroid = computeCentroid(event.allTouches);
      pinchLastFocalX.value = centroid.x;
      pinchLastFocalY.value = centroid.y;
    })
    .onTouchesCancelled(() => {
      'worklet';
      pinchLastScale.value = 1;
      isPinching.value = false;
      enforcePanBounds();
    })
    .onBegin((event: GestureUpdateEvent<PinchGestureHandlerEventPayload>) => {
      'worklet';
      if (event.numberOfPointers < 2) {
        pinchLastScale.value = 1;
        isPinching.value = false;
        enforcePanBounds();
        return;
      }

      isPinching.value = true;
      pinchLastFocalX.value = event.focalX;
      pinchLastFocalY.value = event.focalY;
      pinchLastScale.value = event.scale > 0 ? event.scale : 1;
      focalMarkerX.value = event.focalX;
      focalMarkerY.value = event.focalY;
    })
    .onUpdate((event: GestureUpdateEvent<PinchGestureHandlerEventPayload>) => {
      if (event.scale <= 0) {
        return; // 非法缩放比例直接忽略
      }

      if (event.numberOfPointers < 2) {
        pinchLastScale.value = 1;
        isPinching.value = false;
        return;
      }

      if (!isPinching.value) {
        isPinching.value = true; // 确保状态恢复为缩放中
        pinchLastFocalX.value = event.focalX; // 重置上一帧质心 X
        pinchLastFocalY.value = event.focalY; // 重置上一帧质心 Y
        pinchLastScale.value = event.scale > 0 ? event.scale : 1; // 重置上一帧缩放比例
      }

      // 先基于质心位移更新平移，使拖拽立即生效
      const deltaFocalX = event.focalX - pinchLastFocalX.value; // 计算质心 X 的帧间位移
      const deltaFocalY = event.focalY - pinchLastFocalY.value; // 计算质心 Y 的帧间位移
      panOffsetX.value += deltaFocalX; // 用质心位移驱动拖拽
      panOffsetY.value += deltaFocalY; // 用质心位移驱动拖拽

      const previousZoom = zoomLevel.value;
      const lastScale = pinchLastScale.value > 0 ? pinchLastScale.value : 1;
      const rawScaleRatio = event.scale / lastScale;
      const scaleRatio = Math.pow(rawScaleRatio, SCALE_FACTOR);
      const nextZoom = clamp(
        previousZoom * scaleRatio,
        MIN_ZOOM,
        MAX_ZOOM
      );
      const zoomMultiplier = nextZoom / previousZoom;

      pinchLastScale.value = event.scale;

      const focalX = event.focalX;
      const focalY = event.focalY;
      const offsetToFocalX = focalX - panOffsetX.value;
      const offsetToFocalY = focalY - panOffsetY.value;
      panOffsetX.value = focalX - offsetToFocalX * zoomMultiplier;
      panOffsetY.value = focalY - offsetToFocalY * zoomMultiplier;
      zoomLevel.value = nextZoom;

      focalMarkerX.value = event.focalX; // 同步质心 X 坐标
      focalMarkerY.value = event.focalY; // 同步质心 Y 坐标
      pinchLastFocalX.value = event.focalX; // 更新上一帧质心 X
      pinchLastFocalY.value = event.focalY; // 更新上一帧质心 Y
    })
    .onEnd(() => {
      panStartX.value = panOffsetX.value; // 缓存最终水平偏移
      panStartY.value = panOffsetY.value; // 缓存最终垂直偏移
      pinchLastScale.value = 1;
      enforcePanBounds();
      isPinching.value = false; // 结束缩放状态 
    })
    .onFinalize(() => {
      pinchLastScale.value = 1;
      enforcePanBounds();
      isPinching.value = false; // 保底清理缩放状态
    });

  // 液化增量计算的上一帧触点，运行在 UI 线程
  const lastLiquifyX = useSharedValue<number | null>(null);
  const lastLiquifyY = useSharedValue<number | null>(null);
  const pendingLiquifyDx = useSharedValue(0);
  const pendingLiquifyDy = useSharedValue(0);
  const lastLiquifyFlushMs = useSharedValue(0);

  /**
   * 组合手势：同时检测双指（缩放+平移）和单指（纯平移）
   * 使用 Simultaneous 允许手势同时存在，通过 maxPointers 和 isPinching 隔离
   */
  // 液化手势：用单指拖动产生位移场
  const liquifyGesture = Gesture.Pan()
    .maxPointers(1)
    .onBegin((event: PanGestureHandlerEventPayload) => {
      'worklet';
      // 记录起点以计算增量
      brushIndicatorX.value = event.x;
      brushIndicatorY.value = event.y;
      brushIndicatorOpacity.value = 0.9;
      lastLiquifyX.value = event.x;
      lastLiquifyY.value = event.y;
      pendingLiquifyDx.value = 0;
      pendingLiquifyDy.value = 0;
      lastLiquifyFlushMs.value = 0;
      const extended = event as ExtendedPanGestureEvent;
      const timestamp = extended.timestamp ?? extended.time ?? 0;
      runOnJS(startStrokeRecording)();
      if (metricsEnabled) {
        runOnJS(resetLiquifyStroke)(timestamp);
      }
      if (previewEnabled) {
        runOnJS(showPreviewAt)(event.x, event.y);
      }
    })
    .onUpdate((event: PanGestureHandlerEventPayload) => {
      'worklet';
      // 使用上一次位置计算增量，避免依赖不兼容的 changeX/changeY
      const prevX = lastLiquifyX.value ?? event.x;
      const prevY = lastLiquifyY.value ?? event.y;
      const dx = event.x - prevX;
      const dy = event.y - prevY;
      lastLiquifyX.value = event.x;
      lastLiquifyY.value = event.y;
      brushIndicatorX.value = event.x;
      brushIndicatorY.value = event.y;
      if (previewEnabled) {
        runOnJS(movePreviewTo)(event.x, event.y);
      }
      // 关键：不要丢弃小位移，否则“慢推/快推”的强度会不一致（慢推会更弱）。
      // 将每帧的细小增量累积到一定阈值再一次性提交给 JS，既保证手感一致，也减少 runOnJS 次数。
      pendingLiquifyDx.value += dx;
      pendingLiquifyDy.value += dy;
      // 连贯优先：位移阈值 + 时间阈值双触发，保证慢推也能持续出效果，同时避免 runOnJS 过频。
      const spacingPx = useNativeLiquify
        ? Math.max(1.1, brushRadiusValue.value * 0.14)
        : Math.max(0.45, brushRadiusValue.value * 0.09);
      const pendingLen = Math.hypot(pendingLiquifyDx.value, pendingLiquifyDy.value);
      const extended = event as ExtendedPanGestureEvent;
      const timestamp = extended.timestamp ?? extended.time ?? 0;
      const nowMs = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : Date.now();
      const flushIntervalMs = useNativeLiquify
        ? LIQUIFY_NATIVE_FLUSH_INTERVAL_MS
        : LIQUIFY_FLUSH_INTERVAL_MS;
      const shouldFlushByTime =
        lastLiquifyFlushMs.value <= 0 || nowMs - lastLiquifyFlushMs.value >= flushIntervalMs;
      if (pendingLen < spacingPx && !shouldFlushByTime) {
        return;
      }
      if (shouldFlushByTime) {
        lastLiquifyFlushMs.value = nowMs;
      }
      const pressure = extended.pressure ?? extended.force ?? extended.stylusData?.pressure ?? 1;
      const flushDx = pendingLiquifyDx.value;
      const flushDy = pendingLiquifyDy.value;
      pendingLiquifyDx.value = 0;
      pendingLiquifyDy.value = 0;
      runOnJS(applyBrushDeform)(event.x, event.y, flushDx, flushDy, timestamp, pressure);
    })
    .onEnd(() => {
      'worklet';
      // 尾帧：把还没提交的小增量 flush 掉，避免最后一小段位移“没生效”。
      const flushX = lastLiquifyX.value;
      const flushY = lastLiquifyY.value;
      const flushDx = pendingLiquifyDx.value;
      const flushDy = pendingLiquifyDy.value;
      if (
        flushX != null &&
        flushY != null &&
        (Math.abs(flushDx) + Math.abs(flushDy) > 1e-4)
      ) {
        pendingLiquifyDx.value = 0;
        pendingLiquifyDy.value = 0;
        runOnJS(applyBrushDeform)(flushX, flushY, flushDx, flushDy, 0, 1);
      } else {
        pendingLiquifyDx.value = 0;
        pendingLiquifyDy.value = 0;
      }
      lastLiquifyX.value = null;
      lastLiquifyY.value = null;
      lastLiquifyFlushMs.value = 0;
      brushIndicatorOpacity.value = brushIdleOpacity.value;
      if (metricsEnabled) {
        runOnJS(endLiquifyStroke)();
      }
      if (previewEnabled) {
        runOnJS(hidePreview)();
      }
      runOnJS(finalizeStrokeRecording)();
    })
    .onFinalize(() => {
      'worklet';
      runOnJS(finalizeStrokeRecording)();
    });

  const combinedGesture =
    mode === 'liquify' && !isOriginalView
      ? Gesture.Simultaneous(pinchGesture, liquifyGesture)
      : Gesture.Simultaneous(pinchGesture, singleFingerPan); // 将单指与双指手势共同绑定

  // 质心标记的动画样式：仅在双指缩放时显示，实时跟随质心位置
  const focalMarkerStyle = useAnimatedStyle(() => ({
    opacity: isPinching.value ? 1 : 0, // 缩放时显示质心标记
    transform: [
      { translateX: focalMarkerX.value - FOCAL_MARKER_RADIUS }, // 以质心为中心定位标记
      { translateY: focalMarkerY.value - FOCAL_MARKER_RADIUS }, // 以质心为中心定位标记
    ],
  }));
  const liquifyLayerStyle = useAnimatedStyle(() => ({
    opacity: liquifyLayerOpacity.value,
  }));
  // 已移除 MediaPipe 网格与五官描边的计算，保留通用缩放/平移绘制
  const effectiveZoomForRendering = React.useMemo(
    () => Math.max(canvasTransform.zoom, 0.01),
    [canvasTransform.zoom]
  );
  const effectiveGridStrokeWidth = GRID_STROKE_WIDTH / effectiveZoomForRendering;

  const renderLandmarks = React.useCallback(
    (zoomValue: number, keyPrefix: string) => {
      if (!landmarkDots.length) {
        return null;
      }
      const radius = Math.max(LANDMARK_DOT_RADIUS / Math.max(zoomValue, 0.01), 1);
      return landmarkDots.map((dot) => (
        <Circle key={`${keyPrefix}-${dot.id}`} cx={dot.x} cy={dot.y} r={radius} color={dot.color} />
      ));
    },
    [landmarkDots]
  );
  const brushIndicatorStyle = useAnimatedStyle(() => ({
    opacity: brushIndicatorOpacity.value,
    width: Math.max(2, brushRadiusValue.value * 2),
    height: Math.max(2, brushRadiusValue.value * 2),
    borderRadius: Math.max(1, brushRadiusValue.value),
    transform: [
      { translateX: brushIndicatorX.value - brushRadiusValue.value },
      { translateY: brushIndicatorY.value - brushRadiusValue.value },
    ],
  }));

  React.useEffect(() => {
    if (!originalSkiaImage) {
      liquifyLayerOpacity.value = 1;
      return;
    }
    if (useNativeLiquify) {
      // 原生层在切换原图时保持可见，避免短暂黑屏。
      liquifyLayerOpacity.value = 1;
      return;
    }
    liquifyLayerOpacity.value = withTiming(isOriginalView ? 0 : 1, {
      duration: isOriginalView ? 50 : 90,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    });
  }, [isOriginalView, liquifyLayerOpacity, originalSkiaImage, useNativeLiquify]);

  React.useEffect(() => {
    if (!useNativeLiquify || originalSkiaImage) {
      originalPreviewActiveRef.current = false;
      return;
    }
    const nativeHandle = nativeLiquifyRef.current;
    if (!nativeHandle) {
      return;
    }
    if (isOriginalView) {
      originalPreviewActiveRef.current = true;
      nativeHandle.saveSnapshot(ORIGINAL_PREVIEW_SNAPSHOT_INDEX);
      nativeHandle.resetPreserveSnapshots();
    } else if (originalPreviewActiveRef.current) {
      nativeHandle.restoreSnapshot(ORIGINAL_PREVIEW_SNAPSHOT_INDEX);
      originalPreviewActiveRef.current = false;
    }
  }, [isOriginalView, useNativeLiquify, originalSkiaImage]);

  React.useEffect(() => {
    RNAnimated.timing(originalOverlayOpacity, {
      toValue: isOriginalView ? 1 : 0,
      duration: isOriginalView ? 80 : 120,
      easing: isOriginalView ? Easing.out(Easing.cubic) : Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isOriginalView, originalOverlayOpacity]);

  React.useEffect(() => {
    if (!image) return;
    const logPayload = {
      tag: '[CanvasResolution]',
      original: isOriginalView,
      fittedWidth: imageLayout.fittedWidth,
      fittedHeight: imageLayout.fittedHeight,
      intrinsicWidth: imageLayout.intrinsicWidth,
      intrinsicHeight: imageLayout.intrinsicHeight,
      offsetX: imageLayout.offsetX,
      offsetY: imageLayout.offsetY,
    };
    console.log(logPayload);
  }, [isOriginalView, image, imageLayout]);

  return (
    <View style={[styles.container, { width, height }]}>
      <GestureDetector gesture={combinedGesture}>
        <View style={styles.canvasStack}>
          <Animated.View
            style={[styles.canvasWrapper, originalSkiaImage ? liquifyLayerStyle : null]}
          >
            {useNativeLiquify && backgroundImage ? (
              <LiquifyDisplacementView
                ref={nativeLiquifyRef}
                style={styles.nativeView}
                sourcePath={backgroundImage}
                maxMagnitude={maxMagnitude}
                viewport={nativeViewport ?? undefined}
                brushFalloff={nativeBrushFalloff}
                smoothingStrength={nativeSmoothingStrengthValue}
                smoothingIterations={nativeSmoothingIterationsValue}
                strengthScale={liquifyStrengthScale}
                centerDampen={liquifyCenterDampen}
                edgeBoost={liquifyEdgeBoost}
                maxStepFactor={liquifyStepFactor}
                decayCurve={liquifyDecayCurve}
                centerResponseMin={centerResponseMinValue}
                centerResponseMax={centerResponseMaxValue}
                edgeResponseMin={edgeResponseMinValue}
                edgeResponseMax={edgeResponseMaxValue}
                stepFactorMin={stepFactorMinValue}
                stepFactorMax={stepFactorMaxValue}
                softSaturationK={liquifySoftK}
                restoreBoost={liquifyRestoreBoost}
                restoreToOriginal={liquifyRestoreToOriginal}
                rippleStart={liquifyRippleStart}
                rippleEnd={liquifyRippleEnd}
                rippleMix={liquifyRippleMix}
                rippleSmooth={liquifyRippleSmooth}
                gradientScaleMax={liquifyGradientScaleMax}
                performanceMode={liquifyPerformanceMode}
                onReady={handleNativeSurfaceReady}
                previewConfig={nativePreviewConfig}
                previewShowWeights={liquifyPreviewShowWeights}
                previewShowVectors={liquifyPreviewShowVectors}
                previewShowBrushProfile={liquifyPreviewShowBrushProfile}
                previewBrushCenter={currentBrushCenter}
                previewBrushRadius={previewBrushRadius}
                previewBrushFalloff={nativeBrushFalloff}
                previewBrushDecay={liquifyDecayCurve}
              />
            ) : (
              <SkiaCanvas style={styles.canvas}>
                {image ? (
                  <Group
                    transform={[
                      { translateX: canvasTransform.panX },
                      { translateY: canvasTransform.panY },
                    ]}
                  >
                    <Group
                      transform={[
                        { scaleX: canvasTransform.zoom },
                        { scaleY: canvasTransform.zoom },
                      ]}
                    >
                      {mesh && meshPaint ? (
                        <Vertices
                          vertices={mesh.verts}
                          textures={mesh.uvs}
                          indices={mesh.indices}
                          mode="triangles"
                          paint={meshPaint}
                        />
                      ) : (
                        <SkiaImage image={image} x={0} y={0} width={width} height={height} fit="contain" />
                      )}
                      {renderLandmarks(effectiveZoomForRendering, 'main')}
                    </Group>
                  </Group>
                ) : null}
              </SkiaCanvas>
            )}
            {pendingAppliedPreview ? (
              <SkiaCanvas pointerEvents="none" style={styles.debugOverlay}>
                <Group
                  transform={[
                    { translateX: canvasTransform.panX },
                    { translateY: canvasTransform.panY },
                  ]}
                >
                  <Group
                    transform={[
                      { scaleX: canvasTransform.zoom },
                      { scaleY: canvasTransform.zoom },
                    ]}
                  >
                    <SkiaImage
                      image={pendingAppliedPreview}
                      x={imageLayout.offsetX}
                      y={imageLayout.offsetY}
                      width={imageLayout.fittedWidth}
                      height={imageLayout.fittedHeight}
                      fit="fill"
                    />
                  </Group>
                </Group>
              </SkiaCanvas>
            ) : null}
            <Animated.View pointerEvents="none" style={[styles.focalMarker, focalMarkerStyle]} />
            <Animated.View pointerEvents="none" style={[styles.brushIndicator, brushIndicatorStyle]} />
            {shouldRenderPreview && (
              <View pointerEvents="none" style={styles.previewWindow}>
                {shouldRenderSkiaPreview && previewTransforms ? (
                  <SkiaCanvas style={styles.previewCanvas}>
                    <Group
                      transform={[
                        { translateX: previewTransforms.translateX },
                        { translateY: previewTransforms.translateY },
                      ]}
                    >
                      <Group
                        transform={[
                          { scaleX: previewTransforms.zoom },
                          { scaleY: previewTransforms.zoom },
                        ]}
                      >
                        {mesh && meshPaint ? (
                          <Vertices
                            vertices={mesh.verts}
                            textures={mesh.uvs}
                            indices={mesh.indices}
                            mode="triangles"
                            paint={meshPaint}
                          />
                        ) : (
                          <SkiaImage image={image!} x={0} y={0} width={width} height={height} fit="contain" />
                        )}
                        {renderLandmarks(previewTransforms.zoom, 'preview')}
                      </Group>
                    </Group>
                  </SkiaCanvas>
                ) : null}
                <View style={styles.previewDot} />
              </View>
            )}
          </Animated.View>
          {originalSkiaImage ? (
            <RNAnimated.View
              pointerEvents="none"
              style={[styles.originalOverlay, { opacity: originalOverlayOpacity }]}
            >
              <SkiaCanvas style={styles.canvas}>
                <Group
                  transform={[
                    { translateX: canvasTransform.panX },
                    { translateY: canvasTransform.panY },
                  ]}
                >
                  <Group
                    transform={[
                      { scaleX: canvasTransform.zoom },
                      { scaleY: canvasTransform.zoom },
                    ]}
                  >
                    <SkiaImage
                      image={originalSkiaImage}
                      x={imageLayout.offsetX}
                      y={imageLayout.offsetY}
                      width={imageLayout.fittedWidth || width}
                      height={imageLayout.fittedHeight || height}
                      fit="contain"
                    />
                    {renderLandmarks(effectiveZoomForRendering, 'original')}
                  </Group>
                </Group>
              </SkiaCanvas>
            </RNAnimated.View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000000', // 设置黑色背景保持原有环境
    overflow: 'hidden', // 保证内容不溢出容器
  },
  canvasWrapper: {
    flex: 1, // 填满父容器
  },
  canvasStack: {
    flex: 1,
    position: 'relative',
  },
  canvas: {
    flex: 1, // SkiaCanvas 占满可用空间
  },
  nativeView: {
    flex: 1,
  },
  originalOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  debugOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  focalMarker: {
    position: 'absolute', // 绝对定位覆盖在画布之上
    width: FOCAL_MARKER_SIZE, // 使用固定宽度
    height: FOCAL_MARKER_SIZE, // 使用固定高度
    borderRadius: FOCAL_MARKER_RADIUS, // 圆形标记
    borderWidth: 1, // 描边线宽
    borderColor: 'rgba(255, 45, 85, 0.9)', // 描边颜色
    backgroundColor: 'rgba(255, 45, 85, 0.2)', // 半透明填充色
  },
  brushIndicator: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(180,180,180,0.95)',
    backgroundColor: 'rgba(220,220,220,0.2)',
  },
  previewWindow: {
    position: 'absolute',
    top: PREVIEW_WINDOW_MARGIN,
    left: PREVIEW_WINDOW_MARGIN,
    width: PREVIEW_WINDOW_SIZE,
    height: PREVIEW_WINDOW_SIZE,
    borderWidth: PREVIEW_BORDER_WIDTH,
    borderColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  previewCanvas: {
    width: '100%',
    height: '100%',
  },
  previewDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    top: '50%',
    left: '50%',
    marginLeft: -5,
    marginTop: -5,
  },
});

CanvasComponent.displayName = 'Canvas'; // 指定组件 displayName 方便调试

export default CanvasComponent; // 默认导出画布组件
