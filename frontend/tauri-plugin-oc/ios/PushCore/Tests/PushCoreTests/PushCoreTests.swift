import XCTest

@testable import PushCore

private let alice = "3skqk-iqaaa-aaaaf-aaa3q-cai"
private let group = "hnv5y-siaaa-aaaaf-aacza-cai"
private let base = "https://%@.raw.icp0.io"

private let groupMessage: [AnyHashable: Any] = [
    "type": "group",
    "groupId": group,
    "groupName": "Rust",
    "groupAvatarId": "11",
    "senderId": alice,
    "senderName": "alice",
    "senderAvatarId": "7",
    "body": "hello",
    "bodyType": "message",
    "messageType": "Text",
]

final class NotificationRendererTests: XCTestCase {
    // #10398 invariant 14: the extension always has something to deliver in time
    func testInvariant14AFailedOrSlowAvatarFetchStillDeliversInTime() async {
        let failed = await NotificationRenderer.render(
            userInfo: groupMessage, serverTitle: "Rust", serverBody: "alice: hello",
            avatarBaseUrl: base, timeout: .seconds(5), fetch: { _ in nil })
        XCTAssertEqual(failed.title, "Rust")
        XCTAssertEqual(failed.body, "alice: hello")
        XCTAssertNil(failed.senderAvatar)

        // A fetch that never finishes, and ignores being cancelled
        let start = ContinuousClock.now
        let slow = await NotificationRenderer.render(
            userInfo: groupMessage, serverTitle: "Rust", serverBody: "alice: hello",
            avatarBaseUrl: base, timeout: .milliseconds(200),
            fetch: { _ in
                while true { usleep(10_000) }
            })
        XCTAssertLessThan(ContinuousClock.now - start, .seconds(2))
        XCTAssertEqual(slow.body, "alice: hello")
        XCTAssertNil(slow.senderAvatar)
    }

    // #10398 invariant 14
    func testInvariant14APayloadItCannotReadKeepsTheServersText() async {
        let rendered = await NotificationRenderer.render(
            userInfo: ["aps": ["alert": ["title": "T", "body": "B"]]], serverTitle: "T", serverBody: "B",
            avatarBaseUrl: base, timeout: .seconds(1), fetch: { _ in Data([1]) })
        XCTAssertEqual(rendered.title, "T")
        XCTAssertEqual(rendered.body, "B")
    }

    // #10398 invariant 14: the photo is best effort too. It has its own deadline, so a slow one
    // costs neither the avatars nor time: the photo and the avatars run at once, and the extension
    // couldn't wait out one deadline after the other.
    func testInvariant14ASlowPhotoDownloadNeitherDelaysDeliveryNorCostsTheAvatars() async {
        var photo = groupMessage
        photo["messageType"] = "Image"
        photo["image"] = "https://bucket.raw.icp0.io/files/99"
        // Never returns, and ignores being cancelled, without holding a thread
        let hang: @Sendable (URL) async -> URL? = { _ in await withUnsafeContinuation { _ in } }

        let rendered = await NotificationRenderer.render(
            userInfo: photo, serverTitle: "Rust", serverBody: "alice: hello",
            avatarBaseUrl: base, timeout: .milliseconds(200),
            fetch: { _ in Data([1]) }, fetchImage: hang)
        XCTAssertNil(rendered.image)
        XCTAssertEqual(rendered.senderAvatar, Data([1]))

        // Both slow: one deadline, not two (1s) in a row
        let timeout = Duration.milliseconds(500)
        let start = ContinuousClock.now
        let slow = await NotificationRenderer.render(
            userInfo: photo, serverTitle: "Rust", serverBody: "alice: hello",
            avatarBaseUrl: base, timeout: timeout,
            fetch: { _ in await withUnsafeContinuation { _ in } }, fetchImage: hang)
        XCTAssertLessThan(ContinuousClock.now - start, timeout * 1.5)
        XCTAssertEqual(slow.body, "alice: hello")
    }

