import Intents
import PushCore
import UniformTypeIdentifiers
import UserNotifications

// Renders a message push before iOS shows it (#10398 M1): the sender's avatar,
// the message's photo, and a communication notification so iOS shows the sender like a messaging app. Whatever goes
// wrong, a notification is delivered, with the server's text if nothing better is ready.
final class NotificationService: UNNotificationServiceExtension {
    // The extension has about 30 seconds. Avatars and the photo get most of it, rendering the rest.
    private static let avatarTimeout: Duration = .seconds(20)
    private static let avatars = AvatarCache(
        directory: FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("avatars", isDirectory: true))

    private let lock = NSLock()
    private var contentHandler: ((UNNotificationContent) -> Void)?
    private var serverContent: UNNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        lock.withLock {
            self.contentHandler = contentHandler
            self.serverContent = request.content
        }

        let content = request.content
        let avatarBaseUrl =
            Bundle.main.object(forInfoDictionaryKey: "OCAvatarBaseUrl") as? String ?? "https://%@.raw.icp0.io"
        Task {
            let rendered = await NotificationRenderer.render(
                userInfo: content.userInfo,
                serverTitle: content.title,
                serverBody: content.body,
                avatarBaseUrl: avatarBaseUrl,
                timeout: Self.avatarTimeout,
                fetch: { await Self.avatars.avatar(at: $0) },
                fetchImage: { await Self.downloadImage($0) })
            deliver(Self.notification(rendered, from: content))
        }
    }

    override func serviceExtensionTimeWillExpire() {
        deliver(lock.withLock { serverContent })
    }

    // Hands over the first content ready, once
    private func deliver(_ content: UNNotificationContent?) {
        let handler = lock.withLock {
            defer { contentHandler = nil }
            return contentHandler
        }
        if let handler, let content {
            handler(content)
        }
    }

    // To a file, so a big photo doesn't use up the extension's memory. The attachment's type comes
    // from the file's extension, which a blob's URL doesn't have.
    private static func downloadImage(_ url: URL) async -> URL? {
        guard let (file, response) = try? await URLSession.shared.download(from: url) else { return nil }
        let ext = response.mimeType.flatMap { UTType(mimeType: $0)?.preferredFilenameExtension } ?? "jpg"
        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString).appendingPathExtension(ext)
        guard (response as? HTTPURLResponse)?.statusCode == 200,
            (try? FileManager.default.moveItem(at: file, to: destination)) != nil
        else {
            try? FileManager.default.removeItem(at: file)
            return nil
        }
        return destination
    }

    private static func notification(
        _ rendered: RenderedNotification, from server: UNNotificationContent
    ) -> UNNotificationContent {
        guard let fallback = server.mutableCopy() as? UNMutableNotificationContent else { return server }
        fallback.title = rendered.title
        fallback.body = rendered.body
        if !rendered.threadId.isEmpty {
            fallback.threadIdentifier = rendered.threadId
        }
        if let image = rendered.image {
            // iOS moves the file into its own store, or refuses it, such as when it's too big
            if let attachment = try? UNNotificationAttachment(identifier: "image", url: image) {
                fallback.attachments = [attachment]
            } else {
                try? FileManager.default.removeItem(at: image)
            }
        }

        guard let senderName = rendered.senderName,
            let communication = fallback.mutableCopy() as? UNMutableNotificationContent
        else { return fallback }

        // A communication notification names the sender itself
        communication.body = rendered.messageText
        let sender = INPerson(
            personHandle: INPersonHandle(value: rendered.senderId ?? senderName, type: .unknown),
            nameComponents: nil,
            displayName: senderName,
            image: rendered.senderAvatar.map { INImage(imageData: $0) },
            contactIdentifier: nil,
            customIdentifier: rendered.senderId)
        let groupName = rendered.conversationName.map { INSpeakableString(spokenPhrase: $0) }
        let me = INPerson(
            personHandle: INPersonHandle(value: "me", type: .unknown), nameComponents: nil,
            displayName: nil, image: nil, contactIdentifier: nil, customIdentifier: nil, isMe: true)
        let intent = INSendMessageIntent(
            // A group conversation needs more than one recipient
            recipients: groupName == nil ? nil : [me, sender],
            outgoingMessageType: .outgoingMessageText,
            content: rendered.messageText,
            speakableGroupName: groupName,
            conversationIdentifier: rendered.threadId,
            serviceName: nil,
            sender: sender,
            attachments: nil)

        let interaction = INInteraction(intent: intent, response: nil)
        interaction.direction = .incoming
        interaction.donate(completion: nil)

        return (try? communication.updating(from: intent)) ?? fallback
    }
}
