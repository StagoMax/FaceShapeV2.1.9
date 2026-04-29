/**
 * Supabase 数据库服务模块
 * 提供用户认证、数据存储、文件上传等后端服务功能
 * 使用 Supabase 作为 BaaS (Backend as a Service) 解决方案
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import 'react-native-url-polyfill/auto'; // React Native URL polyfill 支持
import { AUTH_CONFIG } from '../constants';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const { supabaseUrl: supabaseUrlFromConfig, supabaseAnonKey: supabaseAnonKeyFromConfig } =
  (Constants?.expoConfig?.extra as Record<string, string | undefined> | undefined) ?? {};

const supabaseUrl = supabaseUrlFromConfig || process.env.SUPABASE_URL;
const supabaseAnonKey = supabaseAnonKeyFromConfig || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
  );
}

const getProjectRef = (url?: string) => {
  if (!url) {
    return null;
  }
  try {
    const host = new URL(url).hostname;
    return host.split('.')[0] || null;
  } catch {
    return null;
  }
};

const maskKey = (value?: string) => {
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return `${value}***`;
  }
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
};

const maskTokenHint = (value?: string) => {
  if (!value) {
    return null;
  }
  if (value.length <= 10) {
    return `${value}***(${value.length})`;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}(${value.length})`;
};

const decodeJwtPayload = (token?: string) => {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
  try {
    if (typeof atob !== 'function') {
      return null;
    }
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const pickJwtDebugClaims = (token?: string) => {
  const claims = decodeJwtPayload(token);
  if (!claims) {
    return null;
  }
  const { iss, aud, sub, exp, iat, role } = claims as Record<string, unknown>;
  return {
    iss: typeof iss === 'string' ? iss : null,
    aud,
    sub: typeof sub === 'string' ? sub : null,
    exp: typeof exp === 'number' ? exp : null,
    iat: typeof iat === 'number' ? iat : null,
    role: typeof role === 'string' ? role : null,
  };
};

const getProjectRefFromIssuer = (issuer?: string | null) => {
  if (!issuer) {
    return null;
  }
  return getProjectRef(issuer);
};

/**
 * 创建 Supabase 客户端实例
 * 配置认证选项：自动刷新令牌、持久化会话、禁用URL检测
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,     // React Native 需要显式注入存储以持久化会话
    autoRefreshToken: true,    // 自动刷新访问令牌
    persistSession: true,      // 持久化用户会话
    detectSessionInUrl: false, // 禁用从URL检测会话（移动端不需要）
  },
});

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};

const resolveAuthScheme = () => {
  if (Platform.OS !== 'android') {
    return AUTH_CONFIG.APP_SCHEME;
  }
  const appId = Application.applicationId;
  if (appId && appId.endsWith('.debug')) {
    return `${AUTH_CONFIG.APP_SCHEME}-debug`;
  }
  return AUTH_CONFIG.APP_SCHEME;
};

const buildOAuthRedirectTo = () => {
  const usingExpoProxy = Constants.appOwnership === 'expo';
  return makeRedirectUri({
    scheme: resolveAuthScheme(),
    path: AUTH_CONFIG.APP_CALLBACK_PATH,
    ...(usingExpoProxy ? ({ useProxy: true } as Record<string, unknown>) : {}),
  } as any);
};

const buildEmailRedirectTo = () => AUTH_CONFIG.WEB_CONFIRM_URL;

/**
 * 数据库表名常量
 * 定义应用中使用的所有数据库表名，避免硬编码
 */
export const TABLES = {
  USERS: 'users',                           // 用户信息表
  USER_PROFILES: 'user_profiles',           // 用户扩展信息表
  IMAGES: 'images',                         // 图片信息表
  CANVAS_SESSIONS: 'canvas_sessions',       // 画布会话表
  AI_EDITS: 'ai_edits',                     // AI编辑记录表
  CREDIT_TRANSACTIONS: 'credit_transactions', // 积分交易记录表
  CREDIT_PACKAGES: 'credit_packages',       // 积分包配置表
  CREDIT_PURCHASE_REQUESTS: 'credit_purchase_requests', // 积分购买请求表
  GUEST_DEVICES: 'guest_devices',           // 游客设备指纹表
  APP_LOGS: 'app_logs',                      // 客户端日志表
} as const;