    // As on Android, a photo is shown and a video's thumbnail isn't
    func testAPhotoIsDownloadedButAVideoThumbnailIsNot() async {
        let file = URL(fileURLWithPath: "/tmp/photo.jpg")
        func render(_ messageType: String) async -> RenderedNotification {
            var push = groupMessage
            push["messageType"] = messageType
            push["image"] = "https://bucket.raw.icp0.io/files/99"
            return await NotificationRenderer.render(
                userInfo: push, serverTitle: "", serverBody: "", avatarBaseUrl: base,
                timeout: .seconds(5), fetch: { _ in nil },
                fetchImage: { url in url.absoluteString == "https://bucket.raw.icp0.io/files/99" ? file : nil })
        }
        let image = await render("Image")
        let video = await render("Video")
        XCTAssertEqual(image.image, file)
        XCTAssertNil(video.image)
    }

    func testAGroupMessageNamesTheSenderAndFetchesBothAvatars() async {
        let rendered = await NotificationRenderer.render(
            userInfo: groupMessage, serverTitle: "", serverBody: "", avatarBaseUrl: base,
            timeout: .seconds(5), fetch: { url in Data(url.absoluteString.utf8) })

        XCTAssertEqual(rendered.title, "Rust")
        XCTAssertEqual(rendered.body, "alice: hello")
        XCTAssertEqual(rendered.messageText, "hello")
        XCTAssertEqual(rendered.conversationName, "Rust")
        XCTAssertEqual(rendered.threadId, "group:\(group)")
        XCTAssertEqual(
            rendered.senderAvatar, Data("https://\(alice).raw.icp0.io/avatar/7".utf8))
        XCTAssertEqual(
            rendered.conversationAvatar, Data("https://\(group).raw.icp0.io/avatar/11".utf8))
    }

    // A push from a client or canister that sends no sender avatar fetches none, rather than
    // putting the group's picture on the sender
    func testAGroupMessageWithoutASenderAvatarFetchesOnlyTheGroups() async {
        var push = groupMessage
        push.removeValue(forKey: "senderAvatarId")
        let rendered = await NotificationRenderer.render(
            userInfo: push, serverTitle: "", serverBody: "", avatarBaseUrl: base,
            timeout: .seconds(5), fetch: { url in Data(url.absoluteString.utf8) })

        XCTAssertNil(rendered.senderAvatar)
        XCTAssertEqual(
            rendered.conversationAvatar, Data("https://\(group).raw.icp0.io/avatar/11".utf8))
    }
}

final class MessagePushTests: XCTestCase {
    func testTheWebLayerGetsTheSameEventAndroidSends() {
        var channel = groupMessage
        channel["type"] = "channel"
        channel["communityId"] = group
        channel["channelId"] = "42"
        channel["threadIndex"] = "3"

        let payload = MessagePush(userInfo: channel)!.eventPayload(id: 9)
        XCTAssertEqual(payload["type"] as? String, "CHANNEL")
        XCTAssertEqual(payload["communityId"] as? String, group)
        XCTAssertEqual(payload["channelId"] as? Int, 42)
        XCTAssertEqual(payload["threadIndex"] as? Int, 3)
        XCTAssertEqual(payload["id"] as? Int, 9)
    }

    func testOpeningAChatReleasesItsOwnNotificationsOnly() {
        let push = MessagePush(userInfo: groupMessage)!
        XCTAssertTrue(push.isReleased(by: ["groupId": group]))
        XCTAssertFalse(push.isReleased(by: ["groupId": "other"]))
        // A thread of the chat is released on its own
        XCTAssertFalse(push.isReleased(by: ["groupId": group, "threadIndex": "1"]))
    }
}

// Serves every request with `body`, without a Content-Length, so only the running total can hold a
// download to its cap
private final class StubServer: URLProtocol {
    static var body = Data()
    static var requests: [URL] = []

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        Self.requests.append(request.url!)
        let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [:])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Self.body)
        client?.urlProtocolDidFinishLoading(self)
    }
}

final class AvatarCacheTests: XCTestCase {
    private var dir: URL!

    override func setUp() {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        StubServer.body = Data("avatar".utf8)
        StubServer.requests = []
    }

    override func tearDown() {
        try? FileManager.default.removeItem(at: dir)
    }

