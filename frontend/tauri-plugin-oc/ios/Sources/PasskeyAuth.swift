import AuthenticationServices
import Foundation
import Tauri

// Native passkey sign-up / sign-in, mirroring the Android PasskeyAuth
// implementation. The response resolved back to JS is `{ passkey: <json> }`
// where <json> is a WebAuthn-shaped credential JSON string (base64url fields),
// identical in shape to what Android's Credential Manager returns, and errors
// are rejected with a `{"code": ..., "msg": ...}` JSON string decoded by
// guest-js decodePluginError.
//
// NOTE: platform passkeys tie the RP id to an associated domain
// (webcredentials:oc.app). Until the real AASA file is deployed on oc.app this
// only works on the simulator / with developer-mode associated domains — see
// IOS_PORT_STATUS.md.
private let RP_ID = "oc.app"

class SignUpArgs: Decodable {
    let username: String?
}

class SignInArgs: Decodable {
    let challenge: [UInt8]?
}

class PasskeyAuth: NSObject {
    // Strong reference to the in-flight controller + invoke; released on completion.
    private var inFlight: PasskeyRequest?

    func handleSignUp(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SignUpArgs.self)
        let username = args.username ?? "OcUser"

        var challenge = Data(count: 32)
        let result = challenge.withUnsafeMutableBytes {
            SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!)
        }
        guard result == errSecSuccess else {
            invoke.reject(errResponse("PASSKEY_CREATE_FAILED", "Failed to generate a challenge"))
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
                relyingPartyIdentifier: RP_ID)
            let request = provider.createCredentialRegistrationRequest(
                challenge: challenge,
                name: username,
                userID: Data(username.utf8))
            request.userVerificationPreference = .required

            self.run(request: request, invoke: invoke, isSignUp: true)
        }
    }

    func handleSignIn(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(SignInArgs.self)
        guard let challengeBytes = args.challenge else {
            invoke.reject("Challenge value was not provided")
            return
        }

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
                relyingPartyIdentifier: RP_ID)
            let request = provider.createCredentialAssertionRequest(
                challenge: Data(challengeBytes))
            request.userVerificationPreference = .required

            self.run(request: request, invoke: invoke, isSignUp: false)
        }
    }

    private func run(request: ASAuthorizationRequest, invoke: Invoke, isSignUp: Bool) {
        if inFlight != nil {
            invoke.reject(errResponse("INTERRUPTED", "Another passkey request is in progress"))
            return
        }
        let passkeyRequest = PasskeyRequest(invoke: invoke, isSignUp: isSignUp) { [weak self] in
            self?.inFlight = nil
        }
        inFlight = passkeyRequest
        passkeyRequest.start(request)
    }
}

