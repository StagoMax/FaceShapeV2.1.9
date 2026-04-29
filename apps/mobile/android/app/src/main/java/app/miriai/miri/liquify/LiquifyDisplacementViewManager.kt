package app.miriai.miri.liquify

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import kotlin.math.roundToInt

class LiquifyDisplacementViewManager : SimpleViewManager<LiquifyDisplacementView>() {
  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(reactContext: ThemedReactContext): LiquifyDisplacementView {
    return LiquifyDisplacementView(reactContext)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    mutableMapOf(
      "topReady" to mutableMapOf("registrationName" to "onReady"),
    )

  @ReactProp(name = "sourcePath")
  fun setSourcePath(view: LiquifyDisplacementView, path: String?) {
    view.setSourcePath(path)
  }

  @ReactProp(name = "maxMagnitude", defaultFloat = 0.5f)
  fun setMaxMagnitude(view: LiquifyDisplacementView, value: Float) {
    view.setMaxMagnitude(value)
  }

  @ReactProp(name = "brushFalloff", defaultFloat = 0.5f)
  fun setBrushFalloff(view: LiquifyDisplacementView, value: Float) {
    view.setBrushFalloff(value)
  }

  @ReactProp(name = "smoothingStrength", defaultFloat = 0.4f)
  fun setSmoothingStrength(view: LiquifyDisplacementView, value: Float) {
    view.setSmoothingStrength(value)
  }

  @ReactProp(name = "smoothingIterations", defaultInt = 1)
  fun setSmoothingIterations(view: LiquifyDisplacementView, value: Int) {
    view.setSmoothingIterations(value)
  }

  @ReactProp(name = "strengthScale", defaultFloat = 1f)
  fun setStrengthScale(view: LiquifyDisplacementView, value: Float) {
    view.setStrengthScale(value)
  }

  @ReactProp(name = "centerDampen", defaultFloat = 0.6f)
  fun setCenterDampen(view: LiquifyDisplacementView, value: Float) {
    view.setCenterDampen(value)
  }

  @ReactProp(name = "edgeBoost", defaultFloat = 1.15f)
  fun setEdgeBoost(view: LiquifyDisplacementView, value: Float) {
    view.setEdgeBoost(value)
  }

  @ReactProp(name = "maxStepFactor", defaultFloat = 0.8f)
  fun setMaxStepFactor(view: LiquifyDisplacementView, value: Float) {
    view.setMaxStepFactor(value)
  }

  @ReactProp(name = "decayCurve", defaultFloat = 1.3f)
  fun setDecayCurve(view: LiquifyDisplacementView, value: Float) {
    view.setDecayCurve(value)
  }

  @ReactProp(name = "centerResponseMin", defaultFloat = 0.2f)
  fun setCenterResponseMin(view: LiquifyDisplacementView, value: Float) {
    view.setCenterResponseMin(value)
  }

  @ReactProp(name = "centerResponseMax", defaultFloat = 1.5f)
  fun setCenterResponseMax(view: LiquifyDisplacementView, value: Float) {
    view.setCenterResponseMax(value)
  }

  @ReactProp(name = "edgeResponseMin", defaultFloat = 0.6f)
  fun setEdgeResponseMin(view: LiquifyDisplacementView, value: Float) {
    view.setEdgeResponseMin(value)
  }

  @ReactProp(name = "edgeResponseMax", defaultFloat = 2.4f)
  fun setEdgeResponseMax(view: LiquifyDisplacementView, value: Float) {
    view.setEdgeResponseMax(value)
  }

  @ReactProp(name = "stepFactorMin", defaultFloat = 0.05f)
  fun setStepFactorMin(view: LiquifyDisplacementView, value: Float) {
    view.setStepFactorMin(value)
  }

  @ReactProp(name = "stepFactorMax", defaultFloat = 3f)
  fun setStepFactorMax(view: LiquifyDisplacementView, value: Float) {
    view.setStepFactorMax(value)
  }

  @ReactProp(name = "softSaturationK", defaultFloat = 0.25f)
  fun setSoftSaturationK(view: LiquifyDisplacementView, value: Float) {
    view.setSoftSaturationK(value)
  }

  @ReactProp(name = "restoreBoost", defaultFloat = 1.35f)
  fun setRestoreBoost(view: LiquifyDisplacementView, value: Float) {
    view.setRestoreBoost(value)
  }

  @ReactProp(name = "restoreToOriginal", defaultBoolean = false)
  fun setRestoreToOriginal(view: LiquifyDisplacementView, value: Boolean) {
    view.setRestoreToOriginal(value)
  }

  @ReactProp(name = "rippleStart", defaultFloat = 1.3f)
  fun setRippleStart(view: LiquifyDisplacementView, value: Float) {
    view.setRippleStart(value)
  }

  @ReactProp(name = "rippleEnd", defaultFloat = 2.3f)
  fun setRippleEnd(view: LiquifyDisplacementView, value: Float) {
    view.setRippleEnd(value)
  }

  @ReactProp(name = "rippleMix", defaultFloat = 0.3f)
  fun setRippleMix(view: LiquifyDisplacementView, value: Float) {
    view.setRippleMix(value)
  }

  @ReactProp(name = "rippleSmooth", defaultFloat = 0.22f)
  fun setRippleSmooth(view: LiquifyDisplacementView, value: Float) {
    view.setRippleSmooth(value)
  }

  @ReactProp(name = "gradientScaleMax", defaultFloat = 1.5f)
  fun setGradientScaleMax(view: LiquifyDisplacementView, value: Float) {
    view.setGradientScaleMax(value)
  }

  @ReactProp(name = "performanceMode", defaultBoolean = false)
  fun setPerformanceMode(view: LiquifyDisplacementView, value: Boolean) {
    view.setPerformanceMode(value)
  }

  @ReactProp(name = "previewConfig")
  fun setPreviewConfig(view: LiquifyDisplacementView, map: ReadableMap?) {
    if (map == null) {
      view.setPreviewConfig(null)
      return
    }
    val density = view.resources.displayMetrics.density
    view.setPreviewConfig(map.toPreviewConfig(density))
  }

  @ReactProp(name = "previewShowWeights", defaultBoolean = false)
  fun setPreviewShowWeights(view: LiquifyDisplacementView, value: Boolean) {
    view.setPreviewShowWeights(value)
  }

  @ReactProp(name = "previewShowVectors", defaultBoolean = false)
  fun setPreviewShowVectors(view: LiquifyDisplacementView, value: Boolean) {
    view.setPreviewShowVectors(value)
  }

  @ReactProp(name = "previewShowBrushProfile", defaultBoolean = false)
  fun setPreviewShowBrushProfile(view: LiquifyDisplacementView, value: Boolean) {
    view.setPreviewShowBrushProfile(value)
  }

  @ReactProp(name = "previewBrushCenter")
  fun setPreviewBrushCenter(view: LiquifyDisplacementView, map: ReadableMap?) {
    if (map == null) {
      view.setPreviewBrushCenter(null, null)
      return
    }
    val cx = map.getDoubleSafe("x")?.toFloat()
    val cy = map.getDoubleSafe("y")?.toFloat()
    view.setPreviewBrushCenter(cx, cy)
  }

  @ReactProp(name = "previewBrushRadius")
  fun setPreviewBrushRadius(view: LiquifyDisplacementView, map: ReadableMap?) {
    if (map == null) {
      view.setPreviewBrushRadius(null, null)
      return
    }
    val rx = map.getDoubleSafe("x")?.toFloat()
    val ry = map.getDoubleSafe("y")?.toFloat()
    view.setPreviewBrushRadius(rx, ry)
  }

  @ReactProp(name = "previewBrushFalloff", defaultFloat = 0.5f)
  fun setPreviewBrushFalloff(view: LiquifyDisplacementView, value: Float) {
    view.setPreviewBrushFalloff(value)
  }

  @ReactProp(name = "previewBrushDecay", defaultFloat = 1.3f)
  fun setPreviewBrushDecay(view: LiquifyDisplacementView, value: Float) {
    view.setPreviewBrushDecay(value)
  }

  @ReactProp(name = "viewport")
  fun setViewport(view: LiquifyDisplacementView, map: ReadableMap?) {
    if (map == null) {
      return
    }
    val viewWidth = map.getDoubleSafe("viewWidth")?.toInt() ?: return
    val viewHeight = map.getDoubleSafe("viewHeight")?.toInt() ?: return
    val destX = map.getDoubleSafe("destX")?.toFloat() ?: return
    val destY = map.getDoubleSafe("destY")?.toFloat() ?: return
    val destWidth = map.getDoubleSafe("destWidth")?.toFloat() ?: return
    val destHeight = map.getDoubleSafe("destHeight")?.toFloat() ?: return
    val data = LiquifyViewportData(
      viewWidth = viewWidth,
      viewHeight = viewHeight,
      destX = destX,
      destY = destY,
      destWidth = destWidth,
      destHeight = destHeight,
    )
    view.setViewport(data)
  }

  override fun receiveCommand(view: LiquifyDisplacementView, commandId: String, args: ReadableArray?) {
    when (commandId) {
      CMD_ENQUEUE -> args?.getMapSafe(0)?.toBrushCommand()?.let { view.enqueueCommand(it) }
      CMD_ENQUEUE_BATCH -> args?.getArraySafe(0)?.let { array ->
        val commands = mutableListOf<LiquifyBrushCommand>()
        for (i in 0 until array.size()) {
          array.getMapSafe(i)?.toBrushCommand()?.let { commands.add(it) }
        }
        view.enqueueCommands(commands)
      }
      CMD_RESET -> view.resetDisplacement()
      CMD_RESET_PRESERVE_SNAPSHOTS -> view.resetDisplacementPreserveSnapshots()
      CMD_BEGIN_BATCH_UPDATE -> view.beginBatchUpdates()
      CMD_END_BATCH_UPDATE -> view.endBatchUpdates()
      CMD_SAVE_SNAPSHOT -> {
        val index = args?.getInt(0) ?: return
        view.saveSnapshot(index)
      }
      CMD_RESTORE_SNAPSHOT -> {
        val index = args?.getInt(0) ?: return
        view.restoreSnapshot(index)
      }
      CMD_DELETE_SNAPSHOT -> {
        val index = args?.getInt(0) ?: return
        view.deleteSnapshot(index)
      }
      CMD_SAVE_DISPLACEMENT_STATE -> {
        val path = args?.getStringSafe(0) ?: return
        view.saveDisplacementState(path)
      }
      CMD_LOAD_DISPLACEMENT_STATE -> {
        val path = args?.getStringSafe(0) ?: return
        view.loadDisplacementState(path)
      }
      CMD_EXPORT_WARPED_IMAGE -> {
        val path = args?.getStringSafe(0) ?: return
        val maxOutputDim = args?.getIntSafe(1) ?: 2048
        view.exportWarpedImage(path, maxOutputDim)
      }
    }
  }

  private fun ReadableMap.toBrushCommand(): LiquifyBrushCommand? {
    val normalizedX = getDoubleSafe("x") ?: return null
    val normalizedY = getDoubleSafe("y") ?: return null
    val deltaX = getDoubleSafe("dx") ?: 0.0
    val deltaY = getDoubleSafe("dy") ?: 0.0
    val radius = getDoubleSafe("radius") ?: 0.05
    val strength = getDoubleSafe("strength") ?: 0.5
    val pressure = getDoubleSafe("pressure") ?: DEFAULT_PRESSURE
    val tool = if (hasKey("tool")) getString("tool") ?: DEFAULT_TOOL else DEFAULT_TOOL
    return LiquifyBrushCommand(
      normalizedX.toFloat(),
      normalizedY.toFloat(),
      deltaX.toFloat(),
      deltaY.toFloat(),
      radius.toFloat(),
      strength.toFloat(),
      tool,
      pressure.toFloat(),
    )
  }

  private fun ReadableMap.toPreviewConfig(density: Float): LiquifyPreviewWindowConfig? {
    val sizeDp = getDoubleSafe("size")?.toFloat() ?: return null
    val spanX = getDoubleSafe("spanX")?.toFloat() ?: return null
    val spanY = getDoubleSafe("spanY")?.toFloat() ?: return null
    val visible = getBooleanSafe("visible") ?: false
    val offsetXDp = getDoubleSafe("offsetX")?.toFloat() ?: 0f
    val offsetYDp = getDoubleSafe("offsetY")?.toFloat() ?: 0f
    val centerX = getDoubleSafe("centerX")?.toFloat() ?: 0f
    val centerY = getDoubleSafe("centerY")?.toFloat() ?: 0f
    val cornerRadiusDp = getDoubleSafe("cornerRadius")?.toFloat() ?: DEFAULT_PREVIEW_CORNER_DP
    val pxMultiplier = density.coerceAtLeast(0.1f)
    return LiquifyPreviewWindowConfig(
      visible = visible,
      sizePx = (sizeDp * pxMultiplier).roundToInt().coerceAtLeast(0),
      offsetXPx = (offsetXDp * pxMultiplier).roundToInt().coerceAtLeast(0),
      offsetYPx = (offsetYDp * pxMultiplier).roundToInt().coerceAtLeast(0),
      centerX = centerX,
      centerY = centerY,
      spanX = spanX,
      spanY = spanY,
      cornerRadiusPx = (cornerRadiusDp * pxMultiplier).coerceAtLeast(0f),
    )
  }

  private fun ReadableMap.getDoubleSafe(key: String): Double? {
    return if (hasKey(key)) getDouble(key) else null
  }

  private fun ReadableArray.getArraySafe(index: Int): ReadableArray? {
    return if (index in 0 until size()) getArray(index) else null
  }

  private fun ReadableArray.getMapSafe(index: Int): ReadableMap? {
    return if (index in 0 until size()) getMap(index) else null
  }

  private fun ReadableArray.getStringSafe(index: Int): String? {
    return if (index in 0 until size()) getString(index) else null
  }

  private fun ReadableArray.getIntSafe(index: Int): Int? {
    return if (index in 0 until size()) getInt(index) else null
  }

  private fun ReadableMap.getBooleanSafe(key: String): Boolean? {
    return if (hasKey(key)) getBoolean(key) else null
  }

  companion object {
    private const val REACT_CLASS = "LiquifyDisplacementView"
    private const val DEFAULT_TOOL = "push"
    private const val DEFAULT_PRESSURE = 1.0
    private const val DEFAULT_PREVIEW_CORNER_DP = 10.0f
    const val CMD_ENQUEUE = "enqueueBrush"
    const val CMD_ENQUEUE_BATCH = "enqueueBrushBatch"
    const val CMD_RESET = "resetBrush"
    const val CMD_RESET_PRESERVE_SNAPSHOTS = "resetBrushPreserveSnapshots"
    const val CMD_BEGIN_BATCH_UPDATE = "beginBatchUpdate"
    const val CMD_END_BATCH_UPDATE = "endBatchUpdate"
    const val CMD_SAVE_SNAPSHOT = "saveSnapshot"
    const val CMD_RESTORE_SNAPSHOT = "restoreSnapshot"
    const val CMD_DELETE_SNAPSHOT = "deleteSnapshot"
    const val CMD_SAVE_DISPLACEMENT_STATE = "saveDisplacementState"
    const val CMD_LOAD_DISPLACEMENT_STATE = "loadDisplacementState"
    const val CMD_EXPORT_WARPED_IMAGE = "exportWarpedImage"
  }
}
