type SourceQuality = 'full' | 'preview';

type SourcePayload = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

type DirtyRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type WorkerRequest =
  | {
      type: 'setSource';
      quality: SourceQuality;
      width: number;
      height: number;
      pixels: ArrayBuffer;
    }
  | {
      type: 'clearSource';
      quality: SourceQuality;
    }
  | {
      type: 'render';
      requestId: number;
      quality: SourceQuality;
      cols: number;
      rows: number;
      deformX: ArrayBuffer;
      deformY: ArrayBuffer;
      dirtyRect?: DirtyRect | null;
    };

type WorkerResponse = {
  type: 'renderResult';
  requestId: number;
  quality: SourceQuality;
  width: number;
  height: number;
  pixels: ArrayBuffer;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const sources: Record<SourceQuality, SourcePayload | null> = {
  full: null,
  preview: null,
};

const outputs: Record<SourceQuality, Uint8ClampedArray | null> = {
  full: null,
  preview: null,
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

const sampleDisplacement = (
  deformX: Float32Array,
  deformY: Float32Array,
  cols: number,
  rows: number,
  u: number,
  v: number
) => {
  const uu = clamp(u, 0, 1);
  const vv = clamp(v, 0, 1);
  const gx = uu * (cols - 1);
  const gy = vv * (rows - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const sx = gx - x0;
  const sy = gy - y0;
  const idx = (x: number, y: number) => y * cols + x;
  const interp = (buffer: Float32Array) =>
    buffer[idx(x0, y0)] * (1 - sx) * (1 - sy) +
    buffer[idx(x1, y0)] * sx * (1 - sy) +
    buffer[idx(x0, y1)] * (1 - sx) * sy +
    buffer[idx(x1, y1)] * sx * sy;
  return {
    dx: interp(deformX),
    dy: interp(deformY),
  };
};

const renderWarped = (
  source: SourcePayload,
  cols: number,
  rows: number,
  deformX: Float32Array,
  deformY: Float32Array,
  dirtyRect: DirtyRect | null = null,
  previousOutput: Uint8ClampedArray | null = null
) => {
  const { width, height, pixels } = source;
  const output =
    previousOutput && previousOutput.length === width * height * 4
      ? previousOutput
      : new Uint8ClampedArray(pixels);

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
      const { dx, dy } = sampleDisplacement(deformX, deformY, cols, rows, u, v);
      const sx = clamp((u + dx) * (width - 1), 0, width - 1);
      const sy = clamp((v + dy) * (height - 1), 0, height - 1);
      const [r, g, b, a] = sampleBilinear(pixels, width, height, sx, sy);
      const idx = (y * width + x) * 4;
      output[idx] = r;
      output[idx + 1] = g;
      output[idx + 2] = b;
      output[idx + 3] = a;
    }
  }

  return output;
};

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (!message) {
    return;
  }

  if (message.type === 'setSource') {
    const sourcePixels = new Uint8ClampedArray(message.pixels);
    sources[message.quality] = {
      width: message.width,
      height: message.height,
      pixels: sourcePixels,
    };
    outputs[message.quality] = new Uint8ClampedArray(sourcePixels);
    return;
  }

  if (message.type === 'clearSource') {
    sources[message.quality] = null;
    outputs[message.quality] = null;
    return;
  }

  if (message.type !== 'render') {
    return;
  }

  const sourceKey: SourceQuality = sources[message.quality] ? message.quality : 'full';
  const source = sources[sourceKey];
  if (!source) {
    return;
  }

  const deformX = new Float32Array(message.deformX);
  const deformY = new Float32Array(message.deformY);
  const output = renderWarped(
    source,
    message.cols,
    message.rows,
    deformX,
    deformY,
    message.dirtyRect ?? null,
    outputs[sourceKey]
  );
  outputs[sourceKey] = output;
  const payload = new Uint8ClampedArray(output);

  const response: WorkerResponse = {
    type: 'renderResult',
    requestId: message.requestId,
    quality: message.quality,
    width: source.width,
    height: source.height,
    pixels: payload.buffer,
  };

  workerScope.postMessage(response, [response.pixels]);
};

export {};
