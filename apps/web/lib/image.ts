'use client';

import { WEB_IMAGE_RULES } from '@miriai/config';
import { translateClientMessage } from '@/lib/i18n/runtime';

export type PreparedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

type DrawableImageSource = HTMLImageElement | ImageBitmap;

export const validateImageFile = (file: File) => {
  if (!WEB_IMAGE_RULES.SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof WEB_IMAGE_RULES.SUPPORTED_IMAGE_TYPES)[number])) {
    throw new Error(translateClientMessage('errors.unsupportedImageFormat'));
  }
  if (file.size > WEB_IMAGE_RULES.MAX_FILE_SIZE) {
    throw new Error(translateClientMessage('errors.fileTooLarge'));
  }
};

const loadImageElement = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(translateClientMessage('errors.failedToLoadImage')));
    img.src = src;
  });

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(translateClientMessage('errors.failedToReadFile')));
    reader.readAsDataURL(file);
  });

const ORIENTATION_TAG = 0x0112;
const JPEG_SOI = 0xffd8;
const EXIF_APP1 = 0xffe1;
const EXIF_HEADER = 0x45786966;
const TIFF_LITTLE_ENDIAN = 0x4949;

const readExifOrientation = (buffer: ArrayBuffer) => {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== JPEG_SOI) {
    return 1;
  }

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;

    if (marker === 0xffda || marker === 0xffd9) {
      break;
    }
    if ((marker & 0xff00) !== 0xff00 || offset + 2 > view.byteLength) {
      break;
    }

    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > view.byteLength) {
      break;
    }

    if (marker === EXIF_APP1 && offset + 8 <= view.byteLength) {
      const exifHeader = view.getUint32(offset + 2, false);
      const exifPadding = view.getUint16(offset + 6, false);
      if (exifHeader === EXIF_HEADER && exifPadding === 0x0000) {
        const tiffOffset = offset + 8;
        const littleEndian = view.getUint16(tiffOffset, false) === TIFF_LITTLE_ENDIAN;
        const readUint16 = (position: number) => view.getUint16(position, littleEndian);
        const readUint32 = (position: number) => view.getUint32(position, littleEndian);

        if (tiffOffset + 8 > view.byteLength || readUint16(tiffOffset + 2) !== 0x002a) {
          return 1;
        }

        const ifdOffset = tiffOffset + readUint32(tiffOffset + 4);
        if (ifdOffset + 2 > view.byteLength) {
          return 1;
        }

        const entryCount = readUint16(ifdOffset);
        for (let index = 0; index < entryCount; index += 1) {
          const entryOffset = ifdOffset + 2 + index * 12;
          if (entryOffset + 12 > view.byteLength) {
            break;
          }
          if (readUint16(entryOffset) === ORIENTATION_TAG) {
            const orientation = readUint16(entryOffset + 8);
            return orientation >= 1 && orientation <= 8 ? orientation : 1;
          }
        }
      }
    }

    offset += segmentLength;
  }

  return 1;
};

const getSourceDimensions = (source: DrawableImageSource) => {
  if ('naturalWidth' in source) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }
  return {
    width: source.width,
    height: source.height,
  };
};

const loadDrawableImage = async (file: File, fallbackSrc: string): Promise<DrawableImageSource> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, {
        imageOrientation: 'none',
      });
    } catch {
      // Fall back to HTMLImageElement below.
    }
  }
  return loadImageElement(fallbackSrc);
};

const releaseDrawableImage = (source: DrawableImageSource) => {
  if ('close' in source) {
    source.close();
  }
};

const applyOrientationTransform = (
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number
) => {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      ctx.transform(1, 0, 0, 1, 0, 0);
      break;
  }
};

export const prepareImage = async (file: File): Promise<PreparedImage> => {
  validateImageFile(file);
  const rawDataUrl = await fileToDataUrl(file);
  const [orientationBuffer, sourceImage] = await Promise.all([
    file.arrayBuffer().catch(() => null),
    loadDrawableImage(file, rawDataUrl),
  ]);
  const orientation = orientationBuffer ? readExifOrientation(orientationBuffer) : 1;
  const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(sourceImage);
  const swapsAxis = orientation >= 5 && orientation <= 8;
  const orientedWidth = swapsAxis ? sourceHeight : sourceWidth;
  const orientedHeight = swapsAxis ? sourceWidth : sourceHeight;

  const maxDim = Math.max(orientedWidth, orientedHeight);
  const minDim = Math.min(orientedWidth, orientedHeight);

  let scale = 1;
  if (maxDim > WEB_IMAGE_RULES.MAX_SIDE) {
    scale = WEB_IMAGE_RULES.MAX_SIDE / maxDim;
  }
  if (minDim * scale < WEB_IMAGE_RULES.MIN_SIDE) {
    scale = Math.max(scale, WEB_IMAGE_RULES.MIN_SIDE / minDim);
  }

  const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
  const targetWidth = swapsAxis ? drawHeight : drawWidth;
  const targetHeight = swapsAxis ? drawWidth : drawHeight;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    releaseDrawableImage(sourceImage);
    throw new Error(translateClientMessage('errors.failedToCreateCanvas'));
  }

  ctx.save();
  applyOrientationTransform(ctx, orientation, drawWidth, drawHeight);
  ctx.drawImage(sourceImage, 0, 0, drawWidth, drawHeight);
  ctx.restore();
  releaseDrawableImage(sourceImage);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

  return {
    dataUrl,
    width: targetWidth,
    height: targetHeight,
  };
};
