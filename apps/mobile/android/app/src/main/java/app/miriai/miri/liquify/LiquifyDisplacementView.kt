package app.miriai.miri.liquify

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.opengl.GLSurfaceView
import android.util.AttributeSet
import android.util.Log
import android.widget.FrameLayout
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.max
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

class LiquifyDisplacementView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : FrameLayout(context, attrs), GLSurfaceView.Renderer, LifecycleEventListener {

  private val glView = GLSurfaceView(context)
  private val renderer = LiquifyDisplacementRenderer()
  private val pendingCommands = ConcurrentLinkedQueue<LiquifyBrushCommand>()
  private val pendingCommandCount = AtomicInteger(0)
  private var sourceBitmap: Bitmap? = null
  private var sourcePath: String? = null
  private var isSurfaceReady = false
  @Volatile private var needsContextRestore = false
  private val reactContext: ReactContext? = context as? ReactContext
  private var lifecycleRegistered = false
  private var viewportData: LiquifyViewportData? = null
  private var maxMagnitude = 0.5f
  private var brushFalloff = 0.5f
  private var smoothingStrength = 0.4f
  private var smoothingIterations = 1
  private var strengthScale = 1f
  private var centerDampen = 0.6f
  private var edgeBoost = 1.15f
  private var maxStepFactor = 0.8f
  private var decayCurve = 1.3f
  private var softSaturationK = 0.25f
  private var restoreBoost = 1.35f
  private var restoreToOriginal = false
  private var rippleStart = 1.3f
  private var rippleEnd = 2.3f
  private var rippleMix = 0.3f
  private var rippleSmooth = 0.22f
  private var gradientScaleMax = 1.5f
  private var performanceMode = false
  private var centerResponseMin = 0.2f
  private var centerResponseMax = 1.5f
  private var edgeResponseMin = 0.6f
  private var edgeResponseMax = 2.4f
  private var stepFactorMin = 0.05f
  private var stepFactorMax = 3f
  private var previewConfig: LiquifyPreviewWindowConfig? = null
  private var previewShowWeights = false
  private var previewShowVectors = false
  private var previewShowBrushProfile = false
  private var previewBrushCenterX = 0.5f
  private var previewBrushCenterY = 0.5f
  private var previewBrushRadiusX = 0f
  private var previewBrushRadiusY = 0f
  private var previewBrushFalloffValue = 0.5f
  private var previewBrushDecayValue = 1.3f
  private var hasPreviewBrushCenter = false
  // 更高的处理预算，减少事件丢弃导致的“瞬移”
  private val maxCommandsPerFrame = 16
  private val maxPendingQueueSize = 800
  @Volatile private var suppressRenderRequests = false
  @Volatile private var hasSuppressedRenderRequest = false

  private fun requestRenderSafely() {
    if (suppressRenderRequests) {
      hasSuppressedRenderRequest = true
      return
    }
    glView.requestRender()
  }

  private fun emitReadyEvent(retryCount: Int = 0) {
    post {
      val viewId = id
      if (viewId < 0) {
        if (retryCount < 12) {
          postDelayed({ emitReadyEvent(retryCount + 1) }, 16L)
        }
        return@post
      }
      reactContext
        ?.getJSModule(RCTEventEmitter::class.java)
        ?.receiveEvent(viewId, "topReady", null)
    }
  }

  init {
    glView.setEGLContextClientVersion(3)
    glView.setRenderer(this)
    glView.preserveEGLContextOnPause = true
    glView.renderMode = GLSurfaceView.RENDERMODE_WHEN_DIRTY
    addView(
      glView,
      LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
    )
    if (reactContext != null) {
      reactContext.addLifecycleEventListener(this)
      lifecycleRegistered = true
    }
    queueBrushResponseUpdate()
    queueRender {
      renderer.updatePreviewDebug(previewShowWeights, previewShowVectors, previewShowBrushProfile)
    }
    queueBrushPreviewUpdate()
  }

  fun setSourceBitmap(bitmap: Bitmap) {
    sourceBitmap = bitmap
    queueRender {
      renderer.clearSnapshots()
      renderer.bindSourceBitmap(bitmap)
    }
    requestRenderSafely()
  }

