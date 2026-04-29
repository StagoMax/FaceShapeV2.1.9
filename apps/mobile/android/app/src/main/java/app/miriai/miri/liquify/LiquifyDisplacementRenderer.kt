package app.miriai.miri.liquify

import android.graphics.Bitmap
import android.opengl.GLES20
import android.opengl.GLES30
import android.opengl.GLException
import android.opengl.GLUtils
import android.util.Log
import app.miriai.miri.BuildConfig
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import kotlin.math.ceil
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * 简化后的 GPU 渲染器：只负责把原图绘制到 GLSurfaceView 上，不做任何液化处理。
 */
class LiquifyDisplacementRenderer {
  private var sourceTexture: Int = 0
  private var displacementTextureA: Int = 0
  private var displacementTextureB: Int = 0
  private var activeDisplacementTexture: Int = 0
  private var identityDisplacementTexture: Int = 0
  private var framebuffer: Int = 0
  private var viewWidth = 0
  private var viewHeight = 0
  private var textureWidth = 0
  private var textureHeight = 0
  private var displacementWidth = 0
  private var displacementHeight = 0
  private val maxDisplacementSideQuality = 1280
  private val maxDisplacementSidePerformance = 960
  private var renderProgram = 0
  private var positionHandle = 0
  private var uvHandle = 0
  private var sourceSamplerHandle = 0
  private var displacementSamplerHandle = 0
  private var magnitudeHandle = 0
  private var previewModeHandle = 0
  private var previewCenterHandle = 0
  private var previewSpanHandle = 0
  private var previewRadiusHandle = 0
  private var previewWeightMixHandle = 0
  private var previewVectorMixHandle = 0
  private var previewBrushMixHandle = 0
  private var previewBrushCenterHandle = 0
  private var previewBrushRadiusHandle = 0
  private var previewBrushFalloffHandle = 0
  private var previewBrushDecayHandle = 0
  private var debugModeHandle = 0
  private var brushProgram = 0
  private var brushPositionHandle = 0
  private var brushUvHandle = 0
  private var brushSamplerHandle = 0
  private var brushCenterHandle = 0
  private var brushDeltaHandle = 0
  private var brushRadiusHandle = 0
  private var brushStrengthHandle = 0
  private var brushFalloffHandle = 0
  private var brushRadiusUvHandle = 0
  private var brushBlendHandle = 0
  private var brushSoftnessHandle = 0
  private var brushTexelHandle = 0
  private var brushDeltaLengthHandle = 0
  private var brushStrengthScaleHandle = 0
  private var brushCenterResponseHandle = 0
  private var brushEdgeResponseHandle = 0
  private var brushStepFactorHandle = 0
  private var brushDecayCurveHandle = 0
  private var brushGradientLimitHandle = 0
  private var brushIsRestoreHandle = 0
  private var brushMaxMagnitudeHandle = 0
  private var brushSoftKHandle = 0
  private var brushRestoreBoostHandle = 0
  private var brushRippleStartHandle = 0
  private var brushRippleEndHandle = 0
  private var brushRippleMixHandle = 0
  private var brushRippleSmoothHandle = 0
  private var brushGradientScaleHandle = 0
  private var brushRestoreToIdentityHandle = 0
  private var smoothProgram = 0
  private var smoothPositionHandle = 0
  private var smoothUvHandle = 0
  private var smoothSamplerHandle = 0
  private var smoothCenterHandle = 0
  private var smoothFalloffHandle = 0
  private var smoothStrengthHandle = 0
  private var smoothRadiusUvHandle = 0
  private var smoothTexelHandle = 0
  private var smoothGradientLimitHandle = 0
  private var smoothDecayCurveHandle = 0
  private var smoothMaxMagnitudeHandle = 0
  private var smoothSoftKHandle = 0
  private var smoothRippleStartHandle = 0
  private var smoothRippleEndHandle = 0
  private var smoothRippleMixHandle = 0
  private var smoothRippleSmoothHandle = 0
  private var smoothGradientScaleHandle = 0
  private var viewportConfig: LiquifyViewportData? = null
  private var previewConfig: LiquifyPreviewWindowConfig? = null
  private var verticesDirty = true
  private var brushStrengthScale = 1f
  private var brushCenterResponse = 0.6f
  private var brushEdgeResponse = 1.15f
  private var brushStepFactor = 0.8f
  private var brushDecayCurve = 0.8f
  private var gradientLimitScaleMax = 1.5f
  private var softSaturationK = 0.25f
  private var restoreBoost = 1.8f
  private var rippleStart = 1.3f
  private var rippleEnd = 2.3f
  private var rippleMix = 0.3f
  private var rippleSmooth = 0.22f
  private var performanceMode = false
  private var centerResponseMin = 0.2f
  private var centerResponseMax = 1.5f
  private var edgeResponseMin = 0.6f
  private var edgeResponseMax = 2.4f
  private var stepFactorMin = 0.05f
  private var stepFactorMax = 3f
  private var previewWeightMix = 0f
  private var previewVectorMix = 0f
  private var previewBrushMix = 0f
  private var previewBrushCenterX = 0.5f
  private var previewBrushCenterY = 0.5f
  private var previewBrushRadiusX = 0f
  private var previewBrushRadiusY = 0f
  private var previewBrushFalloff = 0.5f
  private var previewBrushDecay = 0.8f
  private var previewSoftSaturationK = softSaturationK
  private var previewRippleStart = rippleStart
  private var previewRippleEnd = rippleEnd
  private var previewRippleMix = rippleMix
  private var previewRippleSmooth = rippleSmooth
  private val exportDebugLogs = BuildConfig.DEBUG
  private var restoreToIdentity = false
  private val snapshotTextures: MutableMap<Int, Int> = mutableMapOf()
  private val displacementStateMagic = 0x4C515346
  private val displacementStateVersion = 1

  private val quadVertices: FloatBuffer = ByteBuffer
    .allocateDirect(6 * 2 * Float.SIZE_BYTES)
    .order(ByteOrder.nativeOrder())
    .asFloatBuffer()

  private val quadUVs: FloatBuffer = ByteBuffer
    .allocateDirect(6 * 2 * Float.SIZE_BYTES)
    .order(ByteOrder.nativeOrder())
    .asFloatBuffer()
    .put(
      floatArrayOf(
        0f, 1f,
        1f, 1f,
        0f, 0f,
        0f, 0f,
        1f, 1f,
        1f, 0f,
      ),
    ).apply { position(0) }

  private val fullScreenVertices: FloatBuffer = ByteBuffer
    .allocateDirect(6 * 2 * Float.SIZE_BYTES)
    .order(ByteOrder.nativeOrder())
    .asFloatBuffer()
    .put(
      floatArrayOf(
        -1f, -1f,
        1f, -1f,
        -1f, 1f,
        -1f, 1f,
        1f, -1f,
        1f, 1f,
      ),
    ).apply { position(0) }

  private val fullScreenUVs: FloatBuffer = ByteBuffer
    .allocateDirect(6 * 2 * Float.SIZE_BYTES)
    .order(ByteOrder.nativeOrder())
    .asFloatBuffer()
    .put(
      floatArrayOf(
        0f, 0f,
        1f, 0f,
        0f, 1f,
        0f, 1f,
        1f, 0f,
        1f, 1f,
      ),
    ).apply { position(0) }

  fun ensureSetup(width: Int, height: Int) {
    if (width <= 0 || height <= 0) return
    if (renderProgram == 0) {
      renderProgram = buildProgram(VERTEX_SHADER, FRAGMENT_SHADER)
      positionHandle = GLES20.glGetAttribLocation(renderProgram, "aPosition")
      uvHandle = GLES20.glGetAttribLocation(renderProgram, "aUV")
      sourceSamplerHandle = GLES20.glGetUniformLocation(renderProgram, "uSource")
      displacementSamplerHandle = GLES20.glGetUniformLocation(renderProgram, "uDisplacement")
      magnitudeHandle = GLES20.glGetUniformLocation(renderProgram, "uMaxMagnitude")
      previewModeHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewMode")
      previewCenterHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewCenter")
      previewSpanHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewSpan")
      previewRadiusHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewRadius")
      previewWeightMixHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewWeightMix")
      previewVectorMixHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewVectorMix")
      previewBrushMixHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushMix")
      previewBrushCenterHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushCenter")
      previewBrushRadiusHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushRadius")
      previewBrushFalloffHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushFalloff")
      previewBrushDecayHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushDecay")
      debugModeHandle = GLES20.glGetUniformLocation(renderProgram, "uDebugMode")
      previewBrushMixHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushMix")
      previewBrushCenterHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushCenter")
      previewBrushRadiusHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushRadius")
      previewBrushFalloffHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushFalloff")
      previewBrushDecayHandle = GLES20.glGetUniformLocation(renderProgram, "uPreviewBrushDecay")
    }
    if (framebuffer == 0) {
      val buffers = IntArray(1)
      GLES20.glGenFramebuffers(1, buffers, 0)
      framebuffer = buffers[0]
    }
    if (brushProgram == 0) {
      brushProgram = buildProgram(VERTEX_SHADER, BRUSH_FRAGMENT_SHADER)
      brushPositionHandle = GLES20.glGetAttribLocation(brushProgram, "aPosition")
      brushUvHandle = GLES20.glGetAttribLocation(brushProgram, "aUV")
      brushSamplerHandle = GLES20.glGetUniformLocation(brushProgram, "uDisplacement")
      brushCenterHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushCenter")
      brushDeltaHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushDelta")
      brushDeltaLengthHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushDeltaLength")
      brushRadiusHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushRadius")
      brushStrengthHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushStrength")
      brushFalloffHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushFalloff")
      brushRadiusUvHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushRadiusUV")
      brushBlendHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushBlend")
      brushSoftnessHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushSoftness")
      brushStrengthScaleHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushStrengthScale")
      brushCenterResponseHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushCenterDampen")
      brushEdgeResponseHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushEdgeBoost")
      brushTexelHandle = GLES20.glGetUniformLocation(brushProgram, "uTexelSize")
      brushStepFactorHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushStepFactor")
      brushDecayCurveHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushDecayCurve")
      brushGradientLimitHandle = GLES20.glGetUniformLocation(brushProgram, "uBrushGradientLimit")
      brushIsRestoreHandle = GLES20.glGetUniformLocation(brushProgram, "uIsRestore")
      brushMaxMagnitudeHandle = GLES20.glGetUniformLocation(brushProgram, "uMaxMagnitude")
      brushSoftKHandle = GLES20.glGetUniformLocation(brushProgram, "uSoftK")
      brushRestoreBoostHandle = GLES20.glGetUniformLocation(brushProgram, "uRestoreBoost")
      brushRippleStartHandle = GLES20.glGetUniformLocation(brushProgram, "uRippleStart")
      brushRippleEndHandle = GLES20.glGetUniformLocation(brushProgram, "uRippleEnd")
      brushRippleMixHandle = GLES20.glGetUniformLocation(brushProgram, "uRippleMix")
      brushRippleSmoothHandle = GLES20.glGetUniformLocation(brushProgram, "uRippleSmooth")
      brushGradientScaleHandle = GLES20.glGetUniformLocation(brushProgram, "uGradientScaleMax")
      brushRestoreToIdentityHandle = GLES20.glGetUniformLocation(brushProgram, "uRestoreToIdentity")
    }
    if (smoothProgram == 0) {
      smoothProgram = buildProgram(VERTEX_SHADER, SMOOTH_FRAGMENT_SHADER)
      smoothPositionHandle = GLES20.glGetAttribLocation(smoothProgram, "aPosition")
      smoothUvHandle = GLES20.glGetAttribLocation(smoothProgram, "aUV")
      smoothSamplerHandle = GLES20.glGetUniformLocation(smoothProgram, "uDisplacement")
      smoothCenterHandle = GLES20.glGetUniformLocation(smoothProgram, "uBrushCenter")
      smoothFalloffHandle = GLES20.glGetUniformLocation(smoothProgram, "uBrushFalloff")
      smoothStrengthHandle = GLES20.glGetUniformLocation(smoothProgram, "uSmoothStrength")
      smoothRadiusUvHandle = GLES20.glGetUniformLocation(smoothProgram, "uBrushRadiusUV")
      smoothTexelHandle = GLES20.glGetUniformLocation(smoothProgram, "uTexelSize")
      smoothGradientLimitHandle = GLES20.glGetUniformLocation(smoothProgram, "uGradientLimit")
      smoothDecayCurveHandle = GLES20.glGetUniformLocation(smoothProgram, "uBrushDecayCurve")
      smoothMaxMagnitudeHandle = GLES20.glGetUniformLocation(smoothProgram, "uMaxMagnitude")
      smoothSoftKHandle = GLES20.glGetUniformLocation(smoothProgram, "uSoftK")
      smoothRippleStartHandle = GLES20.glGetUniformLocation(smoothProgram, "uRippleStart")
      smoothRippleEndHandle = GLES20.glGetUniformLocation(smoothProgram, "uRippleEnd")
      smoothRippleMixHandle = GLES20.glGetUniformLocation(smoothProgram, "uRippleMix")
      smoothRippleSmoothHandle = GLES20.glGetUniformLocation(smoothProgram, "uRippleSmooth")
      smoothGradientScaleHandle = GLES20.glGetUniformLocation(smoothProgram, "uGradientScaleMax")
    }
    viewWidth = width
    viewHeight = height
    if (viewportConfig != null) {
      updateQuadVertices(viewportConfig!!)
    } else if (verticesDirty) {
      resetQuadVertices()
    }
  }

