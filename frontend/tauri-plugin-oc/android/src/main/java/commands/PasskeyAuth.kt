package com.ocplugin.app.commands

import android.annotation.SuppressLint
import android.app.Activity
import android.util.Base64
import android.util.Log
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.exceptions.CreateCredentialNoCreateOptionException
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException
import androidx.credentials.exceptions.CreateCredentialInterruptedException
import androidx.credentials.exceptions.NoCredentialException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.publickeycredential.CreatePublicKeyCredentialDomException
import androidx.credentials.exceptions.publickeycredential.GetPublicKeyCredentialDomException
import androidx.credentials.exceptions.domerrors.NotAllowedError
import androidx.credentials.exceptions.domerrors.TimeoutError
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import com.ocplugin.app.LOG_TAG
import java.security.SecureRandom
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

// TODO should this be a constant in a separate file?
const val RP_ID = "oc.app"

 @InvokeArg
 class SignUpArgs {
     val username: String = "OcUser"
 }

@InvokeArg
class SignInArgs {
    val challenge: ByteArray? = null
}

class PasskeyAuth(private val activity: Activity) {
    private val credentialManager = CredentialManager.create(activity)

    // Command for creating a passkey; prompts user for authentication, and
    // allows them to store the passkey in the device's secure storage.
    //
    // List of error codes:
    // - SYSTEM_PROVIDER_ERROR
    // - NO_PROVIDERS
    // - USER_CANCELLED
    // - SYSTEM_NOT_READY
    // - NO_SCREEN_LOCK
    // - SECURITY_DENIED
    // - PASSKEY_ALREADY_EXISTS
    // - DOM_PASSKEY_ERROR
    // - INTERRUPTED
    // - PASSKEY_CREATE_FAILED
    @SuppressLint("PublicKeyCredential")
    fun handleSignUp(invoke: Invoke) {
        val args = invoke.parseArgs(SignUpArgs::class.java)
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val challenge = generateRandomChallenge()
                val userName = args.username
                val displayName = "${args.username} @ OpenChat"
                val userId = encodeBase64Url(userName.toByteArray())
                val requestJson = JSONObject().apply {
                    put("challenge", encodeBase64Url(challenge))
                    put("rp", JSONObject().apply {
                        put("name", "OpenChat")
                        put("id", RP_ID)
                    })
                    put("user", JSONObject().apply {
                        put("id", userId)
                        put("name", userName)
                        put("displayName", displayName)
                    })
                    put("pubKeyCredParams", JSONArray().apply {
                        put(
                                JSONObject().apply {
                                    put("type", "public-key")
                                    put("alg", -7)
                                }
                        )
                    })
                    put("timeout", 60000)
                    put("authenticatorSelection", JSONObject().apply {
                        put("authenticatorAttachment", "platform")
                        put("userVerification", "required")
                    })
                    put("attestation", "none")
                }

                val result = credentialManager.createCredential(
                    context = activity,
                    request = CreatePublicKeyCredentialRequest(requestJson.toString())
                )

                val rawResponse = result.data.getString(
                    "androidx.credentials.BUNDLE_KEY_REGISTRATION_RESPONSE_JSON"
                )

                if (null == rawResponse) {
                    // Debug logging
                    Log.e(LOG_TAG, "Handshake successful but response JSON is missing. Check Play Services.")

                    invoke.reject(errResponse(
                        "SYSTEM_PROVIDER_ERROR",
                        "Your security provider (e.g. Google Password Manager) failed to return a valid response. Please restart the app or check for system updates."
                    ))
                } else {
                    // All is well
                    val tauriResponse = JSObject().put("passkey", rawResponse)
                    invoke.resolve(tauriResponse)
                }
            }

            catch (e: CreateCredentialNoCreateOptionException) {
                // Exception raised if credential manager providers are not available (aka the
                // passkey cannot be saved anywhere)
                Log.e(LOG_TAG, "No providers available to store the passkey", e)
                invoke.reject(errResponse("NO_PROVIDERS", "No providers available to store the passkey"))
            }

