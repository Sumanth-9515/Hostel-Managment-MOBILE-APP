package com.hostelappmanagementsystem

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.core.content.edit
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureSessionStorageModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val prefs by lazy {
    reactContext.getSharedPreferences("secure_session_storage", Context.MODE_PRIVATE)
  }

  override fun getName(): String = "SecureSessionStorage"

  @ReactMethod
  fun getItem(key: String, promise: Promise) {
    try {
      val encoded = prefs.getString(key, null)
      if (encoded.isNullOrBlank()) {
        promise.resolve(null)
        return
      }
      promise.resolve(decrypt(encoded))
    } catch (error: Exception) {
      prefs.edit { remove(key) }
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun setItem(key: String, value: String, promise: Promise) {
    try {
      prefs.edit { putString(key, encrypt(value)) }
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("secure_storage_write_failed", error)
    }
  }

  @ReactMethod
  fun removeItem(key: String, promise: Promise) {
    prefs.edit { remove(key) }
    promise.resolve(null)
  }

  private fun encrypt(value: String): String {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
    val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    return "${encode(cipher.iv)}:${encode(encrypted)}"
  }

  private fun decrypt(value: String): String? {
    val parts = value.split(":", limit = 2)
    if (parts.size != 2) return null

    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(
        Cipher.DECRYPT_MODE,
        getOrCreateKey(),
        GCMParameterSpec(GCM_TAG_LENGTH_BITS, Base64.decode(parts[0], Base64.NO_WRAP))
    )
    return String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), Charsets.UTF_8)
  }

  private fun getOrCreateKey(): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    val existing = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
    if (existing != null) return existing.secretKey

    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
    val spec =
        KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .build()
    generator.init(spec)
    return generator.generateKey()
  }

  private fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

  companion object {
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "HostelAppSessionKey"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_LENGTH_BITS = 128
  }
}