  fun bindSourceBitmap(bitmap: Bitmap) {
    if (sourceTexture == 0) {
      val textures = IntArray(1)
      GLES20.glGenTextures(1, textures, 0)
      sourceTexture = textures[0]
    }
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, sourceTexture)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    // 波纹/摩尔纹的根因：局部强压缩(minification)时仅用双线性采样会发生 aliasing。
    // 注意：部分机型/驱动对 glGenerateMipmap 不稳定，因此这里采用“CPU 生成 mipmap 链 + 逐级上传”的方式，
    // 在保证稳定性的同时提升采样连续性。
    uploadSourceTextureWithMipmaps(bitmap)
    textureWidth = bitmap.width
    textureHeight = bitmap.height
    ensureDisplacementTexture(textureWidth, textureHeight)
  }

  private fun uploadSourceTextureWithMipmaps(bitmap: Bitmap) {
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    if (bitmap.width <= 0 || bitmap.height <= 0) {
      return
    }

    val maxSizeValues = IntArray(1)
    GLES20.glGetIntegerv(GLES20.GL_MAX_TEXTURE_SIZE, maxSizeValues, 0)
    val glMaxSize = maxSizeValues[0].takeIf { it > 0 } ?: 4096
    val viewportMax = max(viewWidth, viewHeight)
    val desiredMax = if (viewportMax > 0) {
      min(glMaxSize, (viewportMax * 2).coerceIn(1024, 4096))
    } else {
      min(glMaxSize, 2048)
    }

    val maxDim = max(bitmap.width, bitmap.height).coerceAtLeast(1)
    val baseBitmap: Bitmap
    val baseIsScaledCopy: Boolean
    if (maxDim > desiredMax && desiredMax > 0) {
      val scale = desiredMax.toFloat() / maxDim.toFloat()
      val targetW = max(1, (bitmap.width * scale).roundToInt())
      val targetH = max(1, (bitmap.height * scale).roundToInt())
      baseBitmap = Bitmap.createScaledBitmap(bitmap, targetW, targetH, true)
      baseIsScaledCopy = true
    } else {
      baseBitmap = bitmap
      baseIsScaledCopy = false
    }

    var currentBitmap = baseBitmap
    var currentW = baseBitmap.width.coerceAtLeast(1)
    var currentH = baseBitmap.height.coerceAtLeast(1)
    var maxLevel = 0
    var mipmapReady = false

    try {
      GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, baseBitmap, 0)
      // 逐级生成 mipmaps。为了避免内存/时间过大，层级上限控制在 12（足够覆盖到 1x1）。
      var level = 1
      var prevBitmap = baseBitmap
      while ((currentW > 1 || currentH > 1) && level <= 12) {
        val nextW = max(1, currentW / 2)
        val nextH = max(1, currentH / 2)
        val nextBitmap = Bitmap.createScaledBitmap(prevBitmap, nextW, nextH, true)
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, level, nextBitmap, 0)
        if (prevBitmap !== baseBitmap) {
          prevBitmap.recycle()
        }
        prevBitmap = nextBitmap
        currentW = nextW
        currentH = nextH
        maxLevel = level
        level += 1
      }
      if (prevBitmap !== baseBitmap) {
        prevBitmap.recycle()
      }
      if (maxLevel > 0) {
        mipmapReady = true
        GLES30.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES30.GL_TEXTURE_BASE_LEVEL, 0)
        GLES30.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES30.GL_TEXTURE_MAX_LEVEL, maxLevel)
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR_MIPMAP_LINEAR)
      }
    } catch (e: Exception) {
      Log.w(TAG, "uploadSourceTextureWithMipmaps failed, fallback to linear sampling", e)
      GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
      mipmapReady = false
    } finally {
      if (baseIsScaledCopy) {
        currentBitmap.recycle()
      } else if (currentBitmap !== bitmap && !currentBitmap.isRecycled) {
        currentBitmap.recycle()
      }
      if (!mipmapReady) {
        // 确保不会留下“未完整定义 mipmap 但使用 mipmap filter”的状态。
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
      }
    }
  }

  fun applyBrush(
    command: LiquifyBrushCommand,
    falloff: Float,
    smoothingStrength: Float,
    smoothingIterations: Int,
    maxMagnitude: Float,
  ) {
    if ((displacementTextureA == 0 || displacementTextureB == 0) && textureWidth > 0 && textureHeight > 0) {
      ensureDisplacementTexture(textureWidth, textureHeight)
    }
    if (displacementTextureA == 0 || displacementTextureB == 0) return
    if (activeDisplacementTexture == 0) {
      activeDisplacementTexture = displacementTextureA
    }
    val tool = command.tool.lowercase()
    var readTexture = activeDisplacementTexture
    var lastCommand = command
    val deltaLen = hypot(command.deltaX.toDouble(), command.deltaY.toDouble()).toFloat()
    val stepFactor = computeDynamicStepFactor(command)
    val effectiveLen = deltaLen * stepFactor
    // 与 shader 内的单步限制保持同量级，避免快拖动时被 clamp 丢失位移，从而产生“快/慢强度不一致”。
    val maxStep = max(command.radius * 0.25f, 1e-5f)
    val desiredSteps = if (tool == "restore" || deltaLen < 1e-6f || effectiveLen <= maxStep) {
      1
    } else {
      ceil((effectiveLen / maxStep).toDouble()).toInt().coerceAtLeast(1)
    }
    val stepsCap = if (performanceMode) 8 else 12
    val steps = desiredSteps.coerceIn(1, stepsCap)
    if (steps <= 1) {
      val writeTexture = alternateTexture(readTexture)
      val brushApplied = runBrushPass(readTexture, writeTexture, command, falloff, maxMagnitude)
      if (!brushApplied) {
        return
      }
      readTexture = writeTexture
    } else {
      val startX = (command.normalizedX - command.deltaX).coerceIn(0f, 1f)
      val startY = (command.normalizedY - command.deltaY).coerceIn(0f, 1f)
      val stepDx = command.deltaX / steps.toFloat()
      val stepDy = command.deltaY / steps.toFloat()
      for (i in 1..steps) {
        val t = i.toFloat() / steps.toFloat()
        val cx = (startX + command.deltaX * t).coerceIn(0f, 1f)
        val cy = (startY + command.deltaY * t).coerceIn(0f, 1f)
        val stepCommand = command.copy(
          normalizedX = cx,
          normalizedY = cy,
          deltaX = stepDx,
          deltaY = stepDy,
        )
        val writeTexture = alternateTexture(readTexture)
        val brushApplied = runBrushPass(readTexture, writeTexture, stepCommand, falloff, maxMagnitude)
        if (!brushApplied) {
          return
        }
        readTexture = writeTexture
        lastCommand = stepCommand
      }
    }
    activeDisplacementTexture = readTexture
    if (tool != "restore") {
      val perfSmoothIter = if (performanceMode) smoothingIterations.coerceAtMost(1) else smoothingIterations
      val smoothed = runSmoothPass(lastCommand, falloff, smoothingStrength, perfSmoothIter, maxMagnitude)
      if (smoothed != 0) {
        activeDisplacementTexture = smoothed
      }
    }
  }

  fun applySmoothing(
    command: LiquifyBrushCommand,
    falloff: Float,
      smoothingStrength: Float,
      smoothingIterations: Int,
      maxMagnitude: Float,
    ) {
    if (smoothingStrength <= 0f || smoothingIterations <= 0) {
      return
    }
    val smoothed = runSmoothPass(command, falloff, smoothingStrength, smoothingIterations, maxMagnitude)
    if (smoothed != 0) {
      activeDisplacementTexture = smoothed
    }
  }

  fun clearDisplacementTexture() {
    if (displacementTextureA == 0 || displacementTextureB == 0) return
    clearTexture(displacementTextureA)
    clearTexture(displacementTextureB)
    activeDisplacementTexture = displacementTextureA
    clearSnapshots()
  }

  fun clearDisplacementTexturePreserveSnapshots() {
    if (displacementTextureA == 0 || displacementTextureB == 0) return
    clearTexture(displacementTextureA)
    clearTexture(displacementTextureB)
    activeDisplacementTexture = displacementTextureA
  }

  fun render(maxMagnitude: Float) {
    if (sourceTexture == 0 || renderProgram == 0) return
    if (verticesDirty) {
      viewportConfig?.let { updateQuadVertices(it) } ?: resetQuadVertices()
    }
    if (viewWidth <= 0 || viewHeight <= 0) {
      return
    }
    GLES20.glViewport(0, 0, viewWidth, viewHeight)
    renderWarpedQuad(maxMagnitude, 0f, 0.5f, 0.5f, 1f, 1f, true, 0f, 0f)
    renderPreview(maxMagnitude)
  }

  fun release() {
    clearSnapshots()
    if (sourceTexture != 0) {
      val textures = IntArray(1)
      textures[0] = sourceTexture
      GLES20.glDeleteTextures(1, textures, 0)
      sourceTexture = 0
    }
    deleteDisplacementTextures()
    if (identityDisplacementTexture != 0) {
      val tex = IntArray(1)
      tex[0] = identityDisplacementTexture
      GLES20.glDeleteTextures(1, tex, 0)
      identityDisplacementTexture = 0
    }
    if (framebuffer != 0) {
      val buffers = IntArray(1)
      buffers[0] = framebuffer
      GLES20.glDeleteFramebuffers(1, buffers, 0)
      framebuffer = 0
    }
    if (renderProgram != 0) {
      GLES20.glDeleteProgram(renderProgram)
      renderProgram = 0
    }
    if (brushProgram != 0) {
      GLES20.glDeleteProgram(brushProgram)
      brushProgram = 0
    }
    if (smoothProgram != 0) {
      GLES20.glDeleteProgram(smoothProgram)
      smoothProgram = 0
    }
  }

  private fun deleteTexture(textureId: Int) {
    if (textureId == 0) return
    val arr = IntArray(1)
    arr[0] = textureId
    GLES20.glDeleteTextures(1, arr, 0)
  }

  fun clearSnapshots() {
    snapshotTextures.values.forEach { deleteTexture(it) }
    snapshotTextures.clear()
  }

  fun deleteSnapshot(index: Int) {
    if (index < 0) return
    snapshotTextures.remove(index)?.let { deleteTexture(it) }
  }

  fun saveDisplacementState(path: String): Boolean {
    if (path.isBlank()) {
      Log.w(TAG, "saveDisplacementState skipped: blank path")
      return false
    }
    if (displacementWidth <= 0 || displacementHeight <= 0) {
      Log.w(TAG, "saveDisplacementState skipped: invalid displacement size ${displacementWidth}x${displacementHeight}")
      return false
    }
    if (activeDisplacementTexture == 0 || framebuffer == 0) {
      Log.w(TAG, "saveDisplacementState skipped: texture/fbo not ready, tex=$activeDisplacementTexture fbo=$framebuffer")
      return false
    }
    if (!bindFramebuffer(activeDisplacementTexture)) {
      Log.w(TAG, "saveDisplacementState skipped: bindFramebuffer failed")
      return false
    }

    val pixelCount = displacementWidth * displacementHeight
    val rawRgba = FloatArray(pixelCount * 4)
    return try {
      val readBuffer = FloatBuffer.wrap(rawRgba)
      GLES20.glReadPixels(
        0,
        0,
        displacementWidth,
        displacementHeight,
        GLES20.GL_RGBA,
        GLES30.GL_FLOAT,
        readBuffer,
      )
      GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
      val targetFile = File(path)
      targetFile.parentFile?.mkdirs()
      DataOutputStream(BufferedOutputStream(FileOutputStream(targetFile))).use { stream ->
        stream.writeInt(displacementStateMagic)
        stream.writeInt(displacementStateVersion)
        stream.writeInt(displacementWidth)
        stream.writeInt(displacementHeight)
        var srcIndex = 0
        repeat(pixelCount) {
          stream.writeFloat(rawRgba[srcIndex])
          stream.writeFloat(rawRgba[srcIndex + 1])
          srcIndex += 4
        }
      }
      true
    } catch (error: Exception) {
      GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
      Log.w(TAG, "saveDisplacementState failed: $path", error)
      false
    }
  }

  fun loadDisplacementState(path: String): Boolean {
    if (path.isBlank()) {
      Log.w(TAG, "loadDisplacementState skipped: blank path")
      return false
    }
    if (textureWidth <= 0 || textureHeight <= 0) {
      Log.w(TAG, "loadDisplacementState skipped: texture size not ready ${textureWidth}x${textureHeight}")
      return false
    }
    ensureDisplacementTexture(textureWidth, textureHeight)
    if (displacementWidth <= 0 || displacementHeight <= 0) {
      Log.w(TAG, "loadDisplacementState skipped: displacement size invalid ${displacementWidth}x${displacementHeight}")
      return false
    }
    if (displacementTextureA == 0) {
      Log.w(TAG, "loadDisplacementState skipped: displacement texture A not ready")
      return false
    }

    val targetFile = File(path)
    if (!targetFile.exists()) {
      Log.w(TAG, "loadDisplacementState skipped: file missing: $path")
      return false
    }

    return try {
      val pixelCount = displacementWidth * displacementHeight
      val rgba = FloatArray(pixelCount * 4)
      DataInputStream(BufferedInputStream(FileInputStream(targetFile))).use { stream ->
        val magic = stream.readInt()
        val version = stream.readInt()
        val width = stream.readInt()
        val height = stream.readInt()
        if (
          magic != displacementStateMagic ||
          version != displacementStateVersion ||
          width != displacementWidth ||
          height != displacementHeight
        ) {
          Log.w(
            TAG,
            "loadDisplacementState header mismatch path=$path expected=${displacementWidth}x${displacementHeight} " +
              "actual=${width}x${height} magic=$magic version=$version",
          )
          return false
        }
        var dstIndex = 0
        repeat(pixelCount) {
          rgba[dstIndex] = stream.readFloat()
          rgba[dstIndex + 1] = stream.readFloat()
          rgba[dstIndex + 2] = 0f
          rgba[dstIndex + 3] = 1f
          dstIndex += 4
        }
      }

      activeDisplacementTexture = displacementTextureA
      val writeBuffer = FloatBuffer.wrap(rgba)
      GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, activeDisplacementTexture)
      GLES20.glTexSubImage2D(
        GLES20.GL_TEXTURE_2D,
        0,
        0,
        0,
        displacementWidth,
        displacementHeight,
        GLES20.GL_RGBA,
        GLES30.GL_FLOAT,
        writeBuffer,
      )
      GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, 0)
      true
    } catch (error: Exception) {
      Log.w(TAG, "loadDisplacementState failed: $path", error)
      false
    }
  }

  fun exportWarpedImage(path: String, maxMagnitude: Float, maxOutputDim: Int): Boolean {
    if (path.isBlank()) {
      Log.w(TAG, "exportWarpedImage skipped: blank path")
      return false
    }
    if (renderProgram == 0 || sourceTexture == 0) {
      Log.w(TAG, "exportWarpedImage skipped: renderer/source not ready")
      return false
    }
    if (textureWidth <= 0 || textureHeight <= 0) {
      Log.w(TAG, "exportWarpedImage skipped: source size invalid ${textureWidth}x${textureHeight}")
      return false
    }
    val safeMaxDim = maxOutputDim.coerceIn(256, 8192)
    val sourceMax = max(textureWidth, textureHeight).coerceAtLeast(1)
    val scale = if (sourceMax > safeMaxDim) {
      safeMaxDim.toFloat() / sourceMax.toFloat()
    } else {
      1f
    }
    val outWidth = max(1, (textureWidth * scale).roundToInt())
    val outHeight = max(1, (textureHeight * scale).roundToInt())
    val outputTexture = createOutputTexture(outWidth, outHeight)
    if (outputTexture == 0) {
      Log.w(TAG, "exportWarpedImage failed: createOutputTexture returned 0")
      return false
    }
    val pixelBuffer = ByteBuffer.allocateDirect(outWidth * outHeight * 4).order(ByteOrder.nativeOrder())
    return try {
      if (!bindFramebuffer(outputTexture)) {
        Log.w(TAG, "exportWarpedImage failed: bindFramebuffer incomplete")
        return false
      }
      if (exportDebugLogs) {
        Log.w(
          TAG,
          "exportWarpedImage meta: source=${textureWidth}x${textureHeight} disp=${displacementWidth}x${displacementHeight} " +
            "out=${outWidth}x${outHeight} maxMag=$maxMagnitude",
        )
      }
      GLES20.glViewport(0, 0, outWidth, outHeight)
      GLES20.glClearColor(0f, 0f, 0f, 0f)
      GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
      renderWarpedQuad(maxMagnitude, 0f, 0.5f, 0.5f, 1f, 1f, false, 0f, 0f)
      GLES20.glReadPixels(
        0,
        0,
        outWidth,
        outHeight,
        GLES20.GL_RGBA,
        GLES20.GL_UNSIGNED_BYTE,
        pixelBuffer,
      )
      GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)

      val rgba = ByteArray(outWidth * outHeight * 4)
      pixelBuffer.position(0)
      pixelBuffer.get(rgba)
      val argbPixels = IntArray(outWidth * outHeight)
      val totalPixels = outWidth * outHeight
      var blackCount = 0
      var alphaZeroCount = 0
      for (y in 0 until outHeight) {
        val srcY = outHeight - 1 - y
        var srcOffset = srcY * outWidth * 4
        val dstOffset = y * outWidth
        for (x in 0 until outWidth) {
          val r = rgba[srcOffset].toInt() and 0xFF
          val g = rgba[srcOffset + 1].toInt() and 0xFF
          val b = rgba[srcOffset + 2].toInt() and 0xFF
          val a = rgba[srcOffset + 3].toInt() and 0xFF
          argbPixels[dstOffset + x] = (a shl 24) or (r shl 16) or (g shl 8) or b
          if (r == 0 && g == 0 && b == 0) {
            blackCount += 1
          }
          if (a == 0) {
            alphaZeroCount += 1
          }
          srcOffset += 4
        }
      }
      if (exportDebugLogs) {
        val blackPct = blackCount * 100f / totalPixels.toFloat()
        val alphaPct = alphaZeroCount * 100f / totalPixels.toFloat()
        Log.w(
          TAG,
          "exportWarpedImage pixels: out=${outWidth}x${outHeight} blackPct=${"%.2f".format(blackPct)} " +
            "alphaZeroPct=${"%.2f".format(alphaPct)}",
        )
        logExportDebugStats(maxMagnitude, outWidth, outHeight)
      }
      val targetFile = File(path)
      targetFile.parentFile?.mkdirs()
      val tempFile = File(targetFile.parentFile ?: File("."), "${targetFile.name}.tmp")
      if (tempFile.exists()) {
        tempFile.delete()
      }
      val bitmap = Bitmap.createBitmap(argbPixels, outWidth, outHeight, Bitmap.Config.ARGB_8888)
      FileOutputStream(tempFile).use { output ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        output.fd.sync()
      }
      bitmap.recycle()
      if (targetFile.exists()) {
        targetFile.delete()
      }
      if (!tempFile.renameTo(targetFile)) {
        FileInputStream(tempFile).use { input ->
          FileOutputStream(targetFile).use { output ->
            input.copyTo(output)
            output.fd.sync()
          }
        }
        tempFile.delete()
      }
      true
    } catch (error: Exception) {
      GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
      Log.w(TAG, "exportWarpedImage failed: $path", error)
      false
    } finally {
      deleteTexture(outputTexture)
    }
  }

  fun saveSnapshot(index: Int) {
    if (index < 0) return
    if (framebuffer == 0 || displacementWidth <= 0 || displacementHeight <= 0) return
    if (activeDisplacementTexture == 0) return
    val targetTexture = createDisplacementTexture(displacementWidth, displacementHeight)
    if (targetTexture == 0) return
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, framebuffer)
    GLES20.glFramebufferTexture2D(
      GLES20.GL_FRAMEBUFFER,
      GLES20.GL_COLOR_ATTACHMENT0,
      GLES20.GL_TEXTURE_2D,
      activeDisplacementTexture,
      0,
    )
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, targetTexture)
    GLES20.glCopyTexImage2D(
      GLES20.GL_TEXTURE_2D,
      0,
      GLES30.GL_RGBA32F,
      0,
      0,
      displacementWidth,
      displacementHeight,
      0,
    )
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
    snapshotTextures[index]?.let { deleteTexture(it) }
    snapshotTextures[index] = targetTexture
  }

  fun restoreSnapshot(index: Int) {
    val texture = snapshotTextures[index] ?: return
    activeDisplacementTexture = texture
  }

  fun updateViewport(config: LiquifyViewportData) {
    viewportConfig = config
    verticesDirty = true
  }

  fun updatePreviewConfig(config: LiquifyPreviewWindowConfig?) {
    previewConfig = config
  }

  fun updatePreviewDebug(showWeights: Boolean, showVectors: Boolean, showBrush: Boolean) {
    previewWeightMix = if (showWeights) 1f else 0f
    previewVectorMix = if (showVectors) 1f else 0f
    previewBrushMix = if (showBrush) 1f else 0f
  }

  fun updatePreviewBrush(
    centerX: Float,
    centerY: Float,
    radiusX: Float,
    radiusY: Float,
    falloff: Float,
    decay: Float,
  ) {
    previewBrushCenterX = centerX.coerceIn(0f, 1f)
    previewBrushCenterY = centerY.coerceIn(0f, 1f)
    previewBrushRadiusX = radiusX.coerceIn(0f, 1f)
    previewBrushRadiusY = radiusY.coerceIn(0f, 1f)
    previewBrushFalloff = falloff.coerceIn(0.05f, 1f)
    previewBrushDecay = decay.coerceIn(0.2f, 4f)
  }

  fun updateBrushResponse(
    scale: Float,
    center: Float,
    edge: Float,
    stepFactorValue: Float,
    decayCurveValue: Float,
  ) {
    brushStrengthScale = scale.coerceIn(0.2f, 3f)
    brushCenterResponse = center.coerceIn(0.05f, 0.95f)
    brushEdgeResponse = edge.coerceIn(0.6f, 2f)
    brushStepFactor = stepFactorValue.coerceIn(0.1f, 2.5f)
    brushDecayCurve = decayCurveValue.coerceIn(0.4f, 4f)
  }

  fun updateSoftConstraints(
    softK: Float,
    rippleStartValue: Float,
    rippleEndValue: Float,
    rippleMixValue: Float,
    rippleSmoothValue: Float,
    gradientScaleMaxValue: Float,
    restoreBoostValue: Float,
    performanceModeEnabled: Boolean,
  ) {
    softSaturationK = softK.coerceIn(0.01f, 1f)
    rippleStart = rippleStartValue.coerceIn(0.1f, rippleEndValue)
    rippleEnd = rippleEndValue.coerceIn(rippleStart + 0.05f, 5f)
    rippleMix = rippleMixValue.coerceIn(0f, 1f)
    rippleSmooth = rippleSmoothValue.coerceIn(0f, 1f)
    gradientLimitScaleMax = gradientScaleMaxValue.coerceIn(0.5f, 3f)
    restoreBoost = restoreBoostValue.coerceIn(1f, 3f)
    performanceMode = performanceModeEnabled
    previewSoftSaturationK = softSaturationK
    previewRippleStart = rippleStart
    previewRippleEnd = rippleEnd
    previewRippleMix = rippleMix
    previewRippleSmooth = rippleSmooth
  }

  fun updateRestoreMode(toIdentity: Boolean) {
    restoreToIdentity = toIdentity
  }

  fun updateDynamicResponseRanges(
    centerMin: Float,
    centerMax: Float,
    edgeMin: Float,
    edgeMax: Float,
    stepMin: Float,
    stepMax: Float,
  ) {
    val coercedCenterMin = centerMin.coerceIn(0.05f, 2.8f)
    val coercedCenterMax = max(centerMax, coercedCenterMin + 0.05f).coerceIn(coercedCenterMin + 0.05f, 3.5f)
    centerResponseMin = min(coercedCenterMin, coercedCenterMax - 0.05f)
    centerResponseMax = coercedCenterMax
    val coercedEdgeMin = edgeMin.coerceIn(0.2f, 2f)
    val coercedEdgeMax = max(edgeMax, coercedEdgeMin + 0.05f).coerceIn(coercedEdgeMin + 0.05f, 4f)
    edgeResponseMin = min(coercedEdgeMin, coercedEdgeMax - 0.05f)
    edgeResponseMax = coercedEdgeMax
    val coercedStepMin = stepMin.coerceIn(0.01f, 2f)
    val coercedStepMax = max(stepMax, coercedStepMin + 0.01f).coerceIn(coercedStepMin + 0.01f, 5f)
    stepFactorMin = min(coercedStepMin, coercedStepMax - 0.01f)
    stepFactorMax = coercedStepMax
  }

  fun updatePerformanceMode(enabled: Boolean) {
    performanceMode = enabled
  }

  private fun renderPreview(maxMagnitude: Float) {
    val config = previewConfig ?: return
    if (!config.visible) return
    if (viewWidth <= 0 || viewHeight <= 0) return
    if (renderProgram == 0 || sourceTexture == 0) return
    val maxSize = min(viewWidth, viewHeight).coerceAtLeast(1)
    val viewportSize = config.sizePx.coerceIn(4, maxSize)
    val maxOffsetX = max(0, viewWidth - viewportSize)
    val maxOffsetY = max(0, viewHeight - viewportSize)
    val offsetX = config.offsetXPx.coerceIn(0, maxOffsetX)
    val offsetYTop = config.offsetYPx.coerceIn(0, maxOffsetY)
    val viewportY = (viewHeight - offsetYTop - viewportSize).coerceIn(0, viewHeight - viewportSize)
    GLES20.glViewport(offsetX, viewportY, viewportSize, viewportSize)
    val centerX = config.centerX.coerceIn(0f, 1f)
    val centerY = config.centerY.coerceIn(0f, 1f)
    val spanX = config.spanX.coerceIn(0.0001f, 4f)
    val spanY = config.spanY.coerceIn(0.0001f, 4f)
    val cornerRadius = computePreviewCornerRadius(viewportSize, config.cornerRadiusPx)
    renderWarpedQuad(maxMagnitude, 1f, centerX, centerY, spanX, spanY, false, cornerRadius, 0f)
    GLES20.glViewport(0, 0, viewWidth, viewHeight)
  }

  private fun renderWarpedQuad(
    maxMagnitude: Float,
    previewModeValue: Float,
    centerX: Float,
    centerY: Float,
    spanX: Float,
    spanY: Float,
    useQuadGeometry: Boolean,
    previewRadius: Float,
    debugModeValue: Float,
  ) {
    GLES20.glUseProgram(renderProgram)

    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, sourceTexture)
    GLES20.glUniform1i(sourceSamplerHandle, 0)

    val displacementTex = if (activeDisplacementTexture != 0) {
      activeDisplacementTexture
    } else {
      ensureIdentityDisplacementTexture()
      identityDisplacementTexture
    }
    GLES20.glActiveTexture(GLES20.GL_TEXTURE1)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, displacementTex)
    GLES20.glUniform1i(displacementSamplerHandle, 1)
    GLES20.glUniform1f(magnitudeHandle, maxMagnitude)
    GLES20.glUniform1f(previewModeHandle, previewModeValue)
    GLES20.glUniform2f(previewCenterHandle, centerX, centerY)
    GLES20.glUniform2f(previewSpanHandle, spanX, spanY)
    GLES20.glUniform1f(previewRadiusHandle, previewRadius)
    GLES20.glUniform1f(previewWeightMixHandle, previewWeightMix)
    GLES20.glUniform1f(previewVectorMixHandle, previewVectorMix)
    GLES20.glUniform1f(previewBrushMixHandle, previewBrushMix)
    GLES20.glUniform2f(previewBrushCenterHandle, previewBrushCenterX, previewBrushCenterY)
    GLES20.glUniform2f(previewBrushRadiusHandle, previewBrushRadiusX, previewBrushRadiusY)
    GLES20.glUniform1f(previewBrushFalloffHandle, previewBrushFalloff)
    GLES20.glUniform1f(previewBrushDecayHandle, previewBrushDecay)
    if (debugModeHandle >= 0) {
      GLES20.glUniform1f(debugModeHandle, debugModeValue)
    }

    GLES20.glEnableVertexAttribArray(positionHandle)
    if (useQuadGeometry) {
      quadVertices.position(0)
      GLES20.glVertexAttribPointer(positionHandle, 2, GLES20.GL_FLOAT, false, 0, quadVertices)
    } else {
      fullScreenVertices.position(0)
      GLES20.glVertexAttribPointer(positionHandle, 2, GLES20.GL_FLOAT, false, 0, fullScreenVertices)
    }

    GLES20.glEnableVertexAttribArray(uvHandle)
    // 液化命令与预览/主渲染共享同一 Y 轴约定；导出也必须沿用这套 UV，
    // 否则会出现“涂抹区域发黑/错位”。
    quadUVs.position(0)
    GLES20.glVertexAttribPointer(uvHandle, 2, GLES20.GL_FLOAT, false, 0, quadUVs)

    GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 6)

    GLES20.glDisableVertexAttribArray(positionHandle)
    GLES20.glDisableVertexAttribArray(uvHandle)
  }

  private fun logExportDebugStats(maxMagnitude: Float, outWidth: Int, outHeight: Int) {
    if (!exportDebugLogs) {
      return
    }
    val debugSize = 64
    val debugWidth = min(debugSize, outWidth.coerceAtLeast(1))
    val debugHeight = min(debugSize, outHeight.coerceAtLeast(1))
    val outputTexture = createOutputTexture(debugWidth, debugHeight)
    if (outputTexture == 0) {
      Log.w(TAG, "exportWarpedImage debug skipped: output texture alloc failed")
      return
    }
    val pixelBuffer = ByteBuffer.allocateDirect(debugWidth * debugHeight * 4).order(ByteOrder.nativeOrder())
    try {
      if (!bindFramebuffer(outputTexture)) {
        Log.w(TAG, "exportWarpedImage debug skipped: framebuffer incomplete")
        return
      }
      GLES20.glViewport(0, 0, debugWidth, debugHeight)
      GLES20.glClearColor(0f, 0f, 0f, 0f)
      GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
      renderWarpedQuad(maxMagnitude, 0f, 0.5f, 0.5f, 1f, 1f, false, 0f, 1f)
      GLES20.glReadPixels(
        0,
        0,
        debugWidth,
        debugHeight,
        GLES20.GL_RGBA,
        GLES20.GL_UNSIGNED_BYTE,
        pixelBuffer,
      )
    } catch (error: Exception) {
      Log.w(TAG, "exportWarpedImage debug failed", error)
    } finally {
      GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
      deleteTexture(outputTexture)
    }
    val rgba = ByteArray(debugWidth * debugHeight * 4)
    pixelBuffer.position(0)
    pixelBuffer.get(rgba)
    val total = debugWidth * debugHeight
    var outOfRangeCount = 0
    var nanCount = 0
    var magSum = 0f
    var idx = 0
    for (i in 0 until total) {
      val r = (rgba[idx].toInt() and 0xFF) / 255f
      val g = (rgba[idx + 1].toInt() and 0xFF) / 255f
      val b = (rgba[idx + 2].toInt() and 0xFF) / 255f
      magSum += r
      if (g < 0.5f) {
        outOfRangeCount += 1
      }
      if (b > 0.5f) {
        nanCount += 1
      }
      idx += 4
    }
    val outOfRangePct = outOfRangeCount * 100f / total.toFloat()
    val nanPct = nanCount * 100f / total.toFloat()
    val avgMag = magSum / total.toFloat()
    Log.w(
      TAG,
      "exportWarpedImage debug: out=${outWidth}x${outHeight} disp=${displacementWidth}x${displacementHeight} " +
        "maxMag=$maxMagnitude avgDisp=${"%.4f".format(avgMag)} outOfRangePct=${"%.2f".format(outOfRangePct)} " +
        "nanPct=${"%.2f".format(nanPct)}",
    )
  }

  private fun buildProgram(vertexSource: String, fragmentSource: String): Int {
    val vertex = compileShader(GLES20.GL_VERTEX_SHADER, vertexSource)
    val fragment = compileShader(GLES20.GL_FRAGMENT_SHADER, fragmentSource)
    val programId = GLES20.glCreateProgram()
    GLES20.glAttachShader(programId, vertex)
    GLES20.glAttachShader(programId, fragment)
    GLES20.glLinkProgram(programId)
    val status = IntArray(1)
    GLES20.glGetProgramiv(programId, GLES20.GL_LINK_STATUS, status, 0)
    if (status[0] == 0) {
      val info = GLES20.glGetProgramInfoLog(programId)
      Log.e(TAG, "Program link failed: $info")
      GLES20.glDeleteProgram(programId)
      throw GLException(0, info)
    }
    return programId
  }

  private fun compileShader(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type)
    GLES20.glShaderSource(shader, source)
    GLES20.glCompileShader(shader)
    val status = IntArray(1)
    GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0)
    if (status[0] == 0) {
      val info = GLES20.glGetShaderInfoLog(shader)
      Log.e(TAG, "Shader compile failed: $info")
      GLES20.glDeleteShader(shader)
      throw GLException(0, info)
    }
    return shader
  }

  private fun ensureDisplacementTexture(width: Int, height: Int) {
    if (width <= 0 || height <= 0) return
    val (targetWidth, targetHeight) = resolveDisplacementSize(width, height)
    if (
      displacementWidth == targetWidth &&
      displacementHeight == targetHeight &&
      displacementTextureA != 0
    ) {
      return
    }
    deleteDisplacementTextures()
    displacementTextureA = createDisplacementTexture(targetWidth, targetHeight)
    displacementTextureB = createDisplacementTexture(targetWidth, targetHeight)
    displacementWidth = targetWidth
    displacementHeight = targetHeight
    clearTexture(displacementTextureA)
    clearTexture(displacementTextureB)
    activeDisplacementTexture = displacementTextureA
  }

  private fun resolveDisplacementSize(width: Int, height: Int): Pair<Int, Int> {
    val maxSide = if (performanceMode) {
      maxDisplacementSidePerformance
    } else {
      maxDisplacementSideQuality
    }
    val sourceMax = max(width, height).coerceAtLeast(1)
    if (sourceMax <= maxSide) {
      return Pair(width, height)
    }
    val scale = maxSide.toFloat() / sourceMax.toFloat()
    val scaledWidth = max(1, (width * scale).roundToInt())
    val scaledHeight = max(1, (height * scale).roundToInt())
    return Pair(scaledWidth, scaledHeight)
  }

  private fun createDisplacementTexture(width: Int, height: Int): Int {
    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    val textureId = textures[0]
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexImage2D(
      GLES20.GL_TEXTURE_2D,
      0,
      GLES30.GL_RGBA32F,
      width,
      height,
      0,
      GLES20.GL_RGBA,
      GLES30.GL_FLOAT,
      null,
    )
    return textureId
  }

  private fun createOutputTexture(width: Int, height: Int): Int {
    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    val textureId = textures[0]
    if (textureId == 0) {
      return 0
    }
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, textureId)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexImage2D(
      GLES20.GL_TEXTURE_2D,
      0,
      GLES20.GL_RGBA,
      width,
      height,
      0,
      GLES20.GL_RGBA,
      GLES20.GL_UNSIGNED_BYTE,
      null,
    )
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, 0)
    return textureId
  }

  private fun clearTexture(textureId: Int) {
    if (textureId == 0 || framebuffer == 0 || displacementWidth <= 0 || displacementHeight <= 0) return
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, framebuffer)
    GLES20.glFramebufferTexture2D(
      GLES20.GL_FRAMEBUFFER,
      GLES20.GL_COLOR_ATTACHMENT0,
      GLES20.GL_TEXTURE_2D,
      textureId,
      0,
    )
    GLES20.glViewport(0, 0, displacementWidth, displacementHeight)
    GLES20.glClearColor(0f, 0f, 0f, 0f)
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
  }

  private fun runBrushPass(
    sourceTextureId: Int,
    targetTextureId: Int,
    command: LiquifyBrushCommand,
    falloff: Float,
    maxMagnitude: Float,
  ): Boolean {
    if (sourceTextureId == 0 || targetTextureId == 0) return false
    if (!bindFramebuffer(targetTextureId)) {
      Log.e(TAG, "runBrushPass framebuffer incomplete")
      return false
    }
    GLES20.glViewport(0, 0, displacementWidth, displacementHeight)
    GLES20.glUseProgram(brushProgram)

    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, sourceTextureId)
    GLES20.glUniform1i(brushSamplerHandle, 0)
    GLES20.glUniform2f(brushCenterHandle, command.normalizedX, command.normalizedY)
    GLES20.glUniform2f(brushDeltaHandle, command.deltaX, command.deltaY)
    val deltaLength = hypot(command.deltaX.toDouble(), command.deltaY.toDouble()).toFloat()
    GLES20.glUniform1f(brushDeltaLengthHandle, deltaLength)
    val maxDim = max(displacementWidth, displacementHeight).coerceAtLeast(1)
    val radiusPixels = (command.radius * maxDim).coerceAtLeast(1f)
    val radiusUvX = (radiusPixels / displacementWidth.toFloat()).coerceAtLeast(1e-4f)
    val radiusUvY = (radiusPixels / displacementHeight.toFloat()).coerceAtLeast(1e-4f)
    val texelX = if (displacementWidth > 0) 1f / displacementWidth.toFloat() else 0f
    val texelY = if (displacementHeight > 0) 1f / displacementHeight.toFloat() else 0f
    GLES20.glUniform1f(brushRadiusHandle, command.radius)
    GLES20.glUniform1f(brushStrengthHandle, computeEffectiveStrength(command))
    GLES20.glUniform1f(brushFalloffHandle, falloff.coerceAtLeast(0.05f))
    GLES20.glUniform2f(brushRadiusUvHandle, radiusUvX, radiusUvY)
    GLES20.glUniform2f(brushTexelHandle, texelX, texelY)
    GLES20.glUniform1f(brushBlendHandle, computeBrushBlend(command))
    GLES20.glUniform1f(brushSoftnessHandle, computeBrushSoftness(command))
    GLES20.glUniform1f(brushStrengthScaleHandle, brushStrengthScale)
    GLES20.glUniform1f(brushCenterResponseHandle, computeDynamicCenterResponse(command))
    GLES20.glUniform1f(brushEdgeResponseHandle, computeDynamicEdgeBoost(command))
    GLES20.glUniform1f(brushStepFactorHandle, computeDynamicStepFactor(command))
    GLES20.glUniform1f(brushDecayCurveHandle, brushDecayCurve)
    GLES20.glUniform1f(brushGradientLimitHandle, computeGradientLimit(command, maxMagnitude, texelX, texelY))
    GLES20.glUniform1f(brushIsRestoreHandle, if (command.tool.equals("restore", ignoreCase = true)) 1f else 0f)
    GLES20.glUniform1f(brushMaxMagnitudeHandle, maxMagnitude)
    GLES20.glUniform1f(brushSoftKHandle, softSaturationK)
    GLES20.glUniform1f(brushRestoreBoostHandle, restoreBoost)
    GLES20.glUniform1f(brushRippleStartHandle, rippleStart)
    GLES20.glUniform1f(brushRippleEndHandle, rippleEnd)
    GLES20.glUniform1f(brushRippleMixHandle, rippleMix)
    GLES20.glUniform1f(brushRippleSmoothHandle, rippleSmooth)
    GLES20.glUniform1f(brushGradientScaleHandle, gradientLimitScaleMax)
    GLES20.glUniform1f(brushRestoreToIdentityHandle, if (restoreToIdentity) 1f else 0f)

    GLES20.glEnableVertexAttribArray(brushPositionHandle)
    fullScreenVertices.position(0)
    GLES20.glVertexAttribPointer(brushPositionHandle, 2, GLES20.GL_FLOAT, false, 0, fullScreenVertices)

    GLES20.glEnableVertexAttribArray(brushUvHandle)
    fullScreenUVs.position(0)
    GLES20.glVertexAttribPointer(brushUvHandle, 2, GLES20.GL_FLOAT, false, 0, fullScreenUVs)

    GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 6)

    GLES20.glDisableVertexAttribArray(brushPositionHandle)
    GLES20.glDisableVertexAttribArray(brushUvHandle)
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
    return true
  }

  private fun runSmoothPass(
    command: LiquifyBrushCommand,
    falloff: Float,
    smoothingStrength: Float,
    smoothingIterations: Int,
    maxMagnitude: Float,
  ): Int {
    if (smoothingStrength <= 0f || smoothingIterations <= 0) {
      return activeDisplacementTexture
    }
    if ((displacementTextureA == 0 || displacementTextureB == 0) && textureWidth > 0 && textureHeight > 0) {
      ensureDisplacementTexture(textureWidth, textureHeight)
    }
    if (displacementTextureA == 0 || displacementTextureB == 0 || smoothProgram == 0) {
      return activeDisplacementTexture
    }
    if (activeDisplacementTexture == 0) {
      activeDisplacementTexture = displacementTextureA
    }
    var readTexture = activeDisplacementTexture
    var writeTexture = alternateTexture(readTexture)
    val iterations = computeSmoothIterations(command, smoothingIterations)
    val smoothStrength = computeSmoothStrength(command, smoothingStrength)
    for (i in 0 until iterations) {
      executeSmoothPass(readTexture, writeTexture, command, falloff, smoothStrength, maxMagnitude)
      val nextRead = writeTexture
      writeTexture = alternateTexture(nextRead)
      readTexture = nextRead
    }
    return readTexture
  }

  private fun executeSmoothPass(
    sourceTextureId: Int,
    targetTextureId: Int,
    command: LiquifyBrushCommand,
    falloff: Float,
    smoothStrength: Float,
    maxMagnitude: Float,
  ) {
    if (sourceTextureId == 0 || targetTextureId == 0 || displacementWidth <= 0 || displacementHeight <= 0) {
      return
    }
    if (!bindFramebuffer(targetTextureId)) {
      Log.e(TAG, "executeSmoothPass framebuffer incomplete")
      return
    }
    GLES20.glViewport(0, 0, displacementWidth, displacementHeight)
    GLES20.glUseProgram(smoothProgram)

    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, sourceTextureId)
    GLES20.glUniform1i(smoothSamplerHandle, 0)
    GLES20.glUniform2f(smoothCenterHandle, command.normalizedX, command.normalizedY)
    GLES20.glUniform1f(smoothFalloffHandle, falloff.coerceAtLeast(0.05f))
    GLES20.glUniform1f(smoothStrengthHandle, smoothStrength)
    val maxDim = max(displacementWidth, displacementHeight).coerceAtLeast(1)
    // 让平滑区域略大于笔刷半径，减少边界剪切带（文字更不容易出现“断层”）。
    val radiusPixels = (command.radius * maxDim).coerceAtLeast(1f) * 1.85f
    val radiusUvX = (radiusPixels / displacementWidth.toFloat()).coerceAtLeast(1e-4f)
    val radiusUvY = (radiusPixels / displacementHeight.toFloat()).coerceAtLeast(1e-4f)
    GLES20.glUniform2f(smoothRadiusUvHandle, radiusUvX, radiusUvY)
    val texelX = if (displacementWidth > 0) 1f / displacementWidth.toFloat() else 0f
    val texelY = if (displacementHeight > 0) 1f / displacementHeight.toFloat() else 0f
    GLES20.glUniform2f(smoothTexelHandle, texelX, texelY)
    GLES20.glUniform1f(smoothDecayCurveHandle, brushDecayCurve)
    GLES20.glUniform1f(smoothMaxMagnitudeHandle, maxMagnitude)
    GLES20.glUniform1f(
      smoothGradientLimitHandle,
      computeGradientLimit(command, maxMagnitude, texelX, texelY),
    )
    GLES20.glUniform1f(smoothSoftKHandle, softSaturationK)
    GLES20.glUniform1f(smoothRippleStartHandle, rippleStart)
    GLES20.glUniform1f(smoothRippleEndHandle, rippleEnd)
    GLES20.glUniform1f(smoothRippleMixHandle, rippleMix)
    GLES20.glUniform1f(smoothRippleSmoothHandle, rippleSmooth)
    GLES20.glUniform1f(smoothGradientScaleHandle, gradientLimitScaleMax)

    GLES20.glEnableVertexAttribArray(smoothPositionHandle)
    fullScreenVertices.position(0)
    GLES20.glVertexAttribPointer(smoothPositionHandle, 2, GLES20.GL_FLOAT, false, 0, fullScreenVertices)

    GLES20.glEnableVertexAttribArray(smoothUvHandle)
    fullScreenUVs.position(0)
    GLES20.glVertexAttribPointer(smoothUvHandle, 2, GLES20.GL_FLOAT, false, 0, fullScreenUVs)

    GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, 6)

    GLES20.glDisableVertexAttribArray(smoothPositionHandle)
    GLES20.glDisableVertexAttribArray(smoothUvHandle)
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
  }

  private fun bindFramebuffer(textureId: Int): Boolean {
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, framebuffer)
    GLES20.glFramebufferTexture2D(
      GLES20.GL_FRAMEBUFFER,
      GLES20.GL_COLOR_ATTACHMENT0,
      GLES20.GL_TEXTURE_2D,
      textureId,
      0,
    )
    val status = GLES20.glCheckFramebufferStatus(GLES20.GL_FRAMEBUFFER)
    if (status != GLES20.GL_FRAMEBUFFER_COMPLETE) {
      GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
      return false
    }
    return true
  }

  private fun alternateTexture(current: Int): Int {
    if (displacementTextureA == 0 || displacementTextureB == 0) return current
    return if (current == displacementTextureA) displacementTextureB else displacementTextureA
  }

  private fun deleteDisplacementTextures() {
    if (displacementTextureA != 0 || displacementTextureB != 0) {
      val textures = intArrayOf(displacementTextureA, displacementTextureB)
      GLES20.glDeleteTextures(2, textures, 0)
      displacementTextureA = 0
      displacementTextureB = 0
      activeDisplacementTexture = 0
    }
  }

  private fun ensureIdentityDisplacementTexture() {
    if (identityDisplacementTexture != 0) return
    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    identityDisplacementTexture = textures[0]
    GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, identityDisplacementTexture)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    val buffer = ByteBuffer.allocateDirect(4 * 4).order(ByteOrder.nativeOrder()).asFloatBuffer()
    buffer.put(floatArrayOf(0f, 0f, 0f, 0f)).position(0)
    GLES20.glTexImage2D(
      GLES20.GL_TEXTURE_2D,
      0,
      GLES30.GL_RGBA32F,
      1,
      1,
      0,
      GLES20.GL_RGBA,
      GLES30.GL_FLOAT,
      buffer,
    )
  }

  private fun resetQuadVertices() {
    val fullscreen = floatArrayOf(
      -1f, -1f,
      1f, -1f,
      -1f, 1f,
      -1f, 1f,
      1f, -1f,
      1f, 1f,
    )
    quadVertices.position(0)
    quadVertices.put(fullscreen)
    quadVertices.position(0)
    verticesDirty = false
  }

  private fun updateQuadVertices(config: LiquifyViewportData) {
    if (config.viewWidth <= 0 || config.viewHeight <= 0 || config.destWidth <= 0 || config.destHeight <= 0) {
      resetQuadVertices()
      return
    }
    val vw = config.viewWidth.toFloat()
    val vh = config.viewHeight.toFloat()
    val left = (config.destX / vw) * 2f - 1f
    val right = ((config.destX + config.destWidth) / vw) * 2f - 1f
    val top = 1f - (config.destY / vh) * 2f
    val bottom = 1f - ((config.destY + config.destHeight) / vh) * 2f
    val vertices = floatArrayOf(
      left, bottom,
      right, bottom,
      left, top,
      left, top,
      right, bottom,
      right, top,
    )
    quadVertices.position(0)
    quadVertices.put(vertices)
    quadVertices.position(0)
    verticesDirty = false
  }

  private fun computeEffectiveStrength(command: LiquifyBrushCommand): Float {
    val baseStrength = command.strength.coerceAtLeast(0f)
    // 让效果与拖动速度无关：仅保留压力的轻量缩放（手指通常 pressure=1，即不变）。
    val pressureCurve = command.pressure
      .coerceIn(0.05f, 2f)
      .toDouble()
      .pow(0.7)
      .toFloat()
    return (baseStrength * (0.5f + pressureCurve * 0.5f)).coerceIn(0f, 3f)
  }

  private fun computeBrushBlend(command: LiquifyBrushCommand): Float {
    return 0.85f
  }

  private fun computeBrushSoftness(command: LiquifyBrushCommand): Float {
    val normalizedRadius = command.radius.coerceIn(0.01f, 0.6f) / 0.6f
    val radiusBias = (1f - normalizedRadius) * 0.55f
    val base = 0.2f + radiusBias
    return base.coerceIn(0.1f, 0.65f)
  }

  private fun computeDynamicCenterResponse(command: LiquifyBrushCommand): Float {
    return brushCenterResponse.coerceIn(centerResponseMin, centerResponseMax)
  }

  private fun computeDynamicEdgeBoost(command: LiquifyBrushCommand): Float {
    return brushEdgeResponse.coerceIn(edgeResponseMin, edgeResponseMax)
  }

  private fun computeDynamicStepFactor(command: LiquifyBrushCommand): Float {
    return brushStepFactor.coerceIn(stepFactorMin, stepFactorMax)
  }

  private fun computeGradientLimit(
    command: LiquifyBrushCommand,
    maxMagnitude: Float,
    texelX: Float,
    texelY: Float,
  ): Float {
    // 核心：防止位移场出现 fold（雅可比行列式为负），导致文字/边缘“断开”。
    // 位移贴图存的是 displacementSample，最终 warp = uv + displacementSample * maxMagnitude。
    // 因此相邻 texel 的 displacementSample 差值应当与 texelSize / maxMagnitude 同量级。
    val texel = max(texelX, texelY).coerceAtLeast(1e-6f)
    val magnitude = maxMagnitude.coerceAtLeast(0.15f)
    val base = (texel / magnitude).coerceAtLeast(1e-6f)
    val radius = command.radius.coerceIn(0.01f, 0.45f)
    val pressure = command.pressure.coerceIn(0.05f, 2f)
    // 半径越大允许更平滑的梯度；速度越快则更保守（减少瞬态撕裂）。
    val radiusScale = (0.85f + (radius / 0.45f) * 0.35f).coerceIn(0.85f, 1.2f)
    val pressureScale = (0.9f + (pressure - 0.05f) * 0.08f).coerceIn(0.9f, 1.05f)
    val limit = base * radiusScale * pressureScale
    // 自由模式：继续放宽上限，依赖软饱和/平滑兜底。
    return limit.coerceIn(base * 0.25f, base * gradientLimitScaleMax)
  }

  private fun computeSmoothIterations(
    command: LiquifyBrushCommand,
    configIterations: Int,
  ): Int {
    val base = configIterations.coerceIn(0, 5)
    if (base <= 0) {
      return 0
    }
    val maxDim = max(displacementWidth, displacementHeight).coerceAtLeast(1)
    val radiusPixels = (command.radius * maxDim).coerceAtLeast(1f)
    val radiusBonus = (radiusPixels / 240f).toInt().coerceAtMost(2)
    return (base + radiusBonus).coerceIn(1, 6)
  }

  private fun computeSmoothStrength(
    command: LiquifyBrushCommand,
    configStrength: Float,
  ): Float {
    val baseStrength = command.strength.coerceIn(0f, 3f)
    val strengthNorm = (baseStrength / 3f).coerceIn(0f, 1f)
    val config = configStrength.coerceIn(0f, 1f)
    val dynamicBoost = (0.12f + strengthNorm * 0.18f).coerceIn(0.12f, 0.3f)
    return (config * 0.65f + dynamicBoost).coerceIn(0.05f, 0.85f)
  }

  private fun computePreviewCornerRadius(viewportSize: Int, cornerRadiusPx: Float): Float {
    if (viewportSize <= 0) return 0f
    val radius = cornerRadiusPx.coerceAtLeast(0f)
    val normalized = (radius / viewportSize.toFloat()).coerceIn(0f, 0.5f)
    return normalized
  }

  companion object {
    private const val TAG = "LiquifyRenderer"

    private const val VERTEX_SHADER = """
      attribute vec2 aPosition;
      attribute vec2 aUV;
      varying vec2 vUV;
      void main() {
        vUV = aUV;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    """

    private const val FRAGMENT_SHADER = """
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D uSource;
      uniform sampler2D uDisplacement;
      uniform float uMaxMagnitude;
      uniform float uDebugMode;
      uniform float uPreviewMode;
      uniform vec2 uPreviewCenter;
      uniform vec2 uPreviewSpan;
      uniform float uPreviewRadius;
      uniform float uPreviewWeightMix;
      uniform float uPreviewVectorMix;
      uniform float uPreviewBrushMix;
      uniform vec2 uPreviewBrushCenter;
      uniform vec2 uPreviewBrushRadius;
      uniform float uPreviewBrushFalloff;
      uniform float uPreviewBrushDecay;
      void main() {
        vec2 lookupUV = vUV;
        float insideMask = 1.0;
        if (uPreviewMode > 0.5) {
          vec2 span = max(uPreviewSpan, vec2(1e-4));
          vec2 localOffset = (vUV - vec2(0.5)) * span;
          lookupUV = uPreviewCenter + localOffset;
          float radius = clamp(uPreviewRadius, 0.0, 0.5);
          if (radius > 0.0) {
            vec2 halfSize = vec2(0.5 - radius);
            vec2 delta = abs(vUV - vec2(0.5)) - halfSize;
            float dist = length(max(delta, vec2(0.0))) + min(max(delta.x, delta.y), 0.0);
            insideMask = dist <= 0.0 ? 1.0 : 0.0;
          }
        }
        lookupUV = clamp(lookupUV, vec2(0.0), vec2(1.0));
        vec2 displacementSample = texture2D(uDisplacement, lookupUV).rg;
        if (displacementSample.x != displacementSample.x || displacementSample.y != displacementSample.y) {
          displacementSample = vec2(0.0);
        }
        float displacementLen = length(displacementSample);
        if (displacementLen > 1.0) {
          displacementSample *= 1.0 / max(displacementLen, 1e-4);
        }
        vec2 offset = displacementSample * uMaxMagnitude;
        vec2 warped = lookupUV + offset;
        if (uDebugMode > 0.5) {
          float inRange =
            step(0.0, warped.x) * step(warped.x, 1.0) *
            step(0.0, warped.y) * step(warped.y, 1.0);
          float nanFlag = (displacementSample.x != displacementSample.x || displacementSample.y != displacementSample.y) ? 1.0 : 0.0;
          float mag = clamp(displacementLen, 0.0, 1.0);
          gl_FragColor = vec4(mag, inRange, nanFlag, 1.0);
          return;
        }
        vec4 color = texture2D(uSource, warped);
        if (uPreviewMode > 0.5 && insideMask > 0.0) {
          float magnitudeNorm = clamp(length(displacementSample), 0.0, 1.0);
          if (uPreviewWeightMix > 0.001) {
            vec3 heat = vec3(
              magnitudeNorm,
              max(magnitudeNorm * 0.25, 0.05),
              max(magnitudeNorm * 0.15, 0.03)
            );
            float mixAmt = clamp(uPreviewWeightMix, 0.0, 1.0);
            color.rgb = color.rgb + heat * mixAmt * 0.8;
          }
          if (uPreviewVectorMix > 0.001 && magnitudeNorm > 1e-4) {
            vec2 dir = normalize(displacementSample);
            vec2 local = vUV - vec2(0.5);
            float arrowLength = mix(0.12, 0.45, clamp(magnitudeNorm * 1.4, 0.0, 1.0));
            float parallel = dot(local, dir);
            float perpendicular = dot(local, vec2(-dir.y, dir.x));
            float alongMask = step(0.0, parallel) * step(parallel, arrowLength);
            float body = exp(-pow(abs(perpendicular) * 70.0, 1.05)) * alongMask;
            float head = exp(-pow(length(local - dir * arrowLength) * 40.0, 1.2)) * step(arrowLength * 0.7, parallel);
            float arrowMask = clamp(body + head, 0.0, 1.0);
            vec3 arrowColor = vec3(0.05, 0.95, 0.85);
            color.rgb = mix(color.rgb, arrowColor, arrowMask * clamp(uPreviewVectorMix, 0.0, 1.0));
            vec3 vectorField = vec3(0.5 + displacementSample.x * 0.5, 0.5 + displacementSample.y * 0.5, magnitudeNorm);
            color.rgb = mix(color.rgb, vectorField, 0.25 * clamp(uPreviewVectorMix, 0.0, 1.0));
          }
          if (uPreviewBrushMix > 0.001) {
            vec2 brushRadius = max(uPreviewBrushRadius, vec2(1e-4));
            float maxRadius = max(brushRadius.x, brushRadius.y);
            if (maxRadius > 1e-4) {
              vec2 brushDelta = lookupUV - uPreviewBrushCenter;
	              vec2 normalizedDelta = vec2(brushDelta.x / brushRadius.x, brushDelta.y / brushRadius.y);
		              float distNorm = length(normalizedDelta);
		              if (distNorm <= 1.15) {
		                float brushFalloff = max(uPreviewBrushFalloff, 1e-4);
		                float brushDecay = max(uPreviewBrushDecay, 0.2);
		                float falloffWeight = exp(-(distNorm * distNorm) / brushFalloff);
		                float radialBase = max(1.0 - distNorm * distNorm, 0.0);
		                float radialProfile = pow(radialBase, brushDecay);
		                float brushInfluence = falloffWeight * radialProfile;
		                vec3 profileColor = vec3(brushInfluence, brushInfluence * 0.35, brushInfluence * 0.2);
		                color.rgb = mix(color.rgb, profileColor, clamp(uPreviewBrushMix, 0.0, 1.0));
		              }
	            }
	          }
	        }
        gl_FragColor = color;
      }
    """

    private const val BRUSH_FRAGMENT_SHADER = """
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D uDisplacement;
      uniform vec2 uBrushCenter;
      uniform vec2 uBrushDelta;
      uniform float uBrushRadius;
      uniform float uBrushStrength;
      uniform float uBrushFalloff;
      uniform float uBrushGradientLimit;
      uniform vec2 uBrushRadiusUV;
      uniform float uBrushBlend;
      uniform float uBrushSoftness;
      uniform float uBrushStrengthScale;
      uniform float uBrushCenterDampen;
      uniform float uBrushEdgeBoost;
      uniform vec2 uTexelSize;
      uniform float uBrushDeltaLength;
      uniform float uBrushStepFactor;
	      uniform float uBrushDecayCurve;
	      uniform float uIsRestore;
	      uniform float uMaxMagnitude;
	      uniform float uSoftK;
	      uniform float uRestoreBoost;
	      uniform float uRippleStart;
	      uniform float uRippleEnd;
	      uniform float uRippleMix;
	      uniform float uRippleSmooth;
	      uniform float uGradientScaleMax;
	      uniform float uRestoreToIdentity;
	      void main() {
	        vec2 current = texture2D(uDisplacement, vUV).rg;
        float currentLen = length(current);
        if (currentLen > 1.0) {
          current *= 1.0 / max(currentLen, 1e-4);
        }
        vec2 rel = vec2(vUV.x - uBrushCenter.x, vUV.y - uBrushCenter.y);
        vec2 normalized = vec2(rel.x / max(uBrushRadiusUV.x, 1e-4), rel.y / max(uBrushRadiusUV.y, 1e-4));
        float dist = length(normalized);
        if (dist > 1.0) {
          gl_FragColor = vec4(current, 0.0, 1.0);
          return;
        }
        float restoreToIdentity = step(0.5, uRestoreToIdentity);
        float isRestore = step(0.5, uIsRestore);
        float distNorm = clamp(dist, 0.0, 1.0);
        float falloffWeight = exp(-distNorm * distNorm / max(uBrushFalloff, 1e-4));
        float decayCurve = max(uBrushDecayCurve, 0.2);
        float radialBase = max(1.0 - distNorm * distNorm, 0.0);
        float radialProfile = pow(radialBase, decayCurve);
        float influence = falloffWeight * radialProfile;
        // 直接回到原图：一次涂抹即将位移归零，避免多次叠加才能恢复。
        if (restoreToIdentity > 0.5 && isRestore > 0.5) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }
	        vec2 neighborX = texture2D(uDisplacement, vUV + vec2(uTexelSize.x, 0.0)).rg;
	        vec2 neighborY = texture2D(uDisplacement, vUV + vec2(0.0, uTexelSize.y)).rg;
		        vec2 neighborNegX = texture2D(uDisplacement, vUV - vec2(uTexelSize.x, 0.0)).rg;
		        vec2 neighborNegY = texture2D(uDisplacement, vUV - vec2(0.0, uTexelSize.y)).rg;
		        float localStretch = max(
		          max(length(neighborX - current), length(neighborNegX - current)),
		          max(length(neighborY - current), length(neighborNegY - current))
		        );
		        float stability = 1.0 / (1.0 + localStretch * 8.0);
		        // stability 直接乘进 flow 会在反复涂抹时形成“硬条带”；用更温和的缩放保持连续。
		        float stabilityScale = mix(0.5, 1.0, clamp(stability, 0.0, 1.0));
        float deltaLen = uBrushDeltaLength;
        vec2 deltaDir = deltaLen > 1e-5 ? uBrushDelta / deltaLen : vec2(0.0);
        float stepScale = max(uBrushStepFactor, 0.1);
        float scaledLen = deltaLen * stepScale;
        float maxStep = max(uBrushRadius * 0.25, 1e-4);
        scaledLen = min(scaledLen, maxStep);
        vec2 limitedDelta = deltaDir * scaledLen;
        float deltaSoft = 1.0 / (1.0 + abs(scaledLen) * 8.0);
        float smoothWeight = smoothstep(0.0, 1.0, distNorm);
	        float softMix = mix(uBrushSoftness, 1.0, smoothWeight);
	        float centerFactor = mix(uBrushCenterDampen, 1.0, pow(distNorm, 0.75));
	        float edgeFactor = mix(1.0, uBrushEdgeBoost, pow(distNorm, 1.1));
	        float brushScale = softMix * centerFactor * edgeFactor * stabilityScale * deltaSoft;
		        float strength = clamp(uBrushStrength * uBrushStrengthScale, 0.0, 3.0);
		        float strengthNorm = pow(clamp(strength / 3.0, 0.0, 1.0), 0.65);
        float flow = clamp(strengthNorm * influence * brushScale, 0.0, 1.0);
        float blend = clamp(uBrushBlend, 0.05, 1.0);
        float restoreFlow = flow * isRestore * max(uRestoreBoost, 1.0);
        float alpha = flow * blend * (1.0 - isRestore);

	        // push: 使用“局部形变的组合(composition)”更新位移场（inverse warp）：
	        // u_new(p) = u_old(p - alpha*delta) - alpha*delta/maxMagnitude
	        // alpha 同时作用于“平流”和“位移叠加”，避免只平流不叠加导致的生硬/剪切感。
	        vec2 deltaUv = limitedDelta * alpha;
	        vec2 advectUv = clamp(vUV - deltaUv, vec2(0.0), vec2(1.0));
	        vec2 advectedSample = texture2D(uDisplacement, advectUv).rg;
	        float advectedLen = length(advectedSample);
	        if (advectedLen > 1.0) {
	          advectedSample *= 1.0 / max(advectedLen, 1e-4);
	        }
	        float maxMag = max(uMaxMagnitude, 1e-4);
	        vec2 pushTarget = advectedSample - deltaUv / maxMag;

        float restoreWeight = clamp(restoreFlow, 0.0, 1.0);
        vec2 restoreTarget = mix(current * (1.0 - restoreWeight), vec2(0.0), step(0.5, uRestoreToIdentity));
        vec2 base = advectedSample;
        vec2 updated = mix(pushTarget, restoreTarget, isRestore);

        // push 时让梯度约束在“平流后的邻域”上执行，否则会把拖拽感抹平。
        if (isRestore < 0.5) {
          neighborX = texture2D(uDisplacement, advectUv + vec2(uTexelSize.x, 0.0)).rg;
          neighborY = texture2D(uDisplacement, advectUv + vec2(0.0, uTexelSize.y)).rg;
          neighborNegX = texture2D(uDisplacement, advectUv - vec2(uTexelSize.x, 0.0)).rg;
          neighborNegY = texture2D(uDisplacement, advectUv - vec2(0.0, uTexelSize.y)).rg;
        }

	        float gradientLimit = max(uBrushGradientLimit, 1e-4);
	        vec2 avgNeighbors = (neighborX + neighborY + neighborNegX + neighborNegY + base) / 5.0;
	        float texelX = max(uTexelSize.x, 1e-6);
	        float texelY = max(uTexelSize.y, 1e-6);
	        vec2 dDdx = (neighborX - neighborNegX) / (2.0 * texelX);
	        vec2 dDdy = (neighborY - neighborNegY) / (2.0 * texelY);
	        float a = 1.0 + maxMag * dDdx.x;
	        float b = maxMag * dDdy.x;
	        float c = maxMag * dDdx.y;
	        float d = 1.0 + maxMag * dDdy.y;
	        float detJ = a * d - b * c;
	        float detMin = 0.05;
	        float detSoft = 0.25;
	        float detT = smoothstep(detMin, detSoft, detJ);

	        float stretchClamp = max(
	          max(length(updated - neighborX), length(updated - neighborNegX)),
	          max(length(updated - neighborY), length(updated - neighborNegY))
	        );
	        vec2 offsetFromAvg = updated - avgNeighbors;
	        float offsetLen = length(offsetFromAvg);
        float violation = max(offsetLen, stretchClamp);
        float limitScale = mix(0.85, 2.0, clamp(stability, 0.0, 1.0)) * mix(0.75, 2.25, detT);
        float softLimit = gradientLimit * limitScale * max(uGradientScaleMax, 0.01);
        float ratio = violation / max(softLimit, 1e-6);
        // 软饱和：不做硬 clamp，ratio 越大越“黏”但可继续形变。
        float softScale = 1.0 / (1.0 + ratio * ratio * max(uSoftK, 1e-4));
        updated = avgNeighbors + (updated - avgNeighbors) * softScale;
        updated = mix(avgNeighbors, updated, detT);
        // ripple 抑制：更早介入（阈值降到 1.0），并加强柔化。
        float rippleT = smoothstep(uRippleStart, uRippleEnd, ratio);
        updated = mix(updated, avgNeighbors, rippleT * uRippleMix);
        // 高比率时再做一次局部轻平滑（长尾柔化），让极端拉伸更“黏”。
        float rippleSmooth = rippleT * uRippleSmooth;
        vec2 softAvg = (neighborX + neighborY + neighborNegX + neighborNegY + updated) / 5.0;
        updated = mix(updated, softAvg, rippleSmooth);
        float updatedLen = length(updated);
        if (updatedLen > 1.0) {
          updated *= 1.0 / max(updatedLen, 1e-4);
        }
        gl_FragColor = vec4(updated, 0.0, 1.0);
      }
    """

	    private const val SMOOTH_FRAGMENT_SHADER = """
	      precision highp float;
	      varying vec2 vUV;
	      uniform sampler2D uDisplacement;
	      uniform vec2 uBrushCenter;
	      uniform float uBrushFalloff;
	      uniform float uBrushDecayCurve;
	      uniform float uSmoothStrength;
		      uniform float uGradientLimit;
		      uniform float uMaxMagnitude;
		      uniform vec2 uBrushRadiusUV;
		      uniform vec2 uTexelSize;
		      uniform float uSoftK;
		      uniform float uRippleStart;
		      uniform float uRippleEnd;
		      uniform float uRippleMix;
		      uniform float uRippleSmooth;
		      uniform float uGradientScaleMax;
		      void main() {
		        vec2 current = texture2D(uDisplacement, vUV).rg;
        float currentLen = length(current);
        if (currentLen > 1.0) {
          current *= 1.0 / max(currentLen, 1e-4);
        }
        vec2 rel = vec2(vUV.x - uBrushCenter.x, vUV.y - uBrushCenter.y);
        vec2 normalized = vec2(rel.x / max(uBrushRadiusUV.x, 1e-4), rel.y / max(uBrushRadiusUV.y, 1e-4));
        float dist = length(normalized);
        if (dist > 1.0) {
          gl_FragColor = vec4(current, 0.0, 1.0);
          return;
        }
        float falloffWeight = exp(-dist * dist / max(uBrushFalloff, 1e-4));
        float decayCurve = max(uBrushDecayCurve, 0.2);
        float radialBase = max(1.0 - dist * dist, 0.0);
        float radialProfile = pow(radialBase, decayCurve);
        float influence = falloffWeight * radialProfile;
        vec2 accum = vec2(0.0);
        float weightSum = 0.0;
        float maxNeighborDiff = 0.0;
        vec2 neighborX = current;
        vec2 neighborNegX = current;
        vec2 neighborY = current;
        vec2 neighborNegY = current;
        for (int oy = -1; oy <= 1; oy++) {
          for (int ox = -1; ox <= 1; ox++) {
            vec2 offset = vec2(float(ox) * uTexelSize.x, float(oy) * uTexelSize.y);
            vec2 sample = texture2D(uDisplacement, vUV + offset).rg;
            float weight = 1.0;
            if (ox == 0 && oy == 0) {
              weight = 4.0;
            } else if (ox == 0 || oy == 0) {
              weight = 2.0;
            }
            accum += sample * weight;
            weightSum += weight;
            maxNeighborDiff = max(maxNeighborDiff, length(sample - current));
            if (ox == 1 && oy == 0) {
              neighborX = sample;
            } else if (ox == -1 && oy == 0) {
              neighborNegX = sample;
            } else if (ox == 0 && oy == 1) {
              neighborY = sample;
            } else if (ox == 0 && oy == -1) {
              neighborNegY = sample;
            }
          }
        }
	        vec2 average = accum / max(weightSum, 1e-4);
	        float mixAmount = clamp(uSmoothStrength * influence, 0.0, 1.0);
	        float gradientBoost = clamp(maxNeighborDiff * 6.0, 0.0, 1.0);
	        float maxMag = max(uMaxMagnitude, 1e-4);
	        float texelX = max(uTexelSize.x, 1e-6);
	        float texelY = max(uTexelSize.y, 1e-6);
	        vec2 dDdx = (neighborX - neighborNegX) / (2.0 * texelX);
	        vec2 dDdy = (neighborY - neighborNegY) / (2.0 * texelY);
	        float a = 1.0 + maxMag * dDdx.x;
	        float b = maxMag * dDdy.x;
	        float c = maxMag * dDdx.y;
	        float d = 1.0 + maxMag * dDdy.y;
	        float detJ = a * d - b * c;
	        float detMin = 0.05;
	        float detSoft = 0.25;
	        float detT = smoothstep(detMin, detSoft, detJ);
	        float jacobianPenalty = 1.0 - detT;
	        float finalMix = clamp(mixAmount + gradientBoost * 0.35 + jacobianPenalty * 0.65, 0.0, 1.0);
        vec2 result = mix(current, average, finalMix);
        float gradientLimit = max(uGradientLimit, 1e-4);
        float limitScale = mix(0.75, 2.25, detT);
        gradientLimit *= limitScale * max(uGradientScaleMax, 0.01);
        vec2 avgNeighbors = (neighborX + neighborY + neighborNegX + neighborNegY + current) / 5.0;
        float stretchClamp = max(
          max(length(result - neighborX), length(result - neighborNegX)),
          max(length(result - neighborY), length(result - neighborNegY))
        );
        vec2 offsetFromAvg = result - avgNeighbors;
        float offsetLen = length(offsetFromAvg);
        float violation = max(offsetLen, stretchClamp);
        float ratio = violation / max(gradientLimit, 1e-6);
        float softScale = 1.0 / (1.0 + ratio * ratio * max(uSoftK, 1e-4));
        result = avgNeighbors + (result - avgNeighbors) * softScale;
        float rippleT = smoothstep(uRippleStart, uRippleEnd, ratio);
        result = mix(result, avgNeighbors, rippleT * uRippleMix);
        float rippleSmooth = rippleT * uRippleSmooth;
        vec2 softAvg = (neighborX + neighborY + neighborNegX + neighborNegY + result) / 5.0;
        result = mix(result, softAvg, rippleSmooth);
        float resultLen = length(result);
        if (resultLen > 1.0) {
          result *= 1.0 / max(resultLen, 1e-4);
        }
        gl_FragColor = vec4(result, 0.0, 1.0);
      }
    """
  }
}
