import XCTest

@testable import CallCore

final class CallTeardownTests: XCTestCase {
    private let bridge = "https://bridge.example"

    func testEndingADirectCallPostsTheTokenToEndMeeting() {
        let request = CallTeardown(token: "t", kind: .end, sessionId: "s").request(videoBridgeUrl: bridge)
        XCTAssertEqual(request?.url?.absoluteString, "https://bridge.example/room/end_meeting")
        XCTAssertEqual(request?.httpMethod, "POST")
        XCTAssertEqual(request?.value(forHTTPHeaderField: "x-auth-jwt"), "t")
        XCTAssertNil(request?.httpBody)
    }

    func testLeavingAGroupCallNamesOnlyThisDevicesSession() throws {
        let request = CallTeardown(token: "t", kind: .leave, sessionId: "abc").request(videoBridgeUrl: bridge)
        XCTAssertEqual(request?.url?.absoluteString, "https://bridge.example/room/leave")
        let body = try XCTUnwrap(request?.httpBody)
        XCTAssertEqual(try JSONDecoder().decode([String: String].self, from: body), ["sessionId": "abc"])
    }

    func testInvariant20TheOtherPartyLeavingADirectCallEndsIt() {
        let direct = CallTeardown(token: "t", kind: .end, sessionId: nil)
        XCTAssertTrue(CallPolicy.peerLeftEndsCall(teardown: direct, leaverIsLocal: false))
        XCTAssertFalse(CallPolicy.peerLeftEndsCall(teardown: direct, leaverIsLocal: true))
    }

    func testInvariant20SomeoneLeavingAGroupCallDoesNotEndIt() {
        let group = CallTeardown(token: "t", kind: .leave, sessionId: nil)
        XCTAssertFalse(CallPolicy.peerLeftEndsCall(teardown: group, leaverIsLocal: false))
        XCTAssertFalse(CallPolicy.peerLeftEndsCall(teardown: nil, leaverIsLocal: false))
    }
}
