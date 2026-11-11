import AVFoundation
import CallCore
import Foundation
import Tauri
import UIKit

class NativeCallJoinArgs: Decodable {
    let url: String
    let token: String
    let userName: String
    let title: String
    let video: Bool
    let cameraOn: Bool
    let micOn: Bool
    let broadcast: Bool
}

// From the strip shown while the call is minimised: mic, camera, speaker, or show the call screen
class NativeCallControlArgs: Decodable {
    let kind: String
    let on: Bool
}

class CallConfigArgs: Decodable {
    let videoBridgeUrl: String
    let username: String?
}

class CallEndTokenArgs: Decodable {
    let token: String
    let kind: CallTeardownKind
    let sessionId: String?
}

// Between the web layer and the native call in the app target, which links the Daily framework
// and so can't be reached from this package except by notification.
final class NativeCallBridge {
    static let shared = NativeCallBridge()

    private static let videoBridgeUrlKey = "oc.call.videoBridgeUrl"
    private static let usernameKey = "oc.call.username"

    private var teardown: CallTeardown?
    // A call answered from a ring that the web layer hasn't heard about yet
    private var pendingAction: String?

    // Kept across launches, as a ring can start the app with no web layer to ask
    private var videoBridgeUrl: String? {
        get { UserDefaults.standard.string(forKey: Self.videoBridgeUrlKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.videoBridgeUrlKey) }
    }
    private var username: String? {
        get { UserDefaults.standard.string(forKey: Self.usernameKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.usernameKey) }
    }