            catch (e: CreateCredentialCancellationException) {
                // User swiped away the bottom sheet or clicked "Cancel"
                Log.i(LOG_TAG, "User cancelled passkey registration", e)
                invoke.reject(errResponse("USER_CANCELLED", "Registration was cancelled"))
            }

            catch (e: CreateCredentialProviderConfigurationException) {
                // Triggered by NO LOCK SCREEN or missing dependencies
                Log.e(LOG_TAG, "Provider configuration issue (likely no lock screen)", e)
                invoke.reject(errResponse("SYSTEM_NOT_READY", "A secure screen lock (PIN/Biometrics) is required to create a passkey."))
            }

            catch (e: CreateCredentialInterruptedException) {
                // Occurs if a phone call comes in or user switches apps during the flow
                Log.e(LOG_TAG, "Registration interrupted", e)
                invoke.reject(errResponse("CREATE_INTERRUPTED", "The request was interrupted. Please try again."))

            }

            // The DOM naming is inherited from the WebAuthn Standard, but it's not an actual browser
            // DOM error. This error relates to the hardware or the security provider telling us
            // that the rules of the WebAuthn handshake were violated.
            catch (e: CreatePublicKeyCredentialDomException) {
                val message = e.message ?: ""
                val (code, msg) = when {
                    message.contains("screen lock is missing", ignoreCase = true) -> {
                        "NO_SCREEN_LOCK" to "User must set a screen lock to use this app"
                    }
                    message.contains("not allowed", ignoreCase = true) -> {
                        "SECURITY_DENIED" to "Request denied, check domain settings" // check RP_ID
                    }
                    // Specific to Registration: The passkey already exists!
                    message.contains("exclude", ignoreCase = true) -> {
                        "PASSKEY_ALREADY_EXISTS" to "A passkey for this account already exists on this device."
                    }
                    else -> {
                        "DOM_PASSKEY_ERROR" to "hardware security error: $message" // perhaps timeout
                    }
                }
                Log.d(LOG_TAG, "Passkey DOM error: $code ($msg)")
                invoke.reject(errResponse(code, msg))
            }

