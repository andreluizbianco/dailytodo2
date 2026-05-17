package com.dailytodo2

import android.content.*
import android.app.AlarmManager
import android.app.PendingIntent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class TimerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private val ambientHandler = Handler(Looper.getMainLooper())
  private var ambientCurrentPlayer: MediaPlayer? = null
  private var ambientNextPlayer: MediaPlayer? = null
  private var ambientLoopRunnable: Runnable? = null
  private var ambientFadeRunnable: Runnable? = null
  private var ambientSoundId: String = "rain"
  private var ambientVolume: Float = 0.35f
  private var ambientGeneration: Int = 0
  private var ambientIsPlaying: Boolean = false

private val receiver = object : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    if (
      intent?.action == "com.dailytodo2.TIMER_FINISHED" ||
      intent?.action == "com.dailytodo2.TIMER_STATE_CHANGED"
    ) {
      val params = Arguments.createMap().apply {
        putDouble("todoId", intent.getDoubleExtra("todoId", -1.0))
        putDouble("startedAt", intent.getLongExtra("startedAt", 0L).toDouble())
        putDouble("lastStartedAt", intent.getLongExtra("lastStartedAt", 0L).toDouble())
        putDouble("finishedAt", intent.getLongExtra("finishedAt", 0L).toDouble())
        putInt("durationSeconds", intent.getIntExtra("durationSeconds", 0))
        putInt("remainingSeconds", intent.getIntExtra("remainingSeconds", 0))
        putInt("activeElapsedSeconds", intent.getIntExtra("activeElapsedSeconds", 0))
        putBoolean("completed", intent.getBooleanExtra("completed", false))
        putBoolean("isRunning", intent.getBooleanExtra("isRunning", false))
        putBoolean("isPaused", intent.getBooleanExtra("isPaused", false))
        putString("timerMode", intent.getStringExtra("timerMode") ?: "pomodoro")
      }

      val eventName =
        if (intent.action == "com.dailytodo2.TIMER_FINISHED")
          "TIMER_FINISHED"
        else
          "TIMER_STATE_CHANGED"

      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    }
  }
}

init {
  val filter = IntentFilter().apply {
    addAction("com.dailytodo2.TIMER_FINISHED")
    addAction("com.dailytodo2.TIMER_STATE_CHANGED")
  }

  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
    reactContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
  } else {
    reactContext.registerReceiver(receiver, filter)
  }
}

  override fun getName(): String = "TimerModule"

  @ReactMethod
