import CoreGraphics
import XCTest

@testable import CallScreenCore

final class CallScreenTests: XCTestCase {
    // #10529 invariant 1 (as the Android app's, `callStage` in call.adapter.ts)
    func testInvariant1UpToThreePeopleStackWithYourCameraFloatingAndFourOrMoreAreAGrid() {
        XCTAssertEqual(
            CallStage.layout(others: ["a", "b"], selfId: "me", video: true),
            CallStage(tiles: ["a", "b"], floatSelf: true, columns: 1))
        XCTAssertEqual(
            CallStage.layout(others: ["a", "b", "c"], selfId: "me", video: true),
            CallStage(tiles: ["a", "b", "c", "me"], floatSelf: false, columns: 2))
        // a voice call is everyone as an avatar, the user too
        XCTAssertEqual(
            CallStage.layout(others: ["a"], selfId: "me", video: false),
            CallStage(tiles: ["a", "me"], floatSelf: false, columns: 1))
        // a broadcast viewer has no tile of their own (nor does the user before theirs exists), so
        // nothing floats, and the people stack by the same count: the host fills the stage
        XCTAssertEqual(
            CallStage.layout(others: ["a"], selfId: nil, video: true),
            CallStage(tiles: ["a"], floatSelf: false, columns: 1))
        XCTAssertEqual(
            CallStage.layout(others: ["a", "b", "c", "d"], selfId: nil, video: true),
            CallStage(tiles: ["a", "b", "c", "d"], floatSelf: false, columns: 2))
    }

    // #10529 invariant 2
    func testInvariant2TheControlsForEachKindOfCallAndNoCameraInAVoiceCall() {
        XCTAssertEqual(CallControl.controls(video: true, broadcastViewer: false), [.mic, .camera, .speaker, .leave])
        XCTAssertEqual(CallControl.controls(video: false, broadcastViewer: false), [.mic, .speaker, .leave])
        XCTAssertEqual(CallControl.controls(video: true, broadcastViewer: true), [.speaker, .leave])
    }

    // #10529 invariant 3 (as the Android app's `CallChrome`)
    func testInvariant3VideoControlsHideAfterFourSecondsOrOnATapAndATapBringsThemBack() {
        let t0 = Date(timeIntervalSince1970: 1_000)
        var chrome = CallChrome()
        chrome.update(video: true, now: t0)
        XCTAssertTrue(chrome.shown(at: t0.addingTimeInterval(3.9)))
        XCTAssertFalse(chrome.shown(at: t0.addingTimeInterval(4)))
        // a press starts the wait again
        chrome.wake(now: t0.addingTimeInterval(3))
        XCTAssertTrue(chrome.shown(at: t0.addingTimeInterval(6.9)))
        XCTAssertFalse(chrome.shown(at: t0.addingTimeInterval(7)))
        // hidden, a tap brings them back; showing, a tap hides them at once
        let t1 = t0.addingTimeInterval(10)
        chrome.tapStage(now: t1)
        XCTAssertTrue(chrome.shown(at: t1))
        chrome.tapStage(now: t1.addingTimeInterval(1))
        XCTAssertFalse(chrome.shown(at: t1.addingTimeInterval(1)))
    }

    func testInvariant3VoiceControlsNeverHide() {
        let t0 = Date(timeIntervalSince1970: 1_000)
        var chrome = CallChrome()
        chrome.update(video: false, now: t0)
        XCTAssertTrue(chrome.shown(at: t0.addingTimeInterval(60)))
        chrome.tapStage(now: t0.addingTimeInterval(61))
        XCTAssertTrue(chrome.shown(at: t0.addingTimeInterval(61)))
        // a video call turning into a voice one brings them back for good
        chrome.update(video: true, now: t0)
        XCTAssertFalse(chrome.shown(at: t0.addingTimeInterval(5)))
        chrome.update(video: false, now: t0.addingTimeInterval(5))
        XCTAssertTrue(chrome.shown(at: t0.addingTimeInterval(100)))
    }