    var ringBridge: RingBridge? {
        videoBridgeUrl.map { url in
            RingBridge(videoBridgeUrl: url) { request in
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                    throw URLError(.badServerResponse)
                }
                return data
            }
        }
    }

    func install() {
        (NSClassFromString("OCNativeCalls") as? NSObject.Type)?.perform(NSSelectorFromString("start"))
        CallRinger.shared.install()

        let center = NotificationCenter.default
        center.addObserver(forName: .init("ocNativeCallEvent"), object: nil, queue: .main) { [weak self] note in
            guard let event = note.userInfo as? [String: Any] else { return }
            self?.handle(event)
        }
        center.addObserver(forName: UIApplication.willTerminateNotification, object: nil, queue: .main) {
            [weak self] _ in
            self?.sendTeardown(waiting: true)
        }
    }

    func setConfig(videoBridgeUrl: String, username: String?) {
        self.videoBridgeUrl = videoBridgeUrl
        if let username { self.username = username }
    }

    func takePendingAction() -> String? {
        defer { pendingAction = nil }
        return pendingAction
    }

    // Answers a ring with no help from the web layer, which may not be running
    func answer(_ call: IncomingCall, callId: UUID, completion: @escaping (Bool) -> Void) {
        guard let bridge = ringBridge else {
            completion(false)
            return
        }
        tellWebAboutAnswer(call)
        let username = self.username
        Task { @MainActor in
            guard let join = try? await bridge.join(call, username: username) else {
                completion(false)
                return
            }
            let reply: ([String: Any]) -> Void = { result in completion(result["error"] == nil) }
            NotificationCenter.default.post(
                name: .init("ocNativeCallJoin"), object: nil,
                userInfo: [
                    "url": join.url, "token": join.token, "userName": join.userName, "title": join.title,
                    "video": join.video, "cameraOn": false, "cameraWhenActive": join.cameraWhenActive,
                    "micOn": true, "broadcast": false, "reply": reply, "callId": callId.uuidString,
                    "audioDevice": Self.initialAudioDevice(video: join.video),
                ])
        }
    }

    // Warm as an event, cold parked until the web layer asks, like Android. The web layer then
    // joins this same room, and the shell hands it the call that is already running.
    private func tellWebAboutAnswer(_ call: IncomingCall) {
        var action: [String: String] = [
            "kind": "accept", "messageId": call.messageId, "callType": call.audioOnly ? "audio" : "default",
        ]
        switch call.chat {
        case .direct(let userId):
            action["chatType"] = "direct"
            action["chatId"] = userId
        case .group(let groupId):
            action["chatType"] = "group"
            action["chatId"] = groupId
        }
        if OCCompanion.shared.svelteReady {
            OCCompanion.shared.trigger("call-action", action.mapValues { $0 as JSValue })
        } else if let data = try? JSONSerialization.data(withJSONObject: action) {
            pendingAction = String(decoding: data, as: UTF8.self)
        }
    }

    // Ended from the system call screen. With the app on screen the web layer runs the hang-up,
    // as it knows whether this was the last person there. Otherwise it can't be relied on.
    func hangUp() {
        if UIApplication.shared.applicationState == .active {
            NotificationCenter.default.post(name: .init("ocNativeCallHangUp"), object: nil)
        } else {
            sendTeardown(waiting: false)
            leave()
        }
    }

    func setMuted(_ muted: Bool) {
        control("mic", on: !muted)
    }

    func control(_ kind: String, on: Bool) {
        NotificationCenter.default.post(name: .init("ocNativeCallControl"), object: nil, userInfo: ["kind": kind, "on": on])
    }

    func setTeardown(_ teardown: CallTeardown) {
        self.teardown = teardown
    }

    func join(_ args: NativeCallJoinArgs, reply: @escaping ([String: Any]) -> Void) {
        var info: [String: Any] = [
            "url": args.url, "token": args.token, "userName": args.userName, "title": args.title,
            "video": args.video, "cameraOn": args.cameraOn, "micOn": args.micOn,
            "broadcast": args.broadcast, "reply": reply, "audioDevice": Self.initialAudioDevice(video: args.video),
        ]
        // Nil when the call is already in progress, a ring answered here that the web layer joins
        if let callId = CallRinger.shared.startInAppCall(title: args.title, video: args.video) {
            info["callId"] = callId.uuidString
            info["reply"] = { (result: [String: Any]) in
                if result["error"] == nil {
                    CallRinger.shared.inAppCallConnected(callId)
                } else {
                    CallRinger.shared.nativeCallFinished(callId)
                }
                reply(result)
            }
        }
        NotificationCenter.default.post(name: .init("ocNativeCallJoin"), object: nil, userInfo: info)
    }

    // #10402 invariant B, with the session as it is when the call starts
    static func initialAudioDevice(video: Bool) -> String {
        let headset = headsetDevice()
        switch CallAudioPolicy.initialRoute(video: video, headsetConnected: headset != nil) {
        case .headset: return headset ?? "earpiece"
        case .speaker: return "speakerphone"
        case .earpiece: return "earpiece"
        }
    }

    // The Daily name of a connected headset, if there is one
    private static func headsetDevice() -> String? {
        let session = AVAudioSession.sharedInstance()
        let ports = session.currentRoute.outputs.map(\.portType) + (session.availableInputs ?? []).map(\.portType)
        if ports.contains(where: { [.bluetoothHFP, .bluetoothA2DP, .bluetoothLE].contains($0) }) { return "bluetooth" }
        if ports.contains(where: { [.headphones, .headsetMic, .usbAudio].contains($0) }) { return "wired" }
        return nil
    }

    func leave() {
        NotificationCenter.default.post(name: .init("ocNativeCallLeave"), object: nil)
    }

    private func handle(_ event: [String: Any]) {
        let kind = event["kind"] as? String
        if kind == "participant-left", let participant = event["participant"] as? [String: Any],
            CallPolicy.peerLeftEndsCall(teardown: teardown, leaverIsLocal: participant["local"] as? Bool ?? false)
        {
            // The web layer may be suspended on a locked phone, so the shell ends the call itself
            sendTeardown(waiting: false)
            leave()
        }
        if kind == "participant-updated", let participant = event["participant"] as? [String: Any],
            participant["local"] as? Bool == true, let audio = participant["audio"] as? Bool
        {
            CallRinger.shared.localMuteChanged(!audio)
        }
        if kind == "left" {
            teardown = nil
            if let callId = (event["callId"] as? String).flatMap(UUID.init(uuidString:)) {
                CallRinger.shared.nativeCallFinished(callId)
            }
        }
        OCCompanion.shared.trigger("native-call-event", Self.flatten(event))
    }

    // Events carry nested objects, which a JSObject can't be built from here
    static func flatten(_ value: [String: Any]) -> JSObject {
        let data = (try? JSONSerialization.data(withJSONObject: value)) ?? Data("{}".utf8)
        return ["json": String(decoding: data, as: UTF8.self)]
    }

    // `waiting` holds the main thread for the request, as the app is about to be killed
    private func sendTeardown(waiting: Bool) {
        guard let videoBridgeUrl, let teardown, let request = teardown.request(videoBridgeUrl: videoBridgeUrl)
        else { return }
        self.teardown = nil

        let finished = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { _, _, _ in finished.signal() }.resume()
        if waiting {
            _ = finished.wait(timeout: .now() + 2)
        }
    }
}