private class PasskeyRequest: NSObject, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    private let invoke: Invoke
    private let isSignUp: Bool
    private let onFinish: () -> Void
    private var controller: ASAuthorizationController?

    init(invoke: Invoke, isSignUp: Bool, onFinish: @escaping () -> Void) {
        self.invoke = invoke
        self.isSignUp = isSignUp
        self.onFinish = onFinish
    }

    func start(_ request: ASAuthorizationRequest) {
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.controller = controller
        controller.performRequests()
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow } ?? ASPresentationAnchor()
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        defer { onFinish() }

        switch authorization.credential {
        case let registration as ASAuthorizationPlatformPublicKeyCredentialRegistration:
            resolveRegistration(registration)
        case let assertion as ASAuthorizationPlatformPublicKeyCredentialAssertion:
            resolveAssertion(assertion)
        default:
            invoke.reject(
                errResponse(
                    isSignUp ? "PASSKEY_CREATE_FAILED" : "PASSKEY_FETCH_FAILED",
                    "Unexpected credential type"))
        }
    }

    func authorizationController(
        controller: ASAuthorizationController, didCompleteWithError error: Error
    ) {
        defer { onFinish() }

        let fallback = isSignUp ? "PASSKEY_CREATE_FAILED" : "PASSKEY_FETCH_FAILED"
        guard let asError = error as? ASAuthorizationError else {
            invoke.reject(errResponse(fallback, error.localizedDescription))
            return
        }

        let message = (asError.userInfo[NSLocalizedFailureReasonErrorKey] as? String)
            ?? asError.localizedDescription

        if #available(iOS 18.0, *), asError.code == .matchedExcludedCredential {
            invoke.reject(
                errResponse(
                    "PASSKEY_ALREADY_EXISTS",
                    "A passkey for this account already exists on this device."))
            return
        }

        switch asError.code {
        case .canceled:
            invoke.reject(errResponse("USER_CANCELLED", "User cancelled auth"))
        case .notInteractive:
            invoke.reject(errResponse("INTERRUPTED", "The request was interrupted. Please try again."))
        case .failed:
            // A failed association check surfaces here (e.g. the app is not
            // associated with the RP id domain).
            if message.lowercased().contains("not associated") {
                invoke.reject(errResponse("SECURITY_DENIED", "Request denied, check domain settings"))
            } else {
                invoke.reject(errResponse(fallback, message))
            }
        default:
            invoke.reject(errResponse(fallback, message))
        }
    }

    private func resolveRegistration(
        _ registration: ASAuthorizationPlatformPublicKeyCredentialRegistration
    ) {
        guard let attestationObject = registration.rawAttestationObject else {
            invoke.reject(
                errResponse("PASSKEY_CREATE_FAILED", "Registration returned no attestation object"))
            return
        }

        guard let authData = WebAuthnCbor.authDataFromAttestation(attestationObject),
            let coseKey = WebAuthnCbor.coseKeyFromAuthData(authData),
            let spkiDer = WebAuthnCbor.p256SpkiDer(fromCoseKey: coseKey)
        else {
            invoke.reject(
                errResponse("PASSKEY_CREATE_FAILED", "Failed to parse the attestation object"))
            return
        }

        let credentialId = registration.credentialID
        let response: [String: Any] = [
            "attestationObject": base64url(attestationObject),
            "clientDataJSON": base64url(registration.rawClientDataJSON),
            "authenticatorData": base64url(authData),
            "publicKey": base64url(spkiDer),
            "publicKeyAlgorithm": -7,
            "transports": ["internal"],
        ]
        resolveCredential(id: credentialId, response: response)
    }

    private func resolveAssertion(
        _ assertion: ASAuthorizationPlatformPublicKeyCredentialAssertion
    ) {
        let response: [String: Any] = [
            "authenticatorData": base64url(assertion.rawAuthenticatorData),
            "clientDataJSON": base64url(assertion.rawClientDataJSON),
            "signature": base64url(assertion.signature),
            "userHandle": base64url(assertion.userID),
        ]
        resolveCredential(id: assertion.credentialID, response: response)
    }

    private func resolveCredential(id: Data, response: [String: Any]) {
        let credential: [String: Any] = [
            "id": base64url(id),
            "rawId": base64url(id),
            "type": "public-key",
            "authenticatorAttachment": "platform",
            "clientExtensionResults": [String: Any](),
            "response": response,
        ]

        guard let json = try? JSONSerialization.data(withJSONObject: credential),
            let jsonString = String(data: json, encoding: .utf8)
        else {
            invoke.reject(
                errResponse(
                    isSignUp ? "PASSKEY_CREATE_FAILED" : "PASSKEY_FETCH_FAILED",
                    "Failed to serialise the credential"))
            return
        }

        invoke.resolve(["passkey": jsonString])
    }
}

private func base64url(_ data: Data) -> String {
    return data.base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")
}

private func errResponse(_ code: String, _ msg: String) -> String {
    let obj = ["code": code, "msg": msg]
    if let data = try? JSONSerialization.data(withJSONObject: obj),
        let str = String(data: data, encoding: .utf8)
    {
        return str
    }
    return "{\"code\":\"\(code)\",\"msg\":\"error\"}"
}

