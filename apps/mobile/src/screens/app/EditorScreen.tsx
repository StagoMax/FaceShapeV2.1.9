/**
 * EditorScreen 编辑界面组件
 * 
 * @author FaceShape团队
 * @version 2.1.8
 */

// React核心库和Hooks
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// React Native核心组件
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Animated,
  Alert,
  TouchableWithoutFeedback,
  Modal,
  Image,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 云端掩码已移除

// Reanimated
import { useSharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

// 安全区域组件，处理刘海屏等适配
import { SafeAreaView } from 'react-native-safe-area-context';

// 导航相关
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

// 自定义组件
import ToolBar from '../../components/ToolBar';
import LiquifyToolBar from '../../components/LiquifyToolBar';
import ChatComposer from '../../components/editor/ChatComposer';
import Canvas, { type CanvasHandle } from '../../components/Canvas';
// 已移除云端掩码
import type { RootStackParamList } from '../../types';
import { callSeedreamImage } from '../../services/seedreamImage';
import { supabase, supabaseHelpers } from '../../services/supabase';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  selectIsAuthenticated,
  selectIsAnonymous,
  selectUser,
  setUser,
  updateUserCredits,
  updateUserProfile,
} from '../../store/slices/authSlice';
import { ROUTES, COLORS, TYPOGRAPHY, CREDITS, LEGAL_VERSIONS, STORAGE_KEYS } from '../../constants';
import { LIQUIFY_BRUSH_SIZE } from '../../constants/liquify';
import { legalConsentManager } from '../../utils/legalConsent';
import * as FileSystem from 'expo-file-system/legacy';
// expo-media-library 可能未编译进客户端时需要兜底
let MediaLibrary: typeof import('expo-media-library') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MediaLibrary = require('expo-media-library');
} catch (e) {
  console.warn('[media] expo-media-library not available:', e);
}

// 已移除 Face++ 检测与关键点辅助工具，保留纯画布编辑体验

// 云端掩码颜色/可见集合已移除

const clampValue = (value: number, lower: number, upper: number) =>
  Math.min(Math.max(value, lower), upper);

type EditorTutorialStep = {
  id: 'zoom' | 'liquify' | 'restore' | 'viewOriginal' | 'generate';
  titleKey: string;
  descriptionKey: string;
};

const EDITOR_TUTORIAL_STEPS: EditorTutorialStep[] = [
  {
    id: 'zoom',
    titleKey: 'editor.tutorialSteps.zoom.title',
    descriptionKey: 'editor.tutorialSteps.zoom.description',
  },
  {
    id: 'liquify',
    titleKey: 'editor.tutorialSteps.liquify.title',
    descriptionKey: 'editor.tutorialSteps.liquify.description',
  },
  {
    id: 'restore',
    titleKey: 'editor.tutorialSteps.restore.title',
    descriptionKey: 'editor.tutorialSteps.restore.description',
  },
  {
    id: 'viewOriginal',
    titleKey: 'editor.tutorialSteps.viewOriginal.title',
    descriptionKey: 'editor.tutorialSteps.viewOriginal.description',
  },
  {
    id: 'generate',
    titleKey: 'editor.tutorialSteps.generate.title',
    descriptionKey: 'editor.tutorialSteps.generate.description',
  },
];

// 编辑界面组件Props接口定义
type EditorScreenProps = NativeStackScreenProps<RootStackParamList, 'Editor'>;

/**
 * EditorScreen 主组件
 * @param navigation 导航对象，用于页面跳转
 * @param route 路由对象，包含传递的参数
 */
