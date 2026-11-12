import AVFoundation
import CallCore
import CallKit
import Foundation
import PushCore
import PushKit
import Tauri
import UIKit
import UserNotifications

// Rings for a call through PushKit and CallKit, and holds the CallKit call for every native call,
// however it started. The rules are in CallCore's CallRegistry; this is the iOS around them.
final class CallRinger: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
    static let shared = CallRinger()

    private static let pollInterval: TimeInterval = 2

    private let provider: CXProvider
    private let callController = CXCallController()
    private let registry = CallRegistry()
    private var pushRegistry: PKPushRegistry?
    private var rings: [UUID: IncomingCall] = [:]
    private var pollers: [UUID: Task<Void, Never>] = [:]
    // What CallKit last showed for the call in progress
    private var shownMuted = false
    private(set) var voipToken: String?

    private override init() {
        let config = CXProviderConfiguration()
        config.supportsVideo = true
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.generic]
        config.includesCallsInRecents = false
        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    func install() {
        guard pushRegistry == nil else { return }
        let registry = PKPushRegistry(queue: .main)
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
        pushRegistry = registry
    }

    // MARK: PushKit

    func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
        guard type == .voIP else { return }
        let token = ApnsEnvironment.tokenString(deviceToken: credentials.token, sandbox: Push.isSandbox)
        guard token != voipToken else { return }
        voipToken = token
        OCCompanion.shared.trigger("apns-token-refresh", ["voipToken": token])
    }

    func pushRegistry(
        _ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType,
        completion: @escaping () -> Void
    ) {
        guard type == .voIP else {
            completion()
            return
        }
        let call = IncomingCall(payload: payload.dictionaryPayload)
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        // #10398 invariant 13: whatever this push is, iOS must see it reported
        let start = call.map { self.registry.started($0, now: now) } ?? .reportAndEnd(missed: false)

        let uuid = UUID()
        let update = Self.noHold()
        update.remoteHandle = CXHandle(type: .generic, value: call?.id.chat ?? "OpenChat")
        update.localizedCallerName = call?.callerName ?? "OpenChat"
        update.hasVideo = !(call?.audioOnly ?? true)
        update.supportsDTMF = false

        if case .ring = start, let call {
            rings[uuid] = call
        }
        provider.reportNewIncomingCall(with: uuid, update: update) { [weak self] error in
            defer { completion() }
            guard let self else { return }
            if let error {
                NSLog("[CallRinger] report failed: %@", "\(error)")
                self.finish(uuid)
                return
            }
            switch start {
            case .ring(let deadline):
                self.watch(uuid, until: deadline, now: now)
            case .reportAndEnd(let missed):
                self.provider.reportCall(with: uuid, endedAt: nil, reason: .remoteEnded)
                if missed, let call { self.postMissedCall(call) }
            }
        }
    }

    // MARK: Ending a ring

    // No VoIP push can cancel a ring, so the bridge is asked until the ring window ends
    private func watch(_ uuid: UUID, until deadline: Int64, now: Int64) {
        let remaining = Double(deadline - now) / 1000
        DispatchQueue.main.asyncAfter(deadline: .now() + remaining) { [weak self] in
            self?.ended(uuid, as: .timedOut, reason: .unanswered)
        }
        guard let bridge = NativeCallBridge.shared.ringBridge, let token = rings[uuid]?.declineToken else { return }
        pollers[uuid] = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(Self.pollInterval * 1_000_000_000))
                guard !Task.isCancelled, let status = try? await bridge.status(token: token) else { continue }
                await MainActor.run {
                    switch status {
                    case .ringing: break
                    case .answered: self?.ended(uuid, as: .answeredElsewhere, reason: .answeredElsewhere)
                    case .ended: self?.ended(uuid, as: .callEnded, reason: .remoteEnded)
                    }
                }
            }
        }
    }

    private func ended(_ uuid: UUID, as end: RingEnd, reason: CXCallEndedReason) {
        guard let call = rings[uuid], registry.end(call.id, as: end) != nil else { return }
        finish(uuid)
        provider.reportCall(with: uuid, endedAt: nil, reason: reason)
        if end.isMissedCall { postMissedCall(call) }
    }

    private func finish(_ uuid: UUID) {
        rings[uuid] = nil
        pollers.removeValue(forKey: uuid)?.cancel()
    }

    private func postMissedCall(_ call: IncomingCall) {
        let content = UNMutableNotificationContent()
        content.title = call.callerName
        // The app's open-chat_iOS/*.lproj
        content.body = NSLocalizedString("Missed call", comment: "")
        content.sound = .default
        switch call.chat {
        case .direct(let userId): content.userInfo = ["type": "direct", "senderId": userId]
        case .group(let groupId): content.userInfo = ["type": "group", "groupId": groupId]
        }
        UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: "\(Push.missedCallPrefix)\(call.messageId)", content: content, trigger: nil))
    }

    // The web layer joined this call from the chat while it was ringing
    func joinedInApp(messageId: String) {
        guard let id = registry.joinedInApp(messageId: messageId),
            let uuid = rings.first(where: { $0.value.id == id })?.key
        else { return }
        finish(uuid)
        provider.reportCall(with: uuid, endedAt: nil, reason: .answeredElsewhere)
    }

    // MARK: The call in progress

    // A call started or joined in the app gets a CallKit call too. Nil when one is already in
    // progress, such as a ring answered here that the web layer is now catching up with.
    func startInAppCall(title: String, video: Bool) -> UUID? {
        let uuid = UUID()
        guard registry.callStarted(uuid) else { return nil }
        shownMuted = false
        let start = CXStartCallAction(call: uuid, handle: CXHandle(type: .generic, value: title))
        start.isVideo = video
        start.contactIdentifier = title
        callController.request(CXTransaction(action: start)) { error in
            if let error { NSLog("[CallRinger] start failed: %@", "\(error)") }
        }
        return uuid
    }

    func inAppCallConnected(_ uuid: UUID) {
        guard registry.activeCall == uuid else { return }
        provider.reportOutgoingCall(with: uuid, connectedAt: nil)
    }

    // #10402 invariant A: the native call for `uuid` has finished, however it ended
    func nativeCallFinished(_ uuid: UUID) {
        guard registry.nativeEnded(uuid) else { return }
        provider.reportCall(with: uuid, endedAt: nil, reason: .remoteEnded)
    }

    // The mic was muted or unmuted in the app, so the system call screen shows the same
    func localMuteChanged(_ muted: Bool) {
        guard let uuid = registry.activeCall, muted != shownMuted else { return }
        shownMuted = muted
        callController.request(CXTransaction(action: CXSetMutedCallAction(call: uuid, muted: muted))) { error in
            if let error { NSLog("[CallRinger] mute failed: %@", "\(error)") }
        }
    }

    // A call can't be held or merged, so a second call coming in offers End & Accept, not Hold &
    // Accept. All three flags are needed: supportsHolding alone doesn't reliably remove Hold.
    private static func noHold() -> CXCallUpdate {
        let update = CXCallUpdate()
        update.supportsHolding = false
        update.supportsGrouping = false
        update.supportsUngrouping = false
        return update
    }

    private static func configureAudioSession() {
        try? AVAudioSession.sharedInstance().setCategory(
            .playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP])
    }

    // MARK: CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        rings.keys.forEach(finish)
        if let uuid = registry.activeCall, registry.systemEnded(uuid) {
            NativeCallBridge.shared.hangUp()
        }
    }

    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        Self.configureAudioSession()
        action.fulfill()
        provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: nil)
        // A call started in the app is first reported here, without the ring's update
        provider.reportCall(with: action.callUUID, updated: Self.noHold())
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let call = rings[action.callUUID], registry.end(call.id, as: .answeredHere) != nil else {
            action.fail()
            return
        }
        finish(action.callUUID)
        // A call already in progress was ended first, with End & Accept
        guard registry.callStarted(action.callUUID) else {
            action.fail()
            return
        }
        shownMuted = false
        Self.configureAudioSession()
        action.fulfill()
        // Again once answered, as big-chat found the ring's flags alone don't always hold
        provider.reportCall(with: action.callUUID, updated: Self.noHold())

        let uuid = action.callUUID
        NativeCallBridge.shared.answer(call, callId: uuid) { [weak self] joined in
            if !joined { self?.nativeCallFinished(uuid) }
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        action.fulfill()
        // #10402 invariant A: ended on the system call screen, so the native call leaves
        if registry.systemEnded(action.callUUID) {
            NativeCallBridge.shared.hangUp()
            return
        }
        guard let call = rings[action.callUUID], registry.end(call.id, as: .declined) != nil else { return }
        finish(action.callUUID)
        decline(call)
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        if action.callUUID == registry.activeCall {
            shownMuted = action.isMuted
            NativeCallBridge.shared.setMuted(action.isMuted)
        }
        action.fulfill()
    }

    // In a background task, so a lock-screen decline isn't suspended mid-request
    private func decline(_ call: IncomingCall) {
        guard let bridge = NativeCallBridge.shared.ringBridge, let token = call.declineToken else { return }
        var background = UIBackgroundTaskIdentifier.invalid
        let finish = {
            if background != .invalid {
                UIApplication.shared.endBackgroundTask(background)
                background = .invalid
            }
        }
        background = UIApplication.shared.beginBackgroundTask(expirationHandler: finish)
        Task {
            try? await bridge.decline(token: token)
            await MainActor.run { finish() }
        }
    }
}
