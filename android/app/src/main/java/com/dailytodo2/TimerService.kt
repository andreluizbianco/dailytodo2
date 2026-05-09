package com.dailytodo2

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.CountDownTimer
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat

private const val ACTION_START = "START"
private const val ACTION_PAUSE = "PAUSE"
private const val ACTION_RESUME = "RESUME"
private const val ACTION_STOP = "STOP"
private const val ACTION_TOGGLE_PAUSE = "TOGGLE_PAUSE"
private const val ACTION_PREVIEW_ALERT_SOUND = "PREVIEW_ALERT_SOUND"

class TimerService : Service() {
  private val channelId = "pomodoro_timer_channel_v2"
  private val notificationId = 1001
  private val tickerHandler = Handler(Looper.getMainLooper())
  private var countDownTimer: CountDownTimer? = null
  private var stopwatchTicker: Runnable? = null
  private var alertPlayer: MediaPlayer? = null
  private var audioFocusRequest: AudioFocusRequest? = null
  private var todoId: Double = -1.0
  private var startedAt: Long = 0L
  private var lastStartedAt: Long = 0L
  private var durationSeconds: Int = 0
  private var remainingSeconds: Int = 0
  private var activeElapsedSeconds: Int = 0
  private var isPaused: Boolean = false
  private var timerMode: String = "pomodoro"
  private var todoTitle: String = ""

  companion object {
    var currentTodoId: Double = -1.0
    var currentStartedAt: Long = 0L
    var currentLastStartedAt: Long = 0L
    var currentDurationSeconds: Int = 0
    var currentRemainingSeconds: Int = 0
    var currentActiveElapsedSeconds: Int = 0
    var currentIsRunning: Boolean = false
    var currentIsPaused: Boolean = false
    var currentTimerMode: String = "pomodoro"
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    Log.d("TimerService", "onStartCommand action=${intent?.action}")

    when (intent?.action) {
      ACTION_START -> startTimer(intent)
      ACTION_PAUSE -> pauseTimer()
      ACTION_RESUME -> resumeTimer()
      ACTION_STOP -> stopTimer(completed = false)
      ACTION_PREVIEW_ALERT_SOUND -> {
        val volume = intent.getFloatExtra("alertVolume", getAlertVolume())
        playAlertSound(volume) {
          if (!currentIsRunning) {
            stopSelf()
          }
        }
      }
      ACTION_TOGGLE_PAUSE -> {
        if (isPaused) {
          resumeTimer()
        } else {
          pauseTimer()
        }
      }
    }

    return START_STICKY
  }

