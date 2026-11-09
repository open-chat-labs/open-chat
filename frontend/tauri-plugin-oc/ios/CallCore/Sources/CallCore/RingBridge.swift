import Foundation

public enum RingStatus: String, Decodable {
    case ringing
    case answered
    case ended
}

public struct RingRoom: Decodable, Equatable {
    public let token: String
    public let roomName: String

    public var url: String { "https://openchat.daily.co/\(roomName)" }
}

public struct RingJoin: Equatable {
    public let url: String
    public let token: String
    public let userName: String
    public let title: String
    public let cameraWhenActive: Bool
    public let video: Bool
}

// Calls to the video bridge with the ring's own token. #10398 invariant 22: answering needs only
// the push, what the shell stored at login and a network, so it works with no web layer running.
public struct RingBridge {
    public let videoBridgeUrl: String
    public let send: (URLRequest) async throws -> Data

    public init(videoBridgeUrl: String, send: @escaping (URLRequest) async throws -> Data) {
        self.videoBridgeUrl = videoBridgeUrl
        self.send = send
    }

    public func status(token: String) async throws -> RingStatus {
        let data = try await send(try request("ring_status", token: token))
        return try JSONDecoder().decode(Status.self, from: data).status
    }

    public func answer(token: String, username: String) async throws -> RingRoom {
        var request = try request("answer", token: token)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["username": username])
        return try JSONDecoder().decode(RingRoom.self, from: try await send(request))
    }

    // Everything needed to join from the push and the stored username, and nothing else. A video
    // call starts without the camera, as iOS won't give it one on a locked phone.
    public func join(_ call: IncomingCall, username: String?) async throws -> RingJoin {
        guard let token = call.declineToken, let username else { throw URLError(.userAuthenticationRequired) }
        let room = try await answer(token: token, username: username)
        return RingJoin(
            url: room.url, token: room.token, userName: username, title: call.callerName,
            cameraWhenActive: !call.audioOnly, video: !call.audioOnly)
    }

    public func decline(token: String) async throws {
        _ = try await send(try request("decline", token: token))
    }

    private func request(_ path: String, token: String) throws -> URLRequest {
        guard let url = URL(string: "\(videoBridgeUrl)/room/\(path)") else { throw URLError(.badURL) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(token, forHTTPHeaderField: "x-auth-jwt")
        return request
    }

    private struct Status: Decodable {
        let status: RingStatus
    }
}
