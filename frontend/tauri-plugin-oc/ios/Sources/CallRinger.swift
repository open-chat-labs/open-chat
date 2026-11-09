import AVFoundation
import CallCore
import CallKit
import Foundation
import PushCore
import PushKit
import Tauri
import UIKit
import UserNotifications

// Rings for a call through PushKit and CallKit. The rules are in CallCore's CallRegistry; this is
// the iOS around them.
final class CallRinger: NSObject, PKPushRegistryDelegate, CXProviderDelegate {
    static let shared = CallRinger()

    private static let pollInterval: TimeInterval = 2

    private let provider: CXProvider
    private let registry = CallRegistry()
    private var pushRegistry: PKPushRegistry?
    private var rings: [UUID: IncomingCall] = [:]
    private var pollers: [UUID: Task<Void, Never>] = [:]
    // The ring the user answered, while its call lasts
    private var answered: UUID?
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
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: call?.id.chat ?? "OpenChat")
        update.localizedCallerName = call?.callerName ?? "OpenChat"
        update.hasVideo = !(call?.audioOnly ?? true)
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsHolding = false
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
        content.body = "Missed call"
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

    // The native call this ring became has finished, however it ended
    func nativeCallFinished() {
        guard let uuid = answered else { return }
        answered = nil
        provider.reportCall(with: uuid, endedAt: nil, reason: .remoteEnded)
    }

    // MARK: CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        rings.keys.forEach(finish)
        answered = nil
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard let call = rings[action.callUUID], registry.end(call.id, as: .answeredHere) != nil else {
            action.fail()
            return
        }
        finish(action.callUUID)
        answered = action.callUUID
        try? AVAudioSession.sharedInstance().setCategory(
            .playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP])
        action.fulfill()

        NativeCallBridge.shared.answer(call) { [weak self] joined in
            guard let self else { return }
            if !joined, self.answered == action.callUUID {
                self.nativeCallFinished()
            }
        }
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        action.fulfill()
        if action.callUUID == answered {
            answered = nil
            NativeCallBridge.shared.hangUp()
            return
        }
        guard let call = rings[action.callUUID], registry.end(call.id, as: .declined) != nil else { return }
        finish(action.callUUID)
        decline(call)
    }

    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        NativeCallBridge.shared.setMuted(action.isMuted)
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
