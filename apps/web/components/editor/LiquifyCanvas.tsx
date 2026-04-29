'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LiquifyEngine, type LiquifyToolType } from '@miriai/api';
import type { EditorDisplacementSnapshot } from '@/lib/editorSession';
import { WebGLLiquifyRenderer } from './webglLiquifyRenderer';

type LiquifyTool = Extract<LiquifyToolType, 'push' | 'restore'>;

type MeshSnapshot = EditorDisplacementSnapshot;

type Point = { x: number; y: number };
type ZoomAnchor = {
  clientX: number;
  clientY: number;
  offsetX: number;
  offsetY: number;
  relativeX: number;
  relativeY: number;
};
type RenderQuality = 'preview' | 'full';
type DirtyRect = { left: number; top: number; right: number; bottom: number };
type RenderRequest = { quality?: RenderQuality; emitOutput?: boolean; dirtyRect?: DirtyRect | null };
type WorkerSourceQuality = 'full' | 'preview';
type BrushIndicatorRequest = { clientX: number; clientY: number; pointerType?: string };
type RenderSourceQuality = 'full' | 'preview';

type LiquifyWorkerResponse = {
  type: 'renderResult';
  requestId: number;
  quality: WorkerSourceQuality;
  width: number;
  height: number;
  pixels: ArrayBuffer;
};

export interface LiquifyCanvasHandle {
  undo: () => void;
  redo: () => void;
  reset: () => void;
  exportDataUrl: () => string | null;
  exportOpenAiImageDataUrl: () => string | null;
  exportGenerateDataUrl: () => string | null;
  exportGenerateMaskDataUrl: () => string | null;
  exportSession: () => EditorDisplacementSnapshot | null;
  hasLiquifyChanges: () => boolean;
}

