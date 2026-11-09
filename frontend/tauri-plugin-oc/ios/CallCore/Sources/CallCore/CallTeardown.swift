import Foundation

// What the shell does for the call when the web layer can't: a direct call is ended for both
// sides, and a group call is only left, since ending a room ends it for everyone.
public enum CallTeardownKind: String, Decodable {
    case end
    case leave
}

// The bridge token the web layer keeps fresh for the active call
public struct CallTeardown: Equatable {
    public let token: String
    public let kind: CallTeardownKind
    public let sessionId: String?

    public init(token: String, kind: CallTeardownKind, sessionId: String?) {
        self.token = token
        self.kind = kind
        self.sessionId = sessionId
    }

    // The same requests the Android shell sends. A leave names this device's session, so it
    // doesn't eject the same user's other devices.
    public func request(videoBridgeUrl: String) -> URLRequest? {
        let path = kind == .end ? "end_meeting" : "leave"
        guard let url = URL(string: "\(videoBridgeUrl)/room/\(path)") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(token, forHTTPHeaderField: "x-auth-jwt")
        if kind == .leave, let sessionId {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONEncoder().encode(["sessionId": sessionId])
        }
        return request
    }
}

public enum CallPolicy {
    // #10398 invariant 20: the other party leaving a direct call ends it. The token's kind says
    // which sort of call this is. Without one, the web layer decides when it next runs.
    public static func peerLeftEndsCall(teardown: CallTeardown?, leaverIsLocal: Bool) -> Bool {
        !leaverIsLocal && teardown?.kind == .end
    }
}
