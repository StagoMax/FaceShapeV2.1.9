// React和React Native核心组件导入
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,          // 基础容器组件
  Text,          // 文本显示组件
  StyleSheet,    // 样式表
  TouchableOpacity, // 可点击的透明度组件
  ScrollView,    // 滚动视图组件（用于灵感区域水平滚动）
  Image,         // 图片显示组件
  Alert,         // 弹窗提示组件
  Dimensions,    // 获取设备屏幕尺寸的API
  KeyboardAvoidingView, // 键盘避让视图组件
  Platform,      // 平台检测API
  Keyboard,      // 键盘事件监听API
  Animated,      // 动画API
  Modal,         // 模态框组件
  TouchableWithoutFeedback, // 无反馈触摸组件
  ActivityIndicator, // 加载指示器
  Easing,
} from 'react-native';
// Lucide图标导入
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// 安全区域视图组件，避免刘海屏遮挡 - 使用新的库替代已弃用的SafeAreaView
import { SafeAreaView } from 'react-native-safe-area-context';
// 线性渐变组件，用于创建渐变背景效果
import { LinearGradient } from 'expo-linear-gradient';
// 导航相关的Hook和类型
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
// 图片选择器，用于从相册选择图片或拍照
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
// 导航路由参数类型定义
import { RootStackParamList } from '../../types';
import { COLORS, ROUTES, TYPOGRAPHY, FEATURE_FLAGS, DEFAULT_SEEDREAM_MODEL_ALIAS } from '../../constants';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  selectUser,
  selectIsAuthenticated,
  signOut,
  selectIsAnonymous,
} from '../../store/slices/authSlice';
import { normalizeLanguageCode, type LanguageCode } from '../../constants/i18n';
import { HOME_INSPIRATION_ITEMS, type InspirationItem } from '../../constants/inspiration';
import { callSeedreamImage } from '../../services/seedreamImage';
import * as ImageManipulator from 'expo-image-manipulator';

// 定义首页导航属性的类型，用于类型安全的导航操作
type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

/**
 * 首页组件 - 应用的主界面
 * 功能包括：图片上传、灵感展示、文本提示输入等
 */