  fun setSourcePath(path: String?) {
    if (path.isNullOrBlank()) return
    sourcePath = path
    val bitmap = decodeBitmap(path) ?: return
    setSourceBitmap(bitmap)
  }

  fun setMaxMagnitude(value: Float) {
    maxMagnitude = value
  }

  fun enqueueCommand(command: LiquifyBrushCommand) {
    pendingCommands.add(command)
    pendingCommandCount.incrementAndGet()
    requestRenderSafely()
  }

  fun enqueueCommands(commands: List<LiquifyBrushCommand>) {
    if (commands.isEmpty()) return
    pendingCommands.addAll(commands)
    pendingCommandCount.addAndGet(commands.size)
    requestRenderSafely()
  }

  fun resetDisplacement() {
    pendingCommands.clear()
    pendingCommandCount.set(0)
    queueRender {
      renderer.clearDisplacementTexture()
      renderer.clearSnapshots()
    }
    requestRenderSafely()
  }

  fun resetDisplacementPreserveSnapshots() {
    pendingCommands.clear()
    pendingCommandCount.set(0)
    queueRender {
      renderer.clearDisplacementTexturePreserveSnapshots()
    }
    requestRenderSafely()
  }

  fun beginBatchUpdates() {
    suppressRenderRequests = true
    hasSuppressedRenderRequest = false
  }

  fun endBatchUpdates() {
    queueRender {
      suppressRenderRequests = false
      hasSuppressedRenderRequest = false
      glView.requestRender()
    }
  }

  fun saveSnapshot(index: Int) {
    queueRender {
      processPendingCommandsFully()
      renderer.saveSnapshot(index)
      requestRenderSafely()
    }
  }

  fun restoreSnapshot(index: Int) {
    queueRender {
      renderer.restoreSnapshot(index)
      requestRenderSafely()
    }
  }

  fun deleteSnapshot(index: Int) {
    queueRender {
      renderer.deleteSnapshot(index)
    }
  }

  fun saveDisplacementState(path: String?) {
    if (path.isNullOrBlank()) {
      return
    }
    queueRender {
      processPendingCommandsFully()
      val saved = renderer.saveDisplacementState(path)
      if (!saved) {
        Log.w(TAG, "saveDisplacementState failed: $path")
      }
    }
  }

  fun loadDisplacementState(path: String?) {
    if (path.isNullOrBlank()) {
      return
    }
    queueRender {
      val loaded = renderer.loadDisplacementState(path)
      if (!loaded) {
        Log.w(TAG, "loadDisplacementState failed: $path")
        return@queueRender
      }
      requestRenderSafely()
    }
  }

  fun exportWarpedImage(path: String?, maxOutputDim: Int?) {
    if (path.isNullOrBlank()) {
      return
    }
    val safeMaxOutput = (maxOutputDim ?: 2048).coerceIn(256, 8192)
    queueRender {
      processPendingCommandsFully()
      val exported = renderer.exportWarpedImage(path, maxMagnitude, safeMaxOutput)
      if (!exported) {
        Log.w(TAG, "exportWarpedImage failed: path=$path, maxOutput=$safeMaxOutput")
      }
    }
  }