  override fun onDestroy() {
    stopTickers()
    releaseAlertPlayer()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startTimer(intent: Intent) {
    timerMode = intent.getStringExtra("timerMode") ?: "pomodoro"
    todoId = intent.getDoubleExtra("todoId", -1.0)
    durationSeconds =
      if (timerMode == "stopwatch") 0 else intent.getIntExtra("durationSeconds", 0)
    remainingSeconds = durationSeconds
    todoTitle = intent.getStringExtra("todoTitle") ?: ""
    startedAt = intent.getLongExtra("startedAt", System.currentTimeMillis())
    lastStartedAt = System.currentTimeMillis()
    activeElapsedSeconds = 0
    isPaused = false

    Log.d("TimerService", "ACTION_START durationSeconds=$durationSeconds todoId=$todoId")

    publishState(isRunning = true, isPaused = false)
    startForeground(notificationId, buildNotification())
    startTicker()
  }

  private fun pauseTimer() {
    if (isPaused || !currentIsRunning) return

    activeElapsedSeconds = getDisplayElapsedSeconds()
    isPaused = true
    stopTickers()

    if (timerMode == "pomodoro") {
      remainingSeconds = maxOf(0, durationSeconds - activeElapsedSeconds)
    }

    Log.d("TimerService", "ACTION_PAUSE activeElapsedSeconds=$activeElapsedSeconds")

    publishState(isRunning = true, isPaused = true)
    updateNotification()
  }

  private fun resumeTimer() {
    if (!isPaused || !currentIsRunning) return

    isPaused = false
    lastStartedAt = System.currentTimeMillis()

    Log.d("TimerService", "ACTION_RESUME remainingSeconds=$remainingSeconds")

    publishState(isRunning = true, isPaused = false)
    startForeground(notificationId, buildNotification())
    startTicker()
  }

  private fun stopTimer(completed: Boolean) {
    if (currentIsRunning && !isPaused) {
      activeElapsedSeconds = getDisplayElapsedSeconds()
    }

    if (completed) {
      activeElapsedSeconds = durationSeconds
    }

    stopTickers()
    remainingSeconds = 0
    isPaused = false

    Log.d("TimerService", "ACTION_STOP completed=$completed activeElapsedSeconds=$activeElapsedSeconds")

    publishState(isRunning = false, isPaused = false)
    sendFinishedEvent(completed)

    if (completed) {
      alertTimerFinished {
        removeNotification()
        stopSelf()
      }
    } else {
      removeNotification()
      stopSelf()
    }
  }

  private fun startTicker() {
    if (timerMode == "stopwatch") {
      startStopwatchTicker()
    } else {
      startCountdown()
    }
  }

  private fun stopTickers() {
    countDownTimer?.cancel()
    countDownTimer = null
    stopwatchTicker?.let { tickerHandler.removeCallbacks(it) }
    stopwatchTicker = null
  }

  private fun startCountdown() {
    stopTickers()

    countDownTimer = object : CountDownTimer(remainingSeconds * 1000L, 1000L) {
      override fun onTick(millisUntilFinished: Long) {
        remainingSeconds = (millisUntilFinished / 1000L).toInt()

        publishState(isRunning = true, isPaused = false, emitEvent = false)
        updateNotification()
      }

      override fun onFinish() {
        stopTimer(completed = true)
      }
    }

    countDownTimer?.start()
  }

  private fun startStopwatchTicker() {
    stopTickers()

    stopwatchTicker = object : Runnable {
      override fun run() {
        publishState(isRunning = true, isPaused = false, emitEvent = false)
        updateNotification()
        tickerHandler.postDelayed(this, 1000L)
      }
    }

    stopwatchTicker?.run()
  }

  private fun publishState(
    isRunning: Boolean,
    isPaused: Boolean,
    emitEvent: Boolean = true
  ) {
    currentTodoId = todoId
    currentStartedAt = startedAt
    currentLastStartedAt = lastStartedAt
    currentDurationSeconds = durationSeconds
    currentRemainingSeconds = remainingSeconds
    currentActiveElapsedSeconds = getDisplayElapsedSeconds()
    currentIsRunning = isRunning
    currentIsPaused = isPaused
    currentTimerMode = timerMode

    if (emitEvent) {
      sendTimerStateChangedEvent()
    }
  }

  private fun updateNotification() {
    val manager = getSystemService(NotificationManager::class.java)
    manager.notify(notificationId, buildNotification())
  }

  private fun removeNotification() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }

  private fun getDisplayElapsedSeconds(): Int {
    if (isPaused || !currentIsRunning) {
      return activeElapsedSeconds
    }

    val now = System.currentTimeMillis()
    return activeElapsedSeconds + ((now - lastStartedAt) / 1000L).toInt()
  }

  private fun sendFinishedEvent(completed: Boolean) {
    val finishedIntent = Intent("com.dailytodo2.TIMER_FINISHED").apply {
      setPackage(packageName)
      putExtra("todoId", todoId)
      putExtra("startedAt", startedAt)
      putExtra("finishedAt", System.currentTimeMillis())
      putExtra("durationSeconds", durationSeconds)
      putExtra("activeElapsedSeconds", activeElapsedSeconds)
      putExtra("completed", completed)
    }
    savePendingCompletion(completed)
    sendBroadcast(finishedIntent)
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Pomodoro Timer",
        NotificationManager.IMPORTANCE_DEFAULT
      )

