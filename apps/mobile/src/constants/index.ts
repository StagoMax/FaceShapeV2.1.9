// App Constants
export const APP_CONFIG = {
  NAME: 'Miri',
  VERSION: '2.1.8',
  BUNDLE_ID: 'app.miriai.miri',
};

export const AUTH_CONFIG = {
  WEB_CONFIRM_URL: 'https://www.miriai.app/auth/confirm',
  APP_SCHEME: 'miri',
  APP_CALLBACK_PATH: 'auth/callback',
} as const;

export const LEGAL_VERSIONS = {
  PRIVACY_POLICY: '2026-01-19',
  TERMS_OF_SERVICE: '2026-01-19',
} as const;

export const SEEDREAM_MODEL_ALIASES = ['seedream-5.0-lite'] as const;
export const DEFAULT_SEEDREAM_MODEL_ALIAS = 'seedream-5.0-lite' as const;

// Colors
export const COLORS = {
  // Primary colors
  PRIMARY: '#007AFF',
  PRIMARY_DARK: '#0056CC',
  PRIMARY_LIGHT: '#4DA2FF',
  
  // Secondary colors
  SECONDARY: '#FF3B30',
  SECONDARY_DARK: '#D70015',
  SECONDARY_LIGHT: '#FF6B60',
  
  // Neutral colors
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  GRAY_100: '#F2F2F7',
  GRAY_200: '#E5E5EA',
  GRAY_300: '#D1D1D6',
  GRAY_400: '#C7C7CC',
  GRAY_500: '#AEAEB2',
  GRAY_600: '#8E8E93',
  GRAY_700: '#636366',
  GRAY_800: '#48484A',
  GRAY_900: '#1C1C1E',
  
  // Status colors
  SUCCESS: '#34C759',
  SUCCESS_LIGHT: '#D1F2DF',
  WARNING: '#FF9500',
  ERROR: '#FF3B30',
  INFO: '#007AFF',
  ACCENT: '#FF6B35',
  
  // Background colors
  BACKGROUND: '#F2F2F7',
  SURFACE: '#FFFFFF',
  CARD: '#FFFFFF',
  BORDER: '#E5E5EA',
  
  // Text colors
  TEXT_PRIMARY: '#1C1C1E',
  TEXT_SECONDARY: '#8E8E93',
  TEXT_TERTIARY: '#C7C7CC',
  TEXT_INVERSE: '#FFFFFF',
  
  // Canvas colors
  CANVAS_BACKGROUND: '#FFFFFF',
  CANVAS_GRID: '#E5E5EA',
  
  // Brush colors
  BRUSH_COLORS: [
    '#FF0000', // Red
    '#00FF00', // Green
    '#0000FF', // Blue
    '#FFFF00', // Yellow
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#FFA500', // Orange
    '#800080', // Purple
    '#FFC0CB', // Pink
    '#A52A2A', // Brown
    '#000000', // Black
    '#FFFFFF', // White
  ],
};

// Dimensions
export const DIMENSIONS = {
  // Screen padding
  SCREEN_PADDING: 16,
  SCREEN_PADDING_HORIZONTAL: 20,
  SCREEN_PADDING_VERTICAL: 16,
  
  // Component spacing
  SPACING_XS: 4,
  SPACING_SM: 8,
  SPACING_MD: 16,
  SPACING_LG: 24,
  SPACING_XL: 32,
  
  // Border radius
  BORDER_RADIUS_SM: 4,
  BORDER_RADIUS_MD: 8,
  BORDER_RADIUS_LG: 12,
  BORDER_RADIUS_XL: 16,
  BORDER_RADIUS_ROUND: 50,
  
  // Button dimensions
  BUTTON_HEIGHT: 48,
  BUTTON_HEIGHT_SM: 36,
  BUTTON_HEIGHT_LG: 56,
  
  // Input dimensions
  INPUT_HEIGHT: 48,
  
  // Icon sizes
  ICON_SIZE_SM: 16,
  ICON_SIZE_MD: 24,
  ICON_SIZE_LG: 32,
  ICON_SIZE_XL: 48,
  
  // Canvas dimensions
  CANVAS_MIN_SIZE: 200,
  CANVAS_MAX_SIZE: 2000,
  
  // Brush sizes
  BRUSH_SIZE_MIN: 1,
  BRUSH_SIZE_MAX: 100,
  BRUSH_SIZE_DEFAULT: 15,
  
  // Header height
  HEADER_HEIGHT: 56,
  
  // Tab bar height
  TAB_BAR_HEIGHT: 80,
};

