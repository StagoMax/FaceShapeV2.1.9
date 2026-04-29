/**
 * ToolBar 工具栏组件
 * 
 * 功能说明：
 * - 提供绘图工具栏界面
 * - 包含调色盘、画笔、画笔大小滑动条、橡皮擦功能
 * - 严格按照Figma Frame 19设计实现
 * - 使用assets文件夹中的PNG图标
 * - 支持响应式布局和画笔大小调节
 * - 右上角添加侧边栏图标，支持长按查看原图功能（待开发）
 * 
 * @author FaceShape团队
 * @version 2.1.8
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  Animated,
  Easing, // 引入Easing用于更丝滑的动画
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';

// 定义工具类型
type ToolType = 'brush' | 'eraser';

// 工具栏组件Props接口定义
interface ToolBarProps {
  onColorPalettePress?: () => void;    // 调色盘按钮点击回调
  onBrushPress?: () => void;           // 画笔按钮点击回调
  onEraserPress?: () => void;          // 橡皮擦按钮点击回调
  onBrushSizeChange?: (size: number) => void;  // 画笔大小变化回调
  onSidebarPress?: () => void;         // 侧边栏按钮点击回调
  onSidebarLongPress?: () => void;     // 侧边栏按钮长按回调
  initialBrushSize?: number;           // 初始画笔大小
  minBrushSize?: number;               // 最小画笔大小
  maxBrushSize?: number;               // 最大画笔大小
  initialTool?: ToolType;              // 新增：初始工具类型
}

/**
 * ToolBar 工具栏组件
 * @param props 组件属性
 */