const EditorScreen = ({ navigation, route }: EditorScreenProps) => {
  const { imageUri } = route.params;
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isAnonymous = useAppSelector(selectIsAnonymous);
  const user = useAppSelector(selectUser);
  // 状态变量定义
  const [prompt, setPrompt] = useState('');                    // 用户输入的AI提示文本
  const [isInputFocused, setIsInputFocused] = useState(false); // 输入框是否获得焦点
  const [keyboardHeight, setKeyboardHeight] = useState(0);     // 键盘高度，用于布局调整
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current; // 键盘高度动画值
  const [, setSelectedTool] = useState('brush');   // 当前选中的工具
  const [isPromptSending, setIsPromptSending] = useState(false);
  const [isConsentModalVisible, setIsConsentModalVisible] = useState(false);
  const [isConsentSaving, setIsConsentSaving] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  const [composerHeight, setComposerHeight] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  // 已移除 Face++ 地标线相关状态
  
  // 键盘高度动画值，用于平滑的键盘弹出/收起动画
  const [, setStrokeWidth] = useState(8);
  const [, setTool] = useState<'brush' | 'eraser'>('brush');
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // 原始图片（用于对比，不应被AI结果覆盖）
  const [canvasImage, setCanvasImage] = useState<string | null>(null); // 用于画布显示（可能是压缩版本）
  // 云端掩码相关状态移除
  // 液化模式：默认显示液化工具栏，但只有点击工具时才激活液化
  const isLiquifyMode = true;
  const [isLiquifyActive, setIsLiquifyActive] = useState(true);
  const [liquifyTool, setLiquifyTool] = useState<'push' | 'restore'>('push');
  const [liquifySize, setLiquifySize] = useState<number>(LIQUIFY_BRUSH_SIZE.default);
  const liquifyDensity = 120;
  const liquifyIntensity = 0.35;
  const liquifySmoothing = 0.4;
  const liquifyMaxMagnitude = 0.8;
  const liquifyFalloff = 0.4;
  const liquifyNativeFalloff = 0.5;
  const liquifyStrengthScale = 1;
  const liquifyCenterDampen = 0.6;
  const liquifyEdgeBoost = 1.15;
  const liquifyStepFactor = 0.8;
  const liquifyDecayCurve = 1.3;
  const liquifyGradientScaleMax = 1.5;
  const liquifyRestoreBoost = 1.35;
  const liquifyRestoreToOriginal = true;
  const liquifySoftK = 0.25;
  const liquifyRippleStart = 1.3;
  const liquifyRippleEnd = 2.3;
  const liquifyRippleMix = 0.3;
  const liquifyRippleSmooth = 0.22;
  const liquifyPerformanceMode = true;
  const liquifyCenterResponseMin = 0.2;
  const liquifyCenterResponseMax = 1.5;
  const liquifyEdgeResponseMin = 0.6;
  const liquifyEdgeResponseMax = 2.4;
  const liquifyStepFactorMin = 0.05;
  const liquifyStepFactorMax = 3;
  const bwThresholdRatio = 0.25;
  const bwMaskBlurFactor = 0.45;
  const bwMaskAlphaGain = 2;
  const [liquifyRenderPath, setLiquifyRenderPath] = useState<'native' | 'skia'>('skia');
  const [canUndoLiquify, setCanUndoLiquify] = useState(false);
  const [canRedoLiquify, setCanRedoLiquify] = useState(false);
  const [isUndoPressed, setIsUndoPressed] = useState(false);
  const [isRedoPressed, setIsRedoPressed] = useState(false);
  const [isSavingDownload, setIsSavingDownload] = useState(false);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastMessage, setSaveToastMessage] = useState(() => t('editor.downloadSavedToast'));
  const saveToastOpacity = useRef(new Animated.Value(0)).current;
  const [showBrushPreview, setShowBrushPreview] = useState(false);
  const [isViewingOriginal, setIsViewingOriginal] = useState(false);
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const viewOriginalScale = useRef(new Animated.Value(1)).current;
  const canvasRef = useRef<CanvasHandle | null>(null);
  const generateProgressAnim = useRef(new Animated.Value(0)).current;
  const pendingGenerateRef = useRef(false);
  
  // 手势状态：缩放和平移
  const zoomLevel = useSharedValue(1);
  const panOffsetX = useSharedValue(0);
  const panOffsetY = useSharedValue(0);

  useEffect(() => {
    if (!isPromptSending) {
      generateProgressAnim.stopAnimation();
      generateProgressAnim.setValue(0);
      return;
    }
    generateProgressAnim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(generateProgressAnim, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isPromptSending, generateProgressAnim]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isPromptSending) {
        return;
      }
      event.preventDefault();
      Alert.alert(t('editor.generateLeaveTitle'), t('editor.generateLeaveMessage'), [
        { text: t('editor.generateLeaveStay'), style: 'cancel' },
        {
          text: t('editor.generateLeaveExit'),
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, isPromptSending, t]);
  const generateProgressTranslateX = generateProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 220],
  });
  
  // 画布尺寸
  const canvasWidth = Dimensions.get('window').width;
  const canvasHeight = useRef(0);
  const [editorLayout, setEditorLayout] = useState<{ width: number; height: number; y: number | null }>({
    width: 0,
    height: 0,
    y: null,
  });
  const [bottomMetrics, setBottomMetrics] = useState<{ top: number; height: number }>({
    top: 0,
    height: 0,
  });
  const handleResetLiquify = useCallback(() => {
    canvasRef.current?.resetLiquify();
  }, []);

  const handleUndo = () => {
    canvasRef.current?.undoLiquify();
  };

  const handleRedo = () => {
    canvasRef.current?.redoLiquify();
  };

  useEffect(() => {
    setSelectedImage(imageUri);
    setCanvasImage(imageUri);
    if (!imageUri) {
      setImageDimensions(null);
      return;
    }
    Image.getSize(
      imageUri,
      (width, height) => setImageDimensions({ width, height }),
      () => setImageDimensions(null)
    );
  }, [imageUri]);

  useEffect(() => {
    let isMounted = true;
    const loadTutorialState = async () => {
      try {
        const completed = await AsyncStorage.getItem(STORAGE_KEYS.EDITOR_TUTORIAL_COMPLETED);
        if (isMounted && completed !== 'true') {
          setTutorialStepIndex(0);
          setIsTutorialVisible(true);
        }
      } catch (error) {
        console.warn('[editor-tutorial] load failed', error);
        if (isMounted) {
          setTutorialStepIndex(0);
          setIsTutorialVisible(true);
        }
      }
    };
    void loadTutorialState();
    return () => {
      isMounted = false;
    };
  }, []);

  // 已移除 Face++ 自动检测流程，保留纯编辑体验

  // 云端掩码 token 检查已移除

  // 云端掩码请求已移除

  // 云端掩码叠加已移除

  // 已移除 FaceMesh 相关开关，仅保留云端掩码显示

  const layoutThreshold = 0.5;

  const handleEditorLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height, y } = event.nativeEvent.layout;
    console.log('[EditorAreaLayout]', { width, height, y });
    setEditorLayout((prev) => {
      if (
        Math.abs(prev.width - width) < layoutThreshold &&
        Math.abs(prev.height - height) < layoutThreshold &&
        prev.y != null &&
        Math.abs(prev.y - y) < layoutThreshold
      ) {
        return prev;
      }
      return { width, height, y };
    });
  }, []);

  const computedVisibleHeight = useMemo(() => {
    if (editorLayout.y == null) {
      return null;
    }

    if (bottomMetrics.top > 0) {
      const diff = bottomMetrics.top - editorLayout.y;
      if (diff > 0) {
        return diff;
      }
    }

    return editorLayout.height || null;
  }, [editorLayout.y, editorLayout.height, bottomMetrics.top]);

  const editorAreaStyle = useMemo(() => {
    if (!computedVisibleHeight) {
      return null;
    }
    return {
      height: computedVisibleHeight,
      alignSelf: 'stretch' as const,
    };
  }, [computedVisibleHeight]);

  const anchorVisualization = useMemo(() => {
    const size = 16;
    const markerPadding = 0;
    if (!editorLayout.width || !editorLayout.height || editorLayout.y == null) {
      return {
        anchorStyle: { opacity: 0 },
        lineStyle: { opacity: 0 },
        topMarkerStyle: { opacity: 0 },
        bottomMarkerStyle: { opacity: 0 },
        debug: null,
      };
    }

    const { width, height, y: editorTop } = editorLayout;
    const toolbarGlobalTop = bottomMetrics.top;

    const targetTop = (() => {
      if (toolbarGlobalTop > editorTop) {
        return toolbarGlobalTop;
      }
      if (computedVisibleHeight && Number.isFinite(computedVisibleHeight)) {
        return editorTop + computedVisibleHeight;
      }
      if (bottomMetrics.top > editorTop) {
        return bottomMetrics.top;
      }
      return editorTop + height;
    })();

    const resolvedVisibleHeight = Math.max(Math.min(targetTop - editorTop, height), 0);

    const visibleHeight = Math.max(resolvedVisibleHeight, 0);

    const constrainedHeight = Math.max(visibleHeight, size);
    const anchorTop = Math.max(constrainedHeight / 2 - size / 2, 0);

    const anchorStyle = {
      opacity: visibleHeight > 0 ? 1 : 0,
      left: width / 2 - size / 2,
      top: anchorTop,
    };

    const topMarkerStyle = {
      opacity: visibleHeight > 0 ? 1 : 0,
      left: width / 2 - size / 2,
      top: 0,
    };

    const bottomMarkerStyle = {
      opacity: visibleHeight > 0 ? 1 : 0,
      left: width / 2 - size / 2,
      top: Math.max(visibleHeight - size - markerPadding, 0),
    };

    const lineStyle = {
      opacity: visibleHeight > 0 ? 1 : 0,
      left: width / 2 - 1,
      top: 0,
      height: Math.max(visibleHeight, size),
    };

    const debug = {
      editorTop,
      editorHeight: height,
      toolbarGlobalTop,
      bottomContainerTop: bottomMetrics.top,
      bottomContainerHeight: bottomMetrics.height,
      targetTop,
      constrainedHeight,
      visibleHeight,
      anchorTop,
      bottomMarkerTop: bottomMarkerStyle.top,
      bottomMarkerGlobalTop: editorTop + bottomMarkerStyle.top,
      bottomMarkerGlobalBottom: editorTop + bottomMarkerStyle.top + size,
    };

    return { anchorStyle, lineStyle, topMarkerStyle, bottomMarkerStyle, debug };
  }, [
    editorLayout,
    bottomMetrics.top,
    bottomMetrics.height,
    computedVisibleHeight,
    showToolbar,
  ]);

  useEffect(() => {
    if (anchorVisualization.debug) {
      console.log('[AnchorDebug]', anchorVisualization.debug);
    }
  }, [anchorVisualization.debug]);

  /**
   * 键盘事件监听器
   * 监听键盘的显示和隐藏事件，实现聊天输入区域的自适应布局
   */
  useEffect(() => {
    // 键盘显示事件监听器
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (event) => {
      const height = event.endCoordinates.height;  // 获取键盘高度
      setKeyboardHeight(height);                   // 更新键盘高度状态
      
      // 启动键盘弹出动画
      Animated.timing(keyboardHeightAnim, {
        toValue: height,        // 动画目标值为键盘高度
        duration: 250,          // 动画持续时间250ms
        useNativeDriver: false, // 不使用原生驱动（因为涉及布局属性）
      }).start();
      
      // 键盘显示时确保输入框焦点状态为true，保证状态同步
      setIsInputFocused(true);
      setShowToolbar(false);
    });

    // 键盘隐藏事件监听器
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);  // 重置键盘高度为0
      
      // 启动键盘收起动画
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,             // 动画目标值为0
        duration: 250,          // 动画持续时间250ms
        useNativeDriver: false, // 不使用原生驱动
      }).start(({ finished }) => {
        if (finished) {
          setIsInputFocused(false);
          setShowToolbar(true);
        }
      });
    });

  // 清理函数：组件卸载时移除事件监听器
  return () => {
    keyboardDidShowListener?.remove();
    keyboardDidHideListener?.remove();
  };
}, [keyboardHeightAnim]);  // 依赖项：键盘动画值

  const promptAuth = useCallback(() => {
    Alert.alert(t('common.headsUp'), t('editor.authPromptMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('navigation.login'), onPress: () => navigation.navigate(ROUTES.LOGIN, { returnToPrevious: true }) },
      { text: t('navigation.register'), onPress: () => navigation.navigate(ROUTES.REGISTER, { returnToPrevious: true }) },
    ]);
  }, [navigation, t]);

  const hasServerConsent = useMemo(() => {
    if (!user) {
      return false;
    }
    if (!user.ai_consent_at) {
      return false;
    }
    return (
      user.privacy_policy_version === LEGAL_VERSIONS.PRIVACY_POLICY &&
      user.terms_of_service_version === LEGAL_VERSIONS.TERMS_OF_SERVICE
    );
  }, [user]);

  const syncConsentToServer = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      return;
    }
    if (hasServerConsent) {
      return;
    }
    const cached = await legalConsentManager.load();
    if (!cached) {
      return;
    }
    if (
      cached.privacyVersion !== LEGAL_VERSIONS.PRIVACY_POLICY ||
      cached.termsVersion !== LEGAL_VERSIONS.TERMS_OF_SERVICE
    ) {
      return;
    }
    try {
      const updated = await supabaseHelpers.updateUserProfile(user.id, {
        ai_consent_at: cached.acceptedAt,
        privacy_policy_version: cached.privacyVersion,
        terms_of_service_version: cached.termsVersion,
      });
      dispatch(
        updateUserProfile({
          ai_consent_at: updated.ai_consent_at ?? cached.acceptedAt,
          privacy_policy_version: updated.privacy_policy_version ?? cached.privacyVersion,
          terms_of_service_version: updated.terms_of_service_version ?? cached.termsVersion,
        })
      );
    } catch (error) {
      console.warn('[ai-consent] sync failed', error);
    }
  }, [dispatch, hasServerConsent, isAuthenticated, user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      void syncConsentToServer();
    }
  }, [isAuthenticated, syncConsentToServer]);

  /**
   * 生成前校验登录与积分（不扣积分）
   */
  const ensureGenerateCredits = useCallback(async () => {
    const creditCost = CREDITS.COSTS.AI_EDIT;
    const hasAccountSession = !!user && isAuthenticated;
    if (!hasAccountSession) {
      promptAuth();
      return false;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      const refreshed = await supabase.auth.refreshSession();
      accessToken = refreshed.data.session?.access_token;
    }
    if (!accessToken) {
      dispatch(setUser(null));
      promptAuth();
      return false;
    }
    if (user?.credits == null) {
      Alert.alert(t('common.headsUp'), t('editor.creditsFetching'));
      return false;
    }
    if (user.credits < creditCost) {
      navigation.navigate(ROUTES.PURCHASE);
      return false;
    }
    return true;
  }, [dispatch, isAuthenticated, navigation, promptAuth, t, user]);

  const ensureLegalConsent = useCallback(async () => {
    const hasLocalConsent = await legalConsentManager.hasValidConsent();
    if (hasLocalConsent) {
      return true;
    }
    if (hasServerConsent) {
      const acceptedAt = user?.ai_consent_at || new Date().toISOString();
      await legalConsentManager.persist(
        acceptedAt,
        LEGAL_VERSIONS.PRIVACY_POLICY,
        LEGAL_VERSIONS.TERMS_OF_SERVICE
      );
      return true;
    }
    if (!isConsentModalVisible) {
      setIsConsentModalVisible(true);
    }
    pendingGenerateRef.current = true;
    return false;
  }, [hasServerConsent, isConsentModalVisible, user?.ai_consent_at]);

  const handleConsentDecline = useCallback(() => {
    if (isConsentSaving) {
      return;
    }
    pendingGenerateRef.current = false;
    setIsConsentModalVisible(false);
  }, [isConsentSaving]);

  const handleOpenPrivacyPolicy = useCallback(() => {
    setIsConsentModalVisible(false);
    navigation.navigate(ROUTES.PRIVACY_POLICY);
  }, [navigation]);

  const handleOpenTerms = useCallback(() => {
    setIsConsentModalVisible(false);
    navigation.navigate(ROUTES.TERMS_OF_SERVICE);
  }, [navigation]);

  const performGenerate = useCallback(async () => {
    if (isPromptSending) {
      return;
    }
    if (!canvasImage) {
      Alert.alert(t('common.error'), t('editor.noEditableImage'));
      return;
    }
    const canGenerate = await ensureGenerateCredits();
    if (!canGenerate) {
      return;
    }
    setIsPromptSending(true);
    try {
      let requestPath = canvasImage;
      let requestWidth = imageDimensions?.width;
      let requestHeight = imageDimensions?.height;
      let requestSource: 'canvas' | 'liquify' | 'liquify_bw' = 'canvas';

      try {
        // 默认开启液化区域黑白：生成前后台导出黑白融合图，不改当前显示。
        const bwPath = await canvasRef.current?.applyGrayscaleOverlay({ applyPreview: false });
        if (bwPath) {
          requestPath = bwPath;
          requestSource = 'liquify_bw';
          await new Promise<void>((resolve) => {
            Image.getSize(
              bwPath,
              (width, height) => {
                requestWidth = width;
                requestHeight = height;
                resolve();
              },
              () => resolve()
            );
          });
        }
      } catch (bwError) {
        console.warn('[ImageEdit] auto grayscale failed, fallback liquify export', bwError);
      }

      if (requestSource === 'canvas') {
        try {
          const exportedPath = await canvasRef.current?.exportLiquifiedImage();
          if (exportedPath) {
            requestPath = exportedPath;
            requestSource = 'liquify';
            await new Promise<void>((resolve) => {
              Image.getSize(
                exportedPath,
                (width, height) => {
                  requestWidth = width;
                  requestHeight = height;
                  resolve();
                },
                () => resolve()
              );
            });
          }
        } catch (exportError) {
          console.warn('[ImageEdit] export liquified image failed, fallback canvas image', exportError);
        }
      }

      console.log('[ImageEdit] provider request', {
        provider: 'seedream',
        source: requestSource,
        imagePath: requestPath,
        width: requestWidth,
        height: requestHeight,
      });

      const result = await callSeedreamImage({
        imagePath: requestPath,
        width: requestWidth,
        height: requestHeight,
      });

      console.log('[ImageEdit] provider result', {
        provider: 'seedream',
        localPath: result.localPath,
        remoteUrl: result.remoteUrl,
      });
      if (typeof result.newCredits === 'number') {
        dispatch(updateUserCredits(result.newCredits));
      }
      setPrompt('');
      setCanvasImage(result.localPath);
      handleResetLiquify();
      Image.getSize(
        result.localPath,
        (width, height) => setImageDimensions({ width, height }),
        () => {},
      );
      Alert.alert(t('common.headsUp'), t('editor.aiResultApplied'));
    } catch (error: any) {
      if (error?.code === 'insufficient_credits') {
        navigation.navigate(ROUTES.PURCHASE);
        return;
      }
      const message =
        error?.message || t('editor.generateFailed', { provider: t('editor.providerSeedream') });
      Alert.alert(t('common.error'), message);
    } finally {
      setIsPromptSending(false);
    }
  }, [
    canvasImage,
    dispatch,
    ensureGenerateCredits,
    handleResetLiquify,
    imageDimensions?.height,
    imageDimensions?.width,
    isPromptSending,
    navigation,
    t,
  ]);

  const handleConsentAccept = useCallback(async () => {
    if (isConsentSaving) {
      return;
    }
    setIsConsentSaving(true);
    const acceptedAt = new Date().toISOString();
    const privacyVersion = LEGAL_VERSIONS.PRIVACY_POLICY;
    const termsVersion = LEGAL_VERSIONS.TERMS_OF_SERVICE;
    try {
      await legalConsentManager.persist(acceptedAt, privacyVersion, termsVersion);
    } catch (error) {
      console.warn('[ai-consent] local save failed', error);
      Alert.alert(t('common.error'), t('editor.aiConsentSaveFailed'));
      setIsConsentSaving(false);
      return;
    }
    try {
      if (isAuthenticated && user?.id) {
        try {
          const updated = await supabaseHelpers.updateUserProfile(user.id, {
            ai_consent_at: acceptedAt,
            privacy_policy_version: privacyVersion,
            terms_of_service_version: termsVersion,
          });
          dispatch(
            updateUserProfile({
              ai_consent_at: updated.ai_consent_at ?? acceptedAt,
              privacy_policy_version: updated.privacy_policy_version ?? privacyVersion,
              terms_of_service_version: updated.terms_of_service_version ?? termsVersion,
            })
          );
        } catch (error) {
          console.warn('[ai-consent] server save failed', error);
        }
      }
      setIsConsentModalVisible(false);
      const shouldGenerate = pendingGenerateRef.current;
      pendingGenerateRef.current = false;
      if (shouldGenerate) {
        await performGenerate();
      }
    } finally {
      setIsConsentSaving(false);
    }
  }, [dispatch, isAuthenticated, isConsentSaving, performGenerate, t, user?.id]);

  /**
   * 发送AI提示处理函数
   * 处理用户点击发送按钮的事件
   */
  const handleSendPrompt = useCallback(async () => {
    if (isPromptSending) {
      return;
    }
    if (!canvasImage) {
      Alert.alert(t('common.error'), t('editor.noEditableImage'));
      return;
    }
    const canUseAi = await ensureLegalConsent();
    if (!canUseAi) {
      return;
    }
    await performGenerate();
  }, [
    canvasImage,
    ensureLegalConsent,
    isPromptSending,
    performGenerate,
    t,
  ]);

  /**
   * 隐藏键盘处理函数
   * 点击空白区域时隐藏键盘
   */
  const handleDismissKeyboard = () => {
    Keyboard.dismiss();          // 隐藏键盘
    setIsInputFocused(false);    // 重置焦点状态
  };

  const triggerSaveToast = useCallback((message: string) => {
    setSaveToastMessage(message);
    setSaveToastVisible(true);
    saveToastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(saveToastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(saveToastOpacity, {
        toValue: 0,
        duration: 380,
        delay: 900,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setSaveToastVisible(false);
      }
    });
  }, [saveToastOpacity]);


  // ==================== 顶部工具栏按钮处理函数 ====================
  
  /**
   * 编辑按钮点击处理函数
   * 点击钢笔图标返回首页
   */
  const handleEditPress = () => {
    navigation.navigate(ROUTES.HOME);  // 返回首页
  };

  /**
   * 下载操作执行函数
   */
  const performDownload = useCallback(async () => {
    if (isSavingDownload) {
      return;
    }
    if (!canvasImage) {
      Alert.alert(t('editor.downloadFailedTitle'), t('editor.downloadNoImage'));
      return;
    }
    if (!MediaLibrary) {
      Alert.alert(t('common.error'), t('editor.downloadMissingModule'));
      return;
    }
    setIsSavingDownload(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error(t('editor.downloadPermissionDenied'));
      }
      const filePath = await canvasRef.current?.exportLiquifiedImage();
      if (!filePath) {
        throw new Error(t('editor.downloadExportFailed'));
      }
      const normalizedPath = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      if (__DEV__) {
        try {
          const info = await FileSystem.getInfoAsync(normalizedPath);
          const fileSize = info.exists && "size" in info ? info.size : undefined;
          const modifiedAt = info.exists && "modificationTime" in info ? info.modificationTime : undefined;
          console.warn('[LiquifyExport][download-source]', {
            path: normalizedPath,
            size: fileSize,
            exists: info.exists,
            modified: modifiedAt,
          });
        } catch (error) {
          console.warn('[LiquifyExport][download-source-error]', {
            path: normalizedPath,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      const safeDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!safeDir) {
        throw new Error(t('editor.downloadNoCache'));
      }
      const dir = safeDir.endsWith('/') ? safeDir : `${safeDir}/`;
      const targetPath = `${dir}faceshape-save-${Date.now()}.png`;
      await FileSystem.copyAsync({ from: normalizedPath, to: targetPath });
      if (__DEV__) {
        try {
          const info = await FileSystem.getInfoAsync(targetPath);
          const fileSize = info.exists && "size" in info ? info.size : undefined;
          const modifiedAt = info.exists && "modificationTime" in info ? info.modificationTime : undefined;
          console.warn('[LiquifyExport][download-target]', {
            path: targetPath,
            size: fileSize,
            exists: info.exists,
            modified: modifiedAt,
          });
        } catch (error) {
          console.warn('[LiquifyExport][download-target-error]', {
            path: targetPath,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (typeof MediaLibrary.saveToLibraryAsync === 'function') {
        await MediaLibrary.saveToLibraryAsync(targetPath);
      } else {
        const asset = await MediaLibrary.createAssetAsync(targetPath);
        await MediaLibrary.createAlbumAsync('FaceShape', asset, true).catch(() => null);
      }
      triggerSaveToast(t('editor.downloadSavedToast'));
    } catch (error: any) {
      const message = error?.message || t('editor.downloadSaveFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setIsSavingDownload(false);
    }
  }, [canvasImage, isSavingDownload, t, triggerSaveToast]);

  /**
   * 下载按钮点击处理函数
   * 下载编辑后的图片到本地
   */
  const handleDownloadPress = () => {
    if (isSavingDownload) {
      return;
    }
    if (!isAuthenticated && !isAnonymous) {
      promptAuth();
      return;
    }
    void performDownload();
  };

  /**
   * 更多选项按钮点击处理函数
   * 显示更多功能菜单
   */
  const handleMorePress = () => {
    Alert.alert(t('editor.moreTitle'), t('editor.morePressed'));
  };

  const handleViewOriginalPressIn = () => {
    Animated.spring(viewOriginalScale, {
      toValue: 1.15,
      useNativeDriver: true,
      stiffness: 420,
      damping: 16,
      mass: 0.85,
    }).start();
    setIsViewingOriginal(true);
  };

  const handleViewOriginalPressOut = () => {
    Animated.spring(viewOriginalScale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 260,
      damping: 18,
      mass: 1,
    }).start();
    setIsViewingOriginal(false);
  };

  const currentTutorialStep =
    EDITOR_TUTORIAL_STEPS[tutorialStepIndex] || EDITOR_TUTORIAL_STEPS[0];
  const tutorialTotalSteps = EDITOR_TUTORIAL_STEPS.length;
  const isLastTutorialStep = tutorialStepIndex >= tutorialTotalSteps - 1;

  const markTutorialCompleted = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EDITOR_TUTORIAL_COMPLETED, 'true');
    } catch (error) {
      console.warn('[editor-tutorial] persist failed', error);
    }
  }, []);

  const handleSkipTutorial = useCallback(() => {
    setIsTutorialVisible(false);
    setTutorialStepIndex(0);
    void markTutorialCompleted();
  }, [markTutorialCompleted]);

  const handleTutorialNext = useCallback(() => {
    if (isLastTutorialStep) {
      setIsTutorialVisible(false);
      setTutorialStepIndex(0);
      void markTutorialCompleted();
      return;
    }
    setTutorialStepIndex((prev) => Math.min(prev + 1, tutorialTotalSteps - 1));
  }, [isLastTutorialStep, markTutorialCompleted, tutorialTotalSteps]);

  const downloadDisabled = !canvasImage || isSavingDownload;

  // ==================== 工具栏按钮处理函数 ====================
  
  /**
   * 调色盘按钮点击处理函数
   * 打开颜色选择器
   */
  const handleColorPalettePress = () => {
    Alert.alert(t('toolbar.paletteTitle'), t('toolbar.paletteMessage'));
    // TODO: 实现颜色选择器功能
  };

  /**
   * 画笔按钮点击处理函数
   * 切换到画笔工具
   */
  const handleBrushPress = () => {
    setSelectedTool('brush');
    Alert.alert(t('toolbar.brushTitle'), t('toolbar.brushMessage'));
  };

  /**
   * 橡皮擦按钮点击处理函数
   * 切换到橡皮擦工具
   */
  const handleEraserPress = () => {
    setSelectedTool('eraser');
    Alert.alert(t('toolbar.eraserTitle'), t('toolbar.eraserMessage'));
  };

  // ==================== 组件渲染结构 ====================
  return (
    <>
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screenWrapper}>
        {/* 点击空白区域隐藏键盘的包装器 */}
        <TouchableWithoutFeedback onPress={handleDismissKeyboard}>
          <View style={styles.container}>
            {/* ==================== 顶部工具栏 ==================== */}
            <View style={styles.header}>
              {/* 左侧区域 - 编辑按钮 */}
              <View style={styles.leftSection}>
                <TouchableOpacity 
                  style={[styles.toolButton, styles.leftToolButton]}
                  onPress={handleEditPress}
                >
                  <Image 
                    source={require('../../../assets/solar_pen-new-square-linear.png')}
                    style={styles.toolIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.centerSection} />
              {/* 右侧区域 - 下载按钮 */}
              <View style={styles.rightSection}>
                <TouchableOpacity 
                  style={[styles.downloadButton, downloadDisabled && styles.toolButtonDisabled]}
                  onPress={handleDownloadPress}
                  disabled={downloadDisabled}
                >
                  <Image 
                    source={require('../../../assets/material-symbols_download.png')}
                    style={styles.downloadIcon}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ==================== 中央编辑区域 ==================== */}
            <View
              style={[styles.editorArea, editorAreaStyle || undefined]}
              onLayout={handleEditorLayout}
            >
              {null}
              {canvasImage ? (
                <>
                  <Canvas
                    ref={canvasRef}
                    width={editorLayout.width || canvasWidth}
                    height={editorLayout.height || 400}
                    backgroundImage={canvasImage}
                    originalImage={selectedImage || undefined}
                    zoomLevel={zoomLevel}
                    panOffsetX={panOffsetX}
                    panOffsetY={panOffsetY}
                  mode={isLiquifyActive ? 'liquify' : 'view'}
                  liquifyTool={liquifyTool}
                  liquifyBrushSize={liquifySize}
                  liquifyDensity={liquifyDensity}
                  liquifyIntensity={liquifyIntensity}
                  liquifySmoothing={liquifySmoothing}
                  liquifyMaxMagnitude={liquifyMaxMagnitude}
                  liquifyFalloff={liquifyFalloff}
                  liquifyNativeFalloff={liquifyNativeFalloff}
                  liquifyCenterResponseMin={liquifyCenterResponseMin}
                  liquifyCenterResponseMax={liquifyCenterResponseMax}
                  liquifyEdgeResponseMin={liquifyEdgeResponseMin}
                  liquifyEdgeResponseMax={liquifyEdgeResponseMax}
                  liquifyStepFactorMin={liquifyStepFactorMin}
                  liquifyStepFactorMax={liquifyStepFactorMax}
                  liquifyStrengthScale={liquifyStrengthScale}
                  liquifyCenterDampen={liquifyCenterDampen}
                  liquifyEdgeBoost={liquifyEdgeBoost}
                  liquifyStepFactor={liquifyStepFactor}
                  liquifyDecayCurve={liquifyDecayCurve}
                  liquifyRestoreBoost={liquifyRestoreBoost}
                  liquifyRestoreToOriginal={liquifyRestoreToOriginal}
                  liquifyGradientScaleMax={liquifyGradientScaleMax}
                  liquifySoftK={liquifySoftK}
                  liquifyRippleStart={liquifyRippleStart}
                    liquifyRippleEnd={liquifyRippleEnd}
                    liquifyRippleMix={liquifyRippleMix}
                    liquifyRippleSmooth={liquifyRippleSmooth}
                    liquifyPerformanceMode={liquifyPerformanceMode}
                    bwThresholdRatio={bwThresholdRatio}
                    bwMaskBlurFactor={bwMaskBlurFactor}
                    bwMaskAlphaGain={bwMaskAlphaGain}
                    liquifyPreviewShowWeights={false}
                    liquifyPreviewShowVectors={false}
                    liquifyPreviewShowBrushProfile={false}
                    previewIndicatorVisible={showBrushPreview}
                    showOriginal={isViewingOriginal}
                    onLiquifyRenderPathChange={setLiquifyRenderPath}
                    onLiquifyHistoryChange={({ canUndo, canRedo }) => {
                      setCanUndoLiquify(canUndo);
                      setCanRedoLiquify(canRedo);
                    }}
                  />
                </>
              ) : (
                <Text style={styles.editorPlaceholder}>{t('editor.placeholder')}</Text>
              )}
              {null}
              <View pointerEvents="none" style={styles.editorBoundaryTop} />
              <View pointerEvents="none" style={styles.editorBoundaryBottom} />
              <View pointerEvents="none" style={styles.editorBoundaryLeft} />
              <View pointerEvents="none" style={styles.editorBoundaryRight} />
            </View>
          </View>
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.bottomContainer,
            showToolbar && composerHeight ? { paddingBottom: 12 } : null,
            { marginBottom: keyboardHeightAnim },
          ]}
          onLayout={(event: LayoutChangeEvent) => {
            const { y, height } = event.nativeEvent.layout;
            console.log('[BottomContainerLayout]', { y, height });
            setBottomMetrics((prev) => {
              if (
                Math.abs(prev.top - y) < layoutThreshold &&
                Math.abs(prev.height - height) < layoutThreshold
              ) {
                return prev;
              }
              return { top: y, height };
            });
          }}
        >
          {showToolbar && composerHeight !== null ? (
            <View
              style={styles.toolBarInlineSection}
              onLayout={(event: LayoutChangeEvent) => {
                const { y, height } = event.nativeEvent.layout;

                const parentTop = bottomMetrics.top || 0;
                const toolbarTop = parentTop + y;

                const toolbarBottom = toolbarTop + height;
                const composerTop = parentTop + height;

              console.log('[ToolBarInlineLayout]', {
                localTop: y,
                height,
                toolbarTop,
                toolbarBottom,
                parentTop,
                composerTop,
              });
            }}
          >
              <View style={styles.undoRedoFloat}>
                <TouchableOpacity
                  style={[styles.undoRedoButton, !canUndoLiquify && styles.toolButtonDisabled]}
                  onPress={handleUndo}
                  onPressIn={() => setIsUndoPressed(true)}
                  onPressOut={() => setIsUndoPressed(false)}
                  disabled={!canUndoLiquify}
                  activeOpacity={0.75}
                >
                  <View style={styles.undoRedoIconWrapper}>
                    <Image
                      source={require('../../../assets/Vector (1).png')}
                      style={[
                        styles.undoRedoIcon,
                        !canUndoLiquify ? styles.undoRedoIconDisabled : null,
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.undoRedoButton, !canRedoLiquify && styles.toolButtonDisabled]}
                  onPress={handleRedo}
                  onPressIn={() => setIsRedoPressed(true)}
                  onPressOut={() => setIsRedoPressed(false)}
                  disabled={!canRedoLiquify}
                  activeOpacity={0.75}
                >
                  <View style={styles.undoRedoIconWrapper}>
                    <Image
                      source={require('../../../assets/Vector (2).png')}
                      style={[
                        styles.undoRedoIcon,
                        !canRedoLiquify ? styles.undoRedoIconDisabled : null,
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                </TouchableOpacity>
              </View>
              <View style={styles.viewOriginalFloat}>
                <Animated.View
                  style={[
                    styles.viewOriginalButton,
                    { transform: [{ scale: viewOriginalScale }] },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.viewOriginalTouch}
                    onPressIn={handleViewOriginalPressIn}
                    onPressOut={handleViewOriginalPressOut}
                    activeOpacity={1}
                  >
                    <Image
                      source={require('../../../assets/Vector (3).png')}
                      style={styles.viewOriginalIcon}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>
              {isLiquifyMode ? (
                <>
                  <LiquifyToolBar
                    onLiquifyPress={() => {
                      setLiquifyTool('push');
                      setIsLiquifyActive(true);
                    }}
                    onRestorePress={() => {
                      setLiquifyTool('restore');
                      setIsLiquifyActive(true);
                    }}
                  onBrushSizeChange={(v) =>
                      setLiquifySize(
                        Math.max(
                          LIQUIFY_BRUSH_SIZE.min,
                          Math.min(LIQUIFY_BRUSH_SIZE.max, Math.round(v))
                        )
                      )
                    }
                    onBrushSizeSlidingStart={() => setShowBrushPreview(true)}
                    onBrushSizeSlidingComplete={() => setShowBrushPreview(false)}
                    initialBrushSize={liquifySize}
                    minBrushSize={LIQUIFY_BRUSH_SIZE.min}
                    maxBrushSize={LIQUIFY_BRUSH_SIZE.max}
                    activeTool={liquifyTool}
                  />
                </>
              ) : (
                <ToolBar
                  onBrushPress={() => setTool('brush')}
                  onEraserPress={() => setTool('eraser')}
                  onBrushSizeChange={setStrokeWidth}
                  initialBrushSize={8}
                  minBrushSize={4}
                  maxBrushSize={12}
                />
              )}
            </View>
          ) : null}
          <ChatComposer
            prompt={prompt}
            onChangePrompt={setPrompt}
            onSend={handleSendPrompt}
            isSending={isPromptSending}
            isInputFocused={isInputFocused}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onKeyboardHeightChange={setComposerHeight}
          />
        </Animated.View>
      </View>
      {saveToastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.toastContainer, { opacity: saveToastOpacity }]}
        >
          <Text style={styles.toastText}>{saveToastMessage}</Text>
        </Animated.View>
      ) : null}
      <Modal
        visible={isConsentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleConsentDecline}
      >
        <View style={styles.legalModalOverlay}>
          <TouchableWithoutFeedback onPress={handleConsentDecline}>
            <View style={styles.legalModalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.legalModalCard}>
            <Text style={styles.legalModalTitle}>{t('editor.aiConsentTitle')}</Text>
            <Text style={styles.legalModalBody}>{t('editor.aiConsentBody')}</Text>
            <View style={styles.legalModalLinks}>
              <TouchableOpacity
                onPress={handleOpenPrivacyPolicy}
                disabled={isConsentSaving}
              >
                <Text style={styles.legalModalLinkText}>{t('editor.aiConsentViewPrivacy')}</Text>
              </TouchableOpacity>
              <Text style={styles.legalModalLinkDivider}>·</Text>
              <TouchableOpacity onPress={handleOpenTerms} disabled={isConsentSaving}>
                <Text style={styles.legalModalLinkText}>{t('editor.aiConsentViewTerms')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.legalModalActions}>
              <TouchableOpacity
                style={[
                  styles.legalModalPrimaryButton,
                  isConsentSaving && styles.legalModalPrimaryButtonDisabled,
                ]}
                onPress={handleConsentAccept}
                disabled={isConsentSaving}
              >
                {isConsentSaving ? (
                  <ActivityIndicator color={COLORS.WHITE} />
                ) : (
                  <Text style={styles.legalModalPrimaryButtonText}>
                    {t('editor.aiConsentAgree')}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.legalModalSecondaryButton}
                onPress={handleConsentDecline}
                disabled={isConsentSaving}
              >
                <Text style={styles.legalModalSecondaryButtonText}>
                  {t('editor.aiConsentDecline')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
      <Modal
        visible={isTutorialVisible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={handleSkipTutorial}
      >
        <View style={styles.tutorialOverlay}>
          <View style={styles.tutorialCard}>
            <Text style={styles.tutorialTitle}>{t('editor.tutorialTitle')}</Text>
            <Text style={styles.tutorialStepCounter}>
              {t('editor.tutorialStepCounter', {
                current: tutorialStepIndex + 1,
                total: tutorialTotalSteps,
              })}
            </Text>
            <View style={styles.tutorialVideoFrame}>
              <View style={styles.tutorialVideoPlaceholder}>
                <Text style={styles.tutorialVisualBadge}>
                  {`${tutorialStepIndex + 1}`.padStart(2, '0')}
                </Text>
                <Text style={styles.tutorialVisualTitle}>{t(currentTutorialStep.titleKey)}</Text>
              </View>
            </View>
            <Text style={styles.tutorialStepTitle}>{t(currentTutorialStep.titleKey)}</Text>
            <Text style={styles.tutorialStepDescription}>{t(currentTutorialStep.descriptionKey)}</Text>
            <View style={styles.tutorialActions}>
              <TouchableOpacity
                style={styles.tutorialSkipButton}
                onPress={handleSkipTutorial}
                activeOpacity={0.85}
              >
                <Text style={styles.tutorialSkipButtonText}>{t('editor.tutorialSkip')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tutorialNextButton}
                onPress={handleTutorialNext}
                activeOpacity={0.85}
              >
                <Text style={styles.tutorialNextButtonText}>
                  {isLastTutorialStep ? t('editor.tutorialFinish') : t('editor.tutorialNext')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isPromptSending}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={() => {}}
      >
        <View pointerEvents="auto" style={styles.generateOverlay}>
          <View style={styles.generateCard}>
            <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            <Text style={styles.generateTitle}>{t('editor.generateInProgress')}</Text>
            <Text style={styles.generateSubtitle}>
              {t('editor.generateInProgressSubtitle')}
            </Text>
            <View style={styles.generateProgressTrack}>
              <Animated.View
                style={[
                  styles.generateProgressBar,
                  { transform: [{ translateX: generateProgressTranslateX }] },
                ]}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

// ==================== 样式定义 ====================
const styles = StyleSheet.create({
  // -------------------- 基础容器样式 --------------------
  
  /** 安全区域容器 - 处理刘海屏等设备适配 */
  safeArea: {
    flex: 1,                    // 占满整个屏幕
    backgroundColor: '#FFFFFF', // 白色背景
  },

  /** 屏幕包装器 - 主要 Flexbox 容器 */
  screenWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  
  /** 主容器 */
  container: {
    flex: 1,              // 占满安全区域
    flexDirection: 'column',  // 垂直排列
  },

  // -------------------- 顶部工具栏样式 --------------------
  
  /** 顶部工具栏容器 */
  header: {
    flexDirection: 'row',           // 水平排列
    alignItems: 'center',           // 垂直居中对齐
    justifyContent: 'center',       // 居中对齐，配合三等分布局
    paddingTop: 5,                  // 顶部内边距
    paddingBottom: 8,               // 底部内边距
    paddingHorizontal: 10,          // 水平内边距，为对称布局留出空间
  },
  
  /** 工具按钮通用样式 */
  toolButton: {
    width: 50,                // 固定宽度50px
    height: 50,               // 固定高度50px
    justifyContent: 'center', // 垂直居中
    alignItems: 'center',     // 水平居中
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
  
  /** 工具按钮图标样式 */
  toolIcon: {
    width: 28,   // 图标宽度28px
    height: 28,  // 图标高度28px
  },
  downloadButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00000033',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  downloadIcon: {
    width: 26,
    height: 26,
    tintColor: '#222222',
  },
  viewOriginalButton: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOriginalTouch: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOriginalIcon: {
    width: 16,
    height: 16,
    marginHorizontal: 2,
  },
  
  /** 撤销重做按钮组 - 自然居中 */
  undoRedoGroup: {
    flexDirection: 'row',                // 水平排列
    alignItems: 'center',                // 垂直居中对齐
    gap: 8,                              // 按钮间距8px
  },
  undoRedoFloat: {
    position: 'absolute',
    left: 12,
    top: -46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewOriginalFloat: {
    position: 'absolute',
    right: 12,
    top: -46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  undoRedoButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  undoRedoIcon: {
    width: 19,
    height: 19,
  },
  undoRedoIconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  undoRedoIconDisabled: {
    opacity: 0.32,
  },
  
  /** 左侧区域样式 */
  leftSection: {
    flex: 1,                    // 占据1/3宽度
    alignItems: 'flex-start',   // 左对齐
  },
  
  /** 中间区域样式 */
  centerSection: {
    flex: 1,                    // 占据1/3宽度
    alignItems: 'center',       // 居中对齐
  },
  
  /** 右侧区域样式 */
  rightSection: {
    flex: 1,                    // 占据1/3宽度
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 6,
  },
  
  /** 左侧工具按钮样式 */
  leftToolButton: {
    marginLeft: 0,  // 左侧按钮距离左边缘10px（继承header的paddingHorizontal）
  },
  
  /** 右侧工具按钮组样式 */
  rightToolGroup: {
    marginRight: -8,  // 右侧按钮组向右移动，更靠近右边缘
  },
  // -------------------- 编辑区域样式 --------------------
  
  /** 中央编辑区域容器 */
  editorArea: {
    flex: 1,                    // 填充所有剩余空间
    position: 'relative',
    justifyContent: 'center',   // 垂直居中图片
    alignItems: 'center',       // 水平居中图片
    overflow: 'hidden',         // 防止图像溢出到工具栏区域
  },

  /** 编辑区域占位符文本 */
  editorPlaceholder: {
    fontSize: 18,        // 字体大小18px
    color: '#666',       // 灰色文字
    textAlign: 'center', // 文本居中对齐
  },
  composerBoundaryTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(175, 82, 222, 0.9)',
  },
  editorImage: {
    width: '100%',
    height: '100%',
  },

  /** 编辑区域边界视觉标记 */
  editorBoundaryTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(100, 200, 100, 0)',
  },

  editorBoundaryBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(100, 200, 100, 0)',
  },

  editorBoundaryLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(100, 200, 100, 0)',
  },

  editorBoundaryRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(100, 200, 100, 0)',
  },
  cloudMaskToolbar: {
    display: 'none',
  },
  cloudMaskToggle: {
    display: 'none',
  },
  cloudMaskToggleActive: {
    display: 'none',
  },
  cloudMaskToggleText: {
    display: 'none',
  },
  cloudMaskLegend: {
    display: 'none',
  },
  cloudMaskError: {
    display: 'none',
  },
  cloudMaskOverlay: {
    display: 'none',
  },

  anchorMarker: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    zIndex: 20,
    elevation: 20,
  },
  anchorMarkerTop: {
    borderColor: 'rgba(88, 86, 214, 0.9)',
    backgroundColor: 'rgba(88, 86, 214, 0.25)',
  },
  anchorMarkerCenter: {
    borderColor: 'rgba(0, 122, 255, 0.9)',
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  anchorMarkerBottom: {
    borderColor: 'rgba(52, 199, 89, 0.9)',
    backgroundColor: 'rgba(52, 199, 89, 0.25)',
  },
  anchorLine: {
    position: 'absolute',
    width: 2,
    backgroundColor: 'rgba(0, 122, 255, 0.6)',
    zIndex: 10,
    elevation: 10,
  },
  
  // -------------------- 工具栏区域样式 --------------------
  
  /** 工具栏在常规布局内的容器 */
  toolBarInlineSection: {
    position: 'relative',
    paddingHorizontal: 20,
    paddingBottom: 0,
    alignSelf: 'stretch',
    width: '100%',
    backgroundColor: 'transparent',
  },
  
  // -------------------- 底部区域容器 --------------------
  
  bottomContainer: {
    position: 'relative',
    paddingBottom: 0,
    paddingHorizontal: 0,
  },
  tutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tutorialCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  tutorialTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  tutorialStepCounter: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.TEXT_TERTIARY,
    textAlign: 'center',
  },
  tutorialVideoFrame: {
    marginTop: 12,
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  tutorialVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    backgroundColor: '#111827',
  },
  tutorialVisualBadge: {
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    color: COLORS.WHITE,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  tutorialVisualTitle: {
    color: COLORS.WHITE,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  tutorialStepTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  tutorialStepDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.TEXT_SECONDARY,
  },
  tutorialActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  tutorialSkipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.GRAY_300,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tutorialSkipButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT_SECONDARY,
  },
  tutorialNextButton: {
    flex: 1.2,
    borderRadius: 10,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tutorialNextButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  // -------------------- 生成中遮罩 --------------------
  generateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  generateCard: {
    minWidth: 220,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: COLORS.WHITE,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  generateTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  generateSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  generateProgressTrack: {
    marginTop: 12,
    width: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.GRAY_200,
    overflow: 'hidden',
  },
  generateProgressBar: {
    width: 80,
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY,
  },
  legalModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  legalModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  legalModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.WHITE,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  legalModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  legalModalBody: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  legalModalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legalModalLinkText: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  legalModalLinkDivider: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_TERTIARY,
  },
  legalModalActions: {
    width: '100%',
    gap: 10,
    marginTop: 6,
  },
  legalModalPrimaryButton: {
    width: '100%',
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  legalModalPrimaryButtonDisabled: {
    opacity: 0.75,
  },
  legalModalPrimaryButtonText: {
    color: COLORS.WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  legalModalSecondaryButton: {
    width: '100%',
    backgroundColor: COLORS.GRAY_100,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  legalModalSecondaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
  },
  toastContainer: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    transform: [{ translateY: -22 }],
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    maxWidth: '80%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default EditorScreen;
