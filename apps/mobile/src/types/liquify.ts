export interface LiquifyBrushMetrics {
  position: {
    normalizedX: number
    normalizedY: number
  }
  radius: {
    normalized: number
    pixels: number
  }
  falloff: number
  decayCurve: number
  delta: {
    dxNorm: number
    dyNorm: number
    lengthNorm: number
    dxPx: number
    dyPx: number
    lengthPx: number
  }
  dynamics: {
    pressure: number
    speedPxPerSec: number
    deltaTime: number
    strokeDistance: number
  }
  computed: {
    effectiveStrength: number
    brushBlend: number
    brushSoftness: number
    centerResponse: number
    edgeResponse: number
    stepFactor: number
  }
}

