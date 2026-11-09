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
