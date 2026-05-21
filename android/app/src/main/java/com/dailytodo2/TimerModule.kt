package com.dailytodo2

import android.content.*
import android.app.AlarmManager
import android.app.PendingIntent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.os.Build
import android.os.Process
import android.util.Log
import java.io.ByteArrayOutputStream
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class TimerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private var ambientPlayer: AmbientLoopPlayer? = null
  private var ambientSoundId: String = "waterfall"
  private var ambientVolume: Float = 0.35f
  private var ambientIsPlaying: Boolean = false
  private var ambientEnabled: Boolean = false

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

      syncAmbientWithTimerState(
        isFinishedEvent = intent.action == "com.dailytodo2.TIMER_FINISHED",
        completed = intent.getBooleanExtra("completed", false),
        isRunning = intent.getBooleanExtra("isRunning", false),
        isPaused = intent.getBooleanExtra("isPaused", false)
      )

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
  fun addPomodoroMinute() {
    Log.d("TimerModule", "addPomodoroMinute")

    val intent = Intent(reactContext, TimerService::class.java).apply {
      action = "ADD_MINUTE"
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
      ambientPlayer?.isPlaying() == true
    ) {
      ambientVolume = nextVolume
      setAmbientPlayerVolume(ambientVolume)
      return
    }

    ambientSoundId = soundId
    ambientVolume = nextVolume
    ambientEnabled = true
    persistAmbientPreferences()
    releaseAmbientPlayers()

    startAmbientPlayback()
  }

  @ReactMethod
  @Synchronized
  fun stopAmbientSound() {
    Log.d("TimerModule", "stopAmbientSound")
    ambientEnabled = false
    ambientIsPlaying = false
    persistAmbientPreferences()
    releaseAmbientPlayers()
  }

  @ReactMethod
  @Synchronized
  fun pauseAmbientSound() {
    Log.d("TimerModule", "pauseAmbientSound")
    ambientIsPlaying = false
    releaseAmbientPlayers()
  }

  @ReactMethod
  @Synchronized
  fun setAmbientPreferences(enabled: Boolean, soundId: String, volume: Double) {
    val soundChanged = ambientSoundId != soundId

    ambientEnabled = enabled
    ambientSoundId = soundId
    ambientVolume = volume.toFloat().coerceIn(0f, 1f)
    persistAmbientPreferences()

    if (!enabled || (soundChanged && ambientIsPlaying)) {
      ambientIsPlaying = false
      releaseAmbientPlayers()
    }
  }

  @ReactMethod
  fun prepareAmbientSound(soundId: String) {
    if (!ambientEnabled) return

    val resourceId = ambientResourceId(soundId)
    Thread {
      Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
      try {
        AmbientLoopPlayer.prepare(reactContext.applicationContext, resourceId)
      } catch (error: Exception) {
        Log.e("TimerModule", "Error preparing ambient sound", error)
      }
    }.apply {
      name = "DailyTodoAmbientPrepare"
      isDaemon = true
      start()
    }
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
      "waterfall" -> R.raw.ambient_waves
      "cafe" -> R.raw.ambient_cafe
      "stream", "focus" -> R.raw.ambient_stream
      else -> R.raw.ambient_waves
    }
  }

  private fun createAmbientPlayer(soundId: String, volume: Float): AmbientLoopPlayer? {
    return try {
      AmbientLoopPlayer(reactContext, ambientResourceId(soundId), volume.coerceIn(0f, 1f))
    } catch (error: Exception) {
      Log.e("TimerModule", "Error creating ambient player", error)
      null
    }
  }

  private fun startAmbientPlayback() {
    val player = createAmbientPlayer(ambientSoundId, ambientVolume) ?: return
    ambientPlayer = player
    ambientIsPlaying = true
    player.start()
  }

  @Synchronized
  private fun syncAmbientWithTimerState(
    isFinishedEvent: Boolean,
    completed: Boolean,
    isRunning: Boolean,
    isPaused: Boolean
  ) {
    if (isFinishedEvent && completed && ambientIsPlaying) {
      ambientIsPlaying = false
      ambientPlayer?.fadeOutAndStop()
      return
    }

    if (!isRunning || isPaused) {
      if (ambientIsPlaying) {
        ambientIsPlaying = false
        releaseAmbientPlayers()
      }
      return
    }

    if (!ambientEnabled || ambientIsPlaying) return

    startAmbientPlayback()
  }

  private fun persistAmbientPreferences() {
    reactContext
      .getSharedPreferences("timer_prefs", Context.MODE_PRIVATE)
      .edit()
      .putBoolean("ambientSoundEnabled", ambientEnabled)
      .putString("ambientSoundId", ambientSoundId)
      .putFloat("ambientVolume", ambientVolume)
      .apply()
  }

  private fun setAmbientPlayerVolume(volume: Float) {
    ambientPlayer?.setVolume(volume.coerceIn(0f, 1f))
  }

  private fun releaseAmbientPlayers() {
    try {
      ambientPlayer?.stop()
    } catch (_: Exception) {}
    ambientPlayer = null
  }

  private class DecodedAudio(
    val pcm: ByteArray,
    val sampleRate: Int,
    val channelCount: Int
  )

  private class AmbientLoopPlayer(
    private val context: Context,
    private val resourceId: Int,
    private var volume: Float
  ) {
    @Volatile
    private var stopRequested = false
    private var audioTrack: AudioTrack? = null
    private var playbackThread: Thread? = null

    fun start() {
      stopRequested = false

      playbackThread = Thread {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
        try {
          val decoded = getLoopedResource(context, resourceId)
          if (stopRequested) return@Thread

          val frameSize = decoded.channelCount * 2
          val fadeInFrames = (decoded.sampleRate * 1.2f).toInt()
          val channelMask =
            if (decoded.channelCount == 1) AudioFormat.CHANNEL_OUT_MONO else AudioFormat.CHANNEL_OUT_STEREO
          val minBufferSize = AudioTrack.getMinBufferSize(
            decoded.sampleRate,
            channelMask,
            AudioFormat.ENCODING_PCM_16BIT
          )
          val streamBufferSize = maxOf(minBufferSize * 2, 16 * 1024)
          val track = createAudioTrack(decoded.sampleRate, channelMask, streamBufferSize)

          audioTrack = track
          applyTrackVolume(track, 0f)
          track.play()
          var offset = 0
          var writtenFrames = 0
          while (!stopRequested) {
            val remaining = decoded.pcm.size - offset
            val chunkSize = minOf(32 * 1024, remaining)
            if (chunkSize <= 0) {
              offset = 0
              continue
            }
            val fadeProgress =
              if (fadeInFrames <= 0) 1f else (writtenFrames.toFloat() / fadeInFrames.toFloat()).coerceIn(0f, 1f)
            applyTrackVolume(track, volume * fadeProgress)
            val written = track.write(decoded.pcm, offset, chunkSize)
            if (written > 0) {
              offset += written
              writtenFrames += written / frameSize
              if (offset >= decoded.pcm.size) {
                offset = 0
              }
            }
          }
        } catch (error: Exception) {
          Log.e("TimerModule", "Ambient AudioTrack playback failed", error)
        }
      }.apply {
        name = "DailyTodoAmbientLoop"
        isDaemon = true
        start()
      }
    }

    fun isPlaying(): Boolean {
      return audioTrack?.playState == AudioTrack.PLAYSTATE_PLAYING && !stopRequested
    }

    fun setVolume(nextVolume: Float) {
      volume = nextVolume.coerceIn(0f, 1f)
      val track = audioTrack ?: return
      applyTrackVolume(track, volume)
    }

    fun fadeOutAndStop(durationMs: Long = 7_000L) {
      Thread {
        Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
        val steps = 70
        val stepDelay = maxOf(16L, durationMs / steps)
        val startVolume = volume

        for (step in 0..steps) {
          if (stopRequested) return@Thread

          val progress = step.toFloat() / steps.toFloat()
          val eased = progress * progress
          setVolume(startVolume * (1f - eased))

          try {
            Thread.sleep(stepDelay)
          } catch (_: InterruptedException) {
            return@Thread
          }
        }

        stop()
      }.apply {
        name = "DailyTodoAmbientFadeOut"
        isDaemon = true
        start()
      }
    }

    private fun applyTrackVolume(track: AudioTrack, nextVolume: Float) {
      val safeVolume = nextVolume.coerceIn(0f, 1f)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        track.setVolume(safeVolume)
      } else {
        @Suppress("DEPRECATION")
        track.setStereoVolume(safeVolume, safeVolume)
      }
    }

    fun stop() {
      stopRequested = true
      try {
        playbackThread?.join(500)
      } catch (_: Exception) {}
      playbackThread = null
      try {
        audioTrack?.pause()
      } catch (_: Exception) {}
      try {
        audioTrack?.flush()
      } catch (_: Exception) {}
      try {
        audioTrack?.release()
      } catch (_: Exception) {}
      audioTrack = null
    }

    private fun applyLoopCrossfade(decoded: DecodedAudio): DecodedAudio {
      val frameSize = decoded.channelCount * 2
      if (frameSize <= 0 || decoded.pcm.size < frameSize * 4) return decoded

      val totalFrames = decoded.pcm.size / frameSize
      val requestedFadeFrames = (decoded.sampleRate * 0.85f).toInt()
      val fadeFrames = requestedFadeFrames.coerceIn(1, maxOf(1, totalFrames / 6))
      if (fadeFrames <= 1 || totalFrames <= fadeFrames * 2) return decoded

      val fadeBytes = fadeFrames * frameSize
      val bodyStart = fadeBytes
      val bodyEnd = decoded.pcm.size - fadeBytes
      val output = ByteArray(decoded.pcm.size - fadeBytes)
      var outputOffset = 0

      System.arraycopy(decoded.pcm, bodyStart, output, outputOffset, bodyEnd - bodyStart)
      outputOffset += bodyEnd - bodyStart

      for (frame in 0 until fadeFrames) {
        val fadeIn = frame.toFloat() / (fadeFrames - 1).toFloat()
        val fadeOut = 1f - fadeIn

        for (channel in 0 until decoded.channelCount) {
          val endByteIndex = bodyEnd + frame * frameSize + channel * 2
          val startByteIndex = frame * frameSize + channel * 2
          val endSample = readPcm16(decoded.pcm, endByteIndex)
          val startSample = readPcm16(decoded.pcm, startByteIndex)
          val mixedSample = (endSample * fadeOut + startSample * fadeIn)
            .toInt()
            .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt())

          writePcm16(output, outputOffset + frame * frameSize + channel * 2, mixedSample)
        }
      }

      return DecodedAudio(output, decoded.sampleRate, decoded.channelCount)
    }

    private fun readPcm16(bytes: ByteArray, index: Int): Int {
      val low = bytes[index].toInt() and 0xff
      val high = bytes[index + 1].toInt()
      return (high shl 8) or low
    }

    private fun writePcm16(bytes: ByteArray, index: Int, sample: Int) {
      bytes[index] = (sample and 0xff).toByte()
      bytes[index + 1] = ((sample shr 8) and 0xff).toByte()
    }

    private fun createAudioTrack(
      sampleRate: Int,
      channelMask: Int,
      bufferSize: Int
    ): AudioTrack {
      return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        AudioTrack.Builder()
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_MEDIA)
              .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
              .build()
          )
          .setAudioFormat(
            AudioFormat.Builder()
              .setSampleRate(sampleRate)
              .setChannelMask(channelMask)
              .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
              .build()
          )
          .setTransferMode(AudioTrack.MODE_STREAM)
          .setBufferSizeInBytes(bufferSize)
          .build()
      } else {
        @Suppress("DEPRECATION")
        AudioTrack(
          AudioManager.STREAM_MUSIC,
          sampleRate,
          channelMask,
          AudioFormat.ENCODING_PCM_16BIT,
          bufferSize,
          AudioTrack.MODE_STREAM
        )
      }
    }

    private fun getLoopedResource(context: Context, resourceId: Int): DecodedAudio {
      synchronized(AmbientLoopPlayer::class.java) {
        if (lastPreparedResourceId == resourceId && lastPreparedAudio != null) {
          return lastPreparedAudio as DecodedAudio
        }
      }

      val decoded = applyLoopCrossfade(decodeResource(context, resourceId))

      synchronized(AmbientLoopPlayer::class.java) {
        lastPreparedResourceId = resourceId
        lastPreparedAudio = decoded
      }

      return decoded
    }

    private fun decodeResource(context: Context, resourceId: Int): DecodedAudio {
      val extractor = MediaExtractor()
      val pcm = ByteArrayOutputStream()
      var decoder: MediaCodec? = null
      var sampleRate = 44100
      var channelCount = 2

      try {
        val afd = context.resources.openRawResourceFd(resourceId)
        extractor.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
        afd.close()

        var audioTrackIndex = -1
        var inputFormat: MediaFormat? = null
        for (index in 0 until extractor.trackCount) {
          val format = extractor.getTrackFormat(index)
          val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
          if (mime.startsWith("audio/")) {
            audioTrackIndex = index
            inputFormat = format
            break
          }
        }

        if (audioTrackIndex < 0 || inputFormat == null) {
          throw IllegalStateException("No audio track found in ambient resource")
        }

        extractor.selectTrack(audioTrackIndex)
        val mime = inputFormat.getString(MediaFormat.KEY_MIME)
          ?: throw IllegalStateException("Ambient audio track has no MIME type")
        sampleRate = inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        channelCount = inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

        decoder = MediaCodec.createDecoderByType(mime)
        decoder.configure(inputFormat, null, null, 0)
        decoder.start()

        val bufferInfo = MediaCodec.BufferInfo()
        var inputDone = false
        var outputDone = false

        while (!outputDone) {
          if (!inputDone) {
            val inputBufferIndex = decoder.dequeueInputBuffer(10_000)
            if (inputBufferIndex >= 0) {
              val inputBuffer = decoder.getInputBuffer(inputBufferIndex)
              val sampleSize = if (inputBuffer != null) {
                extractor.readSampleData(inputBuffer, 0)
              } else {
                -1
              }

              if (sampleSize < 0) {
                decoder.queueInputBuffer(
                  inputBufferIndex,
                  0,
                  0,
                  0,
                  MediaCodec.BUFFER_FLAG_END_OF_STREAM
                )
                inputDone = true
              } else {
                decoder.queueInputBuffer(
                  inputBufferIndex,
                  0,
                  sampleSize,
                  extractor.sampleTime,
                  0
                )
                extractor.advance()
              }
            }
          }

          when (val outputBufferIndex = decoder.dequeueOutputBuffer(bufferInfo, 10_000)) {
            MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
              val outputFormat = decoder.outputFormat
              sampleRate = outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
              channelCount = outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            }
            MediaCodec.INFO_TRY_AGAIN_LATER -> {}
            else -> {
              if (outputBufferIndex >= 0) {
                val outputBuffer = decoder.getOutputBuffer(outputBufferIndex)
                if (outputBuffer != null && bufferInfo.size > 0) {
                  val chunk = ByteArray(bufferInfo.size)
                  outputBuffer.position(bufferInfo.offset)
                  outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                  outputBuffer.get(chunk)
                  pcm.write(chunk)
                }

                outputDone =
                  bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                decoder.releaseOutputBuffer(outputBufferIndex, false)
              }
            }
          }
        }

        return DecodedAudio(pcm.toByteArray(), sampleRate, channelCount)
      } finally {
        try {
          decoder?.stop()
        } catch (_: Exception) {}
        try {
          decoder?.release()
        } catch (_: Exception) {}
        try {
          extractor.release()
        } catch (_: Exception) {}
      }
    }

    companion object {
      private var lastPreparedResourceId: Int? = null
      private var lastPreparedAudio: DecodedAudio? = null

      fun prepare(context: Context, resourceId: Int) {
        AmbientLoopPlayer(context, resourceId, 0f).getLoopedResource(context, resourceId)
      }
    }
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
