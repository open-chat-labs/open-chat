import CallCore
import SwiftRs
import Tauri
import UIKit
import UserNotifications
import WebKit

// iOS counterpart of the Android OpenChatPlugin + OCPluginCompanion pair.
//
// Anything the Android app delivers to the webview as a plugin event
// ("window-inset-change", "deep-link", "notification-tap", ...) goes through
// OCCompanion.trigger so that events fired before the Svelte app has reported
// ready are queued and flushed later, exactly like the Kotlin implementation.
final class OCCompanion {
    static let shared = OCCompanion()

    // Set by the svelteReady command; read by trigger().
    var svelteReady = false

    // Allows the webview to resize when the keyboard pops up.
    var viewportResizeEnabled = true

    // Deep link URL received during cold start (before the webview was ready).
    // JS pulls this via getPendingDeepLink() once mounted.
    var pendingDeepLinkUrl: String?

    // Notification tap payload received before the webview was ready.
    // JS pulls this via getPendingNotificationTap() once its listener exists.
    var pendingNotificationTap: String?

    weak var plugin: OpenChatPlugin?

    private var eventQueue: [(String, JSObject)] = []

    func trigger(_ event: String, _ payload: JSObject) {
        if svelteReady, let plugin {
            plugin.trigger(event, data: payload)
        } else {
            eventQueue.append((event, payload))
        }
    }

    func flushQueuedEvents() {
        guard svelteReady, let plugin else { return }
        for (event, payload) in eventQueue {
            plugin.trigger(event, data: payload)
        }
        eventQueue.removeAll()
    }
}

class ShowNotificationArgs: Decodable {
    let notificationId: Int?
}

class HapticArgs: Decodable {
    let style: String?
}

class ShareArgs: Decodable {
    let text: String
    let title: String?
}

class ReleaseNotificationsArgs: Decodable {
    let senderId: String?
    let groupId: String?
    let communityId: String?
    let channelId: String?
    let threadIndex: String?
}

class CallRingHandledArgs: Decodable {
    let messageId: String
}

class OpenChatPlugin: Plugin {
    private let passkeyAuth = PasskeyAuth()
    private let recentMedia = RecentMedia()
    private weak var webview: WKWebView?
    private var lastInsetSignature: String?
    private var keyboardHeight: CGFloat = 0
    private var offsetObservation: NSKeyValueObservation?

