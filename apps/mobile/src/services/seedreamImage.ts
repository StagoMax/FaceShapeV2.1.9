import RNFS from 'react-native-fs';
import i18n from '../constants/i18n';
import { Buffer } from 'buffer';
import { supabase, supabaseConfig } from './supabase';
import { DEFAULT_SEEDREAM_MODEL_ALIAS, SEEDREAM_MODEL_ALIASES } from '../constants';
import type { SeedreamModelAlias } from '../types';

type SeedreamRequest = {
  imagePath: string;
  width?: number;
  height?: number;
  size?: string; // e.g., '2K', '1K', or '2048x2048'
};

type SeedreamResult = {
  localPath: string;
  remoteUrl?: string;
  requestId?: string;
  newCredits?: number;
  modelAlias?: SeedreamModelAlias;
};

const SEEDREAM_PROXY_FUNCTION = 'seedream-proxy';

const isSeedreamModelAlias = (value: unknown): value is SeedreamModelAlias =>
  typeof value === 'string' &&
  (SEEDREAM_MODEL_ALIASES as readonly string[]).includes(value);

const getMimeFromPath = (path: string) => {
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
};

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const isDataUrl = (value: string) => value.startsWith('data:image');

const SEEDREAM45_MIN_PIXELS = 2560 * 1440;
const SEEDREAM45_MAX_PIXELS = 4096 * 4096;
const SEEDREAM45_MIN_ASPECT_RATIO = 1 / 16;
const SEEDREAM45_MAX_ASPECT_RATIO = 16;
const SEEDREAM45_DEFAULT_SIZE = '2K';

const isSeedream45PixelSizeValid = (width: number, height: number) => {
  const pixels = width * height;
  const ratio = width / height;
  return (
    pixels >= SEEDREAM45_MIN_PIXELS &&
    pixels <= SEEDREAM45_MAX_PIXELS &&
    ratio >= SEEDREAM45_MIN_ASPECT_RATIO &&
    ratio <= SEEDREAM45_MAX_ASPECT_RATIO
  );
};

const normalizeSeedream45Size = (size?: string, width?: number, height?: number) => {
  const normalized = String(size ?? '').trim();
  if (normalized) {
    const preset = normalized.toUpperCase();
    if (preset === '2K' || preset === '4K') {
      return preset;
    }

    const match = normalized.match(/^(\d{2,5})x(\d{2,5})$/i);
    if (match) {
      const parsedWidth = Number(match[1]);
      const parsedHeight = Number(match[2]);
      if (isSeedream45PixelSizeValid(parsedWidth, parsedHeight)) {
        return `${parsedWidth}x${parsedHeight}`;
      }
    }
  }

  if (width && height) {
    const parsedWidth = Math.max(1, Math.round(width));
    const parsedHeight = Math.max(1, Math.round(height));
    if (isSeedream45PixelSizeValid(parsedWidth, parsedHeight)) {
      return `${parsedWidth}x${parsedHeight}`;
    }
  }

  return SEEDREAM45_DEFAULT_SIZE;
};

async function readImageAsDataUrl(path: string): Promise<string> {
  if (isDataUrl(path)) return path;
  if (isHttpUrl(path)) return path;
  const normalized = path.startsWith('file://') ? path.replace('file://', '') : path;
  const base64 = await RNFS.readFile(normalized, 'base64');
  const mime = getMimeFromPath(path.toLowerCase());
  return `data:${mime};base64,${base64}`;
}

async function downloadToCache(image: string): Promise<string> {
  const fileName = `seedream-${Date.now()}.png`;
  const targetPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

  if (isDataUrl(image)) {
    const base64 = image.split(',')[1] || '';
    await RNFS.writeFile(targetPath, base64, 'base64');
    return `file://${targetPath}`;
  }

  if (isHttpUrl(image)) {
    const maxAttempts = 3;
    const timeoutMs = 120000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      console.log('[Seedream][download-start]', { attempt, url: image });
      try {
        const resp = await fetch(image, { method: 'GET', signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok) {
          console.warn('[Seedream][download-fail]', { attempt, status: resp.status });
          if (attempt === maxAttempts) {
            throw new Error(i18n.t('errors.seedreamDownloadFailed', { status: resp.status }));
          }
          continue;
        }
        const arrayBuffer = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await RNFS.writeFile(targetPath, buffer.toString('base64'), 'base64');
        return `file://${targetPath}`;
      } catch (err: any) {
        clearTimeout(timeout);
        console.warn('[Seedream][download-error]', { attempt, message: err?.message || String(err) });
        if (attempt === maxAttempts) {
          throw new Error(
            i18n.t('errors.seedreamDownloadFailedWithMessage', { message: err?.message || err })
          );
        }
      }
    }
    throw new Error(i18n.t('errors.seedreamDownloadFailedUnknown'));
  }

  throw new Error(i18n.t('errors.seedreamUnsupportedImageUrl'));
}