fun startTimer(
  todoId: Double,
  durationSeconds: Int,
  startedAt: Double,
  timerMode: String,
  todoTitle: String
) {
    Log.d("TimerModule", "startTimer todoId=$todoId durationSeconds=$durationSeconds")

    val intent = Intent(reactContext, TimerService::class.java).apply {
      action = "START"
      putExtra("todoId", todoId)
      putExtra("durationSeconds", durationSeconds)
      putExtra("startedAt", startedAt.toLong())
      putExtra("timerMode", timerMode)
      putExtra("todoTitle", todoTitle)
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactContext.startForegroundService(intent)
    } else {
      reactContext.startService(intent)
    }
  }

  @ReactMethod
  fun pauseTimer() {
    Log.d("TimerModule", "pauseTimer")

    val intent = Intent(reactContext, TimerService::class.java).apply {
      action = "PAUSE"
    }

    reactContext.startService(intent)
  }

  @ReactMethod
  fun resumeTimer() {
    Log.d("TimerModule", "resumeTimer")

    val intent = Intent(reactContext, TimerService::class.java).apply {
      action = "RESUME"
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactContext.startForegroundService(intent)
    } else {
      reactContext.startService(intent)
    }
  }

  @ReactMethod
  fun stopTimer() {
    Log.d("TimerModule", "stopTimer")

    val intent = Intent(reactContext, TimerService::class.java).apply {
      action = "STOP"
    }

    reactContext.startService(intent)
  }

  @ReactMethod
  @Synchronized
  fun startAmbientSound(soundId: String, volume: Double) {
    Log.d("TimerModule", "startAmbientSound soundId=$soundId volume=$volume")

    val nextVolume = volume.toFloat().coerceIn(0f, 1f)
    if (
      ambientIsPlaying &&
      ambientSoundId == soundId &&
      ambientCurrentPlayer?.isPlaying == true
    ) {
      ambientVolume = nextVolume
      setAmbientPlayerVolume(ambientCurrentPlayer, ambientVolume)
      return
    }

    ambientSoundId = soundId
    ambientVolume = nextVolume
    ambientGeneration += 1
    releaseAmbientPlayers()

    val player = createAmbientPlayer(ambientSoundId, ambientVolume) ?: return
    ambientCurrentPlayer = player
    ambientIsPlaying = true
    player.start()
    scheduleAmbientCrossfade(ambientGeneration)
  }

  @ReactMethod
  @Synchronized
  fun stopAmbientSound() {
    Log.d("TimerModule", "stopAmbientSound")
    ambientGeneration += 1
    ambientIsPlaying = false
    releaseAmbientPlayers()
  }

  @ReactMethod
  fun setAlertPreferences(soundEnabled: Boolean, vibrationPattern: String, volume: Double) {
    Log.d(
      "TimerModule",
      "setAlertPreferences soundEnabled=$soundEnabled vibrationPattern=$vibrationPattern volume=$volume"
    )

    val prefs = reactContext.getSharedPreferences("timer_prefs", Context.MODE_PRIVATE)

    prefs.edit()
      .putBoolean("alertSoundEnabled", soundEnabled)
      .putString("alertVibrationPattern", vibrationPattern)
      .putFloat("alertVolume", volume.toFloat().coerceIn(0f, 1f))
      .apply()
  }

  @ReactMethod
  fun previewAlertSound(volume: Double) {
    Log.d("TimerModule", "previewAlertSound volume=$volume")

    val intent = Intent(reactContext, TimerService::class.java).apply {
      action = "PREVIEW_ALERT_SOUND"
      putExtra("alertVolume", volume.toFloat().coerceIn(0f, 1f))
    }

    reactContext.startService(intent)
  }

  @ReactMethod
  fun scheduleReminder(
    reminderId: Double,
    triggerAtMillis: Double,
    title: String,
    body: String,
    targetTodoId: String,
    timerMode: String,
    durationSeconds: Double,
    timerText: String
  ) {
    val id = reminderId.toInt()
    val triggerAt = triggerAtMillis.toLong()
    val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = createReminderPendingIntent(
      id,
      title,
      body,
      targetTodoId,
      timerMode,
      durationSeconds.toInt(),
      timerText
    )

    Log.d("TimerModule", "scheduleReminder id=$id triggerAt=$triggerAt title=$title")

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarmManager.setExactAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        triggerAt,
        pendingIntent
      )
    } else {
      alarmManager.setExact(
        AlarmManager.RTC_WAKEUP,
        triggerAt,
        pendingIntent
      )
    }
  }

  @ReactMethod
  fun cancelReminder(reminderId: Double) {
    val id = reminderId.toInt()
    val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = createReminderPendingIntent(id, "", "", "", "pomodoro", 0, "")

    Log.d("TimerModule", "cancelReminder id=$id")

    alarmManager.cancel(pendingIntent)
    pendingIntent.cancel()
  }

  private fun createReminderPendingIntent(
    reminderId: Int,
    title: String,
    body: String,
    targetTodoId: String,
    timerMode: String,
    durationSeconds: Int,
    timerText: String
  ): PendingIntent {
    val intent = Intent(reactContext, ReminderReceiver::class.java).apply {
      action = ReminderReceiver.ACTION_REMINDER
      putExtra("reminderId", reminderId)
      putExtra("title", title)
      putExtra("body", body)
      putExtra("targetTodoId", targetTodoId)
      putExtra("timerMode", timerMode)
      putExtra("durationSeconds", durationSeconds)
      putExtra("timerText", timerText)
    }

    return PendingIntent.getBroadcast(
      reactContext,
      reminderId,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
  }

  private fun ambientResourceId(soundId: String): Int {
    return when (soundId) {
      "waterfall" -> R.raw.ambient_waterfall
      "gentle-rain" -> R.raw.ambient_gentle_rain
      else -> R.raw.ambient_rain
    }
  }

  private fun createAmbientPlayer(soundId: String, volume: Float): MediaPlayer? {
    return try {
      val assetFileDescriptor = reactContext.resources.openRawResourceFd(
        ambientResourceId(soundId)
      )
      val player = MediaPlayer()

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        player.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        )
      } else {
        @Suppress("DEPRECATION")
        player.setAudioStreamType(AudioManager.STREAM_MUSIC)
      }

      player.setDataSource(
        assetFileDescriptor.fileDescriptor,
        assetFileDescriptor.startOffset,
        assetFileDescriptor.length
      )
      assetFileDescriptor.close()
      player.setVolume(volume, volume)
      player.isLooping = false
      player.prepare()
      player
    } catch (error: Exception) {
      Log.e("TimerModule", "Error creating ambient player", error)
      null
    }
  }

  private fun scheduleAmbientCrossfade(generation: Int) {
    val player = ambientCurrentPlayer ?: return
    val durationMs = player.duration
    if (durationMs <= 0) {
      ambientHandler.postDelayed({ beginAmbientCrossfade(generation) }, 10_000L)
      return
    }

    val fadeMs = ambientFadeDurationMs(durationMs)
    val delayMs = maxOf(250L, durationMs.toLong() - fadeMs)

    ambientLoopRunnable?.let { ambientHandler.removeCallbacks(it) }

    ambientLoopRunnable = Runnable {
      beginAmbientCrossfade(generation)
    }.also { runnable ->
      ambientHandler.postDelayed(runnable, delayMs)
    }
  }

  private fun ambientFadeDurationMs(durationMs: Int): Long {
    return minOf(3000L, maxOf(1200L, durationMs.toLong() / 3L))
  }

  @Synchronized
  private fun beginAmbientCrossfade(generation: Int) {
    if (generation != ambientGeneration) return
    if (!ambientIsPlaying) return

    val outgoingPlayer = ambientCurrentPlayer ?: return
    val incomingPlayer = createAmbientPlayer(ambientSoundId, 0f) ?: run {
      outgoingPlayer.seekTo(0)
      outgoingPlayer.start()
      scheduleAmbientCrossfade(generation)
      return
    }

    ambientNextPlayer = incomingPlayer
    incomingPlayer.start()

    val fadeMs = ambientFadeDurationMs(outgoingPlayer.duration)
    val steps = 30
    val stepDelayMs = maxOf(24L, fadeMs / steps)
    var step = 0

    ambientFadeRunnable?.let { ambientHandler.removeCallbacks(it) }
    ambientFadeRunnable = object : Runnable {
      override fun run() {
        if (generation != ambientGeneration) return

        step += 1
        val ratio = smoothAmbientFadeRatio(
          (step.toFloat() / steps.toFloat()).coerceIn(0f, 1f)
        )
        val outgoingVolume = ambientVolume * (1f - ratio)
        val incomingVolume = ambientVolume * ratio

        try {
          setAmbientPlayerVolume(outgoingPlayer, outgoingVolume)
          setAmbientPlayerVolume(incomingPlayer, incomingVolume)
        } catch (error: Exception) {
          Log.e("TimerModule", "Error during ambient crossfade", error)
        }

        if (step < steps) {
          ambientHandler.postDelayed(this, stepDelayMs)
          return
        }

        try {
          outgoingPlayer.stop()
        } catch (_: Exception) {}
        try {
          outgoingPlayer.release()
        } catch (_: Exception) {}

        ambientCurrentPlayer = incomingPlayer
        ambientNextPlayer = null
        scheduleAmbientCrossfade(generation)
      }
    }.also { runnable ->
      ambientHandler.post(runnable)
    }
  }

  private fun smoothAmbientFadeRatio(value: Float): Float {
    return value * value * (3f - 2f * value)
  }

  private fun setAmbientPlayerVolume(player: MediaPlayer?, volume: Float) {
    player?.setVolume(volume.coerceIn(0f, 1f), volume.coerceIn(0f, 1f))
  }

  private fun releaseAmbientPlayers() {
    ambientLoopRunnable?.let { ambientHandler.removeCallbacks(it) }
    ambientFadeRunnable?.let { ambientHandler.removeCallbacks(it) }
    ambientLoopRunnable = null
    ambientFadeRunnable = null

    try {
      ambientCurrentPlayer?.stop()
    } catch (_: Exception) {}
    try {
      ambientCurrentPlayer?.release()
    } catch (_: Exception) {}
    ambientCurrentPlayer = null
    try {
      ambientNextPlayer?.stop()
    } catch (_: Exception) {}
    try {
      ambientNextPlayer?.release()
    } catch (_: Exception) {}
    ambientNextPlayer = null
  }

  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Int) {}

  @ReactMethod
  fun getTimerState(promise: Promise) {
    val prefs = reactContext.getSharedPreferences("timer_prefs", Context.MODE_PRIVATE)
    val hasPersistedRunningTimer = prefs.getBoolean("currentIsRunning", false)

    if (!TimerService.currentIsRunning && hasPersistedRunningTimer) {
      val persistedTodoId = prefs.getString("currentTodoId", "-1.0")?.toDoubleOrNull() ?: -1.0
      val persistedStartedAt = prefs.getLong("currentStartedAt", 0L)
      val persistedLastStartedAt = prefs.getLong("currentLastStartedAt", 0L)
      val persistedDurationSeconds = prefs.getInt("currentDurationSeconds", 0)
      val persistedStoredElapsedSeconds = prefs.getInt("currentActiveElapsedSeconds", 0)
      val persistedIsPaused = prefs.getBoolean("currentIsPaused", false)
      val persistedTimerMode = prefs.getString("currentTimerMode", "pomodoro") ?: "pomodoro"
      val persistedElapsedSeconds =
        if (persistedIsPaused) {
          persistedStoredElapsedSeconds
        } else {
          persistedStoredElapsedSeconds +
            ((System.currentTimeMillis() - persistedLastStartedAt) / 1000L).toInt()
        }
      val persistedRemainingSeconds =
        if (persistedTimerMode == "stopwatch") {
          0
        } else {
          maxOf(0, persistedDurationSeconds - persistedElapsedSeconds)
        }

      val persistedMap = Arguments.createMap().apply {
        putDouble("todoId", persistedTodoId)
        putDouble("startedAt", persistedStartedAt.toDouble())
        putDouble("lastStartedAt", persistedLastStartedAt.toDouble())
        putInt("durationSeconds", persistedDurationSeconds)
        putInt("remainingSeconds", persistedRemainingSeconds)
        putInt("activeElapsedSeconds", persistedElapsedSeconds)
        putBoolean("isRunning", true)
        putBoolean("isPaused", persistedIsPaused)
        putString("timerMode", persistedTimerMode)
      }

      promise.resolve(persistedMap)
      return
    }

    val map = Arguments.createMap().apply {
      putDouble("todoId", TimerService.currentTodoId)
      putDouble("startedAt", TimerService.currentStartedAt.toDouble())
      putDouble("lastStartedAt", TimerService.currentLastStartedAt.toDouble())
      putInt("durationSeconds", TimerService.currentDurationSeconds)
      putInt("remainingSeconds", TimerService.currentRemainingSeconds)
      putInt("activeElapsedSeconds", TimerService.currentActiveElapsedSeconds)
      putBoolean("isRunning", TimerService.currentIsRunning)
      putBoolean("isPaused", TimerService.currentIsPaused)
      putString("timerMode", TimerService.currentTimerMode)
    }

  promise.resolve(map)
  }

