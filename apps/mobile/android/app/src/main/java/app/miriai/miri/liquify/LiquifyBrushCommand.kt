package app.miriai.miri.liquify

data class LiquifyBrushCommand(
  val normalizedX: Float,
  val normalizedY: Float,
  val deltaX: Float,
  val deltaY: Float,
  val radius: Float,
  val strength: Float,
  val tool: String,
  val pressure: Float,
)
