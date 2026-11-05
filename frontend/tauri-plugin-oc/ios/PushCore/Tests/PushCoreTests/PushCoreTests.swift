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