@ReactMethod
fun getPendingCompletion(promise: Promise) {
  val prefs = reactContext.getSharedPreferences("timer_prefs", Context.MODE_PRIVATE)

  val hasPending = prefs.getBoolean("hasPendingCompletion", false)

  if (!hasPending) {
    promise.resolve(null)
    return
  }

val rawTodoId = prefs.all["pendingTodoId"]

val todoIdString = when (rawTodoId) {
  is String -> rawTodoId.toDoubleOrNull()?.toLong()?.toString() ?: rawTodoId
  is Float -> rawTodoId.toLong().toString()
  is Double -> rawTodoId.toLong().toString()
  is Long -> rawTodoId.toString()
  is Int -> rawTodoId.toString()
  else -> "-1"
}

val map = Arguments.createMap().apply {
  putString("todoId", todoIdString)
  putDouble("startedAt", prefs.getLong("pendingStartedAt", 0L).toDouble())
  putDouble("finishedAt", prefs.getLong("pendingFinishedAt", 0L).toDouble())
  putInt("durationSeconds", prefs.getInt("pendingDurationSeconds", 0))
  putInt("activeElapsedSeconds", prefs.getInt("pendingActiveElapsedSeconds", 0))
  putBoolean("completed", prefs.getBoolean("pendingCompleted", false))
}

  promise.resolve(map)
}