      val manager = getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(channel)
    }
  }

  private fun buildNotification(): Notification {
    val displaySeconds =
      if (timerMode == "stopwatch") {
        getDisplayElapsedSeconds()
      } else {
        remainingSeconds
      }

    val hours = displaySeconds / 3600
    val minutes = (displaySeconds % 3600) / 60
    val seconds = displaySeconds % 60
    val timeText =
      if (hours > 0) {
        String.format("%02d:%02d:%02d", hours, minutes, seconds)
      } else {
        String.format("%02d:%02d", minutes, seconds)
      }

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = PendingIntent.getActivity(
      this,
      0,
      launchIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val toggleIntent = Intent(this, TimerService::class.java).apply {
      action = ACTION_TOGGLE_PAUSE
    }

    val togglePendingIntent = PendingIntent.getService(
      this,
      2001,
      toggleIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val toggleLabel = if (isPaused) "Play" else "Pause"
    val toggleIcon =
      if (isPaused) android.R.drawable.ic_media_play else android.R.drawable.ic_media_pause

    val builder = NotificationCompat.Builder(this, channelId)
      .setContentTitle(
        if (todoTitle.isNotBlank())
          todoTitle
        else if (timerMode == "stopwatch")
          "Stopwatch running"
        else
          "Pomodoro running"
      )
      .setContentText(timeText)
      .setContentIntent(pendingIntent)
      .setAutoCancel(false)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .addAction(toggleIcon, toggleLabel, togglePendingIntent)

    if (isPaused) {
      val stopIntent = Intent(this, TimerService::class.java).apply {
        action = ACTION_STOP
      }

      val stopPendingIntent = PendingIntent.getService(
        this,
        2002,
        stopIntent,
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )

      builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
    }

    return builder.build()
  }

  private fun alertTimerFinished(onComplete: () -> Unit) {
    try {
      playConfiguredVibration()
      val soundWillCompleteLater = playConfiguredSound(onComplete)

      if (!soundWillCompleteLater) {
        onComplete()
      }
    } catch (e: Exception) {
      Log.e("TimerService", "Error playing finish alert", e)
      onComplete()
    }
  }

  private fun playConfiguredVibration() {
    val prefs = getSharedPreferences("timer_prefs", MODE_PRIVATE)
    val patternName = prefs.getString("alertVibrationPattern", "double") ?: "double"
    val pattern = when (patternName) {
      "off" -> return
      "short" -> longArrayOf(0, 250)
      "long" -> longArrayOf(0, 800)
      else -> longArrayOf(0, 500, 200, 500)
    }

    val vibrator =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = getSystemService(VibratorManager::class.java)
        manager.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Vibrator::class.java)
      }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(pattern, -1)
    }
  }

  private fun playConfiguredSound(onComplete: () -> Unit): Boolean {
    val prefs = getSharedPreferences("timer_prefs", MODE_PRIVATE)
    val soundEnabled = prefs.getBoolean("alertSoundEnabled", true)

    if (!soundEnabled) return false

    return playAlertSound(getAlertVolume(), onComplete)
  }

  private fun playAlertSound(volume: Float, onComplete: () -> Unit): Boolean {
    return try {
      releaseAlertPlayer()
      requestMediaAudioFocus()

      val assetFileDescriptor = resources.openRawResourceFd(R.raw.alarm)
      val player = MediaPlayer()

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        player.setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
      } else {
        @Suppress("DEPRECATION")
        player.setAudioStreamType(AudioManager.STREAM_MUSIC)
      }

      player.setVolume(volume, volume)
      player.setDataSource(
        assetFileDescriptor.fileDescriptor,
        assetFileDescriptor.startOffset,
        assetFileDescriptor.length
      )
      assetFileDescriptor.close()

      player.setOnCompletionListener {
        releaseAlertPlayer()
        onComplete()
      }
      player.setOnErrorListener { _, _, _ ->
        releaseAlertPlayer()
        onComplete()
        true
      }

      player.prepare()
      alertPlayer = player
      player.start()
      true
    } catch (e: Exception) {
      Log.e("TimerService", "Error playing custom alarm", e)
      playFallbackRingtone()
      releaseAlertPlayer()
      false
    }
  }

  private fun getAlertVolume(): Float {
    val prefs = getSharedPreferences("timer_prefs", MODE_PRIVATE)
    return prefs.getFloat("alertVolume", 0.8f).coerceIn(0f, 1f)
  }

  private fun requestMediaAudioFocus() {
    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        .setOnAudioFocusChangeListener {}
        .build()

      audioFocusRequest = request
      audioManager.requestAudioFocus(request)
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(
        null,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
      )
    }
  }

  private fun releaseAlertPlayer() {
    alertPlayer?.release()
    alertPlayer = null

    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
      audioFocusRequest = null
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(null)
    }
  }

  private fun playFallbackRingtone() {
    val notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
    val ringtone = RingtoneManager.getRingtone(applicationContext, notification)
    ringtone.play()
  }

  private fun sendTimerStateChangedEvent() {
    val intent = Intent("com.dailytodo2.TIMER_STATE_CHANGED").apply {
      setPackage(packageName)
      putExtra("todoId", todoId)
      putExtra("startedAt", startedAt)
      putExtra("lastStartedAt", lastStartedAt)
      putExtra("durationSeconds", durationSeconds)
      putExtra("remainingSeconds", remainingSeconds)
      putExtra("activeElapsedSeconds", currentActiveElapsedSeconds)
      putExtra("isRunning", currentIsRunning)
      putExtra("isPaused", currentIsPaused)
      putExtra("timerMode", timerMode)
    }

    sendBroadcast(intent)
  }

  private fun savePendingCompletion(completed: Boolean) {
    val prefs = getSharedPreferences("timer_prefs", MODE_PRIVATE)

    prefs.edit()
      .putBoolean("hasPendingCompletion", true)
      .putString("pendingTodoId", String.format("%.0f", todoId))
      .putLong("pendingStartedAt", startedAt)
      .putLong("pendingFinishedAt", System.currentTimeMillis())
      .putInt("pendingDurationSeconds", durationSeconds)
      .putInt("pendingActiveElapsedSeconds", activeElapsedSeconds)
      .putBoolean("pendingCompleted", completed)
      .apply()
  }
}
