package com.dailytodo2

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import androidx.core.content.FileProvider
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class PhotoTextModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  private var cameraPromise: Promise? = null
  private var cameraPhotoFile: File? = null
  private val cameraRequestCode = 8307

  private val activityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(
      activity: Activity?,
      requestCode: Int,
      resultCode: Int,
      data: Intent?
    ) {
      if (requestCode != cameraRequestCode) return

      val promise = cameraPromise ?: return
      val photoFile = cameraPhotoFile
      cameraPromise = null
      cameraPhotoFile = null

      if (resultCode != Activity.RESULT_OK || photoFile == null) {
        photoFile?.delete()
        promise.resolve(null)
        return
      }

      val response = Arguments.createMap()
      response.putString("uri", Uri.fromFile(photoFile).toString())
      response.putString("name", photoFile.name)
      response.putString(
        "createdAt",
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())
      )
      promise.resolve(response)
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "PhotoTextModule"

  @ReactMethod
  fun takePhoto(promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("camera_no_activity", "Camera is not available right now.")
      return
    }

    if (cameraPromise != null) {
      promise.reject("camera_busy", "Camera is already open.")
      return
    }

    try {
      val attachmentsDirectory = File(reactContext.filesDir, "note-attachments")
      if (!attachmentsDirectory.exists()) {
        attachmentsDirectory.mkdirs()
      }

      val timestamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
      val photoFile = File(attachmentsDirectory, "camera-$timestamp.jpg")
      val photoUri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.fileprovider",
        photoFile
      )
      val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
        putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      }

      if (intent.resolveActivity(reactContext.packageManager) == null) {
        promise.reject("camera_unavailable", "No camera app is available.")
        return
      }

      cameraPromise = promise
      cameraPhotoFile = photoFile
      activity.startActivityForResult(intent, cameraRequestCode)
    } catch (error: Exception) {
      cameraPromise = null
      cameraPhotoFile = null
      promise.reject("camera_failed", "Could not open the camera.", error)
    }
  }

  @ReactMethod
  fun recognizeText(imageUri: String, promise: Promise) {
    try {
      val uri = Uri.parse(imageUri)
      val image = InputImage.fromFilePath(reactContext, uri)
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

      recognizer.process(image)
        .addOnSuccessListener { result ->
          val response = Arguments.createMap()
          val blocks = Arguments.createArray()

          result.textBlocks.forEach { block ->
            val blockMap = Arguments.createMap()
            val lines = Arguments.createArray()

            block.lines.forEach { line ->
              lines.pushString(line.text)
            }

            blockMap.putString("text", block.text)
            blockMap.putArray("lines", lines)
            blocks.pushMap(blockMap)
          }

          response.putString("text", result.text)
          response.putArray("blocks", blocks)
          promise.resolve(response)
        }
        .addOnFailureListener { error ->
          promise.reject("photo_text_failed", "Could not scan text from this photo.", error)
        }
    } catch (error: Exception) {
      promise.reject("photo_text_invalid_image", "Could not open this photo.", error)
    }
  }
}
