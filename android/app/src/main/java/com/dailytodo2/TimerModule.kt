package com.dailytodo2

import android.content.*
import android.app.AlarmManager
import android.app.PendingIntent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class TimerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

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
    body: String
  ) {
    val id = reminderId.toInt()
    val triggerAt = triggerAtMillis.toLong()
    val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val pendingIntent = createReminderPendingIntent(id, title, body)

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
    val pendingIntent = createReminderPendingIntent(id, "", "")

    Log.d("TimerModule", "cancelReminder id=$id")

    alarmManager.cancel(pendingIntent)
    pendingIntent.cancel()
  }

  private fun createReminderPendingIntent(
    reminderId: Int,
    title: String,
    body: String
  ): PendingIntent {
    val intent = Intent(reactContext, ReminderReceiver::class.java).apply {
      action = ReminderReceiver.ACTION_REMINDER
      putExtra("reminderId", reminderId)
      putExtra("title", title)
      putExtra("body", body)
    }

    return PendingIntent.getBroadcast(
      reactContext,
      reminderId,
      intent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )
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

  override fun invalidate() {
    try {
      reactContext.unregisterReceiver(receiver)
    } catch (_: Exception) {}

    super.invalidate()
  }
}