// Typography
export const TYPOGRAPHY = {
  // Font families
  FONT_FAMILY_REGULAR: 'System',
  FONT_FAMILY_MEDIUM: 'System',
  FONT_FAMILY_BOLD: 'System',
  
  // Font sizes
  FONT_SIZE_XS: 12,
  FONT_SIZE_SM: 14,
  FONT_SIZE_MD: 16,
  FONT_SIZE_LG: 18,
  FONT_SIZE_XL: 20,
  FONT_SIZE_XXL: 24,
  FONT_SIZE_XXXL: 32,
  
  // Line heights
  LINE_HEIGHT_XS: 16,
  LINE_HEIGHT_SM: 20,
  LINE_HEIGHT_MD: 24,
  LINE_HEIGHT_LG: 28,
  LINE_HEIGHT_XL: 32,
  LINE_HEIGHT_XXL: 36,
  LINE_HEIGHT_XXXL: 40,
  
  // Font weights
  FONT_WEIGHT_REGULAR: '400' as const,
  FONT_WEIGHT_MEDIUM: '500' as const,
  FONT_WEIGHT_SEMIBOLD: '600' as const,
  FONT_WEIGHT_BOLD: '700' as const,
};

// Animation durations
export const ANIMATION = {
  DURATION_FAST: 150,
  DURATION_NORMAL: 300,
  DURATION_SLOW: 500,
  
  // Easing functions
  EASING_IN: 'ease-in',
  EASING_OUT: 'ease-out',
  EASING_IN_OUT: 'ease-in-out',
};

// API Configuration
export const API_CONFIG = {
  // Timeouts
  TIMEOUT_DEFAULT: 30000, // 30 seconds
  TIMEOUT_UPLOAD: 120000, // 2 minutes
  TIMEOUT_AI_PROCESSING: 180000, // 3 minutes
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  
  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  
  // AI processing limits
  MAX_PROMPT_LENGTH: 500,
  MAX_CONCURRENT_REQUESTS: 3,
};

// Canvas Configuration
export const CANVAS_CONFIG = {
  // Default canvas size
  DEFAULT_WIDTH: 800,
  DEFAULT_HEIGHT: 600,
  
  // Zoom limits
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5.0,
  ZOOM_STEP: 0.1,
  
  // Grid settings
  GRID_SIZE: 20,
  SHOW_GRID: false,
  
  // Performance settings
  MAX_UNDO_STEPS: 50,
  STROKE_SIMPLIFICATION_TOLERANCE: 2,
  
  // Touch settings
  TOUCH_SLOP: 8, // Minimum distance to start drawing
  DOUBLE_TAP_DELAY: 300,
};