/**
 * 存储桶名称常量
 * 定义 Supabase Storage 中使用的存储桶名称
 */
export const BUCKETS = {
  IMAGES: 'images',   // 原始图片存储桶
  RESULTS: 'results', // 处理结果存储桶
} as const;

export type OAuthProvider = 'google' | 'apple' | 'github' | 'facebook';

/**
 * Supabase 辅助函数集合
 * 封装常用的数据库操作、认证和存储功能，提供统一的API接口
 */
export const supabaseHelpers = {
  // Supabase 客户端实例
  supabase,
  /**
   * 获取当前 Supabase 配置（脱敏）
   */
  getSupabaseClientInfo: () => ({
    supabaseUrl,
    projectRef: getProjectRef(supabaseUrl),
    anonKeyPrefix: maskKey(supabaseAnonKey),
  }),
  /**
   * 解析 JWT payload（不校验签名，避免输出敏感 token）
   */
  decodeJwtClaims: (token: string) => decodeJwtPayload(token),

  /**
   * 获取当前登录用户信息
   * @returns Promise<User | null> 用户对象或null（未登录）
   * @throws Error 当获取用户信息失败时抛出错误
   * @example
   * const user = await supabaseHelpers.getCurrentUser();
   * if (user) {
   *   console.log('用户ID:', user.id);
   * }
   */
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  /**
   * 用户邮箱密码登录
   * @param email 用户邮箱地址
   * @param password 用户密码
   * @returns Promise<AuthResponse> 认证响应数据，包含用户信息和会话
   * @throws Error 当登录失败时抛出错误（如密码错误、用户不存在等）
   * @example
   * const { user, session } = await supabaseHelpers.signIn('user@example.com', 'password123');
   */
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /**
   * 匿名登录（用于游客也能获得 JWT）
   */
  signInAnonymously: async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data;
  },

  /**
   * 用户注册新账户
   * @param email 用户邮箱地址
   * @param password 用户密码
   * @param name 可选的用户姓名
   * @returns Promise<AuthResponse> 注册响应数据
   * @throws Error 当注册失败时抛出错误（如邮箱已存在、密码不符合要求等）
   * @example
   * const { user } = await supabaseHelpers.signUp('newuser@example.com', 'password123', '张三');
   */
  signUp: async (email: string, password: string, name?: string) => {
    const redirectTo = buildEmailRedirectTo();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || '',
        },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * 用户登出
   * 清除本地会话和服务器端会话
   * @throws Error 当登出失败时抛出错误
   * @example
   * await supabaseHelpers.signOut();
   * console.log('用户已登出');
   */
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * 第三方快捷登录
   * @param provider OAuth 提供商
   */
  signInWithOAuth: async (provider: OAuthProvider) => {
    const redirectTo = buildOAuthRedirectTo();
    console.log('[auth] oauth redirectTo', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) {
      throw new Error('Could not generate a login link. Please try again later.');
    }
    console.log('[auth] oauth authorize url', data.url);

    const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    const authResultUrl =
      'url' in authResult && typeof authResult.url === 'string' ? authResult.url : null;
    console.log('[auth] oauth result type', authResult.type);
    console.log('[auth] oauth result url', authResultUrl ?? '');

    if (authResult.type !== 'success') {
      throw new Error(authResult.type === 'cancel' ? 'User cancelled sign-in' : 'OAuth sign-in failed');
    }

    if (authResultUrl) {
      const redirectURL = new URL(authResultUrl);
      const fragment = redirectURL.hash?.startsWith('#')
        ? redirectURL.hash.substring(1)
        : redirectURL.search?.startsWith('?')
          ? redirectURL.search.substring(1)
          : '';
      const params = new URLSearchParams(fragment);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setSessionError) throw setSessionError;
        if (sessionData.session) {
          return sessionData;
        }
      }
    }

    const { data: fallbackSession, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!fallbackSession.session) {
      throw new Error('Unable to retrieve a session. Please try again later.');
    }
    return fallbackSession;
  },

  /**
   * 获取用户扩展资料
   * @param userId 用户ID
   * @returns Promise<any> 用户资料记录
   */
  getUserProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from(TABLES.USER_PROFILES)
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 创建或更新用户扩展资料
   * @param userId 用户ID
   * @param profileData 要更新的用户资料字段
   * @returns Promise<any> 更新后的用户资料
   */
  upsertUserProfile: async (userId: string, profileData: Record<string, any>) => {
    const { data, error } = await supabase
      .from(TABLES.USER_PROFILES)
      .upsert({ id: userId, ...profileData }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 更新用户扩展资料
   * @param userId 用户ID
   * @param updates 要更新的用户资料字段
   * @returns Promise<any> 更新后的用户资料
   */
  updateUserProfile: async (userId: string, updates: Record<string, any>) => {
    const { data, error } = await supabase
      .from(TABLES.USER_PROFILES)
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 申请扣减用户积分（服务端函数校验）
   * @param amount 扣减积分数
   * @param description 扣减说明
   */
  consumeUserCredits: async (amount: number, description: string) => {
    const { data, error } = await supabase.rpc('consume_user_credits', {
      credit_amount: amount,
      description_text: description,
    });
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  },

  /**
   * 领取每日免费积分（服务端函数校验）
   */
  claimDailyFreeCredits: async () => {
    const { data, error } = await supabase.rpc('claim_daily_free_credits');
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  },

  /**
   * 获取游客设备记录
   * @param fingerprint 设备指纹
   */
  getGuestDevice: async (fingerprint: string) => {
    const { data, error } = await supabase
      .from(TABLES.GUEST_DEVICES)
      .select('*')
      .eq('fingerprint', fingerprint)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ?? null;
  },

  /**
   * 创建或更新游客设备记录
   * @param fingerprint 设备指纹
   * @param data 更新数据
   */
  upsertGuestDevice: async (fingerprint: string, data: Record<string, any>) => {
    const { data: result, error } = await supabase
      .from(TABLES.GUEST_DEVICES)
      .upsert({ fingerprint, ...data }, { onConflict: 'fingerprint' })
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  /**
   * 更新游客设备剩余额度
   * @param fingerprint 设备指纹
   * @param updates 更新字段
   */
  updateGuestDevice: async (
    fingerprint: string,
    updates: Record<string, any>,
  ) => {
    const { data, error } = await supabase
      .from(TABLES.GUEST_DEVICES)
      .update(updates)
      .eq('fingerprint', fingerprint)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 上传图片到 Supabase Storage
   * @param file 要上传的文件（Blob格式）
   * @param fileName 文件名（建议包含扩展名）
   * @param bucket 存储桶名称，默认为 BUCKETS.IMAGES
   * @returns Promise<FileObject> 上传成功后的文件对象信息
   * @throws Error 当上传失败时抛出错误（如文件过大、格式不支持等）
   * @example
   * const fileData = await supabaseHelpers.uploadImage(imageBlob, 'photo_123.jpg');
   * console.log('文件路径:', fileData.path);
   */
  uploadImage: async (file: Blob, fileName: string, bucket: string = BUCKETS.IMAGES) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600', // 缓存1小时
        upsert: false,        // 不覆盖已存在的文件
      });
    if (error) throw error;
    return data;
  },

  /**
   * 获取已上传文件的公共访问URL
   * @param fileName 文件名
   * @param bucket 存储桶名称，默认为 BUCKETS.IMAGES
   * @returns string 文件的公共访问URL
   * @example
   * const imageUrl = supabaseHelpers.getPublicUrl('photo_123.jpg');
   * // 返回: https://xxx.supabase.co/storage/v1/object/public/images/photo_123.jpg
   */
  getPublicUrl: (fileName: string, bucket: string = BUCKETS.IMAGES) => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);
    return data.publicUrl;
  },

  /**
   * 向指定表插入新记录
   * @param table 表名
   * @param data 要插入的数据对象
   * @returns Promise<any> 插入成功后返回的记录（包含自动生成的ID等）
   * @throws Error 当插入失败时抛出错误（如数据验证失败、权限不足等）
   * @example
   * const newImage = await supabaseHelpers.insertRecord(TABLES.IMAGES, {
   *   original_url: 'https://example.com/image.jpg',
   *   width: 1920,
   *   height: 1080
   * });
   */
  insertRecord: async (table: string, data: any) => {
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()  // 返回插入的记录
      .single(); // 只返回单条记录
    if (error) throw error;
    return result;
  },

  /**
   * 根据ID更新表中的记录
   * @param table 表名
   * @param id 记录的唯一标识符
   * @param data 要更新的数据对象
   * @returns Promise<any> 更新后的完整记录
   * @throws Error 当更新失败时抛出错误（如记录不存在、权限不足等）
   * @example
   * const updatedUser = await supabaseHelpers.updateRecord(TABLES.USERS, 'user-123', {
   *   name: '新名字',
   *   credits: 100
   * });
   */
  updateRecord: async (table: string, id: string, data: any) => {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)  // 根据ID匹配
      .select()      // 返回更新后的记录
      .single();     // 只返回单条记录
    if (error) throw error;
    return result;
  },

  /**
   * 根据ID获取单条记录
   * @param table 表名
   * @param id 记录的唯一标识符
   * @returns Promise<any> 查询到的记录对象
   * @throws Error 当查询失败时抛出错误（如记录不存在、权限不足等）
   * @example
   * const user = await supabaseHelpers.getRecord(TABLES.USERS, 'user-123');
   * console.log('用户名:', user.name);
   */
  getRecord: async (table: string, id: string) => {
    const { data, error } = await supabase
      .from(table)
      .select('*')   // 选择所有字段
      .eq('id', id)  // 根据ID匹配
      .single();     // 只返回单条记录
    if (error) throw error;
    return data;
  },

  /**
   * 根据过滤条件获取多条记录
   * @param table 表名
   * @param filter 可选的过滤条件对象，键值对形式
   * @returns Promise<any[]> 符合条件的记录数组
   * @throws Error 当查询失败时抛出错误
   * @example
   * // 获取所有记录
   * const allImages = await supabaseHelpers.getRecords(TABLES.IMAGES);
   * 
   * // 根据用户ID过滤
   * const userImages = await supabaseHelpers.getRecords(TABLES.IMAGES, {
   *   user_id: 'user-123'
   * });
   * 
   * // 多条件过滤
   * const filteredEdits = await supabaseHelpers.getRecords(TABLES.AI_EDITS, {
   *   user_id: 'user-123',
   *   status: 'completed'
   * });
   */
  getRecords: async (table: string, filter?: any) => {
    let query = supabase.from(table).select('*');
    
    // 如果有过滤条件，逐个应用
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value); // 等值匹配
      });
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * 根据ID删除表中的记录
   * @param table 表名
   * @param id 要删除记录的唯一标识符
   * @throws Error 当删除失败时抛出错误（如记录不存在、权限不足等）
   * @example
   * await supabaseHelpers.deleteRecord(TABLES.IMAGES, 'image-123');
   * console.log('图片记录已删除');
   */
  deleteRecord: async (table: string, id: string) => {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id); // 根据ID匹配要删除的记录
    if (error) throw error;
  },

  /**
   * 提交积分购买请求（等待服务端核验后入账）
   * @param payload 购买请求数据
   */
  createCreditPurchaseRequest: async (payload: {
    userId: string;
    packageId: string;
    provider: string;
    providerPaymentId?: string;
  }) => {
    const { data, error } = await supabase
      .from(TABLES.CREDIT_PURCHASE_REQUESTS)
      .insert({
        user_id: payload.userId,
        package_id: payload.packageId,
        provider: payload.provider,
        provider_payment_id: payload.providerPaymentId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * 核验 Google Play 购买并发放积分（通过 Edge Function）
   */
  verifyGooglePlayPurchase: async (payload: {
    packageName: string;
    productId: string;
    purchaseToken: string;
    orderId?: string;
    userId?: string;
  }) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    let activeSession = sessionData.session ?? null;
    try {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        await supabaseHelpers.logClientEvent('purchase_verify_refresh_error', {
          message: refreshError.message,
        }, 'warn');
      } else if (refreshed.session) {
        activeSession = refreshed.session;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabaseHelpers.logClientEvent('purchase_verify_refresh_exception', {
        message,
      }, 'warn');
    }

    const accessToken = activeSession?.access_token;
    if (!accessToken) {
      throw new Error('Missing auth session. Please sign in again.');
    }

    const jwtClaims = pickJwtDebugClaims(accessToken);
    const projectRef = getProjectRef(supabaseUrl);
    const tokenProjectRef = getProjectRefFromIssuer(jwtClaims?.iss ?? null);
    const tokenProjectMismatch =
      Boolean(projectRef && tokenProjectRef && projectRef !== tokenProjectRef);

    await supabaseHelpers.logClientEvent('purchase_verify_session', {
      hasAccessToken: Boolean(accessToken),
      userId: activeSession?.user?.id ?? null,
      tokenSub: jwtClaims?.sub ?? null,
      tokenIss: jwtClaims?.iss ?? null,
      tokenAud: jwtClaims?.aud ?? null,
      tokenExp: jwtClaims?.exp ?? null,
      tokenProjectRef,
      projectRef,
      tokenProjectMismatch,
      productId: payload.productId,
      packageName: payload.packageName,
      requestUserId: payload.userId ?? null,
      orderId: payload.orderId ?? null,
      purchaseTokenHint: maskTokenHint(payload.purchaseToken),
    });
    if (tokenProjectMismatch) {
      await supabaseHelpers.logClientEvent('purchase_verify_project_mismatch', {
        projectRef,
        tokenProjectRef,
        tokenIss: jwtClaims?.iss ?? null,
      }, 'warn');
    }

    const requestUrl = `${supabaseUrl}/functions/v1/verify-google-play-purchase`;
    const sendRequest = async (token: string) => {
      return await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify(payload),
      });
    };

    let response = await sendRequest(accessToken);

    if (response.status === 401) {
      try {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          await supabaseHelpers.logClientEvent('purchase_verify_retry_failed', {
            message: refreshError.message,
            status: response.status,
          }, 'warn');
        } else if (refreshed.session?.access_token) {
          await supabaseHelpers.logClientEvent('purchase_verify_retry', {
            status: response.status,
            productId: payload.productId,
          }, 'warn');
          response = await sendRequest(refreshed.session.access_token);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await supabaseHelpers.logClientEvent('purchase_verify_retry_exception', {
          message,
          status: response.status,
        }, 'warn');
      }
    }

    const gatewayRequestId =
      response.headers.get('sb-request-id') ||
      response.headers.get('x-request-id') ||
      null;

    const rawText = await response.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      await supabaseHelpers.logClientEvent('purchase_verify_http_error', {
        status: response.status,
        body: data ?? rawText ?? null,
        productId: payload.productId,
        requestId: gatewayRequestId,
      }, 'error');
      if (
        response.status === 401 &&
        data &&
        typeof data === 'object' &&
        'message' in data &&
        String((data as any).message).toLowerCase().includes('invalid jwt')
      ) {
        await supabaseHelpers.logClientEvent('purchase_verify_invalid_jwt', {
          productId: payload.productId,
          tokenProjectRef,
          projectRef,
        }, 'error');
      }
      let message = `Edge Function error (${response.status})`;
      if (data && typeof data === 'object') {
        const err = (data as any).error;
        const msg = (data as any).message;
        if (typeof err === 'string' && typeof msg === 'string') {
          message = `${err}: ${msg}`;
        } else if (typeof msg === 'string') {
          message = msg;
        } else if (typeof err === 'string') {
          message = err;
        }
      }
      throw new Error(message);
    }

    await supabaseHelpers.logClientEvent('purchase_verify_success', {
      status: data?.status ?? null,
      requestId: data?.requestId ?? null,
      gatewayRequestId,
      productId: payload.productId,
    });

    return data as {
      status: 'pending' | 'completed';
      newCredits?: number;
      requestId?: string;
      alreadyProcessed?: boolean;
    };
  },

  /**
   * 获取用户剩余积分（调用后端存储过程确保实时余额）
   * @param userId 用户ID
   * @returns Promise<number> 当前积分余额
   */
  getUserCreditBalance: async (userId: string) => {
    const { data, error } = await supabase.rpc('get_user_credit_balance', {
      user_uuid: userId,
    });
    if (error) throw error;
    return typeof data === 'number' ? data : 0;
  },

  /**
   * 客户端日志上报（用于线上调试）
   */
  logClientEvent: async (
    event: string,
    context: Record<string, unknown> = {},
    level: 'info' | 'warn' | 'error' = 'info'
  ) => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      await supabase.from(TABLES.APP_LOGS).insert({
        event,
        level,
        user_id: session?.user?.id ?? null,
        context,
      });
    } catch (error) {
      if (__DEV__) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[log] client log failed', message);
      }
    }
  },
};
