package com.dailytodo2

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicBoolean

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pendingResult = goAsync()
    val finishOnce = AtomicBoolean(false)
    val finishAlert = {
      if (finishOnce.compareAndSet(false, true)) {
        pendingResult.finish()
      }
    }
    val fallbackFinishHandler = Handler(Looper.getMainLooper())

    val reminderId = intent.getIntExtra("reminderId", 0)
    val title = intent.getStringExtra("title") ?: "Note reminder"
    val body = intent.getStringExtra("body") ?: "Reminder for this note"

    createReminderChannel(context)
    showReminderNotification(context, reminderId, title, body)
    playConfiguredVibration(context)
    playConfiguredSound(context.applicationContext, finishAlert)

    fallbackFinishHandler.postDelayed(finishAlert, 10_000)
  }

  private fun createReminderChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Reminders",
      NotificationManager.IMPORTANCE_HIGH
    ).apply {
      enableVibration(false)
      setSound(null, null)
      description = "Note reminder alerts"
    }

    context.getSystemService(NotificationManager::class.java)
      .createNotificationChannel(channel)
  }

  private fun showReminderNotification(
    context: Context,
    reminderId: Int,
    title: String,
    body: String
  ) {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val pendingIntent = PendingIntent.getActivity(
      context,
      reminderId,
      launchIntent,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setDefaults(0)
      .build()

    context.getSystemService(NotificationManager::class.java)
      .notify(NOTIFICATION_ID_BASE + reminderId, notification)
  }

  private fun playConfiguredVibration(context: Context) {
    val prefs = context.getSharedPreferences("timer_prefs", Context.MODE_PRIVATE)
    val patternName = prefs.getString("alertVibrationPattern", "double") ?: "double"
    val pattern = when (patternName) {
      "off" -> return
      "short" -> longArrayOf(0, 250)
      "long" -> longArrayOf(0, 800)
      else -> longArrayOf(0, 500, 200, 500)
    }

    val vibrator =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = context.getSystemService(VibratorManager::class.java)
        manager.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Vibrator::class.java)
      }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(pattern, -1)
    }
  }

  private fun playConfiguredSound(context: Context, onComplete: () -> Unit) {
    val prefs = context.getSharedPreferences("timer_prefs", Context.MODE_PRIVATE)
    val soundEnabled = prefs.getBoolean("alertSoundEnabled", true)
    if (!soundEnabled) {
      onComplete()
      return
    }

    var audioFocusRequest: AudioFocusRequest? = null

    try {
      audioFocusRequest = requestMediaAudioFocus(context)
      val assetFileDescriptor = context.resources.openRawResourceFd(R.raw.alarm)
      val player = MediaPlayer()
      val volume = prefs.getFloat("alertVolume", 0.8f).coerceIn(0f, 1f)

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

      player.setOnCompletionListener { completedPlayer ->
        completedPlayer.release()
        abandonMediaAudioFocus(context, audioFocusRequest)
        onComplete()
      }
      player.setOnErrorListener { erroredPlayer, _, _ ->
        erroredPlayer.release()
        abandonMediaAudioFocus(context, audioFocusRequest)
        onComplete()
        true
      }

      player.prepare()
      player.start()

      Handler(Looper.getMainLooper()).postDelayed({
        try {
          if (player.isPlaying) {
            player.stop()
          }
          player.release()
          abandonMediaAudioFocus(context, audioFocusRequest)
          onComplete()
        } catch (_: Exception) {}
      }, 10_000)
    } catch (e: Exception) {
      abandonMediaAudioFocus(context, audioFocusRequest)
      Log.e("ReminderReceiver", "Error playing reminder alarm", e)
      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      RingtoneManager.getRingtone(context.applicationContext, uri)?.play()
      Handler(Looper.getMainLooper()).postDelayed(onComplete, 3_000)
    }
  }

  private fun requestMediaAudioFocus(context: Context): AudioFocusRequest? {
    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        )
        .setOnAudioFocusChangeListener {}
        .build()

      audioManager.requestAudioFocus(request)
      request
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(
        null,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
      )
      null
    }
  }

  private fun abandonMediaAudioFocus(context: Context, request: AudioFocusRequest?) {
    val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && request != null) {
      audioManager.abandonAudioFocusRequest(request)
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(null)
    }
  }

  companion object {
    const val ACTION_REMINDER = "com.dailytodo2.REMINDER_ALERT"
    private const val CHANNEL_ID = "native_reminders_v1"
    private const val NOTIFICATION_ID_BASE = 40_000
  }
}
