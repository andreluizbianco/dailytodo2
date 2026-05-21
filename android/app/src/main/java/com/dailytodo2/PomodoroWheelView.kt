package com.dailytodo2

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import android.widget.OverScroller
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

class PomodoroWheelView(context: Context) : View(context) {
  private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.rgb(17, 24, 39)
    textAlign = Paint.Align.CENTER
    typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
  }
  private val fadePaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val textBounds = Rect()
  private val scroller = OverScroller(context)
  private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop

  private var velocityTracker: VelocityTracker? = null
  private var selectedMinutes = 25
  private var emittedMinutes = 25
  private var maxMinutes = 480
  private var scrollOffset = 0f
  private var lastScrollerY = 0
  private var lastTouchY = 0f
  private var isDragging = false
  private var isTouching = false
  private var pendingSettle = false
  private var snapTargetValue: Int? = null
  private var interactionEnabled = true
  private var textColor = Color.rgb(17, 24, 39)
  private var fadeColor = Color.WHITE
  private var wheelBackgroundColor = Color.WHITE

  private val itemHeight: Float
    get() = 40f * resources.displayMetrics.density

  init {
    setLayerType(LAYER_TYPE_SOFTWARE, null)
    isFocusable = true
    scroller.setFriction(ViewConfiguration.getScrollFriction() * 0.32f)
  }

  fun setValueMinutes(value: Int) {
    val clampedValue = value.coerceIn(0, maxMinutes)
    if (clampedValue == selectedMinutes && abs(scrollOffset) < 0.5f) return

    selectedMinutes = clampedValue
    emittedMinutes = clampedValue
    scrollOffset = 0f
    scroller.abortAnimation()
    redraw()
  }

  fun setMaxMinutes(value: Int) {
    maxMinutes = max(0, value)
    selectedMinutes = selectedMinutes.coerceIn(0, maxMinutes)
    emittedMinutes = emittedMinutes.coerceIn(0, maxMinutes)
    scrollOffset = 0f
    redraw()
  }

  fun setInteractionEnabled(enabled: Boolean) {
    interactionEnabled = enabled
    isEnabled = enabled
    alpha = if (enabled) 1f else 0.72f
  }

  fun setDarkMode(enabled: Boolean) {
    textColor = if (enabled) Color.rgb(229, 231, 235) else Color.rgb(17, 24, 39)
    if (wheelBackgroundColor == Color.WHITE || wheelBackgroundColor == Color.rgb(16, 18, 20)) {
      setWheelBackgroundColor(if (enabled) "#101214" else "#FFFFFF")
      return
    }
    redraw()
  }

  fun setWheelBackgroundColor(color: String?) {
    val parsedColor = try {
      if (color.isNullOrBlank()) null else Color.parseColor(color)
    } catch (_: IllegalArgumentException) {
      null
    } ?: wheelBackgroundColor

    wheelBackgroundColor = parsedColor
    fadeColor = parsedColor
    setBackgroundColor(parsedColor)
    redraw()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)

    val centerX = width / 2f
    val centerY = height * 0.46f
    val centerValue = selectedMinutes - scrollOffset / itemHeight
    val firstValue = floor(centerValue).toInt() - 4
    val lastValue = firstValue + 9
    val wheelRadius = itemHeight * 3.35f

    for (value in firstValue..lastValue) {
      if (value < 0 || value > maxMinutes) continue

      val distance = value - centerValue
      val wheelAngle = (distance / 3.35f).coerceIn(-1.18f, 1.18f)
      val y = centerY + sin(wheelAngle) * wheelRadius
      val absDistance = abs(distance)
      if (y < -itemHeight || y > height + itemHeight) continue

      val focus = (1f - min(1f, absDistance / 3.15f)).coerceIn(0f, 1f)
      val alpha = (44 + focus * 211).roundToInt().coerceIn(0, 255)
      val sizeSp = 28f + focus * 22f
      val digitScale = 0.82f
      val centerWeight = absDistance < 0.12f
      val scaleX = 0.94f + focus * 0.06f
      val scaleY = 0.74f + focus * 0.26f

      textPaint.color = textColor
      textPaint.alpha = alpha
      textPaint.textSize = sizeSp * digitScale * resources.displayMetrics.scaledDensity
      textPaint.typeface = Typeface.create(
        if (centerWeight) "sans-serif" else "sans-serif-light",
        Typeface.NORMAL,
      )

      val text = formatMinutes(value)
      textPaint.getTextBounds(text, 0, text.length, textBounds)
      canvas.save()
      canvas.scale(scaleX, scaleY, centerX, y)
      canvas.drawText(text, centerX, y - textBounds.exactCenterY(), textPaint)
      canvas.restore()
    }

    drawFades(canvas)
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (!interactionEnabled) return false

    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        parent.requestDisallowInterceptTouchEvent(true)
        scroller.abortAnimation()
        velocityTracker = VelocityTracker.obtain()
        velocityTracker?.addMovement(event)
        lastTouchY = event.y
        isTouching = true
        isDragging = false
        pendingSettle = false
        snapTargetValue = null
        return true
      }

      MotionEvent.ACTION_MOVE -> {
        velocityTracker?.addMovement(event)
        val dy = event.y - lastTouchY
        lastTouchY = event.y

        if (!isDragging && abs(dy) > touchSlop / 2f) {
          isDragging = true
        }

        if (isDragging) {
          applyScrollDelta(dy)
          redraw()
        }

        return true
      }

      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
        velocityTracker?.addMovement(event)
        velocityTracker?.computeCurrentVelocity(1000)
        val velocityY = velocityTracker?.yVelocity ?: 0f
        velocityTracker?.recycle()
        velocityTracker = null

        isTouching = false

        if (event.actionMasked == MotionEvent.ACTION_CANCEL) {
          settleToNearest()
          return true
        }

        if (abs(velocityY) > 120f) {
          startFling(velocityY.roundToInt())
        } else {
          settleToNearest()
        }

        return true
      }
    }

    return super.onTouchEvent(event)
  }

  override fun computeScroll() {
    if (scroller.computeScrollOffset()) {
      val currentY = scroller.currY
      val deltaY = (currentY - lastScrollerY).toFloat()
      lastScrollerY = currentY
      applyScrollDelta(deltaY)
      redraw()
      return
    }

    snapTargetValue?.let { targetValue ->
      completeSnap(targetValue)
      return
    }

    if (pendingSettle && !isTouching) {
      pendingSettle = false
      settleToNearest()
    }
  }

  private fun startFling(velocityY: Int) {
    val minOffset = ((selectedMinutes - maxMinutes) * itemHeight).roundToInt()
    val maxOffset = (selectedMinutes * itemHeight).roundToInt()
    val scaledVelocityY = (velocityY * 1.05f)
      .roundToInt()
      .coerceIn(-5200, 5200)

    lastScrollerY = 0
    pendingSettle = true
    scroller.fling(
      0,
      0,
      0,
      scaledVelocityY,
      0,
      0,
      minOffset,
      maxOffset,
      0,
      (itemHeight * 1.8f).roundToInt(),
    )
    redraw()
  }

  private fun settleToNearest() {
    val nextValue = (selectedMinutes - scrollOffset / itemHeight)
      .roundToInt()
      .coerceIn(0, maxMinutes)
    val targetOffset = ((selectedMinutes - nextValue) * itemHeight).roundToInt()
    val startOffset = scrollOffset.roundToInt()
    val delta = targetOffset - startOffset

    if (abs(delta) <= 1) {
      completeSnap(nextValue)
      return
    }

    snapTargetValue = nextValue
    lastScrollerY = startOffset
    scroller.startScroll(0, startOffset, 0, delta, 82)
    redraw()
  }

  private fun completeSnap(nextValue: Int) {
    selectedMinutes = nextValue.coerceIn(0, maxMinutes)
    scrollOffset = 0f
    snapTargetValue = null
    redraw()

    if (selectedMinutes != emittedMinutes) {
      emittedMinutes = selectedMinutes
      performSnapHaptic()
      emitChange(selectedMinutes)
    }
  }

  private fun applyScrollDelta(deltaY: Float) {
    scrollOffset = clampOffset(scrollOffset + deltaY)

    while (scrollOffset >= itemHeight && selectedMinutes > 0) {
      selectedMinutes -= 1
      scrollOffset -= itemHeight
    }

    while (scrollOffset <= -itemHeight && selectedMinutes < maxMinutes) {
      selectedMinutes += 1
      scrollOffset += itemHeight
    }

    scrollOffset = clampOffset(scrollOffset)
  }

  private fun clampOffset(offset: Float): Float {
    val minOffset = if (selectedMinutes >= maxMinutes) {
      -itemHeight * 0.42f
    } else {
      -itemHeight * 1.1f
    }
    val maxOffset = if (selectedMinutes <= 0) {
      itemHeight * 0.42f
    } else {
      itemHeight * 1.1f
    }
    return offset.coerceIn(minOffset, maxOffset)
  }

  private fun redraw() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
      postInvalidateOnAnimation()
    } else {
      invalidate()
    }
  }

  private fun emitChange(value: Int) {
    val reactContext = context as? ReactContext ?: return
    val event = Arguments.createMap().apply {
      putInt("valueMinutes", value)
    }

    reactContext
      .getJSModule(RCTEventEmitter::class.java)
      .receiveEvent(id, "topValueChange", event)
  }

  private fun performSnapHaptic() {
    val feedbackConstant = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      HapticFeedbackConstants.CONTEXT_CLICK
    } else {
      HapticFeedbackConstants.VIRTUAL_KEY
    }
    performHapticFeedback(feedbackConstant)
  }

  private fun drawFades(canvas: Canvas) {
    val topFadeHeight = height * 0.32f
    fadePaint.shader = LinearGradient(
      0f,
      0f,
      0f,
      topFadeHeight,
      fadeColor,
      Color.TRANSPARENT,
      Shader.TileMode.CLAMP,
    )
    canvas.drawRect(0f, 0f, width.toFloat(), topFadeHeight, fadePaint)

    fadePaint.shader = LinearGradient(
      0f,
      height.toFloat(),
      0f,
      height - topFadeHeight,
      fadeColor,
      Color.TRANSPARENT,
      Shader.TileMode.CLAMP,
    )
    canvas.drawRect(0f, height - topFadeHeight, width.toFloat(), height.toFloat(), fadePaint)
    fadePaint.shader = null
  }

  private fun formatMinutes(value: Int): String {
    return "${value.toString().padStart(2, '0')}:00"
  }
}
