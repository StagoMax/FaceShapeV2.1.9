/**
 * LiquifyEngine 管理可编辑的形变位移网格。
 * - 输入：归一化坐标、画笔参数
 * - 输出：用于纹理采样的位移场（inverse warp：source = output + displacement(output)）
 */

export type LiquifyToolType = 'push' | 'pull' | 'expand' | 'shrink' | 'smooth' | 'restore';

export interface LiquifyBrushParams {
  tool: LiquifyToolType;
  radius: number; // 归一化半径（0-1）
  strength: number; // 0-3（对齐原生路径的动态力度）
  vector?: { dx: number; dy: number }; // 推/拉使用的位移向量（归一化）
  applySmoothing?: boolean; // 默认为 true；用于批量/子步时避免重复平滑，提升一致性与性能
  // ====== 高级参数（用于更接近 PS/美图的液化手感） ======
  brushBlend?: number; // 0-1，单次笔触与历史位移的混合比例
  brushSoftness?: number; // 0-1，中心的柔和度（越小中心越“软/慢”）
  centerDampen?: number; // 0.05-3.5，中心响应（<1 抑制中心撕裂，>1 允许更强中心推动）
  edgeBoost?: number; // 0.6-4，边缘响应（>1 提升边缘推进，减少中心过度拉伸）
  stepFactor?: number; // 0.01-5，等效“步长”缩放
  decayCurve?: number; // 0.2-4，半径内的径向衰减曲线（pow(1-d, decay)）
  gradientLimit?: number; // 0.015-0.55，限制位移梯度，避免局部折叠/撕裂
}

export interface LiquifyEngineConfig {
  cols?: number;
  rows?: number;
  maxMagnitude?: number;
  falloff?: number;
  smoothingStrength?: number;
  smoothingIterations?: number;
}

