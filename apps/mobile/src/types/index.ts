/**
 * 智能图片编辑应用的类型定义文件
 * 包含用户、图像、画布、AI编辑、积分等核心数据结构
 * 
 * @fileoverview 定义了应用中所有主要的 TypeScript 接口和类型
 * @author FaceShape Team
 * @version 2.1.8
 */

// ==================== 用户相关类型 ====================

export type SeedreamModelAlias = 'seedream-5.0-lite';

/**
 * 用户信息接口
 * 存储用户的基本信息和账户数据
 * 
 * @interface User
 * @example
 * const user: User = {
 *   id: 'user_123456',
 *   email: 'user@example.com',
 *   created_at: '2024-01-01T00:00:00Z',
 *   updated_at: '2024-01-15T10:30:00Z'
 * };
 */
export interface User {
  /** 用户唯一标识符 */
  id: string;
  /** 用户邮箱地址 */
  email: string;
  /** 是否为匿名用户（Supabase anonymous session） */
  is_anonymous?: boolean;
  /** 用户显示名称（可选） */
  name?: string;
  /** 用户头像URL（可选） */
  avatar_url?: string;
  /** 用户积分余额 */
  credits: number;
  /** 免费使用次数剩余 */
  free_uses_remaining: number;
  /** AI 使用许可时间 */
  ai_consent_at?: string | null;
  /** 隐私政策版本 */
  privacy_policy_version?: string | null;
  /** 用户服务协议版本 */
  terms_of_service_version?: string | null;
  /** 账户创建时间（ISO 8601 格式） */
  created_at: string;
  /** 最后更新时间（ISO 8601 格式） */
  updated_at: string;
}

/**
 * 用户扩展资料接口
 * 与 Supabase user_profiles 表结构对应
 */