const HomeScreen: React.FC = () => {
  // 获取导航对象，用于页面跳转
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isAnonymous = useAppSelector(selectIsAnonymous);
  const { t, i18n } = useTranslation();
  const normalizedLanguage = normalizeLanguageCode(i18n.language) ?? 'zh';
  
  // 状态管理：用户输入的文本提示内容
  
  // 状态管理：用户选择的图片URI，初始为null表示未选择
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUserPanelVisible, setIsUserPanelVisible] = useState(false);
  const userPanelAnim = useRef(new Animated.Value(0)).current;
  const userPanelWidth = useMemo(() => Math.min(Dimensions.get('window').width * 0.78, 300), []);
  const userPanelTranslateX = userPanelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-userPanelWidth, 0],
  });
  const userInitial = useMemo(() => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'G';
  }, [user]);
  const displayName = isAuthenticated
    ? user?.name || user?.email || t('home.header.signedInFallback')
    : t('common.appName');
  const displayEmail = isAuthenticated
    ? user?.email || t('home.header.emailFallback')
    : t('home.header.guestDescription');
  const hasAccountCredits = !!user && (isAuthenticated || isAnonymous);
  const creditsCount = hasAccountCredits ? user?.credits ?? 0 : 0;
  const displayCredits = t('home.header.creditsValue', { count: creditsCount });

  const openUserPanel = () => {
    Keyboard.dismiss();
    setIsUserPanelVisible(true);
    Animated.timing(userPanelAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  };

  const closeUserPanel = () => {
    Animated.timing(userPanelAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setIsUserPanelVisible(false));
  };

  const handleOpenLogin = () => {
    closeUserPanel();
    navigation.navigate(ROUTES.LOGIN);
  };

  const handleOpenRegister = () => {
    closeUserPanel();
    navigation.navigate(ROUTES.REGISTER);
  };

  const handleOpenPurchase = () => {
    closeUserPanel();
    navigation.navigate(ROUTES.PURCHASE);
  };

  const handleSignOut = async () => {
    try {
      await dispatch(signOut()).unwrap();
      closeUserPanel();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('common.error');
      Alert.alert(t('common.error'), message);
    }
  };
  
  // 状态管理：控制图片来源选择Modal的显示
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  
  // Modal滑出动画值
  const [modalSlideAnim] = useState(new Animated.Value(0));
  // 已移除本地 FaceMesh 推理流程与进度条
  
  // 获取设备屏幕的宽度和高度，用于响应式布局
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const [isGeneratingLineArt, setIsGeneratingLineArt] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationLabel, setGenerationLabel] = useState('');
  const generationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 键盘事件监听
  // 灵感轮播内容：从常量表读取，便于后续逐步扩展
  const inspirationItems: InspirationItem[] = useMemo(() => {
    return HOME_INSPIRATION_ITEMS[normalizedLanguage] ?? HOME_INSPIRATION_ITEMS.zh ?? [];
  }, [normalizedLanguage]);
  const hasInspirationItems = inspirationItems.length > 0;

  /**
   * 显示图片来源选择对话框
   * 让用户选择从相册选择还是拍照
   */
  const showImageSourceOptions = () => {
    Alert.alert(
      t('home.upload.modalTitle'),
      t('home.upload.modalMessage'),
      [
        {
          text: t('home.upload.cancel'),
          style: 'cancel',
        },
        {
          text: t('home.upload.pickLibrary'),
          onPress: () => handleImageSelection('library', false),
        },
        {
          text: t('home.upload.takePhoto'),
          onPress: () => handleImageSelection('camera', false),
        },
      ],
      { cancelable: true }
    );
  };



  /**
   * 处理图片选择功能
   * @param source 图片来源：'library' 或 'camera'
   * @param allowsEditing 是否允许裁剪
   */
  const handleImageSelection = async (source: 'library' | 'camera', allowsEditing: boolean) => {
    try {
      let permissionResult;
      let result;

      if (source === 'library') {
        // 请求访问相册的权限
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        // 如果用户拒绝授权，显示提示并返回
        if (permissionResult.granted === false) {
          Alert.alert(t('common.permissionRequired'), t('home.upload.libraryPermission'));
          return;
        }

        // 启动图片选择器，配置选择参数
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], // 只允许选择图片
          allowsEditing,          // 根据用户选择决定是否允许编辑
          aspect: allowsEditing ? [4, 3] : undefined, // 只有在允许编辑时才设置裁剪比例
          // Android 13+ 默认 Photo Picker 需要额外“完成”一步，这里强制使用旧版选择器以保持单击即返回
          legacy: true,
          allowsMultipleSelection: false,
          selectionLimit: 1,
          quality: 1,             // 图片质量设为最高
        });
      } else {
        // 请求访问相机的权限
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        
        // 如果用户拒绝相机权限，显示提示并返回
        if (permissionResult.granted === false) {
          Alert.alert(t('common.permissionRequired'), t('home.upload.cameraPermission'));
          return;
        }

        // 启动相机，配置拍照参数
        result = await ImagePicker.launchCameraAsync({
          allowsEditing,          // 根据用户选择决定是否允许编辑
          aspect: allowsEditing ? [4, 3] : undefined, // 只有在允许编辑时才设置裁剪比例
          quality: 1,             // 图片质量设为最高
        });
      }

      // 如果用户选择了图片且没有取消操作
      if (!result.canceled && result.assets[0]) {
        const tStart = Date.now();
        const asset = result.assets[0];
        setSelectedImage(asset.uri);

        // 调试阶段：先验证液化/贴图逻辑，不触发网络请求
        if (!FEATURE_FLAGS.ENABLE_SEEDREAM_LINE_ART) {
          const editorParams: RootStackParamList['Editor'] = { imageUri: asset.uri };
          navigation.navigate('Editor', editorParams);
          return;
        }

        setIsGeneratingLineArt(true);
        setGenerationLabel(t('home.generation.preparing'));
        setGenerationProgress(5);
        if (generationTimerRef.current) {
          clearInterval(generationTimerRef.current);
          generationTimerRef.current = null;
        }
        const assetWidth = asset.width ?? 0;
        const assetHeight = asset.height ?? 0;
        const getSize = () =>
          new Promise<{ width: number; height: number }>((resolve) => {
            if (assetWidth && assetHeight) {
              resolve({ width: assetWidth, height: assetHeight });
              return;
            }
            Image.getSize(
              asset.uri,
              (width, height) => resolve({ width, height }),
              () => resolve({ width: assetWidth || 0, height: assetHeight || 0 })
            );
          });
        const original = await getSize();
        const maxDim = Math.max(original.width, original.height);
        const minDim = Math.min(original.width, original.height);
        const MAX_SIZE = 2048;
        const MIN_SIZE = 512;
        let processedUri = asset.uri;
        let targetWidth = original.width;
        let targetHeight = original.height;
        try {
          if (maxDim > MAX_SIZE || minDim < MIN_SIZE) {
            const scaleDown = maxDim > MAX_SIZE ? MAX_SIZE / maxDim : 1;
            const scaleUp = minDim < MIN_SIZE ? MIN_SIZE / Math.max(minDim, 1) : 1;
            const scale = Math.min(scaleDown, scaleUp);
            targetWidth = Math.max(1, Math.round(original.width * scale));
            targetHeight = Math.max(1, Math.round(original.height * scale));
            const manipulated = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: targetWidth, height: targetHeight } }],
              {
                // 使用有损压缩减小体积，加快上传并降低超时概率
                compress: 0.88,
                format: ImageManipulator.SaveFormat.JPEG,
              }
            );
            processedUri = manipulated.uri;
            await new Promise<void>((resolve, reject) => {
              Image.getSize(
                processedUri,
                (w, h) => {
                  targetWidth = w;
                  targetHeight = h;
                  resolve();
                },
                reject
              );
            }).catch(() => {});
          }
        } catch (resizeError) {
          console.warn('[QwenImageEdit] resize failed, fallback original', resizeError);
          processedUri = asset.uri;
          targetWidth = original.width;
          targetHeight = original.height;
        }
        const finalMax = Math.max(targetWidth, targetHeight);
        const finalMin = Math.min(targetWidth, targetHeight);
        if (finalMax > MAX_SIZE || finalMin < MIN_SIZE) {
          Alert.alert(
            t('common.error'),
            t('home.upload.sizeConstraint', {
              min: MIN_SIZE,
              max: MAX_SIZE,
              width: targetWidth,
              height: targetHeight,
            })
          );
          setGenerationProgress(0);
          setGenerationLabel('');
          setIsGeneratingLineArt(false);
          return;
        }
        const logCtx = {
          original: { width: original.width, height: original.height, uri: asset.uri },
          resized: { width: targetWidth, height: targetHeight, uri: processedUri },
          modelAlias: DEFAULT_SEEDREAM_MODEL_ALIAS,
        };
        console.log('[Seedream][prepare]', logCtx);
        setGenerationLabel(t('home.generation.uploading'));
        setGenerationProgress(20);
        const TARGET_GEN_PIXELS = 1100000; // 目标生成像素，保持比例以提速
        const MIN_GEN_PIXELS = 921600; // 官方 Method2 最小像素约 1280x720
        const currentPixels = targetWidth * targetHeight;
        const desiredPixels = Math.max(
          MIN_GEN_PIXELS,
          Math.min(TARGET_GEN_PIXELS, currentPixels)
        );
        const scaleForGen =
          currentPixels > desiredPixels ? Math.sqrt(desiredPixels / currentPixels) : 1;
        const genWidth = Math.max(1, Math.round(targetWidth * scaleForGen));
        const genHeight = Math.max(1, Math.round(targetHeight * scaleForGen));
        const sizeString = `${genWidth}x${genHeight}`;
        try {
          setGenerationLabel(t('home.generation.generating'));
          setGenerationProgress((prev) => Math.max(prev, 40));
          generationTimerRef.current = setInterval(() => {
            setGenerationProgress((prev) => {
              if (prev >= 85) return prev;
              return Math.min(prev + 3, 85);
            });
          }, 800);
          console.log('[Seedream][request-start]', {
            inputSize: `${targetWidth}x${targetHeight}`,
            genSize: sizeString,
          });
          const resultImage = await callSeedreamImage({
            imagePath: processedUri,
            width: genWidth,
            height: genHeight,
            size: sizeString,
          });
          if (generationTimerRef.current) {
            clearInterval(generationTimerRef.current);
            generationTimerRef.current = null;
          }
          setGenerationLabel(t('home.generation.saving'));
          setGenerationProgress(100);
          console.log('[Seedream][request-end]', {
            totalMs: Date.now() - tStart,
            modelAlias: resultImage.modelAlias ?? DEFAULT_SEEDREAM_MODEL_ALIAS,
          });
          const editorParams: RootStackParamList['Editor'] = {
            imageUri: resultImage.localPath,
          };
          navigation.navigate('Editor', editorParams);
        } catch (err) {
          if (generationTimerRef.current) {
            clearInterval(generationTimerRef.current);
            generationTimerRef.current = null;
          }
          const message = err instanceof Error ? err.message : t('common.error');
          Alert.alert(t('common.error'), message);
        } finally {
          setGenerationProgress(0);
          setGenerationLabel('');
          setIsGeneratingLineArt(false);
        }
      }
    } catch (error) {
      // 捕获并处理可能出现的错误
      console.error('Error selecting image:', error);
      Alert.alert(t('common.error'), t('home.upload.selectError'));
      setGenerationProgress(0);
      setGenerationLabel('');
      setIsGeneratingLineArt(false);
    }
  };

  /**
   * 处理图片上传功能（保持向后兼容）
   * 显示图片来源选择Modal
   */
  const handleImageUpload = async () => {
    setShowImageSourceModal(true);
    // 启动滑入动画
    Animated.timing(modalSlideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  /**
   * 关闭图片来源选择Modal
   */
  const closeImageSourceModal = () => {
    // 启动滑出动画
    Animated.timing(modalSlideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowImageSourceModal(false);
    });
  };

  /**
   * 处理拍照选项
   */
  const handleTakePhoto = () => {
    closeImageSourceModal();
    setTimeout(() => {
      handleImageSelection('camera', false);
    }, 300);
  };

  /**
   * 处理相册选择选项
   */
  const handlePhotoLibrary = () => {
    closeImageSourceModal();
    setTimeout(() => {
      handleImageSelection('library', false);
    }, 300);
  };



  /**
   * 处理灵感项目点击事件
   * 当用户点击灵感示例时触发
   * @param item 被点击的灵感项目数据
   */
  const handleInspirationPress = (item: InspirationItem) => {
    Alert.alert(t('home.inspiration.tappedTitle'), t('home.inspiration.tappedMessage', { title: item.title }));
  };

  /**
   * 处理发送提示文本功能
   * 验证用户输入并发送提示内容
   */

  /**
   * 处理升级计划按钮点击事件
   * 导航到购买页面
   */
  const handleUpgradePlan = () => {
    navigation.navigate(ROUTES.PURCHASE);
  };

  const handleOpenSettings = () => {
    closeUserPanel();
    navigation.navigate(ROUTES.SETTINGS);
  };

  const handleUserPanelHeaderPress = () => {
    if (!isAuthenticated) {
      return;
    }
    handleOpenSettings();
  };

  /**
   * 处理点击键盘以外区域关闭输入状态
   */
  const handleDismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // 组件的主要渲染内容
  return (
    // 安全区域容器，确保内容不被状态栏、刘海屏等遮挡
    <SafeAreaView style={styles.safeArea}>
      <TouchableWithoutFeedback onPress={handleDismissKeyboard}>
        <View style={styles.container}>
          {/* 顶部导航栏 - 固定不动，不受键盘影响 */}
          <View style={styles.header}>
            {/* 左侧菜单按钮（汉堡菜单图标） */}
            <TouchableOpacity style={styles.menuButton} onPress={openUserPanel}>
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>{t('common.appName')}</Text>
            </View>
            {/* 右侧购买按钮 */}
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgradePlan}>
              <Text style={styles.upgradeText}>{t('home.header.buyCredits')}</Text>
            </TouchableOpacity>
          </View>      
          {/* 使用KeyboardAwareScrollView包装主要内容区域，不包括顶部导航栏 */}
          <KeyboardAwareScrollView 
        style={styles.keyboardAwareContainer}
        contentContainerStyle={styles.keyboardAwareContent}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={200}
        keyboardOpeningTime={250}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
        extraHeight={120}
      >
        {/* 主内容容器 */}
        <View style={styles.mainContent}>
      {isGeneratingLineArt ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>
            {generationLabel || t('common.loading') || t('common.processing')}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(Math.max(generationProgress, 5), 100)}%` }]} />
          </View>
          <Text style={styles.loadingText}>{`${Math.round(Math.min(Math.max(generationProgress, 5), 100))}%`}</Text>
        </View>
      ) : null}

      {/* 图片上传区域 - 主要的交互区域 */}
      <View style={styles.uploadSection}>
        {/* 圆形上传按钮，带有渐变背景效果 */}
        <TouchableOpacity style={styles.uploadButton} onPress={handleImageUpload}>
          {/* 线性渐变背景，从粉色到蓝色 */}
          <LinearGradient
            colors={['#C2D5FF', '#FFEDED']}  // 渐变颜色：浅蓝色到浅粉色
            start={{ x: 0, y: 1 }}           // 渐变起始点（底部）
            end={{ x: 0, y: 0 }}             // 渐变结束点（顶部）
            style={styles.uploadGradientContainer}
          >
            {/* 加号图标，表示上传功能 */}
            <Text style={styles.uploadIcon}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
        {/* 上传按钮下方的说明文字 */}
        <Text style={styles.uploadText}>{t('home.upload.cta')}</Text>
        <Text style={styles.uploadHintText}>• {t('home.upload.hint')}</Text>
      </View>

      {/* 灵感展示区域 - 为用户提供创意参考 */}
      {hasInspirationItems ? (
        <View style={styles.inspirationSection}>
          {/* 灵感区域标题 */}
          <View style={styles.inspirationHeader}>
            <Text style={styles.inspirationTitle}>{t('home.inspiration.title')}</Text>
          </View>
          {/* 灵感项目水平滚动布局 */}
          <ScrollView 
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            style={styles.inspirationScrollView}
            contentContainerStyle={styles.inspirationScrollContent}
          >
            {inspirationItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.inspirationItem, index === 0 && styles.firstInspirationItem]}
                onPress={() => handleInspirationPress(item)}
              >
                {item.image ? (
                  <>
                    <Image source={item.image} style={styles.inspirationImage} />
                    <View style={styles.inspirationTextOverlay}>
                      <Text style={[styles.inspirationItemText, styles.inspirationItemTextOnImage]}>
                        {item.title}
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.inspirationItemText}>{item.title}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

          </View>
        </KeyboardAwareScrollView>
        </View>
      </TouchableWithoutFeedback>
      
      {/* 图片来源选择Modal */}
      <Modal
        visible={showImageSourceModal}
        transparent={true}
        animationType="none"
        onRequestClose={closeImageSourceModal}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeImageSourceModal}
        >
          <Animated.View 
            style={[
              styles.modalContainer,
              {
                transform: [{
                  translateY: modalSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [300, 0],
                  })
                }]
              }
            ]}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.optionsContainer}>
                {/* 拍照选项 - Frame 29 (Take Photo) */}
                <TouchableOpacity style={styles.takePhotoButton} onPress={handleTakePhoto}>
                  <View style={styles.takePhotoIconContainer}>
                    <Camera size={48} color="#000000" strokeWidth={1.5} />
                  </View>
                  <Text style={styles.takePhotoText}>{t('home.upload.takePhoto')}</Text>
                </TouchableOpacity>
                
                {/* 相册选择选项 - Frame 29 (Photo Library) */}
                <TouchableOpacity style={styles.photoLibraryButton} onPress={handlePhotoLibrary}>
                  <View style={styles.photoLibraryIconContainer}>
                    <ImageIcon size={44} color="#000000" strokeWidth={1.5} />
                  </View>
                  <Text style={styles.photoLibraryText} numberOfLines={1}>{t('home.upload.pickLibrary')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={isUserPanelVisible}
        transparent
        animationType="none"
        onRequestClose={closeUserPanel}
      >
        <View style={styles.userPanelOverlay}>
          <TouchableWithoutFeedback onPress={closeUserPanel}>
            <View style={styles.userPanelBackdrop} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.userPanelContainer,
              {
                width: userPanelWidth,
                transform: [{ translateX: userPanelTranslateX }],
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={isAuthenticated ? 0.7 : 1}
              onPress={handleUserPanelHeaderPress}
              disabled={!isAuthenticated}
            >
              <View
                style={[
                  styles.userPanelHeader,
                  isAuthenticated && styles.userPanelHeaderInteractive,
                ]}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{userInitial}</Text>
                </View>
                <View style={styles.userPanelTexts}>
                  <Text style={styles.userPanelTitle} numberOfLines={1}>{displayName}</Text>
                  <Text style={styles.userPanelSubtitle} numberOfLines={2}>{displayEmail}</Text>
                </View>
                {isAuthenticated ? (
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color={COLORS.TEXT_SECONDARY}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
            <View style={styles.userPanelDivider} />
            <View style={styles.userPanelStats}>
              <Text style={styles.userPanelStatLabel}>{t('home.userPanel.currentCredits')}</Text>
              <Text style={styles.userPanelStatValue}>{displayCredits}</Text>
            </View>
            {!isAuthenticated && (
              <TouchableOpacity
                style={styles.userPanelSettingsButton}
                onPress={handleOpenSettings}
                accessibilityRole="button"
                accessibilityLabel={t('home.userPanel.settingsTitle')}
              >
                <Ionicons name="settings-outline" size={20} color={COLORS.TEXT_PRIMARY} />
              </TouchableOpacity>
            )}
            {isAuthenticated ? (
              <>
                <TouchableOpacity
                  style={styles.userPanelPrimaryButton}
                  onPress={handleOpenPurchase}
                >
                  <Text style={styles.userPanelPrimaryButtonText}>{t('home.userPanel.buyCredits')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.userPanelSecondaryButton}
                  onPress={handleSignOut}
                >
                  <Text style={styles.userPanelSecondaryButtonText}>{t('home.userPanel.signOut')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.userPanelPrimaryButton}
                  onPress={handleOpenLogin}
                >
                  <Text style={styles.userPanelPrimaryButtonText}>{t('navigation.login')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.userPanelSecondaryButton}
                  onPress={handleOpenRegister}
                >
                  <Text style={styles.userPanelSecondaryButtonText}>{t('navigation.register')}</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
      {null}
    </SafeAreaView>
  );
};

// 样式表定义 - 包含所有UI组件的样式配置
const styles = StyleSheet.create({
  // 安全区域容器样式 - 占满整个屏幕并设置白色背景
  safeArea: {
    flex: 1,                    // 占满父容器
    backgroundColor: '#FFFFFF', // 纯白色背景
  },
  // 主容器样式 - 固定布局区域
  container: {
    flex: 1, // 占满安全区域
  },
  // KeyboardAwareScrollView容器样式
  keyboardAwareContainer: {
    flex: 1, // 占满剩余空间（除了顶部导航栏）
  },
  // KeyboardAwareScrollView内容样式
  keyboardAwareContent: {
    flexGrow: 1,
    paddingBottom: 120, // 增加底部空间，确保灵感区域能够显示在输入框上方
    minHeight: '100%',  // 确保内容至少占满屏幕高度
  },
  // 主内容区域样式
  mainContent: {
    flex: 1,
  },
  // 顶部导航栏样式
  header: {
    flexDirection: 'row',           // 水平排列子元素
    alignItems: 'center',           // 垂直居中对齐
    justifyContent: 'space-between', // 两端对齐（左右分布）
    paddingTop: 5,                  // 减少顶部内边距，让导航栏往上移
    paddingBottom: 8,              // 底部内边距
    paddingHorizontal: 20,          // 左右内边距
  },
  // 菜单按钮样式
  menuButton: {
    width: 50,  // 固定宽度
    height: 50, // 固定高度，形成正方形点击区域
    justifyContent: 'center', // 垂直居中
    alignItems: 'center',     // 水平居中
    marginLeft: -10,          // 往左移动10像素
  },
  // 菜单图标样式
  menuIcon: {
    fontSize: 24,        // 字体大小
    color: '#000000',    // 黑色
    fontWeight: 'bold',  // 粗体
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  // 升级计划按钮样式
  upgradeButton: {
    borderRadius: 20,           // 减小圆角半径
    backgroundColor: '#E6EBFE', // 浅蓝色背景
    paddingVertical: 8,         // 减少上下内边距
    paddingHorizontal: 12,      // 减少左右内边距
    alignSelf: 'center',        // 垂直居中对齐
    justifyContent: 'center',   // 内容垂直居中
    alignItems: 'center',       // 内容水平居中
  },
  // 升级计划按钮文字样式
  upgradeText: {
    color: '#000000',                           // 黑色文字
    fontFamily: 'Inter',                        // Inter字体
    fontSize: 12,                               // 减小字体大小
    fontWeight: '500',                          // 中等粗细
    fontStyle: 'italic',                        // 斜体
    textShadowColor: 'rgba(0, 0, 0, 0.25)',     // 文字阴影颜色（半透明黑色）
    textShadowOffset: { width: 0, height: 2 },  // 阴影偏移（向下2像素）
    textShadowRadius: 2,                        // 阴影模糊半径
    marginTop: -2,                              // 向上移动文字位置
  },
  // 图片上传区域样式
  uploadSection: {
    alignItems: 'center',      // 子元素水平居中
    marginTop: 50,             // 增加顶部外边距，使上传区域下移
    paddingVertical: 30,       // 减少上下内边距以节省空间
    paddingHorizontal: 20,     // 左右内边距
    flex: 0.6,                 // 占据60%的可用空间
  },
  // 上传按钮容器样式
  uploadButton: {
    alignItems: 'center', // 内容居中对齐
  },
  // 上传按钮的渐变背景容器样式
  uploadGradientContainer: {
    width: 180,                             // 固定宽度
    height: 180,                            // 固定高度，形成正圆
    borderRadius: 90,                       // 圆角半径为宽高的一半，形成完美圆形
    justifyContent: 'center',               // 垂直居中
    alignItems: 'center',                   // 水平居中
    shadowColor: '#000000',                 // 阴影颜色为黑色
    shadowOffset: { width: -3, height: 3 }, // 阴影偏移（左上3像素，右下3像素）
    shadowOpacity: 0.25,                    // 阴影透明度
    shadowRadius: 4,                        // 阴影模糊半径
    elevation: 8,                           // Android平台的阴影高度
  },
  // 上传按钮内的加号图标样式
  uploadIcon: {
    fontSize: 60,        // 大字体，突出显示
    color: '#000000',    // 黑色
    fontWeight: 'bold',  // 粗体
  },
  // 上传按钮下方的说明文字样式
  uploadText: {
    marginTop: 20,       // 与上传按钮的间距
    lineHeight: 18,      // 行高
    color: '#000000',    // 黑色文字
    fontFamily: 'Inter', // Inter字体
    fontSize: 15,        // 字体大小
    fontWeight: '500',   // 中等粗细
    fontStyle: 'italic', // 斜体
    textAlign: 'center', // 居中对齐
    width: 200,          // 设置足够的宽度来容纳完整文本
    flexWrap: 'nowrap',  // 防止文字换行
  },
  uploadHintText: {
    marginTop: 8,
    width: 240,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 16,
  },
  // 灵感展示区域样式
  inspirationSection: {
    flex: 0.4,             // 占据40%的可用空间
    marginTop: 10,         // 减少顶部外边距
    paddingTop: 10,        // 减少顶部内边距
    paddingBottom: 20,     // 增加底部内边距，确保与输入框有足够间距
    paddingHorizontal: 20, // 左右内边距
    marginBottom: 10,      // 添加底部外边距
  },
  // 灵感区域标题容器样式
  inspirationHeader: {
    marginBottom: 8, // 与下方内容的间距
  },
  // 灵感区域标题文字样式
  inspirationTitle: {
    lineHeight: 24,      // 行高
    color: '#000000',    // 黑色文字
    fontFamily: 'Inter', // Inter字体
    fontSize: 20,        // 较大的字体，突出标题
    fontWeight: '500',   // 中等粗细
    fontStyle: 'italic', // 斜体
  },
  // 灵感项目水平滚动视图样式
  inspirationScrollView: {
    marginTop: 10,              // 顶部外边距
  },
  // 灵感项目滚动内容容器样式
  inspirationScrollContent: {
    paddingHorizontal: 0,       // 左右内边距
    alignItems: 'flex-start',   // 顶部对齐
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  progressBar: {
    width: 220,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  // 第一个灵感项目的特殊样式
  firstInspirationItem: {
    backgroundColor: '#FFE5E5',  // 浅粉色背景
  },
  // 灵感项目内文字样式
  inspirationItemText: {
    fontSize: 14,               // 字体大小
    color: '#333333',           // 深灰色文字
    fontWeight: '500',          // 中等粗细
    textAlign: 'center',        // 居中对齐
  },
  inspirationItemTextOnImage: {
    color: '#FFFFFF',
  },
  // 单个灵感项目样式
  inspirationItem: {
    width: 120,                 // 固定宽度
    height: 80,                 // 固定高度
    marginRight: 15,            // 右侧外边距，项目间间隔
    borderRadius: 12,           // 圆角
    overflow: 'hidden',         // 隐藏超出边界的内容
    backgroundColor: '#f5f5f5', // 浅灰色背景
    justifyContent: 'center',   // 垂直居中
    alignItems: 'center',       // 水平居中
  },
  // 灵感项目图片样式
  inspirationImage: {
    width: '100%',       // 占满容器宽度
    height: '100%',      // 占满容器高度
    resizeMode: 'cover', // 覆盖模式，保持比例裁剪
  },
  inspirationTextOverlay: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  // 键盘避让视图样式（已移除，现在使用包装整个屏幕的方式）
  // keyboardAvoidingView: {
  //   position: 'absolute',   // 绝对定位
  //   bottom: 0,              // 固定在底部
  //   left: 0,                // 左对齐
  //   right: 0,               // 右对齐
  // },
  // Modal背景遮罩样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // 半透明黑色背景
    justifyContent: 'flex-end',
  },
  // Modal容器样式
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // 为底部安全区域留出空间
  },
  // Modal内容样式
  modalContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  userPanelOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  userPanelBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  userPanelContainer: {
    height: '100%',
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 32,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    alignSelf: 'flex-start',
    gap: 16,
  },
  userPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  userPanelHeaderInteractive: {
    paddingVertical: 8,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: COLORS.WHITE,
    fontSize: 22,
    fontWeight: '700',
  },
  userPanelTexts: {
    flex: 1,
    gap: 4,
  },
  userPanelTitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_LG,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  userPanelSubtitle: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  userPanelDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.BORDER,
    marginVertical: 20,
  },
  userPanelStats: {
    gap: 4,
  },
  userPanelStatLabel: {
    fontSize: TYPOGRAPHY.FONT_SIZE_SM,
    color: COLORS.TEXT_SECONDARY,
  },
  userPanelStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  userPanelSettingsButton: {
    width: 40,
    height: 40,
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 8,
  },
  userPanelPrimaryButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  userPanelPrimaryButtonText: {
    color: COLORS.WHITE,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: '600',
  },
  userPanelSecondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    paddingVertical: 12,
    alignItems: 'center',
  },
  userPanelSecondaryButtonText: {
    color: COLORS.PRIMARY,
    fontSize: TYPOGRAPHY.FONT_SIZE_MD,
    fontWeight: '600',
  },
  // 选项容器样式 - 参考858_56设计
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 5,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    height: 128,
    gap: 30, // 两个选项之间的间距，减少以让按钮更靠近
  },
  // Take Photo按钮样式 - 严格按照860_35 Frame 29设计
  takePhotoButton: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 15,
    paddingTop: 12,
    paddingBottom: 19,
    paddingHorizontal: 19,
    width: 140,
    height: 102,
    overflow: 'hidden',
  },
  // Take Photo图标容器样式
  takePhotoIconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Take Photo文字样式
  takePhotoText: {
    marginTop: 4,
    lineHeight: 19,
    letterSpacing: 0,
    color: '#000000',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Photo Library按钮样式 - 严格按照860_36 Frame 29设计
  photoLibraryButton: {
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 15,
    paddingTop: 15,
    paddingBottom: 19,
    paddingHorizontal: 8,
    width: 140,
    height: 102,
    overflow: 'hidden',
  },
  // Photo Library图标容器样式
  photoLibraryIconContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Photo Library文字样式
  photoLibraryText: {
    marginTop: 5,
    lineHeight: 19,
    letterSpacing: 0,
    color: '#000000',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
    fontStyle: 'italic',
    textAlign: 'center',
    width: '100%',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  processingContent: {
    width: 220,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  processingText: {
    marginTop: 12,
    color: '#000000',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: '500',
  },
  progressBarTrack: {
    marginTop: 12,
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressBarPulse: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 48,
    backgroundColor: '#ffffff44',
    borderRadius: 4,
  },
  progressPercent: {
    marginTop: 8,
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
  },
});

export default HomeScreen;
