import XCTest

@testable import CallCore

final class ActiveCallTests: XCTestCase {
    func testInvariantAEndingFromCallKitLeavesTheNativeCallOnce() {
        let registry = CallRegistry()
        let call = UUID()
        XCTAssertTrue(registry.callStarted(call))

        XCTAssertTrue(registry.systemEnded(call))
        XCTAssertFalse(registry.systemEnded(call))
        // The native call's own end then follows, and CallKit isn't told a second time
        XCTAssertFalse(registry.nativeEnded(call))
    }

    func testInvariantAEndingInTheAppEndsTheCallKitCallOnce() {
        let registry = CallRegistry()
        let call = UUID()
        XCTAssertTrue(registry.callStarted(call))

        XCTAssertTrue(registry.nativeEnded(call))
        XCTAssertFalse(registry.nativeEnded(call))
        // CallKit's end action for the call it was just told about doesn't leave anything
        XCTAssertFalse(registry.systemEnded(call))
    }

    func testInvariantAAFinishedCallNeverEndsTheCallThatReplacedIt() {
        let registry = CallRegistry()
        let first = UUID()
        let second = UUID()
        XCTAssertTrue(registry.callStarted(first))
        XCTAssertTrue(registry.systemEnded(first))
        XCTAssertTrue(registry.callStarted(second))

        // The first native call reports leaving after the second has started
        XCTAssertFalse(registry.nativeEnded(first))
        XCTAssertEqual(registry.activeCall, second)
    }

    func testOnlyOneCallIsInProgress() {
        let registry = CallRegistry()
        let first = UUID()
        XCTAssertTrue(registry.callStarted(first))
        XCTAssertFalse(registry.callStarted(UUID()))
        XCTAssertEqual(registry.activeCall, first)
    }
}

final class CallAudioPolicyTests: XCTestCase {
    func testInvariantBACallStartsOnAHeadsetThenEarpieceForVoiceAndSpeakerForVideo() {
        XCTAssertEqual(CallAudioPolicy.initialRoute(video: false, headsetConnected: false), .earpiece)
        XCTAssertEqual(CallAudioPolicy.initialRoute(video: true, headsetConnected: false), .speaker)
        XCTAssertEqual(CallAudioPolicy.initialRoute(video: false, headsetConnected: true), .headset)
        XCTAssertEqual(CallAudioPolicy.initialRoute(video: true, headsetConnected: true), .headset)
    }
}