export interface UserProfile {
  id: string;
  name?: string;
  avatar_url?: string;
  credits: number;
  free_uses_remaining: number;
  daily_usage?: number;
  last_usage_reset?: string;
  ai_consent_at?: string | null;
  privacy_policy_version?: string | null;
  terms_of_service_version?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 游客设备指纹记录
 */
export interface GuestDevice {
  fingerprint: string;
  free_uses_remaining: number;
  total_used: number;
  blocked: boolean;
  last_consumed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== 图像相关类型 ====================

/**
 * 图像数据接口
 * 存储图像的完整信息，包括原始图像和编辑后的图像
 * 
 * @interface ImageData
 * @example
 * const imageData: ImageData = {
 *   id: 'img_123456',
 *   user_id: 'user_123456',
 *   original_url: 'https://storage.supabase.co/bucket/images/original.jpg',
 *   edited_url: 'https://storage.supabase.co/bucket/images/edited.jpg',
 *   file_name: 'portrait.jpg',
 *   file_size: 2048576,
 *   mime_type: 'image/jpeg',
 *   width: 1920,
 *   height: 1080,
 *   created_at: '2024-01-01T00:00:00Z',
 *   updated_at: '2024-01-15T10:30:00Z'
 * };
 */
export interface ImageData {
  /** 图像唯一标识符 */
  id: string;
  /** 图像所属用户ID */
  user_id: string;
  /** 原始图像的存储URL */
  original_url: string;
  /** 编辑后图像的存储URL（可选，编辑后才有） */
  edited_url?: string;
  /** 图像文件名 */
  file_name: string;
  /** 文件大小（字节） */
  file_size: number;
  /** MIME 类型（如 'image/jpeg', 'image/png'） */
  mime_type: string;
  /** 图像宽度（像素） */
  width: number;
  /** 图像高度（像素） */
  height: number;
  /** 图像上传时间（ISO 8601 格式） */
  created_at: string;
  /** 最后更新时间（ISO 8601 格式） */
  updated_at: string;
}

// ==================== 画布和绘图相关类型 ====================

/**
 * 画笔笔触接口
 * 记录用户在画布上的每一次绘制操作
 * 
 * @interface BrushStroke
 * @description
 * 用于创建蒙版的画笔笔触数据，每个笔触包含完整的路径信息
 * 
 * @example
 * const brushStroke: BrushStroke = {
 *   path: [[100, 150], [105, 155], [110, 160]], // 笔触路径点
 *   color: '#ffffff',     // 白色（用于蒙版）
 *   size: 10,            // 笔刷大小
 *   opacity: 0.8,        // 透明度
 *   timestamp: 1703123456789,  // 创建时间戳
 *   tool: 'brush'        // 工具类型
 * };
 */
export interface BrushStroke {
  /** 笔触路径，由一系列 [x, y] 坐标点组成 */
  path: [number, number][];
  /** 笔触颜色（十六进制格式，如 '#ffffff'） */
  color: string;
  /** 笔刷大小（像素） */
  size: number;
  /** 透明度（0-1 之间的浮点数） */
  opacity: number;
  /** 笔触创建时间戳（毫秒） */
  timestamp: number;
  /** 工具类型（可选） */
  tool?: 'brush' | 'eraser';
}

/**
 * 面部特征点数据
 */
// 已去除 MediaPipe FaceMesh 相关类型

/**
 * Face++ 稠密关键点坐标
 */
export interface FacePPLandmarkPoint {
  /** 点位名称（如 nose_left_10） */
  name: string;
  /** 所属关键点分组（face、left_eye 等） */
  group?: string;
  /** X 坐标（像素） */
  x: number;
  /** Y 坐标（像素） */
  y: number;
}

export interface FacePPFaceRectangle {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface FacePPDenseLandmarkResult {
  requestId: string;
  timeUsed: number;
  faceToken: string;
  faceRectangle: FacePPFaceRectangle;
  rawLandmarks: Record<string, Record<string, { x: number; y: number }>>;
  points: FacePPLandmarkPoint[];
  landmarkCount: number;
}

export interface FacePPDetectRequest {
  imageBase64?: string;
  imageUrl?: string;
}

/**
 * 画布会话接口
 * 记录用户在特定图像上的完整编辑会话
 * 
 * @interface CanvasSession
 * @description
 * 存储用户在画布上的所有操作，包括画笔笔触、画布尺寸等信息
 * 用于恢复编辑状态和生成蒙版
 * 
 * @example
 * const canvasSession: CanvasSession = {
 *   id: 'session_123456',
 *   user_id: 'user_123456',
 *   image_id: 'img_123456',
 *   brush_strokes: [brushStroke1, brushStroke2],
 *   canvas_width: 800,
 *   canvas_height: 600,
 *   created_at: '2024-01-01T00:00:00Z',
 *   updated_at: '2024-01-15T10:30:00Z'
 * };
 */
export interface CanvasSession {
  /** 会话唯一标识符 */
  id: string;
  /** 会话所属用户ID */
  user_id: string;
  /** 关联的图像ID */
  image_id: string;
  /** 会话中的所有画笔笔触 */
  brush_strokes: BrushStroke[];
  /** 画布宽度（像素） */
  canvas_width: number;
  /** 画布高度（像素） */
  canvas_height: number;
  /** 会话创建时间（ISO 8601 格式） */
  created_at: string;
  /** 最后更新时间（ISO 8601 格式） */
  updated_at: string;
}

// ==================== AI 编辑相关类型 ====================

/**
 * AI 编辑记录接口
 * 记录每次 AI 图像编辑的完整信息和状态
 * 
 * @interface AIEdit
 * @description
 * 存储图像编辑调用的详细信息，包括编辑指令、结果、状态等
 * 用于追踪编辑历史和管理异步处理流程
 * 
 * @example
 * const aiEdit: AIEdit = {
 *   id: 'edit_123456',
 *   user_id: 'user_123456',
 *   image_id: 'img_123456',
 *   session_id: 'session_123456',
 *   prompt: '将头发颜色改为金色',
 *   result_url: 'https://storage.supabase.co/bucket/images/edited_123456.jpg',
 *   status: 'completed',
 *   processing_time: 15.5,
 *   credits_used: 1,
 *   created_at: '2024-01-01T00:00:00Z',
 *   updated_at: '2024-01-01T00:00:15Z'
 * };
 */
export interface AIEdit {
  /** 编辑记录唯一标识符 */
  id: string;
  /** 编辑所属用户ID */
  user_id: string;
  /** 被编辑的图像ID */
  image_id: string;
  /** 关联的画布会话ID */
  session_id: string;
  /** 用户的编辑指令/提示词 */
  prompt: string;
  /** 编辑结果图像URL（完成后才有） */
  result_url?: string;
  /** 编辑状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** 错误信息（失败时才有） */
  error_message?: string;
  /** 处理耗时（秒，完成后才有） */
  processing_time?: number;
  /** 消耗的积分数量 */
  credits_used: number;
  /** 编辑请求创建时间（ISO 8601 格式） */
  created_at: string;
  /** 最后更新时间（ISO 8601 格式） */
  updated_at: string;
}

// ==================== 积分系统相关类型 ====================

/**
 * 积分交易记录接口
 * 记录用户积分的所有变动情况
 * 
 * @interface CreditTransaction
 * @description
 * 用于追踪积分的获得、消费、退款等所有操作
 * 确保积分系统的透明性和可审计性
 * 
 * @example
 * const creditTransaction: CreditTransaction = {
 *   id: 'txn_123456',
 *   user_id: 'user_123456',
 *   amount: -1,              // 负数表示消费，正数表示获得
 *   type: 'usage',           // 使用积分
 *   description: 'AI图像编辑 - 改变头发颜色',
 *   reference_id: 'edit_123456',  // 关联的编辑记录ID
 *   created_at: '2024-01-01T00:00:00Z'
 * };
 */
export interface CreditTransaction {
  /** 交易记录唯一标识符 */
  id: string;
  /** 交易所属用户ID */
  user_id: string;
  /** 积分变动数量（正数为获得，负数为消费） */
  amount: number;
  /** 交易类型 */
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  /** 交易描述说明 */
  description: string;
  /** 关联的业务记录ID（如编辑ID、订单ID等） */
  reference_id?: string;
  /** 交易创建时间（ISO 8601 格式） */
  created_at: string;
}

// ==================== 导航相关类型 ====================

/**
 * 根导航堆栈参数列表
 * 定义应用中所有页面的导航参数
 * 
 * @type RootStackParamList
 * @description
 * React Navigation 使用的类型定义，确保导航参数的类型安全
 * 
 * @example
 * // 导航到编辑器页面并传递图像URI
 * navigation.navigate('Editor', { imageUri: 'file://path/to/image.jpg' });
 * 
 * // 导航到主页（无参数）
 * navigation.navigate('Home');
 */
type AuthRedirectTarget = 'Home' | 'Purchase' | 'Settings';

type AuthRouteParams = {
  redirectTo?: AuthRedirectTarget;
  resumePurchaseId?: string;
  returnToPrevious?: boolean;
};

type PurchaseRouteParams = {
  resumePurchaseId?: string;
};

export type RootStackParamList = {
  /** 主页 - 无参数 */
  Home: undefined;
  /** 相机页面 - 无参数 */
  Camera: undefined;
  /** 编辑器页面 - 需要传递图像URI */
  Editor: {
    imageUri: string;
  };
  /** 图库页面 - 无参数 */
  Gallery: undefined;
  /** 个人资料页面 - 无参数 */
  Profile: undefined;
  /** 登录页面 - 可选重定向参数 */
  Login: AuthRouteParams | undefined;
  /** 注册页面 - 可选重定向参数 */
  Register: AuthRouteParams | undefined;
  /** 邮箱验证中转页 - 无参数 */
  AuthConfirm: undefined;
  /** 邮箱验证回调页 - 无参数 */
  AuthCallback: undefined;
  /** 积分页面 - 无参数 */
  Credits: undefined;
  /** 购买页面 - 可选继续购买参数 */
  Purchase: PurchaseRouteParams | undefined;
  /** 设置页面 - 无参数 */
  Settings: undefined;
  /** 隐私政策页面 - 无参数 */
  PrivacyPolicy: undefined;
  /** 用户服务协议页面 - 无参数 */
  TermsOfService: undefined;
};

// ==================== API 响应相关类型 ====================

/**
 * 通用 API 响应接口
 * 标准化所有 API 调用的响应格式
 * 
 * @interface APIResponse
 * @template T 响应数据的类型
 * 
 * @description
 * 提供统一的 API 响应结构，便于错误处理和数据提取
 * 
 * @example
 * // 成功响应
 * const response: APIResponse<User> = {
 *   success: true,
 *   data: { id: '123', email: 'user@example.com', ... },
 *   message: '用户信息获取成功'
 * };
 * 
 * // 错误响应
 * const errorResponse: APIResponse = {
 *   success: false,
 *   error: 'USER_NOT_FOUND',
 *   message: '用户不存在'
 * };
 */
export interface APIResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  /** 响应数据（成功时才有） */
  data?: T;
  /** 错误代码（失败时才有） */
  error?: string;
  /** 响应消息（成功或失败的描述） */
  message?: string;
}

// ==================== 应用业务相关类型 ====================

/**
 * AI 编辑请求接口
 * 客户端发起 AI 编辑时使用的请求数据结构
 * 
 * @interface AIEditRequest
 * @description
 * 封装了发起 AI 编辑所需的完整信息，用于前端到后端的数据传输
 * 
 * @example
 * const editRequest: AIEditRequest = {
 *   imageId: 'img_123456',
 *   prompt: '将背景改为海滩场景',
 *   brushStrokes: [brushStroke1, brushStroke2],
 *   canvasWidth: 800,
 *   canvasHeight: 600
 * };
 */
export interface AIEditRequest {
  /** 要编辑的图像ID */
  imageId: string;
  /** 编辑指令/提示词 */
  prompt: string;
  /** 画笔笔触数组（用于生成蒙版） */
  brushStrokes: BrushStroke[];
  /** 画布宽度（像素） */
  canvasWidth: number;
  /** 画布高度（像素） */
  canvasHeight: number;
}

/**
 * 画布组件引用接口
 * 定义画布组件对外暴露的方法
 * 
 * @interface CanvasRef
 * @description
 * 用于父组件控制画布组件的行为，如清空画布、撤销操作等
 * 
 * @example
 * const canvasRef = useRef<CanvasRef>(null);
 * 
 * const handleClear = () => {
 *   canvasRef.current?.clearCanvas();
 * };
 * 
 * const handleUndo = () => {
 *   canvasRef.current?.undoLastStroke();
 * };
 */
export interface CanvasRef {
  /** 清空画布上的所有笔触 */
  clearCanvas: () => void;
  /** 撤销最后一次笔触 */
  undoLastStroke: () => void;
  /** 获取当前画布上的所有笔触数据 */
  getCanvasData: () => BrushStroke[];
}

/**
 * 应用全局状态接口
 * 定义应用的核心状态数据结构
 * 
 * @interface AppState
 * @description
 * 用于状态管理（如 Redux、Zustand）的全局状态定义
 * 包含用户信息、当前图像、画布会话等关键数据
 * 
 * @example
 * const initialState: AppState = {
 *   user: null,
 *   currentImage: null,
 *   canvasSession: null,
 *   isLoading: false,
 *   error: null
 * };
 */
export interface AppState {
  /** 当前登录用户信息 */
  user: User | null;
  /** 当前正在编辑的图像 */
  currentImage: ImageData | null;
  /** 当前画布会话 */
  canvasSession: CanvasSession | null;
  /** 应用是否处于加载状态 */
  isLoading: boolean;
  /** 错误信息（如果有） */
  error: string | null;
}
