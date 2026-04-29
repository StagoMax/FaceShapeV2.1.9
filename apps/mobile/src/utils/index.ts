import { Dimensions, Platform, PixelRatio } from 'react-native';
import { API_CONFIG, ERROR_MESSAGES } from '../constants';

// Device utilities
export const deviceUtils = {
  // Get screen dimensions
  getScreenDimensions: () => {
    const { width, height } = Dimensions.get('screen');
    return { width, height };
  },
  
  // Get window dimensions
  getWindowDimensions: () => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  },
  
  // Check if device is tablet
  isTablet: () => {
    const { width, height } = Dimensions.get('screen');
    const aspectRatio = height / width;
    return Math.min(width, height) >= 600 && (aspectRatio < 1.6);
  },
  
  // Get pixel density
  getPixelRatio: () => PixelRatio.get(),
  
  // Check platform
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  
  // Get safe area insets (basic implementation)
  getSafeAreaInsets: () => {
    // This is a basic implementation
    // In a real app, you'd use react-native-safe-area-context
    return {
      top: Platform.OS === 'ios' ? 44 : 0,
      bottom: Platform.OS === 'ios' ? 34 : 0,
      left: 0,
      right: 0,
    };
  },
};

// String utilities
export const stringUtils = {
  // Capitalize first letter
  capitalize: (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },
  
  // Truncate string
  truncate: (str: string, maxLength: number, suffix = '...'): string => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  },
  
  // Generate random string
  generateRandomString: (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
  
  // Validate email
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  // Format file size
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
};

// Number utilities
export const numberUtils = {
  // Clamp number between min and max
  clamp: (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  },
  
  // Round to decimal places
  roundTo: (value: number, decimals: number): number => {
    return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
  },
  
  // Generate random number between min and max
  randomBetween: (min: number, max: number): number => {
    return Math.random() * (max - min) + min;
  },
  
  // Convert degrees to radians
  degToRad: (degrees: number): number => {
    return degrees * (Math.PI / 180);
  },
  
  // Convert radians to degrees
  radToDeg: (radians: number): number => {
    return radians * (180 / Math.PI);
  },
  
  // Format number with commas
  formatWithCommas: (num: number): string => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },
};

// Date utilities
export const dateUtils = {
  // Format date to string
  formatDate: (date: Date, format = 'YYYY-MM-DD'): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year.toString())
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },
  
  // Get relative time (e.g., "2 hours ago")
  getRelativeTime: (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  },
  
  // Check if date is today
  isToday: (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  },
  
  // Add days to date
  addDays: (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  },
};

// Color utilities
export const colorUtils = {
  // Convert hex to RGB
  hexToRgb: (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },
  
  // Convert RGB to hex
  rgbToHex: (r: number, g: number, b: number): string => {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  },
  
  // Get contrasting color (black or white)
  getContrastColor: (hexColor: string): string => {
    const rgb = colorUtils.hexToRgb(hexColor);
    if (!rgb) return '#000000';
    
    // Calculate luminance
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  },
  
  // Add alpha to hex color
  addAlpha: (hexColor: string, alpha: number): string => {
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');
    return hexColor + alphaHex;
  },
};

// File utilities
export const fileUtils = {
  // Get file extension
  getFileExtension: (filename: string): string => {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
  },
  
  // Get filename without extension
  getFilenameWithoutExtension: (filename: string): string => {
    return filename.replace(/\.[^/.]+$/, '');
  },
  
  // Validate file size
  isValidFileSize: (fileSize: number): boolean => {
    return fileSize <= API_CONFIG.MAX_FILE_SIZE;
  },
  
  // Validate file type
  isValidImageType: (mimeType: string): boolean => {
    return API_CONFIG.SUPPORTED_IMAGE_TYPES.includes(mimeType);
  },
  
  // Generate unique filename
  generateUniqueFilename: (originalName: string): string => {
    const extension = fileUtils.getFileExtension(originalName);
    const timestamp = Date.now();
    const random = stringUtils.generateRandomString(6);
    return `${timestamp}_${random}.${extension}`;
  },
};

