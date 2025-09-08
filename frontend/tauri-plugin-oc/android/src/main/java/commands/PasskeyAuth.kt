package com.ocplugin.app.commands

import android.app.Activity
import android.util.Base64
import android.util.Log
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.exceptions.CreateCredentialNoCreateOptionException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialCancellationException
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
                ) ?: throw Exception("No registration response returned.")

                val tauriResponse = JSObject().put("passkey", rawResponse)
                invoke.resolve(tauriResponse)
            } catch (e: CreateCredentialNoCreateOptionException) {
                // Exception raised if credential manager providers are not available (aka the
                // passkey cannot be saved anywhere)
                Log.e(LOG_TAG, "No providers available to store the passkey", e)
                invoke.reject(errResponse("NO_PROVIDERS", "No providers available to store the passkey"))
            } catch (e: Exception) {
                Log.e(LOG_TAG, "Error creating credentials", e)
                invoke.reject(errResponse("PASSKEY_CREATE_FAILED", e.toString()))
            }
        }
    }

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
                ) ?: throw Exception("No authentication response returned.")

                val tauriResponse = JSObject().put("passkey", rawResponse)
                invoke.resolve(tauriResponse)
            } catch (e: GetCredentialCancellationException) {
                Log.d(LOG_TAG, "User cancelled auth: $e")
                invoke.reject(errResponse("USER_CANCELLED", "User cancelled auth: $e"))
            } catch (e: GetCredentialException) {
                Log.d(LOG_TAG, "No passkey found: $e")
                invoke.reject(errResponse("NO_PASSKEY", "No passkey found: $e"))
            } catch (e: Exception) {
                Log.d(LOG_TAG, "Sign in failed: $e")
                invoke.reject(errResponse("AUTH_FAILED", "Sign in failed: $e"))
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