    // #10529 invariant 4
    func testInvariant4YourCameraSettlesOnTheNearestOfSixSpotsClearOfTheBars() {
        // a 400 x 800 screen, the top bar to 100 and the controls from 700
        let area = CGRect(x: 0, y: 100, width: 400, height: 600)
        let tile = CGSize(width: 104, height: 140)
        let spot = { (x: CGFloat, y: CGFloat) in SelfSpot.nearest(to: CGPoint(x: x, y: y), in: area) }
        XCTAssertEqual(spot(10, 120), .topLeft)
        XCTAssertEqual(spot(390, 690), .bottomRight)
        // the middle third goes to a side, never a centre column
        XCTAssertEqual(spot(199, 400), .middleLeft)
        XCTAssertEqual(spot(201, 400), .middleRight)
        // dropped over the top bar or the controls, it still lands inside the area
        XCTAssertEqual(spot(300, -50), .topRight)
        for s in SelfSpot.allCases {
            let frame = s.frame(of: tile, in: area, margin: 12)
            XCTAssertTrue(area.contains(frame), "\(s) at \(frame)")
        }
    }

    // #10529 invariant 5 (AVAudioSession.Port raw values)
    func testInvariant5WithHeadphonesSpeakerOpensTheSystemPickerElseItToggles() {
        for headphones in ["Headphones", "BluetoothHFP", "BluetoothA2DPOutput", "BluetoothLE", "USBAudio"] {
            XCTAssertEqual(SpeakerButton.kind(ports: ["Receiver", headphones]), .picker, headphones)
        }
        // headphones still connected after the user picked the speaker: the outputs are the speaker,
        // the headset's mic is still an input
        XCTAssertEqual(SpeakerButton.kind(ports: ["Speaker", "MicrophoneBuiltIn", "MicrophoneWired"]), .picker)
        XCTAssertEqual(SpeakerButton.kind(ports: ["Speaker", "MicrophoneBuiltIn", "BluetoothHFP"]), .picker)
        XCTAssertEqual(SpeakerButton.kind(ports: ["Receiver"]), .toggle)
        XCTAssertEqual(SpeakerButton.kind(ports: ["Speaker", "MicrophoneBuiltIn"]), .toggle)
        XCTAssertEqual(SpeakerButton.kind(ports: []), .toggle)
    }

    func testInvariant5ThePickersButtonShowsTheRouteTheCallPlaysThrough() {
        XCTAssertEqual(CallOutput.of(port: "BluetoothHFP"), .headphones)
        XCTAssertEqual(CallOutput.of(port: "Headphones"), .headphones)
        XCTAssertEqual(CallOutput.of(port: "Speaker"), .speaker)
        XCTAssertEqual(CallOutput.of(port: "Receiver"), .phone)
        XCTAssertEqual(CallOutput.of(port: nil), .phone)
    }

    // #10529 invariant 7
    func testInvariant7TheCallFollowsTheRouteOnlyOnceItHoldsStill() {
        let t0 = Date(timeIntervalSinceReferenceDate: 0)
        var follower = RouteFollower<String>()
        // the audio session flipping while it's set up, 200ms apart: nothing to follow
        for i in 0..<10 {
            let at = t0.addingTimeInterval(Double(i) * 0.2)
            follower.moved(to: i % 2 == 0 ? "speaker" : "earpiece", at: at)
            XCTAssertNil(follower.settled(at: at.addingTimeInterval(0.2)))
        }
        // it stops on the earpiece: followed once
        let last = t0.addingTimeInterval(1.8)
        XCTAssertEqual(follower.settled(at: last.addingTimeInterval(RouteFollower<String>.settleAfter)), "earpiece")
        XCTAssertNil(follower.settled(at: last.addingTimeInterval(5)))
    }
}