const ToolBar: React.FC<ToolBarProps> = ({
  onColorPalettePress,
  onBrushPress,
  onEraserPress,
  onBrushSizeChange,
  onSidebarPress,
  onSidebarLongPress,
  initialBrushSize = 10,
  minBrushSize = 1,
  maxBrushSize = 50,
  initialTool = 'brush', // 默认初始工具为画笔
}) => {
  const { t } = useTranslation();
  // 画笔大小状态
  const [brushSize, setBrushSize] = useState(initialBrushSize);
  // 当前激活的工具状态
  const [activeTool, setActiveTool] = useState<ToolType>(initialTool);
  // 动画值
  const slideAnim = useRef(new Animated.Value(0)).current;

  // 用于高亮框计算的实际宽度测量（像素级），确保完全覆盖
  const [brushW, setBrushW] = useState(0); // 画笔按钮实际宽度
  const [sliderW, setSliderW] = useState(0); // 滑块容器实际宽度
  const [eraserW, setEraserW] = useState(0); // 橡皮擦按钮实际宽度
  const hasMeasure = brushW > 0 && sliderW > 0 && eraserW > 0; // 是否完成测量

  // 动画插值（像素级），根据测量结果精确计算覆盖区域
  const leftOffset = -15; // 调整左侧偏移量，以确保完全覆盖
  const widthOffset = 15; // 调整宽度以覆盖左右内边距

  const animatedLeftPx = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-15, brushW], // 0=-15px (补偿左内边距)；1=移动到画笔宽度处
  });
  const animatedWidthPx = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [brushW + sliderW + widthOffset, sliderW + eraserW + widthOffset], // 左侧覆盖=画笔+滑块+边距；右侧覆盖=滑块+橡皮+边距
  });
  
  // 滑动条位置动画
  const sliderPositionAnim = useRef(new Animated.Value(0)).current;
  
  // 滑动条位置动画插值
  const sliderLeftPosition = sliderPositionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-4%', '4%'], // 0=靠近画笔，1=靠近橡皮擦，对称移动
  });

  // 根据激活的工具，启动动画（丝滑平移效果）
  useEffect(() => {
    // 高亮背景动画
    Animated.timing(slideAnim, {
      toValue: activeTool === 'brush' ? 0 : 1, // 0 表示高亮在"画笔+滑块"侧；1 表示在"滑块+橡皮擦"侧
      duration: 240, // 动画时长，保证丝滑但不拖沓
      easing: Easing.out(Easing.quad), // 缓出曲线，过渡更自然
      useNativeDriver: false, // 'width' 与 'left' 不支持原生驱动
    }).start();
    
    // 滑动条位置动画
    Animated.timing(sliderPositionAnim, {
      toValue: activeTool === 'brush' ? 0 : 1, // 0=靠近画笔，1=靠近橡皮擦
      duration: 250, // 稍微加快一点，保持流畅感
      easing: Easing.bezier(0.25, 0.1, 0.25, 1), // 使用标准缓动曲线，更自然
      useNativeDriver: false, // 百分比布局不支持原生驱动
    }).start();
  }, [activeTool, slideAnim, sliderPositionAnim]);

  /**
   * 调色盘按钮点击处理函数
   */
  const handleColorPalettePress = () => {
    if (onColorPalettePress) {
      onColorPalettePress();
    } else {
      Alert.alert(t('toolbar.paletteTitle'), t('toolbar.paletteMessage'));
    }
  };

  /**
   * 画笔按钮点击处理函数
   */
  const handleBrushPress = () => {
    setActiveTool('brush');
    if (onBrushPress) {
      onBrushPress();
    } else {
      Alert.alert(t('toolbar.brushTitle'), t('toolbar.brushMessage'));
    }
  };

  /**
   * 橡皮擦按钮点击处理函数
   */
  const handleEraserPress = () => {
    setActiveTool('eraser');
    if (onEraserPress) {
      onEraserPress();
    } else {
      Alert.alert(t('toolbar.eraserTitle'), t('toolbar.eraserMessage'));
    }
  };

  /**
   * 画笔大小变化处理函数
   * @param value 新的画笔大小值
   */
  const handleBrushSizeChange = (value: number) => {
    setBrushSize(value);
    if (onBrushSizeChange) {
      onBrushSizeChange(value);
    }
  };
  
  /**
   * 侧边栏按钮点击处理函数
   */
  const handleSidebarPress = () => {
    if (onSidebarPress) {
      onSidebarPress();
    } else {
      Alert.alert(t('toolbar.sidebarTitle'), t('toolbar.sidebarMessage'));
    }
  };
  
  // 添加状态来跟踪长按状态
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  /**
   * 侧边栏按钮长按开始处理函数
   */
  const handleSidebarLongPressIn = () => {
    setIsLongPressing(true);
    // 这里可以添加显示原图的逻辑
    if (onSidebarLongPress) {
      onSidebarLongPress();
    } else {
      Alert.alert(t('toolbar.viewOriginalTitle'), t('toolbar.viewOriginalMessage'));
    }
  };
  
  /**
   * 侧边栏按钮长按结束处理函数
   */
  const handleSidebarLongPressOut = () => {
    setIsLongPressing(false);
    // 这里可以添加隐藏原图的逻辑
  };

  // 动画插值
  const animatedLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '20%'], // 从0%到20%
  });

  return (
    <View style={styles.toolBarContainer}>
      {/* 侧边栏图标按钮 - 位于工具栏右上角 */}
      <View style={styles.sidebarButtonContainer}>
        <TouchableOpacity 
          onPress={handleSidebarPress}
          onLongPress={handleSidebarLongPressIn}
          onPressOut={handleSidebarLongPressOut}
          delayLongPress={300}
          style={[
            isLongPressing && styles.sidebarButtonActive
          ]}
        >
          <Image 
            source={require('../../assets/codicon_layout-sidebar-right (2).png')}
            style={[
              styles.sidebarIcon,
              isLongPressing && styles.sidebarIconActive
            ]}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
      
      {/* 调色盘区域 */}
      <View style={styles.colorPaletteContainer}>
        <TouchableOpacity onPress={handleColorPalettePress}>
          <Image 
            source={require('../../assets/streamline-ultimate-color_color-palette-2.png')}
            style={styles.colorPaletteIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* 中间区域 - 包含画笔、滑动条和橡皮擦 */}
      <View style={styles.centerContainer}>
        <View style={styles.innerCenterContainer}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.animatedBackground,
              hasMeasure
                ? { left: animatedLeftPx, width: animatedWidthPx }
                : { left: animatedLeft, width: '80%' }, // 未测量完成时用百分比兜底
            ]}
          />
          
          {/* 画笔图标 */}
          <TouchableOpacity
            onPress={handleBrushPress}
            style={styles.toolButton}
            onLayout={(e) => setBrushW(e.nativeEvent.layout.width)}
          >
            <Image 
              source={require('../../assets/mingcute_pencil-line.png')}
              style={styles.brushIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {/* 画笔大小滑动条 */}
          <Animated.View
            style={[
              styles.sliderContainer,
              { left: sliderLeftPosition } // 使用动画值控制位置
            ]}
            onLayout={(e) => setSliderW(e.nativeEvent.layout.width)}
          >
            <Slider
              style={styles.slider}
              minimumValue={minBrushSize}
              maximumValue={maxBrushSize}
              value={brushSize}
              onValueChange={handleBrushSizeChange}
              minimumTrackTintColor="#007AFF" // iOS标准蓝色（已选择部分）
              maximumTrackTintColor="#9E9E9E" // 更深的灰色
              thumbTintColor="#FFFFFF" // 白色滑块
            />
          </Animated.View>

          {/* 橡皮擦图标 */}
          <TouchableOpacity
            onPress={handleEraserPress}
            style={styles.toolButton}
            onLayout={(e) => setEraserW(e.nativeEvent.layout.width)}
          >
            <Image 
              source={require('../../assets/tabler_eraser.png')}
              style={styles.eraserIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 右侧占位符，用于实现视觉平衡 */}
      <View style={styles.rightSpacer} />
    </View>
  );
};

