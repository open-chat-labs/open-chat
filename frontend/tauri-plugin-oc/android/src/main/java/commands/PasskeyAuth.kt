package com.ocplugin.app.commands

import android.app.Activity
import android.util.Base64
import android.util.Log
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.exceptions.CreateCredentialNoCreateOptionException
import app.tauri.annotation.InvokeArg
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import java.security.SecureRandom
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

// TODO should this be a constant in a separate file?
const val RP_ID = "oc.app"

// * An example of args that could be passed to signUp function!
// @InvokeArg
// class SignUpArgs {
//     val userName: String? = ""
//     val userId: String? = ""
//     val userDisplayName: String? = ""
// }

@InvokeArg
class SignInArgs {
    val challenge: ByteArray? = null
}

class PasskeyAuth(private val activity: Activity) {
    private val credentialManager = CredentialManager.create(activity)

    // Command for creating a passkey; prompts user for authentication, and
    // allows them to store the passkey in the device's secure storage.
    fun handleSignUp(invoke: Invoke) {
        CoroutineScope(Dispatchers.Main).launch {
            try {
                val challenge = generateRandomChallenge()

                // TODO can we get this from the user?
                val userName = "user@oc.app"
                val displayName = "OpenChat User"
                val userId = encodeBase64Url(userName.toByteArray())
                val requestJson =
                        JSONObject().apply {
                            put("challenge", encodeBase64Url(challenge))
                            put(
                                    "rp",
                                    JSONObject().apply {
                                        put("name", "OpenChat")
                                        put("id", RP_ID)
                                    }
                            )
                            put(
                                    "user",
                                    JSONObject().apply {
                                        put("id", userId)
                                        put("name", userName)
                                        put("displayName", displayName)
                                    }
                            )
                            put(
                                    "pubKeyCredParams",
                                    JSONArray().apply {
                                        put(
                                                JSONObject().apply {
                                                    put("type", "public-key")
                                                    put("alg", -7)
                                                }
                                        )
                                    }
                            )
                            put("timeout", 60000)
                            put(
                                    "authenticatorSelection",
                                    JSONObject().apply {
                                        put("authenticatorAttachment", "platform")
                                        put("userVerification", "required")
                                    }
                            )
                            put("attestation", "none")
                        }

                val result =
                        credentialManager.createCredential(
                                context = activity,
                                request = CreatePublicKeyCredentialRequest(requestJson.toString())
                        )

                val rawResponse =
                        result.data.getString(
                                "androidx.credentials.BUNDLE_KEY_REGISTRATION_RESPONSE_JSON"
                        )
                                ?: throw Exception("No registration response returned.")

                val tauriResponse = JSObject().put("passkey", rawResponse)
                invoke.resolve(tauriResponse)
            } catch (e: CreateCredentialNoCreateOptionException) {
                // Exception raised if credential manager providers are not available (aka the
                // passkey cannot be saved anywhere)
                // TODO should we return error codes?
                Log.e("ERROR", "No providers available to store the passkey", e)
                invoke.reject("No credential provider available on this device.")
            } catch (e: Exception) {
                Log.e("ERROR", "Error creating credentials", e)
                invoke.reject("Failed to create passkey: ${e.localizedMessage}")
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
                val requestJson =
                        JSONObject().apply {
                            put("challenge", encodeBase64Url(args.challenge))
                            put("timeout", 60000)
                            put("rpId", RP_ID)
                            put("allowCredentials", JSONArray()) // empty array
                            put("userVerification", "required")
                        }

                val result =
                        credentialManager.getCredential(
                                context = activity,
                                request =
                                        GetCredentialRequest(
                                                credentialOptions =
                                                        listOf(
                                                                GetPublicKeyCredentialOption(
                                                                        requestJson.toString()
                                                                )
                                                        )
                                        ),
                        )

                val rawResponse =
                        result.credential.data.getString(
                                "androidx.credentials.BUNDLE_KEY_AUTHENTICATION_RESPONSE_JSON"
                        )
                                ?: throw Exception("No authentication response returned.")

                val tauriResponse = JSObject().put("passkey", rawResponse)
                invoke.resolve(tauriResponse)
            } catch (e: Exception) {
                // TODO use error codes?
                invoke.reject("Failed to sign in with passkey: ${e.localizedMessage}")
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
}