    private func cache(maxEntries: Int = AvatarCache.maxEntries) -> AvatarCache {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubServer.self]
        return AvatarCache(directory: dir, maxEntries: maxEntries, configuration: configuration)
    }

    private func url(_ id: Int) -> URL {
        URL(string: "https://\(alice).raw.icp0.io/avatar/\(id)")!
    }

    func testACachedAvatarIsServedWithoutFetchingIt() async {
        let first = await cache().avatar(at: url(1))
        // A later push runs in a new extension process
        let second = await cache().avatar(at: url(1))
        XCTAssertEqual(first, Data("avatar".utf8))
        XCTAssertEqual(second, first)
        XCTAssertEqual(StubServer.requests, [url(1)])
    }

    func testTheCacheKeepsOnlyTheMostRecentlyUsedAvatars() async {
        let cache = cache(maxEntries: 2)
        for id in [1, 2, 3] {
            _ = await cache.avatar(at: url(id))
        }
        _ = await cache.avatar(at: url(3))
        _ = await cache.avatar(at: url(1))
        XCTAssertEqual(StubServer.requests, [url(1), url(2), url(3), url(1)])
    }

    func testAnAvatarOverTheSizeCapIsRefusedAndNotCached() async {
        StubServer.body = Data(count: AvatarCache.maxBytes + 1)
        let avatar = await cache().avatar(at: url(1))
        XCTAssertNil(avatar)
        XCTAssertEqual((try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [], [])
    }
}

final class ApnsEnvironmentTests: XCTestCase {
    private func profile(_ environment: String) -> Data {
        Data(
            """
            garbage-before\u{0}<?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
            <plist version="1.0"><dict><key>Entitlements</key><dict>
            <key>aps-environment</key><string>\(environment)</string>
            </dict></dict></plist>\u{0}garbage-after
            """.utf8)
    }

    // #10398 invariant 4: only a development build's tokens are tagged for the sandbox
    func testInvariant4OnlyADevelopmentProfileTagsTheTokenForTheSandbox() {
        let token = Data([0xab, 0x01])
        XCTAssertTrue(ApnsEnvironment.isSandbox(profile: profile("development")))
        XCTAssertFalse(ApnsEnvironment.isSandbox(profile: profile("production")))
        XCTAssertFalse(ApnsEnvironment.isSandbox(profile: nil))
        XCTAssertEqual(ApnsEnvironment.tokenString(deviceToken: token, sandbox: true), "sandbox:ab01")
        XCTAssertEqual(ApnsEnvironment.tokenString(deviceToken: token, sandbox: false), "ab01")
    }
}

// The vectors are those in BlobLocationTest.kt and frontend/openchat-shared/src/utils/userId.spec.ts
final class BlobLocationTests: XCTestCase {
    private let canisterId = "dfdal-2uaaa-aaaaa-qaama-cai"

    func testAUserInAMultiUserCanisterIsServedByItUnderTheirIndex() {
        XCTAssertEqual(
            BlobLocation.of("qp43m-xeaaa-aaaaa-qaama-daa", "avatar"),
            BlobLocation(canisterId: canisterId, path: "user/1/avatar"))
        XCTAssertEqual(
            BlobLocation.of("bhdhu-34aaa-aaaaa-qaamp-7aa", "avatar"),
            BlobLocation(canisterId: canisterId, path: "user/255/avatar"))
        XCTAssertEqual(
            BlobLocation.of("5xs3p-c4aaa-aaaaa-qaama-bai", "avatar"),
            BlobLocation(canisterId: canisterId, path: "user/256/avatar"))
        XCTAssertEqual(
            BlobLocation.of("zf6bn-quaaa-aaaaa-qaamp-77y", "avatar"),
            BlobLocation(canisterId: canisterId, path: "user/32767/avatar"))
    }

    func testAnythingElseIsServedByItsOwnCanisterAtItsRoot() {
        XCTAssertEqual(
            BlobLocation.of(canisterId, "avatar"), BlobLocation(canisterId: canisterId, path: "avatar"))
        XCTAssertEqual(
            BlobLocation.of("h7fir-ribai-bqibi-ga4ea", "avatar"),
            BlobLocation(canisterId: "h7fir-ribai-bqibi-ga4ea", path: "avatar"))
        XCTAssertEqual(
            BlobLocation.of("SVGK6-Q4AAA-AAAAA-QAAMO-RAY", "avatar"),
            BlobLocation(canisterId: "SVGK6-Q4AAA-AAAAA-QAAMO-RAY", path: "avatar"))
    }
}
