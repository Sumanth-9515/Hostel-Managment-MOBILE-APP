package com.hostelappmanagementsystem

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class ConnectivityModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val connectivityManager by lazy {
    reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
  }
  private var callbackRegistered = false

  private val callback =
      object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          sendState()
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
          sendState()
        }

        override fun onLost(network: Network) {
          sendState()
        }

        override fun onUnavailable() {
          sendState()
        }
      }

  override fun getName(): String = "ConnectivityModule"

  @ReactMethod
  fun getCurrentState(promise: Promise) {
    promise.resolve(currentState())
  }

  @ReactMethod
  fun start() {
    if (callbackRegistered) return
    callbackRegistered = true
    val request =
        NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
    connectivityManager.registerNetworkCallback(request, callback)
    sendState()
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  override fun invalidate() {
    super.invalidate()
    if (callbackRegistered) {
      runCatching { connectivityManager.unregisterNetworkCallback(callback) }
      callbackRegistered = false
    }
  }

  private fun sendState() {
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("ConnectivityChanged", currentState())
  }

  private fun currentState(): WritableMap {
    val capabilities = connectivityManager.getNetworkCapabilities(connectivityManager.activeNetwork)

    val hasNetwork = capabilities != null
    val hasInternet =
        capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    val isValidated =
        capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
    val downstreamKbps = capabilities?.linkDownstreamBandwidthKbps ?: 0
    val upstreamKbps = capabilities?.linkUpstreamBandwidthKbps ?: 0
    val isSlowConnection =
        hasNetwork && hasInternet && isValidated && downstreamKbps > 0 && downstreamKbps < 256
    val type =
        when {
          capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> "wifi"
          capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> "cellular"
          capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> "ethernet"
          else -> "unknown"
        }

    return Arguments.createMap().apply {
      putBoolean("isConnected", hasNetwork)
      putBoolean("isInternetReachable", hasInternet && isValidated)
      putBoolean("isOnline", hasNetwork && hasInternet && isValidated)
      putBoolean("isSlow", isSlowConnection)
      putInt("downstreamKbps", downstreamKbps)
      putInt("upstreamKbps", upstreamKbps)
      putString("type", type)
    }
  }
}