  private fun decodeBitmap(path: String): Bitmap? {
    return try {
      when {
        path.startsWith("content://", ignoreCase = true) -> {
          val uri = Uri.parse(path)
          context.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it) }
        }
        path.startsWith("file://", ignoreCase = true) -> {
          val uri = Uri.parse(path)
          BitmapFactory.decodeFile(uri.path ?: path)
        }
        else -> BitmapFactory.decodeFile(path)
      }
    } catch (e: Exception) {
      null
    }
  }

  private fun ensureSourceBitmap() {
    val path = sourcePath
    if (path.isNullOrBlank()) {
      return
    }
    val bitmap = sourceBitmap
    if (bitmap == null || bitmap.isRecycled) {
      sourceBitmap = decodeBitmap(path)
    }
  }

  fun setViewport(config: LiquifyViewportData?) {
    viewportData = config
    if (config == null) {
      return
    }
    queueRender {
      renderer.updateViewport(config)
    }
    requestRenderSafely()
  }

  fun setBrushFalloff(value: Float) {
    brushFalloff = value.coerceIn(0.05f, 1f)
  }

  fun setSmoothingStrength(value: Float) {
    smoothingStrength = value.coerceIn(0.01f, 1f)
  }

  fun setSmoothingIterations(value: Int) {
    smoothingIterations = value.coerceIn(0, 5)
  }

  fun setStrengthScale(value: Float) {
    strengthScale = value.coerceIn(0.2f, 3f)
    queueBrushResponseUpdate()
  }

  fun setCenterDampen(value: Float) {
    centerDampen = value.coerceIn(0.05f, 0.95f)
    queueBrushResponseUpdate()
  }

  fun setEdgeBoost(value: Float) {
    edgeBoost = value.coerceIn(0.8f, 1.8f)
    queueBrushResponseUpdate()
  }

  fun setMaxStepFactor(value: Float) {
    maxStepFactor = value.coerceIn(0.1f, 2.5f)
    queueBrushResponseUpdate()
  }

  fun setDecayCurve(value: Float) {
    decayCurve = value.coerceIn(0.4f, 4f)
    queueBrushResponseUpdate()
  }

  fun setCenterResponseMin(value: Float) {
    centerResponseMin = value.coerceIn(0.05f, centerResponseMax - 0.01f)
    queueDynamicResponseUpdate()
  }

  fun setCenterResponseMax(value: Float) {
    centerResponseMax = max(value, centerResponseMin + 0.05f).coerceAtMost(3.5f)
    queueDynamicResponseUpdate()
  }

  fun setEdgeResponseMin(value: Float) {
    edgeResponseMin = value.coerceIn(0.2f, edgeResponseMax - 0.01f)
    queueDynamicResponseUpdate()
  }

  fun setEdgeResponseMax(value: Float) {
    edgeResponseMax = max(value, edgeResponseMin + 0.05f).coerceAtMost(4f)
    queueDynamicResponseUpdate()
  }

  fun setStepFactorMin(value: Float) {
    stepFactorMin = value.coerceIn(0.01f, stepFactorMax - 0.005f)
    queueDynamicResponseUpdate()
  }

  fun setStepFactorMax(value: Float) {
    stepFactorMax = max(value, stepFactorMin + 0.01f).coerceAtMost(5f)
    queueDynamicResponseUpdate()
  }

  fun setSoftSaturationK(value: Float) {
    softSaturationK = value.coerceIn(0.01f, 1f)
    queueSoftConstraintUpdate()
  }

  fun setRestoreBoost(value: Float) {
    restoreBoost = value.coerceIn(1f, 3f)
    queueSoftConstraintUpdate()
  }

  fun setRestoreToOriginal(value: Boolean) {
    restoreToOriginal = value
    queueRestoreModeUpdate()
  }

  fun setRippleStart(value: Float) {
    rippleStart = value
    queueSoftConstraintUpdate()
  }

  fun setRippleEnd(value: Float) {
    rippleEnd = value
    queueSoftConstraintUpdate()
  }

  fun setRippleMix(value: Float) {
    rippleMix = value.coerceIn(0f, 1f)
    queueSoftConstraintUpdate()
  }

  fun setRippleSmooth(value: Float) {
    rippleSmooth = value.coerceIn(0f, 1f)
    queueSoftConstraintUpdate()
  }

  fun setGradientScaleMax(value: Float) {
    gradientScaleMax = value.coerceIn(0.5f, 3f)
    queueSoftConstraintUpdate()
  }

  fun setPerformanceMode(value: Boolean) {
    performanceMode = value
    queueSoftConstraintUpdate()
  }

  fun setPreviewConfig(config: LiquifyPreviewWindowConfig?) {
    previewConfig = config
    queueRender {
      renderer.updatePreviewConfig(config)
    }
    requestRenderSafely()
  }

  fun setPreviewShowWeights(value: Boolean) {
    previewShowWeights = value
    queueRender {
      renderer.updatePreviewDebug(previewShowWeights, previewShowVectors, previewShowBrushProfile)
    }
    requestRenderSafely()
  }

  fun setPreviewShowVectors(value: Boolean) {
    previewShowVectors = value
    queueRender {
      renderer.updatePreviewDebug(previewShowWeights, previewShowVectors, previewShowBrushProfile)
    }
    requestRenderSafely()
  }

  fun setPreviewShowBrushProfile(value: Boolean) {
    previewShowBrushProfile = value
    queueRender {
      renderer.updatePreviewDebug(previewShowWeights, previewShowVectors, previewShowBrushProfile)
    }
    requestRenderSafely()
  }

  fun setPreviewBrushCenter(centerX: Float?, centerY: Float?) {
    if (centerX == null || centerY == null) {
      hasPreviewBrushCenter = false
    } else {
      hasPreviewBrushCenter = true
      previewBrushCenterX = centerX.coerceIn(0f, 1f)
      previewBrushCenterY = centerY.coerceIn(0f, 1f)
    }
    queueBrushPreviewUpdate()
    requestRenderSafely()
  }

  fun setPreviewBrushRadius(radiusX: Float?, radiusY: Float?) {
    if (radiusX == null || radiusY == null) {
      previewBrushRadiusX = 0f
      previewBrushRadiusY = 0f
    } else {
      previewBrushRadiusX = radiusX.coerceIn(0f, 1f)
      previewBrushRadiusY = radiusY.coerceIn(0f, 1f)
    }
    queueBrushPreviewUpdate()
    requestRenderSafely()
  }

  fun setPreviewBrushFalloff(value: Float) {
    previewBrushFalloffValue = value.coerceIn(0.05f, 1f)
    queueBrushPreviewUpdate()
    requestRenderSafely()
  }

  fun setPreviewBrushDecay(value: Float) {
    previewBrushDecayValue = value.coerceIn(0.2f, 4f)
    queueBrushPreviewUpdate()
    requestRenderSafely()
  }

  private fun queueBrushResponseUpdate() {
    queueRender {
      renderer.updateBrushResponse(
        strengthScale,
        centerDampen,
        edgeBoost,
        maxStepFactor,
        decayCurve,
      )
    }
    queueDynamicResponseUpdate()
  }

  private fun queueBrushPreviewUpdate() {
    val effectiveRadiusX = if (hasPreviewBrushCenter) previewBrushRadiusX else 0f
    val effectiveRadiusY = if (hasPreviewBrushCenter) previewBrushRadiusY else 0f
    queueRender {
      renderer.updatePreviewBrush(
        previewBrushCenterX,
        previewBrushCenterY,
        effectiveRadiusX,
        effectiveRadiusY,
        previewBrushFalloffValue,
        previewBrushDecayValue,
      )
    }
  }

  private fun queueDynamicResponseUpdate() {
    queueRender {
      renderer.updateDynamicResponseRanges(
        centerResponseMin,
        centerResponseMax,
        edgeResponseMin,
        edgeResponseMax,
        stepFactorMin,
        stepFactorMax,
      )
    }
  }

  private fun queueSoftConstraintUpdate() {
    queueRender {
      renderer.updateSoftConstraints(
        softSaturationK,
        rippleStart,
        rippleEnd,
        rippleMix,
        rippleSmooth,
        gradientScaleMax,
        restoreBoost,
        performanceMode,
      )
    }
  }

  private fun queueRestoreModeUpdate() {
    queueRender {
      renderer.updateRestoreMode(restoreToOriginal)
    }
  }

  private fun queueRender(block: () -> Unit) {
    glView.queueEvent {
      block()
    }
  }

  private fun restoreRendererState() {
    if (!isSurfaceReady) {
      return
    }
    val effectiveRadiusX = if (hasPreviewBrushCenter) previewBrushRadiusX else 0f
    val effectiveRadiusY = if (hasPreviewBrushCenter) previewBrushRadiusY else 0f
    ensureSourceBitmap()
    queueRender {
      if (needsContextRestore) {
        renderer.release()
        needsContextRestore = false
      }
      renderer.ensureSetup(width, height)
      sourceBitmap?.let { renderer.bindSourceBitmap(it) }
      viewportData?.let { renderer.updateViewport(it) }
      renderer.updatePreviewConfig(previewConfig)
      renderer.updatePreviewDebug(previewShowWeights, previewShowVectors, previewShowBrushProfile)
      renderer.updatePreviewBrush(
        previewBrushCenterX,
        previewBrushCenterY,
        effectiveRadiusX,
        effectiveRadiusY,
        previewBrushFalloffValue,
        previewBrushDecayValue,
      )
      renderer.updateBrushResponse(
        strengthScale,
        centerDampen,
        edgeBoost,
        maxStepFactor,
        decayCurve,
      )
      renderer.updateDynamicResponseRanges(
        centerResponseMin,
        centerResponseMax,
        edgeResponseMin,
        edgeResponseMax,
        stepFactorMin,
        stepFactorMax,
      )
      renderer.updateSoftConstraints(
        softSaturationK,
        rippleStart,
        rippleEnd,
        rippleMix,
        rippleSmooth,
        gradientScaleMax,
        restoreBoost,
        performanceMode,
      )
      renderer.updateRestoreMode(restoreToOriginal)
    }
    requestRenderSafely()
  }

  override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
    isSurfaceReady = true
    needsContextRestore = true
    restoreRendererState()
    emitReadyEvent()
  }

  override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
    restoreRendererState()
  }

  override fun onDrawFrame(gl: GL10?) {
    processPendingCommands()
    renderer.render(maxMagnitude)
  }

  private fun processPendingCommands() {
    var backlog = pendingCommandCount.get()

    // 若积压过多，只在极端情况下丢弃，避免拖动轨迹“跳跃”
    if (backlog > maxPendingQueueSize) {
      val toDrop = backlog - maxPendingQueueSize
      var dropped = 0
      while (dropped < toDrop) {
        val removed = pendingCommands.poll() ?: break
        dropped += 1
        pendingCommandCount.decrementAndGet()
      }
      backlog = pendingCommandCount.get()
    }

    val budget = when {
      backlog >= 60 -> 24
      backlog >= 30 -> 18
      backlog >= 12 -> 14
      else -> maxCommandsPerFrame
    }

    var processed = 0
    var lastCommand: LiquifyBrushCommand? = null
    var command = pendingCommands.poll()
    while (command != null && processed < budget) {
      pendingCommandCount.decrementAndGet()
      // 只做 brush pass，把 smoothing 合并到每帧一次，避免拖动时 GPU 负载暴涨导致“松手才生效”。
      renderer.applyBrush(
        command,
        brushFalloff,
        smoothingStrength,
        0,
        maxMagnitude,
      )
      lastCommand = command
      processed += 1
      command = pendingCommands.poll()
    }
    lastCommand?.let {
      val isRestore = it.tool.equals("restore", ignoreCase = true)
      val skipSmoothing = isRestore && restoreToOriginal
      if (skipSmoothing) {
        return@let
      }
      val baseIterations = if (isRestore) smoothingIterations.coerceAtMost(1) else smoothingIterations
      val iterations = if (performanceMode) baseIterations.coerceAtMost(1) else baseIterations
      val strength = if (isRestore) smoothingStrength * 0.7f else smoothingStrength
      renderer.applySmoothing(
        it,
        brushFalloff,
        strength,
        iterations,
        maxMagnitude,
      )
    }
    if (pendingCommandCount.get() > 0) {
      requestRenderSafely()
    }
  }

  private fun processPendingCommandsFully() {
    var guard = 0
    while (pendingCommandCount.get() > 0 && guard < 2048) {
      processPendingCommands()
      guard += 1
    }
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    isSurfaceReady = false
    glView.onPause()
    queueRender { renderer.release() }
    if (lifecycleRegistered) {
      reactContext?.removeLifecycleEventListener(this)
      lifecycleRegistered = false
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (!lifecycleRegistered && reactContext != null) {
      reactContext.addLifecycleEventListener(this)
      lifecycleRegistered = true
    }
    glView.onResume()
    restoreRendererState()
  }

  override fun onHostResume() {
    glView.onResume()
    restoreRendererState()
  }

  override fun onHostPause() {
    glView.onPause()
  }

  override fun onHostDestroy() {
    glView.onPause()
    queueRender { renderer.release() }
  }

  companion object {
    private const val TAG = "LiquifyDisplacementView"
  }
}

data class LiquifyViewportData(
  val viewWidth: Int,
  val viewHeight: Int,
  val destX: Float,
  val destY: Float,
  val destWidth: Float,
  val destHeight: Float,
)

data class LiquifyPreviewWindowConfig(
  val visible: Boolean,
  val sizePx: Int,
  val offsetXPx: Int,
  val offsetYPx: Int,
  val centerX: Float,
  val centerY: Float,
  val spanX: Float,
  val spanY: Float,
  val cornerRadiusPx: Float,
)
