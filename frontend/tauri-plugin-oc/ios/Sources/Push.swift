import PushCore
import Tauri
import UIKit
import UserNotifications

// APNs message pushes (#10398 M1): the device token, the notification delegate, taps and
// clearing a chat's notifications once it is open.
//
// The foreground policy is the Android shell's: a push that arrives while the app is open goes to
// the web layer as "push-notification", and the web layer asks for it to be shown with
// showNotification unless its chat is on screen. Asked nothing in time, nothing is shown.
final class Push: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Push()

    // How long the web layer has to ask for a foreground notification to be shown
    private static let presentTimeout: TimeInterval = 3
    // How long to wait for APNs to hand over a token
    private static let tokenTimeout: TimeInterval = 15

    private var previousDelegate: UNUserNotificationCenterDelegate?
    private var alertToken: String?
    private var tokenWaiters: [(String?) -> Void] = []
    private var pendingPresentations: [Int: (UNNotificationPresentationOptions) -> Void] = [:]
    private var nextPresentationId = 1
    private var claimedCenter = false
    private var hookedAppDelegate = false

    // Takes over as the notification delegate. tauri-plugin-notification set itself first and only
    // handles local notifications, so those still go to it.
    //
    // Called twice: Tauri sets up plugins before UIApplicationMain, when there is no app delegate
    // yet, so the token callbacks can only be added on the second call, from the plugin's load.
    func install() {
        if !claimedCenter {
            claimedCenter = true
            let center = UNUserNotificationCenter.current()
            previousDelegate = center.delegate
            center.delegate = self
        }
        if !hookedAppDelegate {
            hookedAppDelegate = swizzleAppDelegate()
        }
    }

    // MARK: - Token

    // The alert token as the backend stores it, nil if APNs gives none in time
    func requestAlertToken(_ completion: @escaping (String?) -> Void) {
        DispatchQueue.main.async {
            if let alertToken = self.alertToken {
                completion(alertToken)
                return
            }
            self.tokenWaiters.append(completion)
            UIApplication.shared.registerForRemoteNotifications()
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.tokenTimeout) {
                self.resolveTokenWaiters(nil)
            }
        }
    }

    private func didRegister(deviceToken: Data) {
        let token = ApnsEnvironment.tokenString(deviceToken: deviceToken, sandbox: Self.isSandbox)
        NSLog("[Push] APNs token received")
        DispatchQueue.main.async {
            let refreshed = self.alertToken != nil && self.alertToken != token
            self.alertToken = token
            self.resolveTokenWaiters(token)
            if refreshed {
                OCCompanion.shared.trigger("apns-token-refresh", ["alertToken": token])
            }
        }
    }

    private func resolveTokenWaiters(_ token: String?) {
        let waiters = tokenWaiters
        tokenWaiters.removeAll()
        waiters.forEach { $0(token) }
    }

    private static let isSandbox: Bool = {
        let profile = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision")
            .flatMap { try? Data(contentsOf: $0) }
        return ApnsEnvironment.isSandbox(profile: profile)
    }()

    // Tauri's app delegate is generated and has no hook for the device token, so the callbacks
    // are added to its class at runtime
    private func swizzleAppDelegate() -> Bool {
        guard let delegate = UIApplication.shared.delegate else {
            return false
        }
        let cls: AnyClass = type(of: delegate)
        let registered: @convention(block) (AnyObject, UIApplication, NSData) -> Void = { _, _, token in
            Push.shared.didRegister(deviceToken: token as Data)
        }
        let failed: @convention(block) (AnyObject, UIApplication, NSError) -> Void = { _, _, error in
            NSLog("[Push] failed to register for remote notifications: %@", error.localizedDescription)
            DispatchQueue.main.async { Push.shared.resolveTokenWaiters(nil) }
        }
        let methods: [(Selector, AnyObject)] = [
            (
                #selector(UIApplicationDelegate.application(_:didRegisterForRemoteNotificationsWithDeviceToken:)),
                registered as AnyObject
            ),
            (
                #selector(UIApplicationDelegate.application(_:didFailToRegisterForRemoteNotificationsWithError:)),
                failed as AnyObject
            ),
        ]
        for (selector, block) in methods {
            class_replaceMethod(cls, selector, imp_implementationWithBlock(block), "v@:@@")
        }
        // UIKit notes which callbacks the delegate answers when the delegate is set, so callbacks
        // added after that are never called until it is set again
        let application = UIApplication.shared
        application.delegate = nil
        application.delegate = delegate
        NSLog("[Push] APNs callbacks added to the app delegate")
        return true
    }

    // MARK: - Foreground

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        guard notification.request.trigger is UNPushNotificationTrigger else {
            forwardWillPresent(center, notification, completionHandler)
            return
        }
        guard let push = MessagePush(userInfo: notification.request.content.userInfo) else {
            completionHandler([])
            return
        }

        DispatchQueue.main.async {
            let id = self.nextPresentationId
            self.nextPresentationId += 1
            self.pendingPresentations[id] = completionHandler
            OCCompanion.shared.trigger("push-notification", JSObject.from(push.eventPayload(id: id)))
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.presentTimeout) {
                self.pendingPresentations.removeValue(forKey: id)?([])
            }
        }
    }

    // The web layer found the notification's chat isn't on screen
    func present(id: Int) {
        DispatchQueue.main.async {
            self.pendingPresentations.removeValue(forKey: id)?([.banner, .list, .sound])
        }
    }

    private func forwardWillPresent(
        _ center: UNUserNotificationCenter, _ notification: UNNotification,
        _ completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if let previousDelegate,
            previousDelegate.responds(
                to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:withCompletionHandler:)))
        {
            previousDelegate.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
        } else {
            completionHandler([])
        }
    }

    // MARK: - Taps

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        guard response.notification.request.trigger is UNPushNotificationTrigger else {
            if let previousDelegate,
                previousDelegate.responds(
                    to: #selector(UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:withCompletionHandler:)))
            {
                previousDelegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
            } else {
                completionHandler()
            }
            return
        }

        if response.actionIdentifier == UNNotificationDefaultActionIdentifier,
            let push = MessagePush(userInfo: response.notification.request.content.userInfo)
        {
            let payload = push.eventPayload(id: 0)
            DispatchQueue.main.async {
                // Before the web layer is up, the tap waits for it to ask, as on Android
                if OCCompanion.shared.svelteReady {
                    OCCompanion.shared.trigger("notification-tap", JSObject.from(payload))
                } else if let json = try? JSONSerialization.data(withJSONObject: payload) {
                    OCCompanion.shared.pendingNotificationTap = String(data: json, encoding: .utf8)
                }
            }
        }
        completionHandler()
    }

    // MARK: - Clearing

    // Removes the delivered notifications of the chat the web layer just opened
    func release(_ request: [String: String]) {
        let center = UNUserNotificationCenter.current()
        center.getDeliveredNotifications { notifications in
            let ids = notifications
                .filter { MessagePush(userInfo: $0.request.content.userInfo)?.isReleased(by: request) == true }
                .map { $0.request.identifier }
            center.removeDeliveredNotifications(withIdentifiers: ids)
        }
    }
}

extension JSObject {
    static func from(_ dictionary: [String: Any]) -> JSObject {
        var object = JSObject()
        for (key, value) in dictionary {
            switch value {
            case let value as String: object[key] = value
            case let value as Int: object[key] = value
            case let value as Bool: object[key] = value
            case let value as Double: object[key] = value
            default: break
            }
        }
        return object
    }
}
