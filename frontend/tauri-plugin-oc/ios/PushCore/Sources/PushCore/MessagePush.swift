import Foundation

// A message push as the pusher sends it to APNs: the `aps` alert with the server's text, plus the
// same string keys an Android phone gets as FCM data (see `FcmData::as_data` in the backend).
public struct MessagePush: Equatable {
    public enum Chat: Equatable {
        case direct(senderId: String)
        case group(groupId: String)
        case channel(communityId: String, channelId: String)
    }

    public enum BodyType: String {
        case message, reaction, tip, invite
    }

    public let chat: Chat
    public let threadIndex: Int?
    public let senderId: String?
    public let senderName: String?
    public let senderAvatarId: String?
    public let groupName: String?
    public let groupAvatarId: String?
    public let communityName: String?
    public let communityAvatarId: String?
    public let channelName: String?
    public let channelAvatarId: String?
    public let body: String
    public let bodyType: BodyType
    public let messageType: String?
    public let fileName: String?

    // Nil for anything that isn't a message push, such as a payload with no chat
    public init?(userInfo: [AnyHashable: Any]) {
        func string(_ key: String) -> String? {
            (userInfo[key] as? String).flatMap { $0.isEmpty ? nil : $0 }
        }

        switch string("type") {
        case "direct":
            guard let senderId = string("senderId") else { return nil }
            chat = .direct(senderId: senderId)
        case "group":
            guard let groupId = string("groupId") else { return nil }
            chat = .group(groupId: groupId)
        case "channel":
            guard let communityId = string("communityId"), let channelId = string("channelId") else {
                return nil
            }
            chat = .channel(communityId: communityId, channelId: channelId)
        default:
            return nil
        }

        threadIndex = string("threadIndex").flatMap(Int.init)
        senderId = string("senderId")
        senderName = string("senderName")
        senderAvatarId = string("senderAvatarId")
        groupName = string("groupName")
        groupAvatarId = string("groupAvatarId")
        communityName = string("communityName")
        communityAvatarId = string("communityAvatarId")
        channelName = string("channelName")
        channelAvatarId = string("channelAvatarId")
        body = string("body") ?? ""
        bodyType = string("bodyType").flatMap(BodyType.init(rawValue:)) ?? .message
        messageType = string("messageType")
        fileName = string("fileName")
    }

    // What the web layer's "push-notification" and "notification-tap" listeners read, the same
    // shape the Android shell sends
    public func eventPayload(id: Int) -> [String: Any] {
        var payload: [String: Any] = ["id": id]
        switch chat {
        case .direct(let senderId):
            payload["type"] = "DM"
            payload["senderId"] = senderId
        case .group(let groupId):
            payload["type"] = "GROUP"
            payload["groupId"] = groupId
        case .channel(let communityId, let channelId):
            payload["type"] = "CHANNEL"
            payload["communityId"] = communityId
            payload["channelId"] = Int(channelId) ?? channelId
        }
        if let threadIndex {
            payload["threadIndex"] = threadIndex
        }
        return payload
    }

    // Whether opening the chat the web layer names in `releaseNotifications` should remove this
    // notification. A thread is released on its own; the chat releases its main messages.
    public func isReleased(by request: [String: String]) -> Bool {
        let thread = request["threadIndex"].flatMap(Int.init)
        guard thread == threadIndex else { return false }
        switch chat {
        case .direct(let senderId):
            return request["senderId"] == senderId
        case .group(let groupId):
            return request["groupId"] == groupId
        case .channel(let communityId, let channelId):
            return request["communityId"] == communityId && request["channelId"] == channelId
        }
    }
}