    @objc public override func load(webview: WKWebView) {
        self.webview = webview
        OCCompanion.shared.plugin = self
        Push.shared.install()
        NativeCallBridge.shared.install()

        hideKeyboardAccessoryBar(webview)

        // The app is a fixed-height shell — every scrollable area is an inner
        // element, the document itself must never scroll. WKWebView disagrees
        // when the keyboard appears: with contentInsetAdjustmentBehavior .never
        // it "reveals" the focused input by scrolling the whole document up by
        // the keyboard height, which double-counts with the frontend's own
        // keyboard accommodation (the input tray). Pin the offset to zero.
        offsetObservation = webview.scrollView.observe(\.contentOffset, options: [.new]) {
            scrollView, _ in
            if scrollView.contentOffset != .zero {
                scrollView.setContentOffset(.zero, animated: false)
            }
        }

        // The webview must be edge-to-edge like the Android app: the frontend
        // applies its own top/bottom padding from the window-inset-change
        // events, so WKWebView's automatic safe-area content inset would
        // double it up (a big blank band under the status bar).
        webview.scrollView.contentInsetAdjustmentBehavior = .never

        // Debug-only console capture: collect console errors/warns, uncaught
        // errors, and failed <img>/resource loads, drain to NSLog so they can
        // be read with:
        //   xcrun simctl spawn booted log stream \
        //     --predicate 'process == "OpenChat" AND eventMessage CONTAINS "DEBUG-web1"'
        #if DEBUG
        let capture = """
            (() => {
              if (window.__ocDbg) return; window.__ocDbg = [];
              const push = (m) => { try { window.__ocDbg.push(String(m).slice(0, 500)); } catch {} };
              const wrap = (name) => { const o = console[name].bind(console);
                console[name] = (...a) => { push(name + ': ' + a.map(x => { try { return typeof x === 'object' ? JSON.stringify(x) : String(x); } catch { return String(x); } }).join(' ')); o(...a); }; };
              wrap('error'); wrap('warn');
              window.addEventListener('error', (e) => {
                if (e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO')) {
                  push('resource-fail ' + e.target.tagName + ' ' + (e.target.currentSrc || e.target.src));
                } else { push('uncaught: ' + e.message); }
              }, true);
              window.addEventListener('unhandledrejection', (e) => push('unhandledrejection: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
            })();
            """
        webview.configuration.userContentController.addUserScript(
            WKUserScript(source: capture, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak webview] _ in
            webview?.evaluateJavaScript(
                "(() => { const l = window.__ocDbg || []; window.__ocDbg = []; return l; })()"
            ) { result, _ in
                if let lines = result as? [String] {
                    for line in lines { NSLog("[DEBUG-web1] %@", line) }
                }
            }
        }
        #endif

        let center = NotificationCenter.default
        center.addObserver(
            self, selector: #selector(keyboardWillChangeFrame(_:)),
            name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        center.addObserver(
            self, selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification, object: nil)
        center.addObserver(
            self, selector: #selector(orientationChanged(_:)),
            name: UIDevice.orientationDidChangeNotification, object: nil)

        // Report the initial insets once the window exists.
        DispatchQueue.main.async { [weak self] in
            self?.emitInsetChange(keyboardVisible: false)
        }
    }

    // WKWebView attaches a Safari-style accessory bar (prev/next arrows + Done)
    // above the keyboard for any focused form field, which looks out of place in
    // a native app (Android shows none). There is no public API to disable it,
    // so use the standard runtime override (same approach as Capacitor/Cordova):
    // re-class the internal WKContentView with a dynamic subclass whose
    // inputAccessoryView returns nil.
    private func hideKeyboardAccessoryBar(_ webview: WKWebView) {
        guard
            let contentView = webview.scrollView.subviews.first(where: {
                String(describing: type(of: $0)).hasPrefix("WKContent")
            }),
            let contentClass = object_getClass(contentView)
        else { return }

        let subclassName = "OC_WKContentView_NoAccessory"
        if let existing = NSClassFromString(subclassName) {
            object_setClass(contentView, existing)
            return
        }

        guard let subclass = objc_allocateClassPair(contentClass, subclassName, 0) else { return }
        let noAccessory: @convention(block) (AnyObject) -> UIView? = { _ in nil }
        class_addMethod(
            subclass,
            NSSelectorFromString("inputAccessoryView"),
            imp_implementationWithBlock(noAccessory),
            "@@:")
        objc_registerClassPair(subclass)
        object_setClass(contentView, subclass)
    }

    // MARK: - Commands

    @objc func openUrl(_ invoke: Invoke) throws {
        try OpenUrl.handle(invoke)
    }

    @objc func signUp(_ invoke: Invoke) throws {
        try passkeyAuth.handleSignUp(invoke)
    }

    @objc func signIn(_ invoke: Invoke) throws {
        try passkeyAuth.handleSignIn(invoke)
    }

    // iOS pushes go through APNs, not FCM, so there is never an FCM token
    @objc func getFcmToken(_ invoke: Invoke) {
        invoke.resolve(["fcmToken": NSNull()])
    }

    // The APNs alert token, prefixed for the sandbox by a development build. Null if APNs gives
    // none, e.g. without a network connection.
    @objc func getApnsDevice(_ invoke: Invoke) {
        Push.shared.requestAlertToken { token in
            invoke.resolve([
                "alertToken": token ?? NSNull(),
                "voipToken": CallRinger.shared.voipToken ?? NSNull(),
            ])
        }
    }

    @objc func nativeCallJoin(_ invoke: Invoke) {
        guard let args = try? invoke.parseArgs(NativeCallJoinArgs.self) else {
            invoke.reject("Invalid native call arguments")
            return
        }
        NativeCallBridge.shared.join(args) { result in
            if let error = result["error"] as? String {
                invoke.reject(error)
            } else {
                invoke.resolve(NativeCallBridge.flatten(result))
            }
        }
    }

    @objc func getPendingCallAction(_ invoke: Invoke) {
        invoke.resolve(["payload": NativeCallBridge.shared.takePendingAction() ?? NSNull()])
    }

    @objc func callRingHandled(_ invoke: Invoke) {
        if let args = try? invoke.parseArgs(CallRingHandledArgs.self) {
            CallRinger.shared.joinedInApp(messageId: args.messageId)
        }
        invoke.resolve()
    }

    @objc func nativeCallLeave(_ invoke: Invoke) {
        NativeCallBridge.shared.leave()
        invoke.resolve()
    }

    @objc func setCallConfig(_ invoke: Invoke) {
        if let args = try? invoke.parseArgs(CallConfigArgs.self) {
            NativeCallBridge.shared.setConfig(videoBridgeUrl: args.videoBridgeUrl, username: args.username)
        }
        invoke.resolve()
    }

    @objc func setCallEndToken(_ invoke: Invoke) {
        if let args = try? invoke.parseArgs(CallEndTokenArgs.self) {
            NativeCallBridge.shared.setTeardown(
                CallTeardown(token: args.token, kind: args.kind, sessionId: args.sessionId))
        }
        invoke.resolve()
    }

    // The web layer found a foreground push's chat isn't on screen, so it is shown
    @objc func showNotification(_ invoke: Invoke) {
        if let id = (try? invoke.parseArgs(ShowNotificationArgs.self))?.notificationId {
            Push.shared.present(id: id)
        }
        invoke.resolve()
    }

    @objc func svelteReady(_ invoke: Invoke) {
        OCCompanion.shared.svelteReady = true
        OCCompanion.shared.flushQueuedEvents()
        invoke.resolve()
    }

    // A chat was opened, so its delivered notifications go
    @objc func releaseNotifications(_ invoke: Invoke) {
        if let args = try? invoke.parseArgs(ReleaseNotificationsArgs.self) {
            let request = [
                "senderId": args.senderId, "groupId": args.groupId, "communityId": args.communityId,
                "channelId": args.channelId, "threadIndex": args.threadIndex,
            ].compactMapValues { $0 }
            Push.shared.release(request)
        }
        invoke.resolve()
    }

    @objc func clearAllNotifications(_ invoke: Invoke) {
        let center = UNUserNotificationCenter.current()
        center.removeAllDeliveredNotifications()
        center.removeAllPendingNotificationRequests()
        invoke.resolve()
    }

    @objc func deleteFcmToken(_ invoke: Invoke) {
        invoke.resolve()
    }

    // A haptic where the native design asks for one: UIKit's light impact
    // (a tab tap) by default, its medium one for `style: "medium"` (a
    // message's long-press menu opening).
    @objc func haptic(_ invoke: Invoke) {
        let style = (try? invoke.parseArgs(HapticArgs.self))?.style
        let impact: UIImpactFeedbackGenerator.FeedbackStyle = style == "medium" ? .medium : .light
        DispatchQueue.main.async {
            UIImpactFeedbackGenerator(style: impact).impactOccurred()
        }
        invoke.resolve()
    }

    // The system share sheet for a link or some text. Resolves once it's up;
    // what the user picks there isn't reported.
    @objc func share(_ invoke: Invoke) throws {
        let args = try invoke.parseArgs(ShareArgs.self)
        DispatchQueue.main.async {
            guard let presenter = self.manager.viewController else {
                invoke.reject("No view to share from")
                return
            }
            let sheet = UIActivityViewController(activityItems: [args.text], applicationActivities: nil)
            // an iPad shows it as a popover, which needs somewhere to point
            if let popover = sheet.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.maxY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            presenter.present(sheet, animated: true)
            invoke.resolve()
        }
    }

    // Programmatic backgrounding is forbidden on iOS; the closest honest
    // behaviour is a no-op.
    @objc func minimizeApp(_ invoke: Invoke) {
        invoke.resolve()
    }

    // iOS cannot relaunch itself. Exiting at least guarantees the next launch
    // is fresh (used after an OTA update download). Review before store
    // submission — see IOS_PORT_STATUS.md.
    @objc func loadRecentMedia(_ invoke: Invoke) throws {
        try recentMedia.handleLoad(invoke)
    }

    @objc func exportMedia(_ invoke: Invoke) throws {
        try recentMedia.handleExport(invoke)
    }

    @objc func enableViewportResize(_ invoke: Invoke) {
        OCCompanion.shared.viewportResizeEnabled = true
        DispatchQueue.main.async { [weak self] in self?.applyWebviewFrame() }
        invoke.resolve()
    }

    @objc func disableViewportResize(_ invoke: Invoke) {
        OCCompanion.shared.viewportResizeEnabled = false
        DispatchQueue.main.async { [weak self] in self?.applyWebviewFrame() }
        invoke.resolve()
    }

    // Android dynamic shortcuts have no iOS equivalent (yet). The response
    // shape must match the rust UpdateChatShortcutsResponse model.
    @objc func updateChatShortcuts(_ invoke: Invoke) {
        invoke.resolve(["count": 0])
    }

    @objc func getPendingDeepLink(_ invoke: Invoke) {
        if let url = OCCompanion.shared.pendingDeepLinkUrl {
            OCCompanion.shared.pendingDeepLinkUrl = nil
            invoke.resolve(["url": url])
        } else {
            invoke.resolve()
        }
    }

    @objc func getPendingNotificationTap(_ invoke: Invoke) {
        if let payload = OCCompanion.shared.pendingNotificationTap {
            OCCompanion.shared.pendingNotificationTap = nil
            invoke.resolve(["payload": payload])
        } else {
            invoke.resolve()
        }
    }

    // MARK: - Keyboard / insets
    //
    // Mirrors MainActivity.handleWindowInsets on Android: emits
    // "window-inset-change" events the frontend keyboard store consumes, and —
    // when viewport resize is enabled — shrinks the webview so the page lays
    // out above the keyboard (the Android adjustResize behaviour). Note that
    // iOS "dp" == points, so no density conversion is needed.

    @objc private func keyboardWillChangeFrame(_ notification: Notification) {
        guard let window = webview?.window,
            let endFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey]
                as? CGRect
        else { return }

        // Frame in the window's coordinate space; a frame at/below the bottom
        // edge means the keyboard is (being) dismissed.
        let converted = window.convert(endFrame, from: nil)
        let overlap = max(0, window.bounds.height - converted.origin.y)
        keyboardHeight = overlap
        applyWebviewFrame()
        emitInsetChange(keyboardVisible: overlap > 0)
    }