export interface ExportedMesh {
  cols: number;
  rows: number;
  deformX: Float32Array;
  deformY: Float32Array;
  indices: Uint16Array;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export class LiquifyEngine {
  private cols: number;

  private rows: number;

  private maxMagnitude: number = 0.55;

  private falloff: number = 0.5;

  private smoothingStrength: number = 0.35;

  private smoothingIterations: number = 1;

  private deformX: Float32Array;

  private deformY: Float32Array;

  private tempX: Float32Array;

  private tempY: Float32Array;

  private indices: Uint16Array;

  constructor(config: LiquifyEngineConfig = {}) {
    this.cols = Math.max(4, Math.floor(config.cols ?? 60));
    this.rows = Math.max(4, Math.floor(config.rows ?? 60));
    this.deformX = new Float32Array(this.cols * this.rows);
    this.deformY = new Float32Array(this.cols * this.rows);
    this.tempX = new Float32Array(this.deformX.length);
    this.tempY = new Float32Array(this.deformY.length);
    this.indices = LiquifyEngine.buildIndices(this.cols, this.rows);
    this.applyConfig(config);
  }

  private applyConfig(config: LiquifyEngineConfig) {
    this.maxMagnitude = config.maxMagnitude ?? this.maxMagnitude ?? 0.55;
    this.falloff = clamp(config.falloff ?? this.falloff ?? 0.5, 0.05, 0.95);
    this.smoothingStrength = clamp(
      config.smoothingStrength ?? this.smoothingStrength ?? 0.35,
      0.05,
      0.95
    );
    this.smoothingIterations = Math.max(
      0,
      Math.floor(config.smoothingIterations ?? this.smoothingIterations ?? 1)
    );
  }

  reconfigure(config: LiquifyEngineConfig = {}) {
    const nextCols = Math.max(4, Math.floor(config.cols ?? this.cols));
    const nextRows = Math.max(4, Math.floor(config.rows ?? this.rows));
    const dimensionChanged = nextCols !== this.cols || nextRows !== this.rows;
    if (dimensionChanged) {
      const sourceCols = this.cols;
      const sourceRows = this.rows;
      const sourceX = this.deformX;
      const sourceY = this.deformY;
      const sampleFromSource = (u: number, v: number) => {
        const uu = clamp(u, 0, 1);
        const vv = clamp(v, 0, 1);
        const gx = uu * (sourceCols - 1);
        const gy = vv * (sourceRows - 1);
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const x1 = Math.min(sourceCols - 1, x0 + 1);
        const y1 = Math.min(sourceRows - 1, y0 + 1);
        const sx = gx - x0;
        const sy = gy - y0;
        const idx = (x: number, y: number) => y * sourceCols + x;
        const interp = (buffer: Float32Array) =>
          buffer[idx(x0, y0)] * (1 - sx) * (1 - sy) +
          buffer[idx(x1, y0)] * sx * (1 - sy) +
          buffer[idx(x0, y1)] * (1 - sx) * sy +
          buffer[idx(x1, y1)] * sx * sy;
        return {
          dx: interp(sourceX),
          dy: interp(sourceY),
        };
      };
      const newLength = nextCols * nextRows;
      const newX = new Float32Array(newLength);
      const newY = new Float32Array(newLength);
      for (let y = 0; y < nextRows; y += 1) {
        const v = nextRows === 1 ? 0 : y / (nextRows - 1);
        for (let x = 0; x < nextCols; x += 1) {
          const u = nextCols === 1 ? 0 : x / (nextCols - 1);
          const { dx, dy } = sampleFromSource(u, v);
          const idx = y * nextCols + x;
          newX[idx] = dx;
          newY[idx] = dy;
        }
      }
      this.cols = nextCols;
      this.rows = nextRows;
      this.deformX = newX;
      this.deformY = newY;
      this.tempX = new Float32Array(newLength);
      this.tempY = new Float32Array(newLength);
      this.indices = LiquifyEngine.buildIndices(nextCols, nextRows);
    }
    this.applyConfig(config);
  }

  private neighborAverage(x: number, y: number) {
    let accX = this.deformX[y * this.cols + x];
    let accY = this.deformY[y * this.cols + x];
    let count = 1;
    const offsets = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) {
        continue;
      }
      const idx = ny * this.cols + nx;
      accX += this.deformX[idx];
      accY += this.deformY[idx];
      count += 1;
    }
    const inv = 1 / count;
    return { x: accX * inv, y: accY * inv };
  }

  reset() {
    this.deformX.fill(0);
    this.deformY.fill(0);
  }

  private readNeighborDisplacement(gx: number, gy: number) {
    const x = clamp(gx, 0, this.cols - 1);
    const y = clamp(gy, 0, this.rows - 1);
    const idx = y * this.cols + x;
    return { x: this.deformX[idx], y: this.deformY[idx] };
  }

  private static applyGradientClampSamples(
    base: { x: number; y: number },
    updated: { x: number; y: number },
    neighborX: { x: number; y: number },
    neighborNegX: { x: number; y: number },
    neighborY: { x: number; y: number },
    neighborNegY: { x: number; y: number },
    gradientLimit: number,
    texelU: number,
    texelV: number
  ) {
    const limit = Math.max(gradientLimit, 1e-6);
    const avgX =
      (neighborX.x + neighborNegX.x + neighborY.x + neighborNegY.x + base.x) / 5;
    const avgY =
      (neighborX.y + neighborNegX.y + neighborY.y + neighborNegY.y + base.y) / 5;

    const cellU = Math.max(texelU, 1e-6);
    const cellV = Math.max(texelV, 1e-6);
    const dDduX = (neighborX.x - neighborNegX.x) / (2 * cellU);
    const dDdvX = (neighborY.x - neighborNegY.x) / (2 * cellV);
    const dDduY = (neighborX.y - neighborNegX.y) / (2 * cellU);
    const dDdvY = (neighborY.y - neighborNegY.y) / (2 * cellV);
    const detJ = (1 + dDduX) * (1 + dDdvY) - dDdvX * dDduY;
    const detT = smoothstep(0.05, 0.25, detJ);

    const localStretch = Math.max(
      Math.max(
        Math.hypot(neighborX.x - base.x, neighborX.y - base.y),
        Math.hypot(neighborNegX.x - base.x, neighborNegX.y - base.y)
      ),
      Math.max(
        Math.hypot(neighborY.x - base.x, neighborY.y - base.y),
        Math.hypot(neighborNegY.x - base.x, neighborNegY.y - base.y)
      )
    );
    const stability = 1 / (1 + localStretch * 8);

    const limitScale = lerp(0.85, 2, clamp(stability, 0, 1)) * lerp(0.75, 2.25, detT);
    const softLimit = limit * limitScale;

    const stretchClamp = Math.max(
      Math.max(
        Math.hypot(updated.x - neighborX.x, updated.y - neighborX.y),
        Math.hypot(updated.x - neighborNegX.x, updated.y - neighborNegX.y)
      ),
      Math.max(
        Math.hypot(updated.x - neighborY.x, updated.y - neighborY.y),
        Math.hypot(updated.x - neighborNegY.x, updated.y - neighborNegY.y)
      )
    );
    const offsetLen = Math.hypot(updated.x - avgX, updated.y - avgY);
    const violation = Math.max(stretchClamp, offsetLen);
    const ratio = violation / Math.max(softLimit, 1e-6);
    const softScale = 1 / (1 + ratio * ratio * 0.25);

    const scaledX = avgX + (updated.x - avgX) * softScale;
    const scaledY = avgY + (updated.y - avgY) * softScale;
    let resultX = lerp(avgX, scaledX, detT);
    let resultY = lerp(avgY, scaledY, detT);
    const rippleT = smoothstep(1.3, 2.3, ratio);
    resultX = lerp(resultX, avgX, rippleT * 0.3);
    resultY = lerp(resultY, avgY, rippleT * 0.3);
    const softAvgX = (neighborX.x + neighborNegX.x + neighborY.x + neighborNegY.x + resultX) / 5;
    const softAvgY = (neighborX.y + neighborNegX.y + neighborY.y + neighborNegY.y + resultY) / 5;
    const rippleSmooth = rippleT * 0.22;
    resultX = lerp(resultX, softAvgX, rippleSmooth);
    resultY = lerp(resultY, softAvgY, rippleSmooth);
    return { x: resultX, y: resultY };
  }

  private applyGradientClamp(
    gx: number,
    gy: number,
    current: { x: number; y: number },
    updated: { x: number; y: number },
    gradientLimit: number
  ) {
    const limit = Math.max(gradientLimit, 1e-6);
    const neighborX = this.readNeighborDisplacement(gx + 1, gy);
    const neighborNegX = this.readNeighborDisplacement(gx - 1, gy);
    const neighborY = this.readNeighborDisplacement(gx, gy + 1);
    const neighborNegY = this.readNeighborDisplacement(gx, gy - 1);
    const avgX = (neighborX.x + neighborNegX.x + neighborY.x + neighborNegY.x + current.x) / 5;
    const avgY = (neighborX.y + neighborNegX.y + neighborY.y + neighborNegY.y + current.y) / 5;

    const cellU = this.cols > 1 ? 1 / (this.cols - 1) : 1;
    const cellV = this.rows > 1 ? 1 / (this.rows - 1) : 1;
    const dDduX = (neighborX.x - neighborNegX.x) / (2 * Math.max(cellU, 1e-6));
    const dDdvX = (neighborY.x - neighborNegY.x) / (2 * Math.max(cellV, 1e-6));
    const dDduY = (neighborX.y - neighborNegX.y) / (2 * Math.max(cellU, 1e-6));
    const dDdvY = (neighborY.y - neighborNegY.y) / (2 * Math.max(cellV, 1e-6));
    const detJ = (1 + dDduX) * (1 + dDdvY) - dDdvX * dDduY;
    const detT = smoothstep(0.05, 0.25, detJ);

    const localStretch = Math.max(
      Math.max(
        Math.hypot(neighborX.x - current.x, neighborX.y - current.y),
        Math.hypot(neighborNegX.x - current.x, neighborNegX.y - current.y)
      ),
      Math.max(
        Math.hypot(neighborY.x - current.x, neighborY.y - current.y),
        Math.hypot(neighborNegY.x - current.x, neighborNegY.y - current.y)
      )
    );
    const stability = 1 / (1 + localStretch * 8);

    const limitScale = lerp(0.85, 2, clamp(stability, 0, 1)) * lerp(0.75, 2.25, detT);
    const softLimit = limit * limitScale;

    const stretchClamp = Math.max(
      Math.max(
        Math.hypot(updated.x - neighborX.x, updated.y - neighborX.y),
        Math.hypot(updated.x - neighborNegX.x, updated.y - neighborNegX.y)
      ),
      Math.max(
        Math.hypot(updated.x - neighborY.x, updated.y - neighborY.y),
        Math.hypot(updated.x - neighborNegY.x, updated.y - neighborNegY.y)
      )
    );
    const offsetLen = Math.hypot(updated.x - avgX, updated.y - avgY);
    const violation = Math.max(stretchClamp, offsetLen);
    const ratio = violation / Math.max(softLimit, 1e-6);
    const softScale = 1 / (1 + ratio * ratio * 0.25);

    const scaledX = avgX + (updated.x - avgX) * softScale;
    const scaledY = avgY + (updated.y - avgY) * softScale;
    let resultX = lerp(avgX, scaledX, detT);
    let resultY = lerp(avgY, scaledY, detT);
    const rippleT = smoothstep(1.3, 2.3, ratio);
    resultX = lerp(resultX, avgX, rippleT * 0.25);
    resultY = lerp(resultY, avgY, rippleT * 0.25);
    const softAvgX = (neighborX.x + neighborNegX.x + neighborY.x + neighborNegY.x + resultX) / 5;
    const softAvgY = (neighborX.y + neighborNegX.y + neighborY.y + neighborNegY.y + resultY) / 5;
    const rippleSmooth = rippleT * 0.18;
    resultX = lerp(resultX, softAvgX, rippleSmooth);
    resultY = lerp(resultY, softAvgY, rippleSmooth);
    return { x: resultX, y: resultY };
  }

  private postGradientClampRegion(
    rowStart: number,
    rowEnd: number,
    colStart: number,
    colEnd: number,
    gradientLimit: number
  ) {
    const limit = Math.max(gradientLimit, 0);
    if (limit <= 0) {
      return;
    }
    const cols = this.cols;
    for (let gy = rowStart; gy <= rowEnd; gy += 1) {
      for (let gx = colStart; gx <= colEnd; gx += 1) {
        const idx = gy * cols + gx;
        const currentX = this.deformX[idx];
        const currentY = this.deformY[idx];
        const clamped = this.applyGradientClamp(
          gx,
          gy,
          { x: currentX, y: currentY },
          { x: currentX, y: currentY },
          limit
        );
        this.tempX[idx] = clamped.x;
        this.tempY[idx] = clamped.y;
      }
    }
    for (let gy = rowStart; gy <= rowEnd; gy += 1) {
      for (let gx = colStart; gx <= colEnd; gx += 1) {
        const idx = gy * cols + gx;
        this.deformX[idx] = this.tempX[idx];
        this.deformY[idx] = this.tempY[idx];
      }
    }
  }

  applyBrush(cx: number, cy: number, params: LiquifyBrushParams) {
    const radius = clamp(params.radius, 0.001, 0.5);
    const influenceStrength = clamp(params.strength, 0, 3);
    if (influenceStrength <= 0) {
      return;
    }
    const strengthNorm = Math.pow(clamp(influenceStrength / 3, 0, 1), 0.65);
    const radiusSq = radius * radius;
    const vector = params.vector ?? { dx: 0, dy: 0 };
    const stepFactor = clamp(params.stepFactor ?? 1, 0.01, 5);
    const brushBlend = clamp(params.brushBlend ?? 1, 0.05, 1);
    const brushSoftness = clamp(params.brushSoftness ?? 0.35, 0.05, 1);
    const centerDampen = clamp(params.centerDampen ?? 0.6, 0.05, 3.5);
    const edgeBoost = clamp(params.edgeBoost ?? 1.15, 0.6, 4);
    const decayCurve = clamp(params.decayCurve ?? 1.3, 0.2, 4);
    let deltaX = vector.dx * stepFactor;
    let deltaY = vector.dy * stepFactor;
    let deltaLength = Math.hypot(deltaX, deltaY);
    // 关键：单次笔触位移不要超过笔刷半径的一定比例，否则在边缘形成过陡梯度，容易 fold（文字断裂）。
    const maxDelta = Math.max(radius * 0.25, 1e-6);
    if (deltaLength > maxDelta) {
      const scale = maxDelta / Math.max(deltaLength, 1e-6);
      deltaX *= scale;
      deltaY *= scale;
      deltaLength = maxDelta;
    }
    const deltaSoft = 1 / (1 + Math.abs(deltaLength) * 8);
    let minRow = this.rows;
    let maxRow = -1;
    let minCol = this.cols;
    let maxCol = -1;

    const cols = this.cols;
    const rows = this.rows;
    const baseGradientLimit = clamp(
      params.gradientLimit ?? clamp(radius * 0.85, 0.015, 0.55),
      0.00001,
      1
    );
    // 关键：网格相邻点间距远大于像素级位移贴图，相同的 gradientLimit 会在网格尺度上过于宽松而产生折叠/撕裂。
    // 将梯度限制按网格间距收紧，使相邻顶点的位移变化不至于跨越一个单元格。
    const cellSize = 1 / Math.max(1, Math.max(cols - 1, rows - 1));
    // 放宽相邻网格允许的梯度（1.5x cell），提升可拉伸幅度，后续用软饱和/轻平滑兜底。
    const gradientLimit = Math.min(baseGradientLimit, cellSize * 1.5);
    const centerX = cx * (cols - 1);
    const centerY = cy * (rows - 1);
    const radiusX = radius * (cols - 1);
    const radiusY = radius * (rows - 1);
    const colStart = clamp(Math.floor(centerX - radiusX) - 1, 0, cols - 1);
    const colEnd = clamp(Math.ceil(centerX + radiusX) + 1, 0, cols - 1);
    const rowStart = clamp(Math.floor(centerY - radiusY) - 1, 0, rows - 1);
    const rowEnd = clamp(Math.ceil(centerY + radiusY) + 1, 0, rows - 1);
    const texelU = cols > 1 ? 1 / (cols - 1) : 0;
    const texelV = rows > 1 ? 1 / (rows - 1) : 0;
    const sourceX = this.deformX;
    const sourceY = this.deformY;
    const colsMinusOne = cols - 1;
    const rowsMinusOne = rows - 1;
    const sampleFromSource = (u: number, v: number) => {
      const uu = clamp(u, 0, 1);
      const vv = clamp(v, 0, 1);
      const gx = uu * colsMinusOne;
      const gy = vv * rowsMinusOne;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = Math.min(cols - 1, x0 + 1);
      const y1 = Math.min(rows - 1, y0 + 1);
      const sx = gx - x0;
      const sy = gy - y0;
      const idx = (x: number, y: number) => y * cols + x;
      const idx00 = idx(x0, y0);
      const idx10 = idx(x1, y0);
      const idx01 = idx(x0, y1);
      const idx11 = idx(x1, y1);
      const w00 = (1 - sx) * (1 - sy);
      const w10 = sx * (1 - sy);
      const w01 = (1 - sx) * sy;
      const w11 = sx * sy;
      return {
        x: sourceX[idx00] * w00 + sourceX[idx10] * w10 + sourceX[idx01] * w01 + sourceX[idx11] * w11,
        y: sourceY[idx00] * w00 + sourceY[idx10] * w10 + sourceY[idx01] * w01 + sourceY[idx11] * w11,
      };
    };

    for (let gy = rowStart; gy <= rowEnd; gy += 1) {
      const v = rows === 1 ? 0 : gy / (rows - 1);
      const dy = v - cy;
      for (let gx = colStart; gx <= colEnd; gx += 1) {
        const u = cols === 1 ? 0 : gx / (cols - 1);
        const dx = u - cx;
        const distSq = dx * dx + dy * dy;
        const idx = gy * cols + gx;
        const currentX = this.deformX[idx];
        const currentY = this.deformY[idx];

        let nextX = currentX;
        let nextY = currentY;

        if (distSq <= radiusSq) {
          const distNorm = Math.sqrt(distSq) / Math.max(radius, 1e-6);
          const falloffWeight = Math.exp(-(distNorm * distNorm) / Math.max(this.falloff, 1e-6));
          // 用 (1 - d^2) 替代 (1 - d)，让边缘衰减更“长”，避免反复涂抹时边缘被钉死造成剪切断层。
          const radialBase = Math.max(1 - distNorm * distNorm, 0);
          const radialProfile = Math.pow(radialBase, decayCurve);
          const influence = falloffWeight * radialProfile;

          const neighborX = this.readNeighborDisplacement(gx + 1, gy);
          const neighborNegX = this.readNeighborDisplacement(gx - 1, gy);
          const neighborY = this.readNeighborDisplacement(gx, gy + 1);
          const neighborNegY = this.readNeighborDisplacement(gx, gy - 1);
          const localStretch = Math.max(
            Math.max(
              Math.hypot(neighborX.x - currentX, neighborX.y - currentY),
              Math.hypot(neighborNegX.x - currentX, neighborNegX.y - currentY)
            ),
            Math.max(
              Math.hypot(neighborY.x - currentX, neighborY.y - currentY),
              Math.hypot(neighborNegY.x - currentX, neighborNegY.y - currentY)
            )
          );
          const stability = 1 / (1 + localStretch * 8);
          const stabilityScale = lerp(0.5, 1, clamp(stability, 0, 1));
          const smoothWeight = smoothstep(0, 1, distNorm);
          const softMix = lerp(brushSoftness, 1, smoothWeight);
          const centerFactor = lerp(centerDampen, 1, Math.pow(distNorm, 0.75));
          const edgeFactor = lerp(1, edgeBoost, Math.pow(distNorm, 1.1));
          const brushScale = softMix * centerFactor * edgeFactor * stabilityScale * deltaSoft;
          const flow = clamp(strengthNorm * influence * brushScale, 0, 1);

          if (flow > 0) {
            minRow = Math.min(minRow, gy);
            maxRow = Math.max(maxRow, gy);
            minCol = Math.min(minCol, gx);
            maxCol = Math.max(maxCol, gx);
          }

          switch (params.tool) {
            case 'push': {
              const alpha = flow * brushBlend;
              const deltaUx = deltaX * alpha;
              const deltaUy = deltaY * alpha;
              const baseU = clamp(u - deltaUx, 0, 1);
              const baseV = clamp(v - deltaUy, 0, 1);
              const advectedSample = sampleFromSource(baseU, baseV);
              const advectedX = advectedSample.x;
              const advectedY = advectedSample.y;
              nextX = advectedX - deltaUx;
              nextY = advectedY - deltaUy;
              if (gradientLimit > 0.00001) {
                const neighborXSample = sampleFromSource(baseU + texelU, baseV);
                const neighborNegXSample = sampleFromSource(baseU - texelU, baseV);
                const neighborYSample = sampleFromSource(baseU, baseV + texelV);
                const neighborNegYSample = sampleFromSource(baseU, baseV - texelV);
	                const clamped = LiquifyEngine.applyGradientClampSamples(
	                  { x: advectedX, y: advectedY },
	                  { x: nextX, y: nextY },
	                  neighborXSample,
	                  neighborNegXSample,
	                  neighborYSample,
	                  neighborNegYSample,
	                  gradientLimit,
	                  texelU,
	                  texelV
	                );
                nextX = clamped.x;
                nextY = clamped.y;
              }
              break;
            }
            case 'pull': {
              const alpha = flow * brushBlend;
              const deltaUx = deltaX * alpha;
              const deltaUy = deltaY * alpha;
              const baseU = clamp(u - deltaUx, 0, 1);
              const baseV = clamp(v - deltaUy, 0, 1);
              const advectedSample = sampleFromSource(baseU, baseV);
              const advectedX = advectedSample.x;
              const advectedY = advectedSample.y;
              nextX = advectedX + deltaUx;
              nextY = advectedY + deltaUy;
              if (gradientLimit > 0.00001) {
                const neighborXSample = sampleFromSource(baseU + texelU, baseV);
                const neighborNegXSample = sampleFromSource(baseU - texelU, baseV);
                const neighborYSample = sampleFromSource(baseU, baseV + texelV);
                const neighborNegYSample = sampleFromSource(baseU, baseV - texelV);
	                const clamped = LiquifyEngine.applyGradientClampSamples(
	                  { x: advectedX, y: advectedY },
	                  { x: nextX, y: nextY },
	                  neighborXSample,
	                  neighborNegXSample,
	                  neighborYSample,
	                  neighborNegYSample,
	                  gradientLimit,
	                  texelU,
	                  texelV
	                );
                nextX = clamped.x;
                nextY = clamped.y;
              }
              break;
            }
            case 'expand':
            case 'shrink': {
              const len = Math.sqrt(distSq) || 1;
              const ux = dx / len;
              const uy = dy / len;
              const dir = params.tool === 'expand' ? 1 : -1;
              const radial = (1 - distNorm) * strengthNorm * influence * 0.6;
              const targetX = currentX + ux * radial * dir;
              const targetY = currentY + uy * radial * dir;
              nextX = lerp(currentX, targetX, brushBlend);
              nextY = lerp(currentY, targetY, brushBlend);
              break;
            }
            case 'restore': {
              const restoreWeight = clamp(strengthNorm * influence, 0, 1);
              const targetX = currentX * (1 - restoreWeight);
              const targetY = currentY * (1 - restoreWeight);
              nextX = lerp(currentX, targetX, brushBlend);
              nextY = lerp(currentY, targetY, brushBlend);
              break;
            }
            case 'smooth': {
              const avg = this.neighborAverage(gx, gy);
              const t = clamp(strengthNorm * influence, 0, 1);
              nextX = lerp(currentX, avg.x, t);
              nextY = lerp(currentY, avg.y, t);
              break;
            }
            default:
              break;
          }

          if (
            gradientLimit > 0.00001 &&
            params.tool !== 'smooth' &&
            params.tool !== 'push' &&
            params.tool !== 'pull'
          ) {
            const clamped = this.applyGradientClamp(
              gx,
              gy,
              { x: currentX, y: currentY },
              { x: nextX, y: nextY },
              gradientLimit
            );
            nextX = clamped.x;
            nextY = clamped.y;
          }
        }

        // 全局幅度限制，避免位移场发散
        const mag = Math.hypot(nextX, nextY);
        if (mag > this.maxMagnitude) {
          const scale = this.maxMagnitude / Math.max(mag, 1e-6);
          nextX *= scale;
          nextY *= scale;
        }

        this.tempX[idx] = nextX;
        this.tempY[idx] = nextY;
      }
    }

    for (let gy = rowStart; gy <= rowEnd; gy += 1) {
      for (let gx = colStart; gx <= colEnd; gx += 1) {
        const idx = gy * cols + gx;
        this.deformX[idx] = this.tempX[idx];
        this.deformY[idx] = this.tempY[idx];
      }
    }

    const shouldSmooth = params.applySmoothing !== false && params.tool !== 'restore';
    if (shouldSmooth && this.smoothingIterations > 0 && minRow <= maxRow && minCol <= maxCol) {
      const smoothRowStart = Math.max(0, minRow);
      const smoothRowEnd = Math.min(this.rows - 1, maxRow);
      const smoothColStart = Math.max(0, minCol);
      const smoothColEnd = Math.min(this.cols - 1, maxCol);
      // 先做一次梯度投影，抑制局部折叠，再进入平滑迭代（更像 PS 的“不会撕裂”的手感）。
      if (gradientLimit > 0.00001) {
        for (let iter = 0; iter < 2; iter += 1) {
          this.postGradientClampRegion(
            smoothRowStart,
            smoothRowEnd,
            smoothColStart,
            smoothColEnd,
            gradientLimit
          );
        }
      }
      this.smoothRegion(smoothRowStart, smoothRowEnd, smoothColStart, smoothColEnd, cx, cy, params.radius);
    }
  }

  sampleDisplacement(u: number, v: number) {
    const uu = clamp(u, 0, 1);
    const vv = clamp(v, 0, 1);
    const gx = uu * (this.cols - 1);
    const gy = vv * (this.rows - 1);
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = Math.min(this.cols - 1, x0 + 1);
    const y1 = Math.min(this.rows - 1, y0 + 1);
    const sx = gx - x0;
    const sy = gy - y0;
    const idx = (x: number, y: number) => y * this.cols + x;
    const interp = (buffer: Float32Array) =>
      buffer[idx(x0, y0)] * (1 - sx) * (1 - sy) +
      buffer[idx(x1, y0)] * sx * (1 - sy) +
      buffer[idx(x0, y1)] * (1 - sx) * sy +
      buffer[idx(x1, y1)] * sx * sy;
    return {
      dx: interp(this.deformX),
      dy: interp(this.deformY),
    };
  }

  /**
   * 将“源图坐标”(uSource/vSource) 映射到当前“输出坐标”(u/v)。
   *
   * 注意：本引擎的位移场用于纹理采样（inverse warp）：source = output + displacement(output)。
   * 因此这里需要求解 output，使其满足 output + displacement(output) ≈ source。
   */
  mapSourceToOutput(uSource: number, vSource: number, iterations = 6) {
    const targetU = clamp(uSource, 0, 1);
    const targetV = clamp(vSource, 0, 1);
    let u = targetU;
    let v = targetV;
    const iterCount = Math.max(1, Math.floor(iterations));
    for (let i = 0; i < iterCount; i += 1) {
      const { dx, dy } = this.sampleDisplacement(u, v);
      const estimateU = u + dx;
      const estimateV = v + dy;
      const errorU = targetU - estimateU;
      const errorV = targetV - estimateV;
      u = clamp(u + errorU, 0, 1);
      v = clamp(v + errorV, 0, 1);
      if (Math.hypot(errorU, errorV) < 1e-5) {
        break;
      }
    }
    return { u, v };
  }

  exportDisplacement(): ExportedMesh {
    return {
      cols: this.cols,
      rows: this.rows,
      deformX: this.deformX,
      deformY: this.deformY,
      indices: this.indices,
    };
  }

  loadDisplacement(mesh: Pick<ExportedMesh, 'cols' | 'rows' | 'deformX' | 'deformY'>) {
    const { cols, rows, deformX, deformY } = mesh;
    const nextCols = Math.max(4, Math.floor(cols));
    const nextRows = Math.max(4, Math.floor(rows));
    this.cols = nextCols;
    this.rows = nextRows;
    const length = nextCols * nextRows;
    this.deformX = new Float32Array(length);
    this.deformY = new Float32Array(length);
    this.tempX = new Float32Array(length);
    this.tempY = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      this.deformX[i] = deformX[i] ?? 0;
      this.deformY[i] = deformY[i] ?? 0;
    }
    this.indices = LiquifyEngine.buildIndices(nextCols, nextRows);
  }

  getMaxMagnitude() {
    return this.maxMagnitude;
  }

  private smoothRegion(
    minRow: number,
    maxRow: number,
    minCol: number,
    maxCol: number,
    centerU: number,
    centerV: number,
    brushRadius: number
  ) {
    const centerX = centerU * (this.cols - 1);
    const centerY = centerV * (this.rows - 1);
    const maxDim = Math.max(this.cols - 1, this.rows - 1);
    const radiusCells = Math.max(1, brushRadius * maxDim * 1.85);
    for (let iter = 0; iter < this.smoothingIterations; iter += 1) {
      for (let gy = minRow; gy <= maxRow; gy += 1) {
        for (let gx = minCol; gx <= maxCol; gx += 1) {
          const idx = gy * this.cols + gx;
          let accumX = this.deformX[idx];
          let accumY = this.deformY[idx];
          let count = 1;
          for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
              if (ox === 0 && oy === 0) continue;
              const nx = gx + ox;
              const ny = gy + oy;
              if (nx < minCol || nx > maxCol || ny < minRow || ny > maxRow) continue;
              const nIdx = ny * this.cols + nx;
              accumX += this.deformX[nIdx];
              accumY += this.deformY[nIdx];
              count += 1;
            }
          }
          const dist = Math.hypot(gx - centerX, gy - centerY);
          const feather = radiusCells > 1 ? clamp(1 - dist / radiusCells, 0, 1) : 1;
          this.tempX[idx] = (accumX / count) * feather + this.deformX[idx] * (1 - feather);
          this.tempY[idx] = (accumY / count) * feather + this.deformY[idx] * (1 - feather);
        }
      }
      for (let gy = minRow; gy <= maxRow; gy += 1) {
        for (let gx = minCol; gx <= maxCol; gx += 1) {
          const idx = gy * this.cols + gx;
          this.deformX[idx] =
            this.deformX[idx] * (1 - this.smoothingStrength) + this.tempX[idx] * this.smoothingStrength;
          this.deformY[idx] =
            this.deformY[idx] * (1 - this.smoothingStrength) + this.tempY[idx] * this.smoothingStrength;
        }
      }
    }
  }

  private static buildIndices(cols: number, rows: number) {
    const quadCount = (cols - 1) * (rows - 1);
    const indices = new Uint16Array(quadCount * 6);
    let offset = 0;
    for (let y = 0; y < rows - 1; y += 1) {
      for (let x = 0; x < cols - 1; x += 1) {
        const topLeft = y * cols + x;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + cols;
        const bottomRight = bottomLeft + 1;
        indices[offset + 0] = topLeft;
        indices[offset + 1] = bottomLeft;
        indices[offset + 2] = topRight;
        indices[offset + 3] = topRight;
        indices[offset + 4] = bottomLeft;
        indices[offset + 5] = bottomRight;
        offset += 6;
      }
    }
    return indices;
  }
}
