import * as FileSystem from 'expo-file-system';
import { deleteAsync } from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface DownscaledImage {
  uri: string;
  width: number;
  height: number;
  cleanup: () => Promise<void>;
}

export const createDownscaledCopy = async (
  sourceUri: string,
  options: {
    maxDimension: number;
    compress?: number;
    allowSkipIfSmaller?: boolean;
  },
): Promise<DownscaledImage> => {
  const { maxDimension, compress = 0.9, allowSkipIfSmaller = true } = options;

  const { width = 0, height = 0 } = await new Promise<{ width: number; height: number } | null>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { Image } = require('react-native');
    Image.getSize(sourceUri, (w: number, h: number) => resolve({ width: w, height: h }), () => resolve(null));
  }) ?? { width: 0, height: 0 };

  if (
    allowSkipIfSmaller &&
    width > 0 &&
    height > 0 &&
    Math.max(width, height) <= maxDimension
  ) {
    return {
      uri: sourceUri,
      width,
      height,
      cleanup: async () => {},
    };
  }

  const manipulationActions = (() => {
    if (!width || !height) {
      return [{ resize: { width: maxDimension } }];
    }
    if (width >= height) {
      return [{ resize: { width: maxDimension } }];
    }
    return [{ resize: { height: maxDimension } }];
  })();

  const result = await manipulateAsync(
    sourceUri,
    manipulationActions,
    {
      compress,
      base64: false,
      format: SaveFormat.JPEG,
    }
  );

  if (!result.uri) {
    throw new Error('Failed to create downscaled image copy');
  }

  const cleanup = async () => {
    if (result.uri && result.uri !== sourceUri) {
      await deleteAsync(result.uri, { idempotent: true }).catch(() => {});
    }
  };

  return {
    uri: result.uri,
    width: result.width ?? width,
    height: result.height ?? height,
    cleanup,
  };
};
