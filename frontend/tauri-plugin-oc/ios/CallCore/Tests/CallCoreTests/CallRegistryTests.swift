import XCTest

@testable import CallCore

final class CallRegistryTests: XCTestCase {
    private let started: Int64 = 1_000_000

    private func call(messageId: String = "1") -> IncomingCall {
        IncomingCall(payload: [
            "type": "direct", "senderId": "alice", "senderName": "alice", "callMessageId": messageId,
            "callStarted": "\(started)", "callAudioOnly": "true", "callDeclineToken": "jwt",
        ])!
    }

    func testAPushIsRead() {
        XCTAssertEqual(call().chat, .direct(userId: "alice"))
        XCTAssertTrue(call().audioOnly)
        XCTAssertEqual(call().declineToken, "jwt")
        XCTAssertNil(IncomingCall(payload: ["type": "direct"]))
    }

    func testARingRingsUntilTheEndOfItsWindow() {
        XCTAssertEqual(
            CallRegistry().started(call(), now: started + 1), .ring(deadline: started + callRingWindowMs))
    }

    func testInvariant13ALateRingIsReportedAndEndedAsMissed() {
        XCTAssertEqual(CallRegistry().started(call(), now: started + callRingWindowMs), .reportAndEnd(missed: true))
    }

    func testInvariant13ADuplicatePushIsReportedAndEndedNotMissed() {
        let registry = CallRegistry()
        _ = registry.started(call(), now: started)
        XCTAssertEqual(registry.started(call(), now: started + 1), .reportAndEnd(missed: false))
    }

    func testInvariant12AnEndedRingNeverRingsAgain() {
        for end in [RingEnd.answeredHere, .declined, .timedOut, .answeredElsewhere, .callEnded] {
            let registry = CallRegistry()
            _ = registry.started(call(), now: started)
            XCTAssertEqual(registry.end(call().id, as: end), end)
            XCTAssertEqual(registry.started(call(), now: started + 1), .reportAndEnd(missed: false))
        }
    }

    func testOnlyARingThatNobodyPickedUpIsAMissedCall() {
        XCTAssertTrue(RingEnd.timedOut.isMissedCall)
        XCTAssertTrue(RingEnd.callEnded.isMissedCall)
        XCTAssertFalse(RingEnd.declined.isMissedCall)
        XCTAssertFalse(RingEnd.answeredHere.isMissedCall)
        XCTAssertFalse(RingEnd.answeredElsewhere.isMissedCall)
    }

    func testEndingACallThatIsNotRingingDoesNothing() {
        XCTAssertNil(CallRegistry().end(call().id, as: .declined))
    }
}

final class RingBridgeTests: XCTestCase {
    func testInvariant22AnsweringNeedsOnlyTheRingTokenAndTheStoredUsername() async throws {
        var sent: URLRequest?
        let bridge = RingBridge(videoBridgeUrl: "https://bridge.example") { request in
            sent = request
            return Data(#"{"token":"daily","roomName":"room"}"#.utf8)
        }

        let room = try await bridge.answer(token: "jwt", username: "bob")

        XCTAssertEqual(room.url, "https://openchat.daily.co/room")
        XCTAssertEqual(room.token, "daily")
        XCTAssertEqual(sent?.url?.absoluteString, "https://bridge.example/room/answer")
        XCTAssertEqual(sent?.value(forHTTPHeaderField: "x-auth-jwt"), "jwt")
        let body = try XCTUnwrap(sent?.httpBody)
        XCTAssertEqual(try JSONDecoder().decode([String: String].self, from: body), ["username": "bob"])
    }

    private func call(audioOnly: Bool, token: String? = "jwt") -> IncomingCall {
        var payload: [String: String] = [
            "type": "direct", "senderId": "alice", "senderName": "Alice", "callMessageId": "1",
            "callStarted": "1", "callAudioOnly": audioOnly ? "true" : "false",
        ]
        payload["callDeclineToken"] = token
        return IncomingCall(payload: payload)!
    }

    private let bridge = RingBridge(videoBridgeUrl: "https://bridge.example") { _ in
        Data(#"{"token":"daily","roomName":"room"}"#.utf8)
    }

    func testInvariant22ARingJoinsFromThePushAndTheStoredUsernameAlone() async throws {
        let join = try await bridge.join(call(audioOnly: false), username: "bob")
        XCTAssertEqual(
            join,
            RingJoin(
                url: "https://openchat.daily.co/room", token: "daily", userName: "bob", title: "Alice",
                cameraWhenActive: true, video: true))

        let voice = try await bridge.join(call(audioOnly: true), username: "bob")
        XCTAssertFalse(voice.video)
        XCTAssertFalse(voice.cameraWhenActive)
    }

    func testARingWithNoTokenOrUsernameCannotJoin() async {
        for (ring, username) in [(call(audioOnly: true, token: nil), "bob"), (call(audioOnly: true), nil)] as [(IncomingCall, String?)] {
            do {
                _ = try await bridge.join(ring, username: username)
                XCTFail("joined")
            } catch {}
        }
    }

    func testRingStatusIsRead() async throws {
        let bridge = RingBridge(videoBridgeUrl: "https://bridge.example") { _ in
            Data(#"{"status":"answered"}"#.utf8)
        }
        let status = try await bridge.status(token: "jwt")
        XCTAssertEqual(status, .answered)
    }
}