// Canvas utilities
export const canvasUtils = {
  // Calculate distance between two points
  getDistance: (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  },
  
  // Calculate angle between two points
  getAngle: (x1: number, y1: number, x2: number, y2: number): number => {
    return Math.atan2(y2 - y1, x2 - x1);
  },
  
  // Simplify stroke path (Douglas-Peucker algorithm)
  simplifyPath: (points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] => {
    if (points.length <= 2) return points;
    
    const simplify = (pts: { x: number; y: number }[], tol: number): { x: number; y: number }[] => {
      if (pts.length <= 2) return pts;
      
      let maxDistance = 0;
      let maxIndex = 0;
      
      for (let i = 1; i < pts.length - 1; i++) {
        const distance = getPerpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
        if (distance > maxDistance) {
          maxDistance = distance;
          maxIndex = i;
        }
      }
      
      if (maxDistance > tol) {
        const left = simplify(pts.slice(0, maxIndex + 1), tol);
        const right = simplify(pts.slice(maxIndex), tol);
        return left.slice(0, -1).concat(right);
      } else {
        return [pts[0], pts[pts.length - 1]];
      }
    };
    
    const getPerpendicularDistance = (
      point: { x: number; y: number },
      lineStart: { x: number; y: number },
      lineEnd: { x: number; y: number }
    ): number => {
      const A = point.x - lineStart.x;
      const B = point.y - lineStart.y;
      const C = lineEnd.x - lineStart.x;
      const D = lineEnd.y - lineStart.y;
      
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      
      if (lenSq === 0) return Math.sqrt(A * A + B * B);
      
      const param = dot / lenSq;
      
      let xx: number, yy: number;
      
      if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
      } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
      } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
      }
      
      const dx = point.x - xx;
      const dy = point.y - yy;
      return Math.sqrt(dx * dx + dy * dy);
    };
    
    return simplify(points, tolerance);
  },
  
  // Convert screen coordinates to canvas coordinates
  screenToCanvas: (
    screenX: number,
    screenY: number,
    canvasOffset: { x: number; y: number },
    canvasScale: number
  ): { x: number; y: number } => {
    return {
      x: (screenX - canvasOffset.x) / canvasScale,
      y: (screenY - canvasOffset.y) / canvasScale,
    };
  },
  
  // Convert canvas coordinates to screen coordinates
  canvasToScreen: (
    canvasX: number,
    canvasY: number,
    canvasOffset: { x: number; y: number },
    canvasScale: number
  ): { x: number; y: number } => {
    return {
      x: canvasX * canvasScale + canvasOffset.x,
      y: canvasY * canvasScale + canvasOffset.y,
    };
  },
};

// Error handling utilities
export const errorUtils = {
  // Get user-friendly error message
  getErrorMessage: (error: any): string => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error?.message) return error.error.message;
    return ERROR_MESSAGES.UNKNOWN_ERROR;
  },
  
  // Check if error is network related
  isNetworkError: (error: any): boolean => {
    const message = errorUtils.getErrorMessage(error).toLowerCase();
    return message.includes('network') || 
           message.includes('connection') || 
           message.includes('timeout') || 
           message.includes('fetch');
  },
  
  // Log error (in production, this would send to crash reporting service)
  logError: (error: any, context?: string): void => {
    if (__DEV__) {
      console.error('Error:', error);
      if (context) console.error('Context:', context);
    }
    // In production, send to crash reporting service like Crashlytics
  },
};

// Async utilities
export const asyncUtils = {
  // Delay execution
  delay: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Retry async function
  retry: async <T>(
    fn: () => Promise<T>,
    maxRetries: number = API_CONFIG.MAX_RETRIES,
    delayMs: number = API_CONFIG.RETRY_DELAY
  ): Promise<T> => {
    let lastError: any;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxRetries) {
          await asyncUtils.delay(delayMs * Math.pow(2, i)); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  },
  
  // Timeout promise
  timeout: <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), ms)
      )
    ]);
  },
};

// Validation utilities
export const validationUtils = {
  // Validate required field
  required: (value: any): boolean => {
    return value !== null && value !== undefined && value !== '';
  },
  
  // Validate minimum length
  minLength: (value: string, min: number): boolean => {
    return value.length >= min;
  },
  
  // Validate maximum length
  maxLength: (value: string, max: number): boolean => {
    return value.length <= max;
  },
  
  // Validate password strength
  isStrongPassword: (password: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  },
};