import ShareCore
import Tauri
import UIKit

// Shares the share extension left in the App Group inbox reach the web layer as the
// `share-target` event Android raises, and its chat picker takes over (#10403). The extension
// opens the app, which then becomes active; a cold start drains on load, and the event waits
// in OCCompanion's queue until the web layer is ready.
enum ShareTarget {
    // One drain at a time, so a share is never read twice
    private static let queue = DispatchQueue(label: "com.oclabs.openchat.share-inbox")

    static func install() {
        NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { _ in deliver() }
        deliver()
    }

    private static func deliver() {
        guard
            let inbox = ShareInbox.shared(),
            let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
        else { return }
        let cache = caches.appendingPathComponent("shared-in", isDirectory: true)
        queue.async {
            let shares = inbox.drain(into: cache)
            guard !shares.isEmpty else { return }
            DispatchQueue.main.async {
                for share in shares {
                    if case let event as JSObject = js(share.event) {
                        OCCompanion.shared.trigger("share-target", event)
                    }
                }
            }
        }
    }

    private static func js(_ value: Any) -> JSValue {
        switch value {
        case let object as [String: Any]: return object.mapValues(js)
        case let array as [Any]: return array.map(js)
        case let value as JSValue: return value
        default: return NSNull()
        }
    }
}