// ==================== 样式定义 ====================
const styles = StyleSheet.create({
  /** 工具栏主容器 - 严格按照Figma Frame 19设计 */
  toolBarContainer: {
    flexDirection: 'row',           // 水平排列
    alignItems: 'flex-start',       // 顶部对齐
    backgroundColor: '#ffffff',     // 白色背景
    paddingTop: 13,                 // 顶部内边距13px
    paddingBottom: 10,              // 底部内边距10px
    paddingLeft: 15,                // 左内边距15px
    paddingRight: 23,               // 右内边距23px
    height: 71,                     // 固定高度71px
    width: '100%',                  // 撑满屏幕宽度
  },

  /** 侧边栏按钮容器样式 */
  sidebarButtonContainer: {
    position: 'absolute',
    top: -30, // 位于工具栏上方
    right: 13, // 向左偏移，不贴着右边
    zIndex: 10, // 确保在其他元素之上
    backgroundColor: 'transparent', // 确保背景透明
    padding: 8, // 增加点击区域
    borderRadius: 20, // 长按时的高亮效果更圆润
  },
  
  /** 侧边栏图标样式 */
  sidebarIcon: {
    width: 24,
    height: 24,
    tintColor: '#333', // 图标颜色
    backgroundColor: 'transparent', // 确保图标背景透明
  },
  sidebarButtonActive: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)', // 轻微的蓝色背景表示激活状态
  },
  sidebarIconActive: {
    tintColor: '#007AFF', // 激活时图标变为蓝色
    backgroundColor: 'transparent', // 确保图标背景透明
  },

  /** 调色盘容器样式 */
  colorPaletteContainer: {
    width: 37,                      // 容器宽度37px
    height: 37,                     // 容器高度37px
    marginTop: 4,                   // 顶部边距4px
    justifyContent: 'center',       // 垂直居中
    alignItems: 'center',           // 水平居中
  },

  /** 调色盘图标样式 */
  colorPaletteIcon: {
    width: 24,                      // 调色盘图标宽度24px（与顶部栏一致）
    height: 24,                     // 调色盘图标高度24px（与顶部栏一致）
  },

  /** 中间容器样式 - 包含画笔、滑动条和橡皮擦 */
  centerContainer: {
    flex: 1,
    height: 48,
    backgroundColor: '#f3f3f3',
    borderRadius: 43,
    marginLeft: 9,
    paddingHorizontal: 15, // 在这里添加内边距
    flexDirection: 'row', // 确保子元素可以横向排列
    overflow: 'hidden', // 裁剪溢出，确保高亮框在圆角内
  },

  innerCenterContainer: {
    flex: 1, // 占据父容器的剩余空间
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around', // 连续排布，避免space-between带来的空隙
    height: '100%',
    position: 'relative',
  },

  animatedBackground: {
    position: 'absolute',
    height: '100%',
    width: '80%', // 覆盖一个图标和滑动条 (20% + 60%)
    backgroundColor: '#e0e0e0',
    borderRadius: 43,
    zIndex: 0, // 在底层
    pointerEvents: 'none', // 不拦截点击事件
  },

  toolButton: {
    width: '20%', // 每个图标占20%
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    zIndex: 1, // 置于高亮层之上
  },

  brushIcon: {
    width: 24,
    height: 24,
  },

  sliderContainer: {
    width: '60%', // 滑动条占60%
    justifyContent: 'center',
    height: '100%',
    zIndex: 1, // 置于高亮层之上
  },

  /** 滑动条样式 */
  slider: {
    width: '100%',                  // 占满容器宽度
    height: 38,                     // 高度38px
  },

  /** 橡皮擦图标样式 */
  eraserIcon: {
    width: 24,                      // 橡皮擦图标宽度24px（与顶部栏一致）
    height: 24,                     // 橡皮擦图标高度24px（与顶部栏一致）
  },

  rightSpacer: {
    width: 37, // 与左侧调色盘容器宽度一致，实现平衡
  },
});

export default ToolBar;
export type { ToolBarProps };
