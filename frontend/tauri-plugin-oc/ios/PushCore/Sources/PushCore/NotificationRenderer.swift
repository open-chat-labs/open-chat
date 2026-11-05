import Foundation

// What a message notification shows. The Notification Service Extension turns it into a
// communication notification; anything missing falls back to what the server already put in the
// alert.
public struct RenderedNotification: Equatable {
    public let title: String
    public let body: String
    // The message without the sender's name in front, for a communication notification, which
    // names the sender itself
    public let messageText: String
    public let threadId: String
    public let senderId: String?
    public let senderName: String?
    // The group or channel, nil for a direct chat
    public let conversationName: String?
    public let senderAvatar: Data?
    public let conversationAvatar: Data?
}

public enum NotificationRenderer {
    // Renders `userInfo` within `timeout`, fetching avatars with `fetch`. Always returns: a payload
    // it can't read keeps the server's text, and an avatar that fails or doesn't arrive in time is
    // left out.
    public static func render(
        userInfo: [AnyHashable: Any],
        serverTitle: String,
        serverBody: String,
        avatarBaseUrl: String,
        timeout: Duration,
        fetch: @escaping @Sendable (URL) async -> Data?
    ) async -> RenderedNotification {
        guard let push = MessagePush(userInfo: userInfo) else {
            return RenderedNotification(
                title: serverTitle, body: serverBody, messageText: serverBody, threadId: "",
                senderId: nil, senderName: nil, conversationName: nil, senderAvatar: nil,
                conversationAvatar: nil)
        }

        let urls = avatarUrls(push, base: avatarBaseUrl)
        let avatars = await withDeadline(timeout) {
            async let sender = urls.sender.asyncMap(fetch)
            async let conversation = urls.conversation.asyncMap(fetch)
            return await (sender ?? nil, conversation ?? nil)
        }

        return RenderedNotification(
            title: title(push),
            body: body(push),
            messageText: messageText(push),
            threadId: threadId(push.chat),
            senderId: push.senderId,
            senderName: push.senderName,
            conversationName: conversationName(push),
            senderAvatar: avatars?.0,
            conversationAvatar: avatars?.1)
    }

    // Notifications are grouped per chat, the same ids the pusher sets as `thread-id`
    public static func threadId(_ chat: MessagePush.Chat) -> String {
        switch chat {
        case .direct(let senderId): return "direct:\(senderId)"
        case .group(let groupId): return "group:\(groupId)"
        case .channel(let communityId, let channelId): return "channel:\(communityId):\(channelId)"
        }
    }

    // The sender's avatar for the person, and the group's or channel's for the conversation
    public static func avatarUrls(_ push: MessagePush, base: String) -> (sender: URL?, conversation: URL?) {
        func main(_ entityId: String, _ avatarId: String?) -> URL? {
            guard let avatarId else { return nil }
            let location = BlobLocation.of(entityId, "avatar")
            return URL(string: "\(String(format: base, location.canisterId))/\(location.path)/\(avatarId)")
        }

        let sender = push.senderId.flatMap { main($0, push.senderAvatarId) }
        switch push.chat {
        case .direct:
            return (sender, nil)
        case .group(let groupId):
            return (sender, main(groupId, push.groupAvatarId))
        case .channel(let communityId, let channelId):
            let channel = push.channelAvatarId.flatMap {
                URL(string: "\(String(format: base, communityId))/channel/\(channelId)/avatar/\($0)")
            }
            return (sender, channel ?? main(communityId, push.communityAvatarId))
        }
    }

    // The same wording as the pusher's fallback and the Android shell
    static func title(_ push: MessagePush) -> String {
        let thread = push.threadIndex != nil ? " // Thread" : ""
        switch push.chat {
        case .direct: return push.senderName ?? "OpenChat"
        case .group: return "\(push.groupName ?? "")\(thread)"
        case .channel: return "\(push.communityName ?? "")#\(push.channelName ?? "")\(thread)"
        }
    }

    static func body(_ push: MessagePush) -> String {
        let text = messageText(push)
        guard push.bodyType == .message else { return text }
        switch push.chat {
        case .direct: return text
        default: return "\(push.senderName ?? ""): \(text)"
        }
    }

    static func messageText(_ push: MessagePush) -> String {
        let sender = push.senderName ?? ""
        switch push.bodyType {
        case .reaction: return "\(sender) reacted with \(push.body)"
        case .tip: return "\(sender) sent a tip of \(push.body)"
        case .invite: return "\(sender) invited you to \(push.body)"
        case .message: break
        }

        let caption = push.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : push.body
        switch push.messageType {
        case "Image": return caption ?? "📷 Photo"
        case "Video": return "🎥 " + (caption ?? "Shared a video")
        case "Giphy": return "🎞️ " + (caption ?? "Shared a GIF")
        case "Audio": return "🎙️ " + (caption ?? "Shared audio")
        case "File":
            let fileName = push.fileName.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
            return "📎 " + (fileName ?? caption ?? "Shared a file")
        default: return caption ?? push.body
        }
    }

    static func conversationName(_ push: MessagePush) -> String? {
        switch push.chat {
        case .direct: return nil
        case .group: return push.groupName
        case .channel: return "\(push.communityName ?? "")#\(push.channelName ?? "")"
        }
    }
}

// Runs `work`, giving up with nil once `timeout` passes. Returns at the deadline even when `work`
// ignores cancellation, since the extension is killed if it overruns.
func withDeadline<T: Sendable>(_ timeout: Duration, _ work: @escaping @Sendable () async -> T) async -> T? {
    let once = ResumeOnce<T?>()
    return await withCheckedContinuation { continuation in
        once.set(continuation)
        let task = Task { once.resume(await work()) }
        Task {
            try? await Task.sleep(for: timeout)
            once.resume(nil)
            task.cancel()
        }
    }
}

private final class ResumeOnce<T: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<T, Never>?

    func set(_ continuation: CheckedContinuation<T, Never>) {
        lock.withLock { self.continuation = continuation }
    }

    func resume(_ value: T) {
        let continuation = lock.withLock {
            defer { self.continuation = nil }
            return self.continuation
        }
        continuation?.resume(returning: value)
    }
}

extension Optional where Wrapped == URL {
    fileprivate func asyncMap(_ f: @Sendable (URL) async -> Data?) async -> Data?? {
        guard let url = self else { return nil }
        return await f(url)
    }
}