// Just enough CBOR to pull the pieces the frontend needs out of a WebAuthn
// attestation object: the authenticator data, and the credential public key
// (COSE EC2/P-256) converted to a DER SubjectPublicKeyInfo (what the browser's
// AuthenticatorAttestationResponse.getPublicKey() would return).
enum WebAuthnCbor {
    // Attestation object = CBOR map { "fmt": tstr, "attStmt": map, "authData": bstr }
    static func authDataFromAttestation(_ data: Data) -> Data? {
        var reader = Reader(data)
        guard let map = reader.readValue() as? [AnyHashable: Any] else { return nil }
        return map["authData"] as? Data
    }

    // authData = rpIdHash(32) | flags(1) | signCount(4) | aaguid(16) |
    //            credIdLen(2 BE) | credId | credentialPublicKey(COSE CBOR map)
    static func coseKeyFromAuthData(_ authData: Data) -> [AnyHashable: Any]? {
        guard authData.count > 55 else { return nil }
        let credIdLen = Int(authData[53]) << 8 | Int(authData[54])
        let keyStart = 55 + credIdLen
        guard authData.count > keyStart else { return nil }
        var reader = Reader(authData.subdata(in: keyStart..<authData.count))
        return reader.readValue() as? [AnyHashable: Any]
    }

    // COSE EC2 key: 1:kty(=2), -1:crv(=1, P-256), -2:x, -3:y
    static func p256SpkiDer(fromCoseKey key: [AnyHashable: Any]) -> Data? {
        guard let kty = key[1] as? Int, kty == 2,
            let crv = key[-1] as? Int, crv == 1,
            let x = key[-2] as? Data, x.count == 32,
            let y = key[-3] as? Data, y.count == 32
        else { return nil }

        // SPKI header for an uncompressed P-256 EC point.
        let header: [UInt8] = [
            0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01,
            0x06, 0x08, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04,
        ]
        var der = Data(header)
        der.append(x)
        der.append(y)
        return der
    }

    // Minimal CBOR reader: definite-length unsigned/negative ints, byte
    // strings, text strings, arrays and maps — all an attestation object uses.
    private struct Reader {
        private let bytes: [UInt8]
        private var index = 0

        init(_ data: Data) {
            self.bytes = [UInt8](data)
        }

        mutating func readValue() -> Any? {
            guard let initial = next() else { return nil }
            let major = initial >> 5
            guard let length = readLength(initial & 0x1F) else { return nil }

            switch major {
            case 0:  // unsigned int
                return Int(length)
            case 1:  // negative int: -1 - n
                return -1 - Int(length)
            case 2:  // byte string
                return readBytes(Int(length)).map { Data($0) }
            case 3:  // text string
                return readBytes(Int(length)).flatMap { String(bytes: $0, encoding: .utf8) }
            case 4:  // array
                var array: [Any] = []
                for _ in 0..<length {
                    guard let value = readValue() else { return nil }
                    array.append(value)
                }
                return array
            case 5:  // map
                var map: [AnyHashable: Any] = [:]
                for _ in 0..<length {
                    guard let key = readValue() as? AnyHashable,
                        let value = readValue()
                    else { return nil }
                    map[key] = value
                }
                return map
            default:
                // Tags / floats / indefinite lengths are not used in
                // attestation objects; bail out rather than misparse.
                return nil
            }
        }

        private mutating func readLength(_ additional: UInt8) -> UInt64? {
            switch additional {
            case 0...23:
                return UInt64(additional)
            case 24:
                return next().map { UInt64($0) }
            case 25:
                return readBytes(2).map { $0.reduce(0) { $0 << 8 | UInt64($1) } }
            case 26:
                return readBytes(4).map { $0.reduce(0) { $0 << 8 | UInt64($1) } }
            case 27:
                return readBytes(8).map { $0.reduce(0) { $0 << 8 | UInt64($1) } }
            default:
                return nil
            }
        }

        private mutating func next() -> UInt8? {
            guard index < bytes.count else { return nil }
            defer { index += 1 }
            return bytes[index]
        }

        private mutating func readBytes(_ count: Int) -> [UInt8]? {
            guard index + count <= bytes.count else { return nil }
            defer { index += count }
            return Array(bytes[index..<index + count])
        }
    }
}
