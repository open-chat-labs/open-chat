import Foundation
import ShareCore

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
    // The only picture the notification shows, in a group or channel too: iOS shows one image, and
    // the sender's says who wrote it, as Android's per-sender rows do. One without an avatar gets
    // iOS's initials, never the group's picture.
    public let senderAvatar: Data?
    // The message's photo, downloaded to a local file for the notification to attach
    public let image: URL?
}

public enum NotificationRenderer {
    // Renders `userInfo` within `timeout`, fetching avatars with `fetch` and the message's photo
    // with `fetchImage`. Always returns: a payload it can't read keeps the server's text, and an
    // avatar or photo that fails or doesn't arrive in time is left out. The photo has its own
    // deadline, so a slow one doesn't cost the avatars.
    public static func render(
        userInfo: [AnyHashable: Any],
        serverTitle: String,
        serverBody: String,
        avatarBaseUrl: String,
        timeout: Duration,
        fetch: @escaping @Sendable (URL) async -> Data?,
        fetchImage: @escaping @Sendable (URL) async -> URL? = { _ in nil }
    ) async -> RenderedNotification {
        guard let push = MessagePush(userInfo: userInfo) else {
            return RenderedNotification(
                title: serverTitle, body: serverBody, messageText: serverBody, threadId: "",
                senderId: nil, senderName: nil, conversationName: nil, senderAvatar: nil,
                image: nil)
        }

        let imageUrl = push.imageUrl
        async let image = withDeadline(timeout) { await imageUrl.asyncMap(fetchImage) ?? nil }
        let avatarUrl = senderAvatarUrl(push, base: avatarBaseUrl)
        let avatar = await withDeadline(timeout) { await avatarUrl.asyncMap(fetch) ?? nil }

        return RenderedNotification(
            title: title(push),
            body: body(push),
            messageText: messageText(push),
            threadId: threadId(push.chat),
            senderId: push.senderId,
            senderName: push.senderName,
            conversationName: conversationName(push),
            senderAvatar: avatar ?? nil,
            image: await image ?? nil)
    }

    // Notifications are grouped per chat, the same ids the pusher sets as `thread-id`
    public static func threadId(_ chat: MessagePush.Chat) -> String {
        switch chat {
        case .direct(let senderId): return "direct:\(senderId)"
        case .group(let groupId): return "group:\(groupId)"
        case .channel(let communityId, let channelId): return "channel:\(communityId):\(channelId)"
        }
    }

    // The sender's avatar, in any chat
    public static func senderAvatarUrl(_ push: MessagePush, base: String) -> URL? {
        guard let senderId = push.senderId, let avatarId = push.senderAvatarId else { return nil }
        let location = BlobLocation.of(senderId, "avatar")
        return URL(string: "\(String(format: base, location.canisterId))/\(location.path)/\(avatarId)")
    }

    // The same wording as the pusher's fallback and the Android shell
    static func title(_ push: MessagePush) -> String {
        func inThread(_ name: String) -> String {
            push.threadIndex != nil ? localized("%1$@ // Thread", name) : name
        }
        switch push.chat {
        case .direct: return push.senderName ?? "OpenChat"
        case .group: return inThread(push.groupName ?? "")
        case .channel: return inThread("\(push.communityName ?? "")#\(push.channelName ?? "")")
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
        case .reaction: return localized("%1$@ reacted with %2$@", sender, push.body)
        case .tip: return localized("%1$@ sent a tip of %2$@", sender, push.body)
        case .invite: return localized("%1$@ invited you to %2$@", sender, push.body)
        case .message: break
        }

        let caption = push.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : push.body
        switch push.messageType {
        case "Image": return caption ?? "📷 " + localized("Photo")
        case "Video": return "🎥 " + (caption ?? localized("Shared a video"))
        case "Giphy": return "🎞️ " + (caption ?? localized("Shared a GIF"))
        case "Audio": return "🎙️ " + (caption ?? localized("Shared audio"))
        case "File":
            let fileName = push.fileName.flatMap { $0.trimmingCharacters(in: .whitespaces).isEmpty ? nil : $0 }
            return "📎 " + (fileName ?? caption ?? localized("Shared a file"))
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

// The text in the app's language (AppLanguage). The translations are the Notification Service
// Extension's (NotificationService/*.lproj), so `swift test`, which has none, gets the English key
// back.
private func localized(_ key: String, _ args: CVarArg...) -> String {
    let format = AppLanguage.localized(key)
    return args.isEmpty ? format : String(format: format, arguments: args)
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
    fileprivate func asyncMap<T>(_ f: @Sendable (URL) async -> T?) async -> T?? {
        guard let url = self else { return nil }
        return await f(url)
    }
}