type LiquifyCanvasProps = {
  comparisonImageDataUrl?: string | null;
  imageDataUrl: string | null;
  tool: LiquifyTool;
  brushSize: number;
  strength?: number;
  zoom?: number;
  onWheelZoom?: (delta: number) => void;
  onSuggestInitialZoom?: (zoom: number) => void;
  showOriginal: boolean;
  initialDisplacement?: EditorDisplacementSnapshot | null;
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onOutputChange?: (dataUrl: string | null) => void;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const PREVIEW_MAX_EDGE = 1024;
const WEB_MESH_TARGET_CELL_PX = 8;
const WEB_MESH_MIN_DENSITY = 96;
const WEB_MESH_MAX_DENSITY = 192;
const WEB_ENGINE_CONFIG = {
  maxMagnitude: 0.6,
  falloff: 0.5,
  smoothingIterations: 1,
  smoothingStrength: 0.35,
} as const;

const computeWebMeshResolution = (width: number, height: number) => {
  const density = clamp(
    Math.round(Math.max(width, height) / WEB_MESH_TARGET_CELL_PX),
    WEB_MESH_MIN_DENSITY,
    WEB_MESH_MAX_DENSITY
  );
  return { cols: density, rows: density };
};

const mergeDirtyRect = (a: DirtyRect | null, b: DirtyRect | null): DirtyRect | null => {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
};

const toNormalizedDirtyRect = (
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number
): DirtyRect | null => {
  if (width <= 0 || height <= 0) {
    return null;
  }
  const normalized: DirtyRect = {
    left: clamp(left / width, 0, 1),
    top: clamp(top / height, 0, 1),
    right: clamp(right / width, 0, 1),
    bottom: clamp(bottom / height, 0, 1),
  };
  if (normalized.right <= normalized.left || normalized.bottom <= normalized.top) {
    return null;
  }
  return normalized;
};

const createEmptyImageData = (width: number, height: number) => {
  return new ImageData(width, height);
};

const createDetachedCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const imageDataToCanvas = (imageData: ImageData) => {
  const canvas = createDetachedCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

const canvasToImageData = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const drawCanvasToCanvas = (
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  destWidth: number,
  destHeight: number,
  flipY = false
) => {
  ctx.save();
  if (flipY) {
    ctx.scale(1, -1);
    ctx.drawImage(sourceCanvas, 0, -destHeight, destWidth, destHeight);
  } else {
    ctx.drawImage(sourceCanvas, 0, 0, destWidth, destHeight);
  }
  ctx.restore();
};

const createGrayscaleImageData = (source: ImageData) => {
  const output = createEmptyImageData(source.width, source.height);
  const src = source.data;
  const dst = output.data;
  for (let i = 0; i < src.length; i += 4) {
    const gray = Math.round(src[i] * 0.2126 + src[i + 1] * 0.7152 + src[i + 2] * 0.0722);
    dst[i] = gray;
    dst[i + 1] = gray;
    dst[i + 2] = gray;
    dst[i + 3] = src[i + 3];
  }
  return output;
};

const sampleBilinear = (data: Uint8ClampedArray, width: number, height: number, x: number, y: number) => {
  const x0 = clamp(Math.floor(x), 0, width - 1);
  const y0 = clamp(Math.floor(y), 0, height - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);

  const fx = x - x0;
  const fy = y - y0;

  const idx = (px: number, py: number) => (py * width + px) * 4;

  const i00 = idx(x0, y0);
  const i10 = idx(x1, y0);
  const i01 = idx(x0, y1);
  const i11 = idx(x1, y1);

  const r =
    data[i00] * (1 - fx) * (1 - fy) +
    data[i10] * fx * (1 - fy) +
    data[i01] * (1 - fx) * fy +
    data[i11] * fx * fy;
  const g =
    data[i00 + 1] * (1 - fx) * (1 - fy) +
    data[i10 + 1] * fx * (1 - fy) +
    data[i01 + 1] * (1 - fx) * fy +
    data[i11 + 1] * fx * fy;
  const b =
    data[i00 + 2] * (1 - fx) * (1 - fy) +
    data[i10 + 2] * fx * (1 - fy) +
    data[i01 + 2] * (1 - fx) * fy +
    data[i11 + 2] * fx * fy;
  const a =
    data[i00 + 3] * (1 - fx) * (1 - fy) +
    data[i10 + 3] * fx * (1 - fy) +
    data[i01 + 3] * (1 - fx) * fy +
    data[i11 + 3] * fx * fy;

  return [r, g, b, a] as const;
};

const cloneSnapshot = (engine: LiquifyEngine): MeshSnapshot => {
  const mesh = engine.exportDisplacement();
  return {
    cols: mesh.cols,
    rows: mesh.rows,
    deformX: new Float32Array(mesh.deformX),
    deformY: new Float32Array(mesh.deformY),
  };
};

const hasVisibleDisplacement = (
  mesh: ReturnType<LiquifyEngine['exportDisplacement']>,
  width: number,
  height: number
) => {
  const { deformX, deformY } = mesh;
  for (let i = 0; i < deformX.length; i += 1) {
    if (Math.hypot(deformX[i] * width, deformY[i] * height) > 0.01) {
      return true;
    }
  }
  return false;
};

const LiquifyCanvas = forwardRef<LiquifyCanvasHandle, LiquifyCanvasProps>(function LiquifyCanvas(
  {
    comparisonImageDataUrl = null,
    imageDataUrl,
    tool,
    brushSize,
    strength = 1,
    zoom = 1,
    onWheelZoom,
    onSuggestInitialZoom,
    showOriginal,
    initialDisplacement = null,
    onHistoryChange,
    onOutputChange,
  },
  ref
) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const userPannedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewDisplayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const brushIndicatorRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const sourcePixelsRef = useRef<ImageData | null>(null);
  const fullOutputPixelsRef = useRef<ImageData | null>(null);
  const previewSourcePixelsRef = useRef<ImageData | null>(null);
  const previewOutputPixelsRef = useRef<ImageData | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglRendererRef = useRef<Record<RenderSourceQuality, WebGLLiquifyRenderer | null>>({
    full: null,
    preview: null,
  });
  const webglFailedRef = useRef(false);
  const renderRafRef = useRef<number | null>(null);
  const pendingRenderRef = useRef<{ quality: RenderQuality; emitOutput: boolean; dirtyRect: DirtyRect | null }>({
    quality: 'preview',
    emitOutput: false,
    dirtyRect: null,
  });
  const renderWorkerRef = useRef<Worker | null>(null);
  const workerRequestIdRef = useRef(0);
  const latestWorkerRequestIdRef = useRef(0);
  const workerBusyRef = useRef(false);
  const queuedWorkerRenderRef = useRef<
    { quality: RenderQuality; emitOutput: boolean; dirtyRect: DirtyRect | null } | null
  >(null);
  const workerPendingMetaRef = useRef<
    Map<number, { quality: RenderQuality; emitOutput: boolean }>
  >(new Map());
  const pointerDownRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const queuedStrokePointRef = useRef<Point | null>(null);
  const strokeFrameRef = useRef<number | null>(null);
  const strokeDirtyRef = useRef(false);
  const lastBrushClientRef = useRef<Point | null>(null);
  const brushVisibleRef = useRef(false);
  const queuedBrushIndicatorRef = useRef<BrushIndicatorRequest | null>(null);
  const brushIndicatorFrameRef = useRef<number | null>(null);

  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const panPointerIdRef = useRef<number | null>(null);
  const panStartRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);

  const engineRef = useRef(
    new LiquifyEngine({
      cols: WEB_MESH_MIN_DENSITY,
      rows: WEB_MESH_MIN_DENSITY,
      ...WEB_ENGINE_CONFIG,
    })
  );

  const historyRef = useRef<MeshSnapshot[]>([]);
  const historyIndexRef = useRef(0);
  const onHistoryChangeRef = useRef(onHistoryChange);
  const onOutputChangeRef = useRef(onOutputChange);
  const showOriginalRef = useRef(showOriginal);

  useEffect(() => {
    onHistoryChangeRef.current = onHistoryChange;
  }, [onHistoryChange]);

  useEffect(() => {
    onOutputChangeRef.current = onOutputChange;
  }, [onOutputChange]);

  const notifyHistory = useCallback(() => {
    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;
    onHistoryChangeRef.current?.({ canUndo, canRedo });
  }, []);

  const destroyWebGLRenderers = useCallback(() => {
    for (const quality of ['full', 'preview'] as const) {
      webglRendererRef.current[quality]?.destroy();
      webglRendererRef.current[quality] = null;
    }
  }, []);

  const ensureWebGLRenderer = useCallback((quality: RenderSourceQuality) => {
    if (webglFailedRef.current || typeof document === 'undefined') {
      return null;
    }
    const current = webglRendererRef.current[quality];
    if (current) {
      return current;
    }
    try {
      const renderer = new WebGLLiquifyRenderer();
      webglRendererRef.current[quality] = renderer;
      return renderer;
    } catch {
      webglFailedRef.current = true;
      destroyWebGLRenderers();
      return null;
    }
  }, [destroyWebGLRenderers]);

  const pushWebGLSource = useCallback(
    (quality: RenderSourceQuality, imageData: ImageData | null) => {
      if (!imageData) {
        webglRendererRef.current[quality]?.destroy();
        webglRendererRef.current[quality] = null;
        return;
      }
      const renderer = ensureWebGLRenderer(quality);
      renderer?.setSource(imageData);
    },
    [ensureWebGLRenderer]
  );

  const buildPreviewSource = useCallback((image: HTMLImageElement, width: number, height: number) => {
    const maxEdge = Math.max(width, height);
    if (maxEdge <= PREVIEW_MAX_EDGE) {
      previewSourcePixelsRef.current = null;
      previewOutputPixelsRef.current = null;
      return;
    }

    const scale = PREVIEW_MAX_EDGE / maxEdge;
    const previewWidth = Math.max(1, Math.round(width * scale));
    const previewHeight = Math.max(1, Math.round(height * scale));
    let previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) {
      previewCanvas = document.createElement('canvas');
      previewCanvasRef.current = previewCanvas;
    }
    previewCanvas.width = previewWidth;
    previewCanvas.height = previewHeight;
    const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true });
    if (!previewCtx) {
      previewSourcePixelsRef.current = null;
      previewOutputPixelsRef.current = null;
      return;
    }
    previewCtx.clearRect(0, 0, previewWidth, previewHeight);
    previewCtx.drawImage(image, 0, 0, previewWidth, previewHeight);
    previewSourcePixelsRef.current = previewCtx.getImageData(0, 0, previewWidth, previewHeight);
    previewOutputPixelsRef.current = createEmptyImageData(previewWidth, previewHeight);
  }, []);

  const renderWarped = useCallback(
    (sourcePixels: ImageData, outputPixels: ImageData, dirtyRect: DirtyRect | null = null) => {
      const width = sourcePixels.width;
      const height = sourcePixels.height;
      const src = sourcePixels.data;
      const out = outputPixels.data;
      const engine = engineRef.current;

      const hasDirtyRect = !!dirtyRect;
      const startX = hasDirtyRect
        ? clamp(Math.floor((dirtyRect?.left ?? 0) * width) - 2, 0, width - 1)
        : 0;
      const endX = hasDirtyRect
        ? clamp(Math.ceil((dirtyRect?.right ?? 1) * width) + 2, 0, width - 1)
        : width - 1;
      const startY = hasDirtyRect
        ? clamp(Math.floor((dirtyRect?.top ?? 0) * height) - 2, 0, height - 1)
        : 0;
      const endY = hasDirtyRect
        ? clamp(Math.ceil((dirtyRect?.bottom ?? 1) * height) + 2, 0, height - 1)
        : height - 1;

      for (let y = startY; y <= endY; y += 1) {
        const v = height > 1 ? y / (height - 1) : 0;
        for (let x = startX; x <= endX; x += 1) {
          const u = width > 1 ? x / (width - 1) : 0;
          const { dx, dy } = engine.sampleDisplacement(u, v);
          const sx = clamp((u + dx) * (width - 1), 0, width - 1);
          const sy = clamp((v + dy) * (height - 1), 0, height - 1);
          const [r, g, b, a] = sampleBilinear(src, width, height, sx, sy);
          const idx = (y * width + x) * 4;
          out[idx] = r;
          out[idx + 1] = g;
          out[idx + 2] = b;
          out[idx + 3] = a;
        }
      }
    },
    []
  );

  const drawRenderedImage = useCallback(
    (quality: RenderQuality, outputPixels: ImageData, emitOutput: boolean) => {
      const canvas = canvasRef.current;
      const previewCanvas = previewDisplayCanvasRef.current;
      if (!canvas) {
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      const previewSource = previewSourcePixelsRef.current;
      const usePreview = quality === 'preview' && !!previewSource && !!previewCanvas;
      if (usePreview) {
        if (previewCanvas.width !== outputPixels.width || previewCanvas.height !== outputPixels.height) {
          previewCanvas.width = outputPixels.width;
          previewCanvas.height = outputPixels.height;
        }
        const previewCtx = previewCanvas.getContext('2d');
        if (!previewCtx) {
          return;
        }
        previewCtx.putImageData(outputPixels, 0, 0);
        previewCanvas.style.opacity = '1';
        canvas.style.opacity = '0';
      } else {
        if (previewCanvas) {
          previewCanvas.style.opacity = '0';
        }
        canvas.style.opacity = '1';
        ctx.putImageData(outputPixels, 0, 0);
      }

      if (emitOutput) {
        onOutputChangeRef.current?.(canvas.toDataURL('image/jpeg', 0.92));
      }
    },
    []
  );

  const drawRenderedCanvas = useCallback(
    (quality: RenderQuality, sourceCanvas: HTMLCanvasElement, emitOutput: boolean) => {
      const canvas = canvasRef.current;
      const previewCanvas = previewDisplayCanvasRef.current;
      if (!canvas) {
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      const previewSource = previewSourcePixelsRef.current;
      const usePreview = quality === 'preview' && !!previewSource && !!previewCanvas;
      if (usePreview) {
        if (previewCanvas.width !== sourceCanvas.width || previewCanvas.height !== sourceCanvas.height) {
          previewCanvas.width = sourceCanvas.width;
          previewCanvas.height = sourceCanvas.height;
        }
        const previewCtx = previewCanvas.getContext('2d');
        if (!previewCtx) {
          return;
        }
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        drawCanvasToCanvas(previewCtx, sourceCanvas, previewCanvas.width, previewCanvas.height);
        previewCanvas.style.opacity = '1';
        canvas.style.opacity = '0';
      } else {
        if (previewCanvas) {
          previewCanvas.style.opacity = '0';
        }
        canvas.style.opacity = '1';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawCanvasToCanvas(ctx, sourceCanvas, canvas.width, canvas.height);
      }

      if (emitOutput) {
        onOutputChangeRef.current?.(canvas.toDataURL('image/jpeg', 0.92));
      }
    },
    []
  );

  const clearWorkerState = useCallback(() => {
    workerPendingMetaRef.current.clear();
    workerBusyRef.current = false;
    queuedWorkerRenderRef.current = null;
    latestWorkerRequestIdRef.current = 0;
  }, []);

  const pushWorkerSource = useCallback(
    (quality: WorkerSourceQuality, imageData: ImageData | null) => {
      const worker = renderWorkerRef.current;
      if (!worker) {
        return;
      }
      if (!imageData) {
        worker.postMessage({ type: 'clearSource', quality });
        return;
      }

      const copy = new Uint8ClampedArray(imageData.data);
      worker.postMessage(
        {
          type: 'setSource',
          quality,
          width: imageData.width,
          height: imageData.height,
          pixels: copy.buffer,
        },
        [copy.buffer]
      );
    },
    []
  );

  const mergeRenderRequest = useCallback(
    (
      current: { quality: RenderQuality; emitOutput: boolean; dirtyRect: DirtyRect | null },
      next: { quality: RenderQuality; emitOutput: boolean; dirtyRect: DirtyRect | null }
    ): { quality: RenderQuality; emitOutput: boolean; dirtyRect: DirtyRect | null } => {
      const quality =
        current.quality === 'full' || next.quality === 'full' ? 'full' : 'preview';
      return {
        quality,
        emitOutput: current.emitOutput || next.emitOutput,
        dirtyRect: quality === 'full' ? null : mergeDirtyRect(current.dirtyRect, next.dirtyRect),
      };
    },
    []
  );

  const sendWorkerRender = useCallback(
    (quality: RenderQuality, emitOutput: boolean, dirtyRect: DirtyRect | null = null) => {
      const worker = renderWorkerRef.current;
      if (!worker || showOriginalRef.current) {
        return false;
      }

      const mesh = engineRef.current.exportDisplacement();
      const deformX = new Float32Array(mesh.deformX);
      const deformY = new Float32Array(mesh.deformY);
      const requestId = workerRequestIdRef.current + 1;
      workerRequestIdRef.current = requestId;
      latestWorkerRequestIdRef.current = requestId;
      workerPendingMetaRef.current.set(requestId, { quality, emitOutput });
      workerBusyRef.current = true;

      worker.postMessage(
        {
          type: 'render',
          requestId,
          quality,
          cols: mesh.cols,
          rows: mesh.rows,
          deformX: deformX.buffer,
          deformY: deformY.buffer,
          dirtyRect,
        },
        [deformX.buffer, deformY.buffer]
      );
      return true;
    },
    []
  );

  const requestWorkerRender = useCallback(
    (quality: RenderQuality, emitOutput: boolean, dirtyRect: DirtyRect | null = null) => {
      const worker = renderWorkerRef.current;
      if (!worker) {
        return false;
      }

      if (workerBusyRef.current) {
        const next: { quality: RenderQuality; emitOutput: boolean; dirtyRect: DirtyRect | null } = {
          quality,
          emitOutput,
          dirtyRect,
        };
        queuedWorkerRenderRef.current = queuedWorkerRenderRef.current
          ? mergeRenderRequest(queuedWorkerRenderRef.current, next)
          : next;
        return true;
      }

      return sendWorkerRender(quality, emitOutput, dirtyRect);
    },
    [mergeRenderRequest, sendWorkerRender]
  );

  const renderWithWebGL = useCallback(
    (quality: RenderQuality, emitOutput: boolean) => {
      const sourcePixels = sourcePixelsRef.current;
      if (!sourcePixels || webglFailedRef.current) {
        return false;
      }
      const previewSource = previewSourcePixelsRef.current;
      const usePreview = quality === 'preview' && !!previewSource;
      const renderQuality: RenderSourceQuality = usePreview ? 'preview' : 'full';
      const renderer = ensureWebGLRenderer(renderQuality);
      if (!renderer) {
        return false;
      }
      const mesh = engineRef.current.exportDisplacement();
      const didRender = renderer.render(
        {
          cols: mesh.cols,
          rows: mesh.rows,
          deformX: mesh.deformX,
          deformY: mesh.deformY,
          indices: mesh.indices,
        },
        engineRef.current.getMaxMagnitude(),
        showOriginalRef.current
      );
      if (!didRender) {
        return false;
      }
      drawRenderedCanvas(usePreview ? 'preview' : 'full', renderer.getCanvas(), emitOutput);
      return true;
    },
    [drawRenderedCanvas, ensureWebGLRenderer]
  );

  const renderNow = useCallback(
    (
      quality: RenderQuality,
      emitOutput: boolean,
      forceSync = false,
      dirtyRect: DirtyRect | null = null
    ) => {
      const canvas = canvasRef.current;
      const sourcePixels = sourcePixelsRef.current;
      if (!canvas || !sourcePixels) {
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      if (showOriginalRef.current) {
        const previewCanvas = previewDisplayCanvasRef.current;
        if (previewCanvas) {
          previewCanvas.style.opacity = '0';
        }
        canvas.style.opacity = '1';
        ctx.putImageData(sourcePixels, 0, 0);
        if (emitOutput) {
          onOutputChangeRef.current?.(canvas.toDataURL('image/jpeg', 0.92));
        }
        return;
      }

      if (renderWithWebGL(quality, emitOutput)) {
        return;
      }

      if (!forceSync && requestWorkerRender(quality, emitOutput, dirtyRect)) {
        return;
      }

      const previewSource = previewSourcePixelsRef.current;
      const usePreview = quality === 'preview' && !!previewSource;
      const renderSource = usePreview ? previewSource : sourcePixels;
      const width = renderSource.width;
      const height = renderSource.height;
      const outputRef = usePreview ? previewOutputPixelsRef : fullOutputPixelsRef;
      if (!outputRef.current || outputRef.current.width !== width || outputRef.current.height !== height) {
        outputRef.current = createEmptyImageData(width, height);
        outputRef.current.data.set(renderSource.data);
      }
      const outputPixels = outputRef.current;
      renderWarped(renderSource, outputPixels, dirtyRect);
      drawRenderedImage(usePreview ? 'preview' : 'full', outputPixels, emitOutput);
    },
    [drawRenderedImage, renderWarped, renderWithWebGL, requestWorkerRender]
  );

  const createRenderedSnapshotCanvas = useCallback(() => {
    const sourcePixels = sourcePixelsRef.current;
    if (!sourcePixels) {
      return null;
    }

    const renderer = !showOriginalRef.current ? ensureWebGLRenderer('full') : null;
    if (renderer) {
      const mesh = engineRef.current.exportDisplacement();
      const didRender = renderer.render(
        {
          cols: mesh.cols,
          rows: mesh.rows,
          deformX: mesh.deformX,
          deformY: mesh.deformY,
          indices: mesh.indices,
        },
        engineRef.current.getMaxMagnitude(),
        showOriginalRef.current
      );
      if (didRender) {
        const rendererCanvas = renderer.getCanvas();
        const snapshot = createDetachedCanvas(rendererCanvas.width, rendererCanvas.height);
        const snapshotCtx = snapshot.getContext('2d');
        if (snapshotCtx) {
          drawCanvasToCanvas(snapshotCtx, rendererCanvas, snapshot.width, snapshot.height);
          return snapshot;
        }
      }
    }

    const rendered = createEmptyImageData(sourcePixels.width, sourcePixels.height);
    renderWarped(sourcePixels, rendered, null);
    return imageDataToCanvas(rendered);
  }, [ensureWebGLRenderer, renderWarped]);

  const buildGenerateArtifacts = useCallback(() => {
    const sourcePixels = sourcePixelsRef.current;
    if (!sourcePixels) {
      return null;
    }

    const mesh = engineRef.current.exportDisplacement();
    const { cols, rows, deformX, deformY } = mesh;
    const vertexCount = cols * rows;
    const width = sourcePixels.width;
    const height = sourcePixels.height;

    const magsPx = new Array<number>(vertexCount);
    let maxMagPx = 0;
    for (let i = 0; i < vertexCount; i += 1) {
      const magPx = Math.hypot(deformX[i] * width, deformY[i] * height);
      magsPx[i] = magPx;
      maxMagPx = Math.max(maxMagPx, magPx);
    }

    const fallbackCanvas = createRenderedSnapshotCanvas();
    if (!fallbackCanvas) {
      return null;
    }

    if (maxMagPx <= 0) {
      return {
        fallbackCanvas,
        baseMaskCanvas: null,
        softMaskCanvas: null,
        width,
        height,
      };
    }

    const buildMaskForThreshold = (threshold: number) => {
      const activeCells: Array<{ x0: number; y0: number; x1: number; y1: number }> = [];
      let bboxMinX = width;
      let bboxMinY = height;
      let bboxMaxX = 0;
      let bboxMaxY = 0;

      for (let y = 0; y < rows - 1; y += 1) {
        for (let x = 0; x < cols - 1; x += 1) {
          const idx0 = y * cols + x;
          const idx1 = idx0 + 1;
          const idx2 = idx0 + cols;
          const idx3 = idx2 + 1;
          const cellMagPx = Math.max(magsPx[idx0], magsPx[idx1], magsPx[idx2], magsPx[idx3]);
          if (cellMagPx <= threshold) {
            continue;
          }

          const u0 = cols === 1 ? 0 : x / (cols - 1);
          const v0 = rows === 1 ? 0 : y / (rows - 1);
          const u1 = cols === 1 ? 1 : (x + 1) / (cols - 1);
          const v1 = rows === 1 ? 1 : (y + 1) / (rows - 1);
          const x0 = u0 * width;
          const y0 = v0 * height;
          const x1 = u1 * width;
          const y1 = v1 * height;

          activeCells.push({ x0, y0, x1, y1 });
          bboxMinX = Math.min(bboxMinX, x0);
          bboxMinY = Math.min(bboxMinY, y0);
          bboxMaxX = Math.max(bboxMaxX, x1);
          bboxMaxY = Math.max(bboxMaxY, y1);
        }
      }

      const areaCoverage =
        activeCells.reduce((sum, rect) => sum + (rect.x1 - rect.x0) * (rect.y1 - rect.y0), 0) /
        Math.max(width * height, 1);
      const bbox =
        activeCells.length && bboxMaxX >= bboxMinX && bboxMaxY >= bboxMinY
          ? {
              x: bboxMinX,
              y: bboxMinY,
              w: bboxMaxX - bboxMinX,
              h: bboxMaxY - bboxMinY,
            }
          : null;

      return {
        activeCells,
        areaCoverage,
        bbox,
        threshold,
      };
    };

    const absoluteThresholdPx = 1;
    const relativeThresholdPx = maxMagPx * 0.2;
    const baseThreshold = Math.min(Math.max(absoluteThresholdPx, relativeThresholdPx), maxMagPx * 0.9);
    let maskResult = buildMaskForThreshold(baseThreshold);
    let bboxCoverage = maskResult.bbox
      ? (maskResult.bbox.w * maskResult.bbox.h) / Math.max(width * height, 1)
      : 0;

    if (maskResult.areaCoverage > 0.35 || bboxCoverage > 0.6) {
      const sorted = [...magsPx].sort((a, b) => b - a);
      const p80 = sorted[Math.max(0, Math.floor(sorted.length * 0.2) - 1)] ?? maxMagPx;
      const bumped = Math.max(baseThreshold, p80, maxMagPx * 0.35, 2);
      maskResult = buildMaskForThreshold(bumped);
      bboxCoverage = maskResult.bbox
        ? (maskResult.bbox.w * maskResult.bbox.h) / Math.max(width * height, 1)
        : 0;
    }

    if (!maskResult.activeCells.length) {
      maskResult = buildMaskForThreshold(0);
    }

    if (!maskResult.activeCells.length) {
      return {
        fallbackCanvas,
        baseMaskCanvas: null,
        softMaskCanvas: null,
        width,
        height,
      };
    }

    const baseMaskCanvas = createDetachedCanvas(width, height);
    const baseMaskCtx = baseMaskCanvas.getContext('2d');
    if (!baseMaskCtx) {
      return {
        fallbackCanvas,
        baseMaskCanvas: null,
        softMaskCanvas: null,
        width,
        height,
      };
    }
    baseMaskCtx.clearRect(0, 0, width, height);
    baseMaskCtx.fillStyle = '#ffffff';
    maskResult.activeCells.forEach((rect) => {
      baseMaskCtx.fillRect(rect.x0, rect.y0, Math.max(0, rect.x1 - rect.x0), Math.max(0, rect.y1 - rect.y0));
    });

    const cellWidthPx = cols > 1 ? width / (cols - 1) : width;
    const cellHeightPx = rows > 1 ? height / (rows - 1) : height;
    const blurPx = Math.max(1, Math.max(cellWidthPx, cellHeightPx) * 0.45);
    const softMaskCanvas = createDetachedCanvas(width, height);
    const softMaskCtx = softMaskCanvas.getContext('2d');
    if (!softMaskCtx) {
      return {
        fallbackCanvas,
        baseMaskCanvas,
        softMaskCanvas: null,
        width,
        height,
      };
    }
    softMaskCtx.clearRect(0, 0, width, height);
    softMaskCtx.filter = `blur(${blurPx}px)`;
    softMaskCtx.drawImage(baseMaskCanvas, 0, 0);
    softMaskCtx.filter = 'none';

    return {
      fallbackCanvas,
      baseMaskCanvas,
      softMaskCanvas,
      width,
      height,
    };
  }, [createRenderedSnapshotCanvas]);

  const exportOpenAiImageDataUrl = useCallback(() => {
    const artifacts = buildGenerateArtifacts();
    if (!artifacts) {
      return null;
    }
    return artifacts.fallbackCanvas.toDataURL('image/png');
  }, [buildGenerateArtifacts]);

  const exportGenerateMaskDataUrl = useCallback(() => {
    const artifacts = buildGenerateArtifacts();
    if (!artifacts?.baseMaskCanvas) {
      return null;
    }

    const { width, height, baseMaskCanvas } = artifacts;
    const maskCanvas = createDetachedCanvas(width, height);
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) {
      return null;
    }

    // OpenAI edits use the mask alpha channel to guide editable regions.
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.fillStyle = 'rgba(255, 255, 255, 1)';
    maskCtx.fillRect(0, 0, width, height);
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.drawImage(baseMaskCanvas, 0, 0);
    maskCtx.globalCompositeOperation = 'source-over';

    return maskCanvas.toDataURL('image/png');
  }, [buildGenerateArtifacts]);

  const exportGenerateDataUrl = useCallback(() => {
    const artifacts = buildGenerateArtifacts();
    if (!artifacts) {
      return null;
    }
    const { fallbackCanvas, softMaskCanvas, width, height } = artifacts;
    if (!softMaskCanvas) {
      return fallbackCanvas.toDataURL('image/jpeg', 0.92);
    }

    const renderedImageData = canvasToImageData(fallbackCanvas);
    if (!renderedImageData) {
      return fallbackCanvas.toDataURL('image/jpeg', 0.92);
    }

    const grayscaleCanvas = imageDataToCanvas(createGrayscaleImageData(renderedImageData));
    if (!grayscaleCanvas) {
      return fallbackCanvas.toDataURL('image/jpeg', 0.92);
    }

    const maskedBwCanvas = createDetachedCanvas(width, height);
    const maskedBwCtx = maskedBwCanvas.getContext('2d');
    if (!maskedBwCtx) {
      return fallbackCanvas.toDataURL('image/jpeg', 0.92);
    }
    maskedBwCtx.clearRect(0, 0, width, height);
    maskedBwCtx.drawImage(grayscaleCanvas, 0, 0);
    maskedBwCtx.globalCompositeOperation = 'destination-in';
    maskedBwCtx.drawImage(softMaskCanvas, 0, 0);
    maskedBwCtx.globalCompositeOperation = 'source-over';

    const outputCanvas = createDetachedCanvas(width, height);
    const outputCtx = outputCanvas.getContext('2d');
    if (!outputCtx) {
      return fallbackCanvas.toDataURL('image/jpeg', 0.92);
    }
    outputCtx.clearRect(0, 0, width, height);
    outputCtx.drawImage(fallbackCanvas, 0, 0);
    outputCtx.drawImage(maskedBwCanvas, 0, 0);

    return outputCanvas.toDataURL('image/png');
  }, [buildGenerateArtifacts]);

  const hasLiquifyChanges = useCallback(() => {
    const sourcePixels = sourcePixelsRef.current;
    if (!sourcePixels) {
      return false;
    }
    return hasVisibleDisplacement(
      engineRef.current.exportDisplacement(),
      sourcePixels.width,
      sourcePixels.height
    );
  }, []);

  const scheduleRender = useCallback(
    (request: RenderRequest = {}) => {
      const requestedQuality = request.quality ?? 'full';
      const requestedEmitOutput = request.emitOutput ?? true;
      const requestedDirtyRect = request.dirtyRect ?? null;
      const pending = pendingRenderRef.current;
      const mergedQuality =
        pending.quality === 'full' || requestedQuality === 'full' ? 'full' : requestedQuality;
      pendingRenderRef.current = {
        quality: mergedQuality,
        emitOutput: pending.emitOutput || requestedEmitOutput,
        dirtyRect:
          mergedQuality === 'full' ? null : mergeDirtyRect(pending.dirtyRect, requestedDirtyRect),
      };

      if (renderRafRef.current != null) {
        return;
      }

      renderRafRef.current = window.requestAnimationFrame(() => {
        renderRafRef.current = null;
        const next = pendingRenderRef.current;
        pendingRenderRef.current = { quality: 'preview', emitOutput: false, dirtyRect: null };
        renderNow(next.quality, next.emitOutput, false, next.dirtyRect);
      });
    },
    [renderNow]
  );

  const flushRender = useCallback(
    (quality: RenderQuality = 'full', emitOutput = false, forceSync = false) => {
      if (renderRafRef.current != null) {
        window.cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = null;
      }
      pendingRenderRef.current = { quality: 'preview', emitOutput: false, dirtyRect: null };
      renderNow(quality, emitOutput, forceSync, null);
    },
    [renderNow]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      return;
    }

    const worker = new Worker(new URL('./liquifyRender.worker.ts', import.meta.url));
    renderWorkerRef.current = worker;

    const handleMessage = (event: MessageEvent<LiquifyWorkerResponse>) => {
      const message = event.data;
      if (!message || message.type !== 'renderResult') {
        return;
      }

      const meta = workerPendingMetaRef.current.get(message.requestId);
      workerPendingMetaRef.current.delete(message.requestId);
      workerBusyRef.current = false;

      if (
        meta &&
        message.requestId === latestWorkerRequestIdRef.current &&
        !showOriginalRef.current &&
        sourcePixelsRef.current
      ) {
        const outputPixels = new ImageData(
          new Uint8ClampedArray(message.pixels),
          message.width,
          message.height
        );
        drawRenderedImage(meta.quality, outputPixels, meta.emitOutput);
      }

      const queued = queuedWorkerRenderRef.current;
      if (queued) {
        queuedWorkerRenderRef.current = null;
        sendWorkerRender(queued.quality, queued.emitOutput, queued.dirtyRect);
      }
    };

    const handleError = () => {
      clearWorkerState();
      renderWorkerRef.current = null;
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    if (sourcePixelsRef.current) {
      pushWorkerSource('full', sourcePixelsRef.current);
      pushWorkerSource('preview', previewSourcePixelsRef.current ?? sourcePixelsRef.current);
    }

    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      clearWorkerState();
      renderWorkerRef.current = null;
      worker.terminate();
    };
  }, [clearWorkerState, drawRenderedImage, pushWorkerSource, sendWorkerRender]);

  const setHistory = useCallback((replace = false) => {
    const snapshot = cloneSnapshot(engineRef.current);

    if (replace) {
      historyRef.current = [snapshot];
      historyIndexRef.current = 0;
      notifyHistory();
      return;
    }

    const head = historyRef.current.slice(0, historyIndexRef.current + 1);
    head.push(snapshot);
    historyRef.current = head.slice(-60);
    historyIndexRef.current = historyRef.current.length - 1;
    notifyHistory();
  }, [notifyHistory]);

  useEffect(() => {
    if (!imageDataUrl) {
      if (renderRafRef.current != null) {
        window.cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = null;
      }
      if (strokeFrameRef.current != null) {
        window.cancelAnimationFrame(strokeFrameRef.current);
        strokeFrameRef.current = null;
      }
      if (brushIndicatorFrameRef.current != null) {
        window.cancelAnimationFrame(brushIndicatorFrameRef.current);
        brushIndicatorFrameRef.current = null;
      }
      pendingRenderRef.current = { quality: 'preview', emitOutput: false, dirtyRect: null };
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.opacity = '1';
      }
      const previewCanvas = previewDisplayCanvasRef.current;
      if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        previewCtx?.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        previewCanvas.style.opacity = '0';
      }
      sourcePixelsRef.current = null;
      fullOutputPixelsRef.current = null;
      previewSourcePixelsRef.current = null;
      previewOutputPixelsRef.current = null;
      imageRef.current = null;
      webglFailedRef.current = false;
      pointerDownRef.current = false;
      strokeDirtyRef.current = false;
      queuedStrokePointRef.current = null;
      queuedBrushIndicatorRef.current = null;
      clearWorkerState();
      pushWorkerSource('full', null);
      pushWorkerSource('preview', null);
      pushWebGLSource('full', null);
      pushWebGLSource('preview', null);
      onOutputChangeRef.current?.(null);
      return;
    }

    const image = new Image();
    image.onload = () => {
      webglFailedRef.current = false;
      imageRef.current = image;

      const width = image.naturalWidth;
      const height = image.naturalHeight;

      setSize({ width, height });

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      sourcePixelsRef.current = imageData;
      fullOutputPixelsRef.current = createEmptyImageData(width, height);
      buildPreviewSource(image, width, height);
      clearWorkerState();
      pushWorkerSource('full', imageData);
      pushWorkerSource('preview', previewSourcePixelsRef.current ?? imageData);
      pushWebGLSource('full', imageData);
      pushWebGLSource('preview', previewSourcePixelsRef.current);

      if (initialDisplacement) {
        engineRef.current.loadDisplacement(initialDisplacement);
        setHistory(true);
        scheduleRender({ quality: 'full', emitOutput: true });
      } else {
        engineRef.current.reconfigure({
          ...WEB_ENGINE_CONFIG,
          ...computeWebMeshResolution(width, height),
        });
        engineRef.current.reset();
        setHistory(true);

        const initial = canvas.toDataURL('image/jpeg', 0.92);
        onOutputChangeRef.current?.(initial);
        scheduleRender({ quality: 'full', emitOutput: false });
      }
    };
    image.onerror = () => {
      onOutputChangeRef.current?.(null);
    };
    image.src = imageDataUrl;
  }, [
    buildPreviewSource,
    clearWorkerState,
    imageDataUrl,
    initialDisplacement,
    pushWebGLSource,
    pushWorkerSource,
    scheduleRender,
    setHistory,
  ]);

  useEffect(() => {
    showOriginalRef.current = showOriginal;
    scheduleRender({ quality: 'full', emitOutput: false });
  }, [showOriginal, scheduleRender]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }

    const updateViewport = () => {
      setViewport({
        width: wrap.clientWidth,
        height: wrap.clientHeight,
      });
    };

    updateViewport();

    const observer = new ResizeObserver(updateViewport);
    observer.observe(wrap);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    userPannedRef.current = false;
  }, [imageDataUrl]);

  useEffect(() => {
    if (!imageDataUrl) {
      userPannedRef.current = false;
      return;
    }
    if (!size.width || !size.height || !viewport.width || !viewport.height) {
      return;
    }
    if (!onSuggestInitialZoom) {
      return;
    }
    const fitZoom = clamp(
      Math.min(viewport.width / size.width, viewport.height / size.height, 1),
      0.25,
      3
    );
    onSuggestInitialZoom(fitZoom);
  }, [imageDataUrl, onSuggestInitialZoom, size.height, size.width, viewport.height, viewport.width]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpacePressed(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (renderRafRef.current != null) {
        window.cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = null;
      }
      if (strokeFrameRef.current != null) {
        window.cancelAnimationFrame(strokeFrameRef.current);
        strokeFrameRef.current = null;
      }
      if (brushIndicatorFrameRef.current != null) {
        window.cancelAnimationFrame(brushIndicatorFrameRef.current);
        brushIndicatorFrameRef.current = null;
      }
      destroyWebGLRenderers();
    };
  }, [destroyWebGLRenderers]);

  const toCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const hideBrushIndicator = useCallback(() => {
    queuedBrushIndicatorRef.current = null;
    if (brushIndicatorFrameRef.current != null) {
      window.cancelAnimationFrame(brushIndicatorFrameRef.current);
      brushIndicatorFrameRef.current = null;
    }
    const indicator = brushIndicatorRef.current;
    if (!indicator) {
      return;
    }
    indicator.style.opacity = '0';
    brushVisibleRef.current = false;
  }, []);

  const applyBrushIndicator = useCallback(
    (clientX: number, clientY: number, pointerType?: string) => {
      const indicator = brushIndicatorRef.current;
      const wrap = wrapRef.current;
      if (!indicator || !wrap) {
        return;
      }
      if (pointerType === 'touch' || spacePressed || isPanning || !sourcePixelsRef.current) {
        hideBrushIndicator();
        return;
      }

      const rect = wrap.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        hideBrushIndicator();
        return;
      }

      const zoomScale = clamp(zoom, 0.25, 3);
      const diameter = Math.max(12, Math.round(brushSize * zoomScale));
      const offsetX = wrap.scrollLeft;
      const offsetY = wrap.scrollTop;
      indicator.style.width = `${diameter}px`;
      indicator.style.height = `${diameter}px`;
      indicator.style.transform = `translate3d(${Math.round(offsetX + x - diameter / 2)}px, ${Math.round(offsetY + y - diameter / 2)}px, 0)`;
      indicator.style.opacity = '1';
      lastBrushClientRef.current = { x: clientX, y: clientY };
      brushVisibleRef.current = true;
    },
    [brushSize, hideBrushIndicator, isPanning, spacePressed, zoom]
  );

  const updateBrushIndicator = useCallback(
    (clientX: number, clientY: number, pointerType?: string) => {
      queuedBrushIndicatorRef.current = { clientX, clientY, pointerType };
      if (brushIndicatorFrameRef.current != null) {
        return;
      }
      brushIndicatorFrameRef.current = window.requestAnimationFrame(() => {
        brushIndicatorFrameRef.current = null;
        const next = queuedBrushIndicatorRef.current;
        queuedBrushIndicatorRef.current = null;
        if (!next) {
          return;
        }
        applyBrushIndicator(next.clientX, next.clientY, next.pointerType);
      });
    },
    [applyBrushIndicator]
  );

  useEffect(() => {
    if (!imageDataUrl) {
      lastBrushClientRef.current = null;
      hideBrushIndicator();
      zoomAnchorRef.current = null;
    }
  }, [hideBrushIndicator, imageDataUrl]);

  useEffect(() => {
    if (showOriginal) {
      hideBrushIndicator();
    }
  }, [hideBrushIndicator, showOriginal]);

  useEffect(() => {
    if (spacePressed || isPanning) {
      hideBrushIndicator();
      return;
    }
    const last = lastBrushClientRef.current;
    if (!last || !brushVisibleRef.current) {
      return;
    }
    applyBrushIndicator(last.x, last.y);
  }, [applyBrushIndicator, brushSize, hideBrushIndicator, isPanning, spacePressed, zoom]);

  const onCanvasPointerEnter = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateBrushIndicator(event.clientX, event.clientY, event.pointerType);
  };

  const applyRestoreSegment = useCallback(
    (fromPoint: Point, toPoint: Point, includeStart = false) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return false;
      }

      const radiusPx = Math.max(brushSize * 0.5, 4);
      const radius = clamp(radiusPx / Math.max(Math.min(canvas.width, canvas.height), 1), 0.002, 0.2);
      const moveDistancePx = Math.hypot(toPoint.x - fromPoint.x, toPoint.y - fromPoint.y);
      const stampSpacingPx = Math.max(3, radiusPx * 0.36);
      const substeps = Math.max(1, Math.min(14, Math.ceil(moveDistancePx / stampSpacingPx)));
      const startIndex = includeStart ? 0 : 1;

      for (let i = startIndex; i <= substeps; i += 1) {
        const t = substeps === 0 ? 1 : i / substeps;
        const x = fromPoint.x + (toPoint.x - fromPoint.x) * t;
        const y = fromPoint.y + (toPoint.y - fromPoint.y) * t;
        engineRef.current.restoreRegion(x / canvas.width, y / canvas.height, radius, 0.2);
      }

      strokeDirtyRef.current = true;
      scheduleRender({ quality: 'preview', emitOutput: false, dirtyRect: null });
      return true;
    },
    [brushSize, scheduleRender]
  );

  const applyQueuedStroke = useCallback(() => {
    strokeFrameRef.current = null;

    if (!pointerDownRef.current) {
      queuedStrokePointRef.current = null;
      return;
    }

    const point = queuedStrokePointRef.current;
    if (!point) {
      return;
    }

    queuedStrokePointRef.current = null;

    const last = lastPointRef.current;
    const canvas = canvasRef.current;
    if (!last || !canvas) {
      lastPointRef.current = point;
      return;
    }

    const deltaPxX = point.x - last.x;
    const deltaPxY = point.y - last.y;
    const moveDistancePx = Math.hypot(deltaPxX, deltaPxY);
    if (moveDistancePx < 0.15) {
      lastPointRef.current = point;
      return;
    }

    if (tool === 'restore') {
      applyRestoreSegment(last, point);
      lastPointRef.current = point;

      if (queuedStrokePointRef.current && strokeFrameRef.current == null) {
        strokeFrameRef.current = window.requestAnimationFrame(() => {
          applyQueuedStroke();
        });
      }
      return;
    }

    const movementGain = clamp(moveDistancePx / Math.max(brushSize * 0.22, 1), 0.85, 2.5);
    const baseStrength = clamp(strength, 0.4, 3);
    const strokeStrength = clamp(baseStrength * movementGain, 0.4, 3);
    const stepFactor = clamp(0.9 + baseStrength * 0.55 * movementGain, 0.8, 3);
    const radiusPx = Math.max(brushSize * 0.5, 4);
    const radius = clamp(radiusPx / Math.max(Math.min(canvas.width, canvas.height), 1), 0.002, 0.2);
    const substepDistancePx = Math.max(2.5, brushSize * 0.28);
    const substeps = Math.max(1, Math.min(6, Math.ceil(moveDistancePx / substepDistancePx)));
    const perStepStrength = clamp(strokeStrength, 0.35, 3);
    const perStepFactor = clamp(stepFactor, 0.6, 3);

    for (let i = 1; i <= substeps; i += 1) {
      const t0 = (i - 1) / substeps;
      const t1 = i / substeps;
      const x0 = last.x + (point.x - last.x) * t0;
      const y0 = last.y + (point.y - last.y) * t0;
      const x1 = last.x + (point.x - last.x) * t1;
      const y1 = last.y + (point.y - last.y) * t1;
      const subDx = (x1 - x0) / Math.max(canvas.width, 1);
      const subDy = (y1 - y0) / Math.max(canvas.height, 1);

      engineRef.current.applyBrush(x1 / canvas.width, y1 / canvas.height, {
        tool,
        radius,
        strength: perStepStrength,
        stepFactor: perStepFactor,
        brushBlend: 0.92,
        brushSoftness: 0.3,
        centerDampen: 0.72,
        edgeBoost: 1.25,
        decayCurve: 1.15,
        vector: tool === 'push' ? { dx: subDx, dy: subDy } : { dx: 0, dy: 0 },
      });
    }

    const dirtyMarginPx = radiusPx + Math.max(radiusPx * 0.45, 18);
    const dirtyRect = toNormalizedDirtyRect(
      Math.min(last.x, point.x) - dirtyMarginPx,
      Math.min(last.y, point.y) - dirtyMarginPx,
      Math.max(last.x, point.x) + dirtyMarginPx,
      Math.max(last.y, point.y) + dirtyMarginPx,
      canvas.width,
      canvas.height
    );

    lastPointRef.current = point;
    strokeDirtyRef.current = true;
    scheduleRender({ quality: 'preview', emitOutput: false, dirtyRect });

    if (queuedStrokePointRef.current && strokeFrameRef.current == null) {
      strokeFrameRef.current = window.requestAnimationFrame(() => {
        applyQueuedStroke();
      });
    }
  }, [applyRestoreSegment, brushSize, scheduleRender, strength, tool]);

  const queueStrokePoint = useCallback(
    (point: Point) => {
      queuedStrokePointRef.current = point;
      if (strokeFrameRef.current != null) {
        return;
      }
      strokeFrameRef.current = window.requestAnimationFrame(() => {
        applyQueuedStroke();
      });
    },
    [applyQueuedStroke]
  );

  const flushQueuedStroke = useCallback(() => {
    if (strokeFrameRef.current != null) {
      window.cancelAnimationFrame(strokeFrameRef.current);
      strokeFrameRef.current = null;
    }
    if (queuedStrokePointRef.current) {
      applyQueuedStroke();
    }
  }, [applyQueuedStroke]);

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateBrushIndicator(event.clientX, event.clientY, event.pointerType);
    if (spacePressed) {
      return;
    }
    if (event.button !== 0) {
      return;
    }

    if (!sourcePixelsRef.current) {
      return;
    }
    const point = toCanvasPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    pointerDownRef.current = true;
    pointerIdRef.current = event.pointerId;
    lastPointRef.current = point;
    queuedStrokePointRef.current = null;
    strokeDirtyRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'restore') {
      applyRestoreSegment(point, point, true);
    }
  };

  const onCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateBrushIndicator(event.clientX, event.clientY, event.pointerType);
    if (!pointerDownRef.current || pointerIdRef.current !== event.pointerId) {
      return;
    }

    const point = toCanvasPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    queueStrokePoint(point);
  };

  const onCanvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    updateBrushIndicator(event.clientX, event.clientY, event.pointerType);
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }
    flushQueuedStroke();
    pointerDownRef.current = false;
    pointerIdRef.current = null;
    lastPointRef.current = null;
    queuedStrokePointRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (strokeDirtyRef.current) {
      setHistory(false);
      scheduleRender({ quality: 'full', emitOutput: true });
      strokeDirtyRef.current = false;
    }
  };

  const onCanvasPointerLeave = () => {};

  const onCanvasPointerCancel = (event: React.PointerEvent<HTMLCanvasElement>) => {
    onCanvasPointerUp(event);
    onCanvasPointerLeave();
  };

  const onWrapPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageDataUrl) {
      return;
    }
    if (!spacePressed && event.button !== 1) {
      return;
    }

    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }

    panPointerIdRef.current = event.pointerId;
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: wrap.scrollLeft,
      top: wrap.scrollTop,
    };
    userPannedRef.current = true;
    setIsPanning(true);
    hideBrushIndicator();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onWrapPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    updateBrushIndicator(event.clientX, event.clientY, event.pointerType);

    if (panPointerIdRef.current !== event.pointerId || !panStartRef.current) {
      return;
    }

    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }

    const dx = event.clientX - panStartRef.current.x;
    const dy = event.clientY - panStartRef.current.y;
    wrap.scrollLeft = clamp(panStartRef.current.left - dx, panBounds.minLeft, panBounds.maxLeft);
    wrap.scrollTop = clamp(panStartRef.current.top - dy, panBounds.minTop, panBounds.maxTop);
  };

  const onWrapPointerLeave = () => {
    lastBrushClientRef.current = null;
    hideBrushIndicator();
  };

  const onWrapPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panPointerIdRef.current !== event.pointerId) {
      return;
    }
    panPointerIdRef.current = null;
    panStartRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      undo: () => {
        if (historyIndexRef.current <= 0) {
          return;
        }
        historyIndexRef.current -= 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        if (!snapshot) {
          return;
        }
        engineRef.current.loadDisplacement(snapshot);
        notifyHistory();
        scheduleRender({ quality: 'full', emitOutput: true });
      },
      redo: () => {
        if (historyIndexRef.current >= historyRef.current.length - 1) {
          return;
        }
        historyIndexRef.current += 1;
        const snapshot = historyRef.current[historyIndexRef.current];
        if (!snapshot) {
          return;
        }
        engineRef.current.loadDisplacement(snapshot);
        notifyHistory();
        scheduleRender({ quality: 'full', emitOutput: true });
      },
      reset: () => {
        engineRef.current.reset();
        setHistory(true);
        scheduleRender({ quality: 'full', emitOutput: true });
      },
      exportDataUrl: () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return null;
        }
        flushRender('full', false, true);
        return canvas.toDataURL('image/jpeg', 0.92);
      },
      exportOpenAiImageDataUrl: () => exportOpenAiImageDataUrl(),
      exportGenerateDataUrl: () => exportGenerateDataUrl(),
      exportGenerateMaskDataUrl: () => exportGenerateMaskDataUrl(),
      exportSession: () => {
        if (!sourcePixelsRef.current) {
          return null;
        }
        return cloneSnapshot(engineRef.current);
      },
      hasLiquifyChanges: () => hasLiquifyChanges(),
    }),
    [
      exportGenerateDataUrl,
      exportGenerateMaskDataUrl,
      exportOpenAiImageDataUrl,
      flushRender,
      hasLiquifyChanges,
      notifyHistory,
      scheduleRender,
      setHistory,
    ]
  );

  const style = useMemo(() => {
    const zoomScale = clamp(zoom, 0.25, 3);
    if (!size.width || !size.height) {
      return { minHeight: 320, width: '100%' };
    }

    return {
      width: `${Math.round(size.width * zoomScale)}px`,
      height: `${Math.round(size.height * zoomScale)}px`,
    };
  }, [size.height, size.width, zoom]);

  const scaledWidth = size.width ? Math.round(size.width * clamp(zoom, 0.25, 3)) : 0;
  const scaledHeight = size.height ? Math.round(size.height * clamp(zoom, 0.25, 3)) : 0;
  const panMarginX = Math.max(viewport.width, 420);
  const panMarginY = Math.max(viewport.height, 320);
  const innerWidth = Math.max(scaledWidth + panMarginX * 2, viewport.width + panMarginX * 2);
  const innerHeight = Math.max(scaledHeight + panMarginY * 2, viewport.height + panMarginY * 2);
  const innerStyle = useMemo(
    () => ({
      width: `${innerWidth}px`,
      height: `${innerHeight}px`,
    }),
    [innerHeight, innerWidth]
  );

  const panBounds = useMemo(() => {
    const maxScrollLeft = Math.max(innerWidth - viewport.width, 0);
    const maxScrollTop = Math.max(innerHeight - viewport.height, 0);

    if (!scaledWidth || !scaledHeight || !viewport.width || !viewport.height) {
      return {
        minLeft: 0,
        maxLeft: maxScrollLeft,
        minTop: 0,
        maxTop: maxScrollTop,
      };
    }

    const canvasLeft = (innerWidth - scaledWidth) / 2;
    const canvasTop = (innerHeight - scaledHeight) / 2;
    const minVisibleX = Math.min(Math.max(Math.round(scaledWidth * 0.1), 56), scaledWidth);
    const minVisibleY = Math.min(Math.max(Math.round(scaledHeight * 0.1), 56), scaledHeight);

    let minLeft = clamp(canvasLeft + minVisibleX - viewport.width, 0, maxScrollLeft);
    let maxLeft = clamp(canvasLeft + scaledWidth - minVisibleX, 0, maxScrollLeft);
    let minTop = clamp(canvasTop + minVisibleY - viewport.height, 0, maxScrollTop);
    let maxTop = clamp(canvasTop + scaledHeight - minVisibleY, 0, maxScrollTop);

    if (minLeft > maxLeft) {
      const centered = clamp((canvasLeft + scaledWidth / 2) - viewport.width / 2, 0, maxScrollLeft);
      minLeft = centered;
      maxLeft = centered;
    }
    if (minTop > maxTop) {
      const centered = clamp((canvasTop + scaledHeight / 2) - viewport.height / 2, 0, maxScrollTop);
      minTop = centered;
      maxTop = centered;
    }

    return { minLeft, maxLeft, minTop, maxTop };
  }, [innerHeight, innerWidth, scaledHeight, scaledWidth, viewport.height, viewport.width]);

  const onWrapWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!imageDataUrl || !onWheelZoom) {
        return;
      }

      const deltaPx = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      if (Math.abs(deltaPx) < 1) {
        return;
      }

      const wrap = wrapRef.current;
      if (wrap && scaledWidth > 0 && scaledHeight > 0) {
        const wrapRect = wrap.getBoundingClientRect();
        const offsetX = event.clientX - wrapRect.left;
        const offsetY = event.clientY - wrapRect.top;
        const canvasLeft = (innerWidth - scaledWidth) / 2;
        const canvasTop = (innerHeight - scaledHeight) / 2;
        const contentX = wrap.scrollLeft + offsetX;
        const contentY = wrap.scrollTop + offsetY;

        zoomAnchorRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          offsetX,
          offsetY,
          relativeX: (contentX - canvasLeft) / Math.max(scaledWidth, 1),
          relativeY: (contentY - canvasTop) / Math.max(scaledHeight, 1),
        };
      } else {
        zoomAnchorRef.current = null;
      }

      const normalized = clamp(Math.abs(deltaPx) / 120, 0.4, 2);
      const delta = deltaPx < 0 ? normalized : -normalized;
      onWheelZoom(delta);
      event.preventDefault();
    },
    [imageDataUrl, innerHeight, innerWidth, onWheelZoom, scaledHeight, scaledWidth]
  );

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor) {
      return;
    }

    const wrap = wrapRef.current;
    if (!wrap || !scaledWidth || !scaledHeight || !viewport.width || !viewport.height) {
      zoomAnchorRef.current = null;
      return;
    }

    const canvasLeft = (innerWidth - scaledWidth) / 2;
    const canvasTop = (innerHeight - scaledHeight) / 2;
    const targetLeft = canvasLeft + anchor.relativeX * scaledWidth - anchor.offsetX;
    const targetTop = canvasTop + anchor.relativeY * scaledHeight - anchor.offsetY;

    wrap.scrollLeft = clamp(targetLeft, panBounds.minLeft, panBounds.maxLeft);
    wrap.scrollTop = clamp(targetTop, panBounds.minTop, panBounds.maxTop);
    userPannedRef.current = true;
    zoomAnchorRef.current = null;
    updateBrushIndicator(anchor.clientX, anchor.clientY);
  }, [
    innerHeight,
    innerWidth,
    panBounds.maxLeft,
    panBounds.maxTop,
    panBounds.minLeft,
    panBounds.minTop,
    scaledHeight,
    scaledWidth,
    updateBrushIndicator,
    viewport.height,
    viewport.width,
  ]);

  useEffect(() => {
    if (!imageDataUrl) {
      return;
    }
    if (zoomAnchorRef.current) {
      return;
    }
    if (!scaledWidth || !scaledHeight || !viewport.width || !viewport.height) {
      return;
    }
    if (userPannedRef.current) {
      return;
    }
    const wrap = wrapRef.current;
    if (!wrap) {
      return;
    }
    const centerLeft = Math.max((innerWidth - viewport.width) / 2, 0);
    const centerTop = Math.max((innerHeight - viewport.height) / 2, 0);
    wrap.scrollLeft = clamp(centerLeft, panBounds.minLeft, panBounds.maxLeft);
    wrap.scrollTop = clamp(centerTop, panBounds.minTop, panBounds.maxTop);
  }, [
    imageDataUrl,
    innerHeight,
    innerWidth,
    panBounds.maxLeft,
    panBounds.maxTop,
    panBounds.minLeft,
    panBounds.minTop,
    scaledHeight,
    scaledWidth,
    viewport.height,
    viewport.width,
  ]);

  const wrapClassName =
    spacePressed || isPanning ? 'editor-canvas-wrap editor-canvas-wrap-pan' : 'editor-canvas-wrap';

  return (
    <div
      ref={wrapRef}
      className={wrapClassName}
      onPointerDown={onWrapPointerDown}
      onPointerMove={onWrapPointerMove}
      onPointerUp={onWrapPointerUp}
      onPointerCancel={onWrapPointerUp}
      onPointerLeave={onWrapPointerLeave}
      onWheel={onWrapWheel}
    >
      <div className="editor-canvas-inner" style={innerStyle}>
        <div className="editor-canvas-stack" style={style}>
          <canvas
            ref={canvasRef}
            className="editor-canvas"
            onContextMenu={(event) => event.preventDefault()}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerEnter={onCanvasPointerEnter}
            onPointerLeave={onCanvasPointerLeave}
            onPointerUp={onCanvasPointerUp}
            onPointerCancel={onCanvasPointerCancel}
          />
          <canvas ref={previewDisplayCanvasRef} className="editor-canvas editor-canvas-preview" aria-hidden />
          {comparisonImageDataUrl ? (
            <img
              src={comparisonImageDataUrl}
              alt=""
              aria-hidden
              draggable={false}
              className={showOriginal ? 'editor-compare-image editor-compare-image-visible' : 'editor-compare-image'}
            />
          ) : null}
        </div>
      </div>
      <div ref={brushIndicatorRef} className="editor-brush-indicator" aria-hidden />
    </div>
  );
});

export default LiquifyCanvas;