            catch (e: Exception) {
                // This is less than ideal, but perhaps we just show the error msg, and have the users
                // let us know what it is!
                Log.e(LOG_TAG, "Error creating credentials", e)
                invoke.reject(errResponse("PASSKEY_CREATE_FAILED", e.toString()))
            }
        }
    }

    // Command for signing in with an existing passkey.
    //
    // List of error codes:
    // - AUTH_EMPTY_RESPONSE
    // - USER_CANCELLED
    // - NO_PASSKEY
    // - NO_SCREEN_LOCK
    // - SECURITY_DENIED
    // - DOM_PASSKEY_ERROR
    // - SYSTEM_NOT_READY
    // - DEVICE_NOT_SUPPORTED
    // - INTERRUPTED
    // - TRANSIENT_SYSTEM_ERROR
    // - CREDENTIAL_ERROR
    // - PASSKEY_FETCH_FAILED
    fun handleSignIn(invoke: Invoke) {
        val args = invoke.parseArgs(SignInArgs::class.java)

        // Challenge is passed from the svelte app
        if (args.challenge === null) {
            invoke.reject("Challenge value was not provided")
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val requestJson = JSONObject().apply {
                    put("challenge", encodeBase64Url(args.challenge))
                    put("timeout", 60000)
                    put("rpId", RP_ID)
                    put("allowCredentials", JSONArray()) // empty array
                    put("userVerification", "required")
                }

                val result = credentialManager.getCredential(
                    context = activity,
                    request = GetCredentialRequest(
                        credentialOptions =
                            listOf(
                                GetPublicKeyCredentialOption(
                                    requestJson.toString()
                                )
                            )
                    ),
                )

                val rawResponse = result.credential.data.getString(
                    "androidx.credentials.BUNDLE_KEY_AUTHENTICATION_RESPONSE_JSON"
                )

                if (rawResponse == null) {
                    Log.e(LOG_TAG, "Sign-in successful but authentication JSON is missing.")

                    invoke.reject(errResponse(
                        "AUTH_EMPTY_RESPONSE",
                        "The login handshake failed to return your credentials. Please try again or check your Google Account sync."
                    ))
                } else {
                    val tauriResponse = JSObject().put("passkey", rawResponse)
                    invoke.resolve(tauriResponse)
                }
            }

            // The order in which we catch exceptions is important!
            catch (e: GetCredentialCancellationException) {
                // User intentionally closed the prompt
                Log.d(LOG_TAG, "User cancelled auth", e)
                invoke.reject(errResponse("USER_CANCELLED", "User cancelled auth"))
            }

            catch (e: NoCredentialException) {
                // No saved passkeys or passwords match your RP_ID for this app
                Log.d(LOG_TAG, "No RP_ID matching passkeys found", e)
                invoke.reject(errResponse("NO_PASSKEY", "No saved passkeys found for this account."))

            }

            catch (e: GetCredentialProviderConfigurationException) {
                // No lock screen or Google Play Services is outdated
                Log.d(LOG_TAG, "NO LOCK SCREEN or Google Play Services is outdated", e)
                invoke.reject(errResponse("SYSTEM_NOT_READY", "Security provider not configured. Please ensure a screen lock is set."))

            }

            catch (e: GetCredentialUnsupportedException) {
                // Hardware too old or user is on a "De-Googled" phone without a provider.
                Log.d(LOG_TAG, "device does not support the Credential Manager API", e)
                invoke.reject(errResponse("DEVICE_NOT_SUPPORTED", "This device does not support the Credential Manager API."))

            }

            catch (e: GetCredentialInterruptedException) {
                // The UI was killed (e.g., an incoming phone call or user swiped to another app).
                Log.d(LOG_TAG, "login process was interrupted", e)
                invoke.reject(errResponse("INTERRUPTED", "The login process was interrupted. Please try again."))

            }

            // TODO same code is in create passkey
            catch (e: GetPublicKeyCredentialDomException) {
                val message = e.message ?: ""
                val (code, msg) = when {
                    message.contains("screen lock is missing", ignoreCase = true) -> {
                        "NO_SCREEN_LOCK" to "User must set a screen lock to use this app"
                    }
                    message.contains("not allowed", ignoreCase = true) -> {
                        "SECURITY_DENIED" to "Request denied, check domain settings" // check RP_ID
                    }
                    else -> {
                        "DOM_PASSKEY_ERROR" to "hardware security error: $message" // perhaps timeout
                    }
                }
                Log.d(LOG_TAG, "Passkey DOM error: $code ($msg)")
                invoke.reject(errResponse(code, msg))
            }

            catch (e: GetCredentialUnknownException) {
                // Usually a transient error, low-level system failure that happened within the
                // Credential Provider. Should be recoverable on next use try.
                Log.d(LOG_TAG, "low-level system failure happened within the Credential Provider", e)
                invoke.reject(errResponse("TRANSIENT_SYSTEM_ERROR", "An unexpected system error occurred. Try restarting the app."))
            }

            catch (e: GetCredentialException) {
                // General credential error, anything else that is still a "Credential" issue and hasn't
                // been caught by the above exceptions; though we're quite thorough, new errors could
                // be added eventually. Catches Configuration errors, Unsupported errors, etc.
                Log.d(LOG_TAG, "Uncategorized Credential Manager error", e)
                invoke.reject(errResponse("CREDENTIAL_ERROR", e.message ?: "Credential operation failed"))
            }

            catch (e: Exception) {
                Log.d(LOG_TAG, "Fatal error", e)
                invoke.reject(errResponse("PASSKEY_FETCH_FAILED", e.message ?: "Auth operation failed"))
            }
        }
    }

    // Generate a random challenge for the passkey creation request
    private fun generateRandomChallenge(): ByteArray {
        val random = SecureRandom()
        val challenge = ByteArray(32)
        random.nextBytes(challenge)
        return challenge
    }

    // Base64-url encode without padding, for WebAuthn challenge/user ID formatting
    private fun encodeBase64Url(data: ByteArray): String {
        return Base64.encodeToString(data, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    }

    private fun errResponse(code: String, msg: String): String {
        return JSONObject().apply {
            put("code", code)
            put("msg", msg)
        }.toString()
    }
}