    @objc private func keyboardWillHide(_ notification: Notification) {
        keyboardHeight = 0
        applyWebviewFrame()
        emitInsetChange(keyboardVisible: false)
    }

    @objc private func orientationChanged(_ notification: Notification) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.applyWebviewFrame()
            self.emitInsetChange(keyboardVisible: self.keyboardHeight > 0)
        }
    }

    private func applyWebviewFrame() {
        guard let webview, let window = webview.window else { return }
        var frame = window.bounds
        if OCCompanion.shared.viewportResizeEnabled && keyboardHeight > 0 {
            frame.size.height -= keyboardHeight
        }
        if webview.frame != frame {
            webview.frame = frame
        }
    }

    private func emitInsetChange(keyboardVisible: Bool) {
        guard let window = webview?.window ?? UIApplication.shared.windows.first else { return }
        let safeArea = window.safeAreaInsets

        // Home-indicator devices behave like Android gesture navigation: the
        // frontend supplies its own bottom padding.
        let isGestureNavigation = safeArea.bottom > 0
        let os = ProcessInfo.processInfo.operatingSystemVersion

        let signature =
            "\(keyboardVisible)|\(isGestureNavigation)|\(keyboardHeight)|\(safeArea.bottom)|\(safeArea.top)"
        if signature == lastInsetSignature { return }
        lastInsetSignature = signature

        let payload: JSObject = [
            "isKeyboardOpen": keyboardVisible,
            "isGestureNavigation": isGestureNavigation,
            "navHeightDp": Double(safeArea.bottom),
            "statusBarHeightDp": Double(safeArea.top),
            "keyboardHeightDp": Double(keyboardHeight),
            "apiLevel": os.majorVersion,
            "osVersion": "\(os.majorVersion).\(os.minorVersion).\(os.patchVersion)",
        ]
        OCCompanion.shared.trigger("window-inset-change", payload)
    }
}

@_cdecl("init_plugin_oc")
func initPluginOc() -> Plugin {
    // As early as possible, so a tap that launched the app reaches the delegate
    Push.shared.install()
    return OpenChatPlugin()
}
