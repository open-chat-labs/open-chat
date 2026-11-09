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

class CallConfigArgs: Decodable {
    let videoBridgeUrl: String
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

    private var videoBridgeUrl: String?
    private var teardown: CallTeardown?

    func install() {
        (NSClassFromString("OCNativeCalls") as? NSObject.Type)?.perform(NSSelectorFromString("start"))

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

    func setConfig(videoBridgeUrl: String) {
        self.videoBridgeUrl = videoBridgeUrl
    }

    func setTeardown(_ teardown: CallTeardown) {
        self.teardown = teardown
    }

    func join(_ args: NativeCallJoinArgs, reply: @escaping ([String: Any]) -> Void) {
        NotificationCenter.default.post(
            name: .init("ocNativeCallJoin"), object: nil,
            userInfo: [
                "url": args.url, "token": args.token, "userName": args.userName, "title": args.title,
                "video": args.video, "cameraOn": args.cameraOn, "micOn": args.micOn,
                "broadcast": args.broadcast, "reply": reply,
            ])
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
        if kind == "left" {
            teardown = nil
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