export async function callSeedreamImage(request: SeedreamRequest): Promise<SeedreamResult> {
  const t0 = Date.now();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error(i18n.t('errors.seedreamLoginRequired'));
  }
  const normalizedPath = request.imagePath.startsWith('file://')
    ? request.imagePath.replace('file://', '')
    : request.imagePath;
  let fileStat: RNFS.StatResult | undefined;
  try {
    if (!isHttpUrl(request.imagePath) && !isDataUrl(request.imagePath)) {
      fileStat = await RNFS.stat(normalizedPath);
    }
  } catch (statErr) {
    console.warn('[Seedream] stat failed', statErr);
  }

  const tEncodeStart = Date.now();
  const imageData = await readImageAsDataUrl(request.imagePath);
  const encodeMs = Date.now() - tEncodeStart;
  const base64Part = isDataUrl(imageData) ? imageData.split(',')[1] || '' : '';
  const payloadBytes = base64Part ? Math.floor((base64Part.length * 3) / 4) : undefined;
  const pixelCount =
    request.width && request.height ? Math.round(request.width * request.height) : undefined;
  console.log('[Seedream][image-meta]', {
    path: request.imagePath,
    mime: getMimeFromPath(request.imagePath.toLowerCase()),
    width: request.width,
    height: request.height,
    sizeBytes: fileStat?.size,
    sizeMB: fileStat?.size ? Number((fileStat.size / 1024 / 1024).toFixed(2)) : undefined,
    base64KB: payloadBytes ? Math.round(payloadBytes / 1024) : undefined,
    pixelCount,
    encodeMs,
  });

  const sizeString = normalizeSeedream45Size(request.size, request.width, request.height);

  console.log('[Seedream][proxy] request', {
    model: 'server_profile',
    requestedSize: request.size,
    size: sizeString,
  });

  const callProxy = async (token: string) => {
    const resp = await fetch(`${supabaseConfig.url}/functions/v1/${SEEDREAM_PROXY_FUNCTION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: supabaseConfig.anonKey,
      },
      body: JSON.stringify({
        image: imageData,
        size: sizeString,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.warn('[Seedream][proxy] error', {
        status: resp.status,
        error: json?.error,
        message: json?.message,
        detail: json?.detail,
      });
      const errorCode = json?.error || `HTTP ${resp.status}`;
      const detail = json?.detail || json?.message;
      const message = detail && detail !== errorCode ? `${errorCode}: ${detail}` : errorCode;
      throw Object.assign(new Error(message), {
        status: resp.status,
        code: json?.error,
        detail,
      });
    }
    return json as { b64?: string; url?: string; newCredits?: number; modelAlias?: string };
  };

  let proxyResult: { b64?: string; url?: string; newCredits?: number; modelAlias?: string };
  try {
    proxyResult = await callProxy(accessToken);
  } catch (err: any) {
    if (err?.code === 'insufficient_credits') {
      throw err;
    }
    if (err?.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = refreshed.data.session?.access_token;
      if (refreshedToken) {
        try {
          proxyResult = await callProxy(refreshedToken);
        } catch (refreshErr: any) {
          if (refreshErr?.status === 401) {
            throw new Error(i18n.t('errors.seedreamAuthFailed'));
          }
          throw refreshErr;
        }
      } else {
        throw new Error(i18n.t('errors.seedreamLoginRequired'));
      }
    } else {
      throw new Error(
        i18n.t('errors.seedreamCallFailed', { message: err?.message || 'unknown error' })
      );
    }
  }

  const imageB64: string | undefined = proxyResult?.b64;
  const imageUrl: string | undefined = proxyResult?.url;
  const newCredits = typeof proxyResult?.newCredits === 'number'
    ? proxyResult.newCredits
    : undefined;
  const modelAlias = isSeedreamModelAlias(proxyResult?.modelAlias)
    ? proxyResult.modelAlias
    : DEFAULT_SEEDREAM_MODEL_ALIAS;
  const imagePayload = imageB64 ? `data:image/jpeg;base64,${imageB64}` : imageUrl;

  if (!imagePayload) {
    throw new Error(i18n.t('errors.seedreamNoImage'));
  }

  const localPath = await downloadToCache(imagePayload);
  let returnedSizeBytes: number | undefined;
  try {
    const stat = await RNFS.stat(localPath.replace('file://', ''));
    returnedSizeBytes = stat.size;
  } catch (e) {}
  const tEnd = Date.now();
  console.log('[Seedream][proxy] done', {
    localPath,
    remoteUrl: imageUrl,
    returnedSizeBytes,
    totalMs: tEnd - t0,
  });

  return {
    localPath,
    remoteUrl: imageUrl,
    newCredits,
    modelAlias,
  };
}