@ReactMethod
  fun clearPendingCompletion() {
    val prefs = reactContext.getSharedPreferences("timer_prefs", Context.MODE_PRIVATE)

    prefs.edit()
    .remove("hasPendingCompletion")
    .remove("pendingTodoId")
    .remove("pendingStartedAt")
    .remove("pendingFinishedAt")
    .remove("pendingDurationSeconds")
    .remove("pendingActiveElapsedSeconds")
    .remove("pendingCompleted")
    .apply()
}

@ReactMethod
fun getNotificationTarget(promise: Promise) {
  val intent = currentActivity?.intent
  val targetTodoId = intent?.getStringExtra("notificationTargetTodoId")

  if (targetTodoId.isNullOrBlank()) {
    promise.resolve(null)
    return
  }

  val map = Arguments.createMap().apply {
    putString("todoId", targetTodoId)
    putString("targetType", intent.getStringExtra("notificationTargetType") ?: "notification")
    putString("reminderId", intent.getStringExtra("notificationTargetReminderId") ?: "")
  }

  promise.resolve(map)
}

@ReactMethod
fun clearNotificationTarget() {
  currentActivity?.intent?.removeExtra("notificationTargetTodoId")
  currentActivity?.intent?.removeExtra("notificationTargetType")
  currentActivity?.intent?.removeExtra("notificationTargetReminderId")
}

  override fun invalidate() {
    try {
      reactContext.unregisterReceiver(receiver)
    } catch (_: Exception) {}

    releaseAmbientPlayers()
    super.invalidate()
  }
}