// Navigation Routes
export const ROUTES = {
  // Auth screens
  LOGIN: 'Login',
  REGISTER: 'Register',
  FORGOT_PASSWORD: 'ForgotPassword',
  AUTH_CONFIRM: 'AuthConfirm',
  AUTH_CALLBACK: 'AuthCallback',
  
  // Main screens
  HOME: 'Home',
  EDITOR: 'Editor',
  DRAWING: 'Drawing',
  PROFILE: 'Profile',
  SETTINGS: 'Settings',
  PRIVACY_POLICY: 'PrivacyPolicy',
  TERMS_OF_SERVICE: 'TermsOfService',
  PURCHASE: 'Purchase',
  
  // Modal screens
  IMAGE_PICKER: 'ImagePicker',
  BRUSH_SETTINGS: 'BrushSettings',
  AI_PROMPT: 'AIPrompt',
  CREDITS: 'Credits',
  
  // Tab navigator
  MAIN_TABS: 'MainTabs',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  USER_TOKEN: '@user_token',
  USER_DATA: '@user_data',
  APP_SETTINGS: '@app_settings',
  CANVAS_SETTINGS: '@canvas_settings',
  RECENT_COLORS: '@recent_colors',
  ONBOARDING_COMPLETED: '@onboarding_completed',
  EDITOR_TUTORIAL_COMPLETED: '@editor_tutorial_completed',
  AI_LEGAL_CONSENT: '@ai_legal_consent',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Network errors
  NETWORK_ERROR: 'Network connection error. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timeout. Please try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  
  // Auth errors
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  WEAK_PASSWORD: 'Password must be at least 8 characters long.',
  
  // File errors
  FILE_TOO_LARGE: 'File size exceeds the maximum limit of 10MB.',
  UNSUPPORTED_FILE_TYPE: 'Unsupported file type. Please use JPEG, PNG, or WebP.',
  UPLOAD_FAILED: 'Failed to upload image. Please try again.',
  
  // AI processing errors
  AI_PROCESSING_FAILED: 'AI processing failed. Please try again.',
  PROMPT_TOO_LONG: 'Prompt is too long. Please keep it under 500 characters.',
  INSUFFICIENT_CREDITS: 'Insufficient credits. Please purchase more credits.',
  
  // Canvas errors
  CANVAS_SAVE_FAILED: 'Failed to save canvas. Please try again.',
  CANVAS_LOAD_FAILED: 'Failed to load canvas. Please try again.',
  
  // General errors
  UNKNOWN_ERROR: 'An unknown error occurred. Please try again.',
  PERMISSION_DENIED: 'Permission denied. Please check your permissions.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  IMAGE_UPLOADED: 'Image uploaded successfully!',
  IMAGE_PROCESSED: 'Image processed successfully!',
  CANVAS_SAVED: 'Canvas saved successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
  CREDITS_PURCHASED: 'Credits purchased successfully!',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_AI_PROCESSING: true,
  ENABLE_IN_APP_PURCHASES: true,
  ENABLE_SOCIAL_SHARING: true,
  ENABLE_CLOUD_SYNC: true,
  ENABLE_ANALYTICS: true,
  ENABLE_CRASH_REPORTING: true,
  ENABLE_BETA_FEATURES: false,
  ENABLE_NATIVE_LIQUIFY_ANDROID: true,
  // 调试用：是否启用 Seedream 生成流程（当前默认关闭，避免选图时触发网络请求）
  ENABLE_SEEDREAM_LINE_ART: false,
} as const;

// Credit System
export const CREDITS = {
  // AI processing costs
  AI_EDIT_COST: 1,
  PREMIUM_FILTER_COST: 2,
  BATCH_PROCESSING_COST: 5,
  
  // Feature costs
  COSTS: {
    AI_EDIT: 1,
    SAVE_RESULT: 1,
    IMAGE_UPLOAD: 0,
    PREMIUM_FILTER: 2,
    BATCH_PROCESSING: 5,
  },

  // Credit packages
  PACKAGES: [
    { id: 'credits_10', credits: 10, price: 0.99 },
    { id: 'credits_50', credits: 50, price: 3.99, popular: true },
    { id: 'credits_150', credits: 150, price: 9.99 },
    { id: 'credits_400', credits: 400, price: 19.99 },
  ],

  // Free credits
  DAILY_FREE_CREDITS: 3,
  SIGNUP_BONUS_CREDITS: 0,
} as const;
