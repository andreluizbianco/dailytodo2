package com.dailytodo2

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class PomodoroWheelViewManager(
  private val reactContext: ReactApplicationContext
) : SimpleViewManager<PomodoroWheelView>() {
  override fun getName(): String = "PomodoroWheelView"

  override fun createViewInstance(reactContext: ThemedReactContext): PomodoroWheelView {
    return PomodoroWheelView(reactContext)
  }

  @ReactProp(name = "valueMinutes", defaultInt = 25)
  fun setValueMinutes(view: PomodoroWheelView, value: Int) {
    view.setValueMinutes(value)
  }

  @ReactProp(name = "maxMinutes", defaultInt = 480)
  fun setMaxMinutes(view: PomodoroWheelView, value: Int) {
    view.setMaxMinutes(value)
  }

  @ReactProp(name = "enabled", defaultBoolean = true)
  fun setEnabled(view: PomodoroWheelView, enabled: Boolean) {
    view.setInteractionEnabled(enabled)
  }

  @ReactProp(name = "darkMode", defaultBoolean = false)
  fun setDarkMode(view: PomodoroWheelView, enabled: Boolean) {
    view.setDarkMode(enabled)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
    return MapBuilder.of(
      "topValueChange",
      MapBuilder.of("registrationName", "onValueChange")
    )
  }
}
