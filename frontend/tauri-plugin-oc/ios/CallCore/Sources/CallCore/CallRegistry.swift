import Foundation

public let callRingWindowMs: Int64 = 40_000

public struct CallId: Hashable {
    public let chat: String
    public let messageId: String
}

// A ring as the push carries it
public struct IncomingCall: Equatable {
    public enum Chat: Equatable {
        case direct(userId: String)
        case group(groupId: String)
    }

    public let chat: Chat
    public let messageId: String
    public let audioOnly: Bool
    public let started: Int64
    public let declineToken: String?
    public let callerName: String

    public var id: CallId {
        switch chat {
        case .direct(let userId): return CallId(chat: "direct:\(userId)", messageId: messageId)
        case .group(let groupId): return CallId(chat: "group:\(groupId)", messageId: messageId)
        }
    }

    // Nil for a payload that isn't a usable ring. Keys are those of the Android push.
    public init?(payload: [AnyHashable: Any]) {
        func value(_ key: String) -> String? { payload[key] as? String }

        guard let messageId = value("callMessageId"), let started = value("callStarted").flatMap(Int64.init) else {
            return nil
        }
        switch value("type") {
        case "direct":
            guard let userId = value("senderId") else { return nil }
            chat = .direct(userId: userId)
            callerName = value("senderName") ?? "OpenChat"
        case "group":
            guard let groupId = value("groupId") else { return nil }
            chat = .group(groupId: groupId)
            callerName = value("groupName") ?? "OpenChat"
        default:
            return nil
        }
        self.messageId = messageId
        self.started = started
        audioOnly = value("callAudioOnly") == "true"
        declineToken = value("callDeclineToken")
    }
}

// How a report to CallKit should go. iOS insists every VoIP push is reported, so a push that
// mustn't ring is still reported, and ended at once.
public enum RingStart: Equatable {
    case ring(deadline: Int64)
    case reportAndEnd(missed: Bool)
}

public enum RingEnd: Equatable {
    case answeredHere
    case declined
    case timedOut
    case answeredElsewhere
    case callEnded

    public var isMissedCall: Bool { self == .timedOut || self == .callEnded }
}

// The ring rules with no iOS in them, a port of the Android CallRegistry, and the call in progress.
// CallKit, PushKit and the bridge are adapters around it. Called on the main thread only.
public final class CallRegistry {
    private let rememberLimit: Int
    private var ringing: [CallId: IncomingCall] = [:]
    private var finished: [CallId] = []
    // The CallKit call of the native call in progress. The shell holds one call at a time.
    public private(set) var activeCall: UUID?

    public init(rememberLimit: Int = 100) {
        self.rememberLimit = rememberLimit
    }

    public func started(_ call: IncomingCall, now: Int64) -> RingStart {
        if ringing[call.id] != nil || finished.contains(call.id) {
            return .reportAndEnd(missed: false)
        }
        // A start timestamp ahead of this clock rings for the full window
        let deadline = min(call.started, now) + callRingWindowMs
        if deadline <= now {
            remember(call.id)
            return .reportAndEnd(missed: true)
        }
        ringing[call.id] = call
        return .ring(deadline: deadline)
    }

    // Returns how the ring ended, or nil if that call wasn't ringing
    public func end(_ id: CallId, as end: RingEnd) -> RingEnd? {
        guard ringing.removeValue(forKey: id) != nil else { return nil }
        remember(id)
        return end
    }

    // Joined from the chat while it rang here
    public func joinedInApp(messageId: String) -> CallId? {
        guard let id = ringing.keys.first(where: { $0.messageId == messageId }) else { return nil }
        _ = end(id, as: .answeredHere)
        return id
    }

    // A native call is starting under the CallKit call `uuid`. False when one is already in progress.
    public func callStarted(_ uuid: UUID) -> Bool {
        guard activeCall == nil else { return false }
        activeCall = uuid
        return true
    }

    // #10402 invariant A: CallKit ended `uuid`. True when that is the call in progress, which the
    // native call must now leave. Anything else has already ended on the native side.
    public func systemEnded(_ uuid: UUID) -> Bool {
        guard activeCall == uuid else { return false }
        activeCall = nil
        return true
    }

    // #10402 invariant A: the native call for `uuid` finished. True when CallKit still has it as the
    // call in progress and must now be told it ended.
    public func nativeEnded(_ uuid: UUID) -> Bool {
        guard activeCall == uuid else { return false }
        activeCall = nil
        return true
    }

    private func remember(_ id: CallId) {
        finished.append(id)
        if finished.count > rememberLimit {
            finished.removeFirst(finished.count - rememberLimit)
        }
    }
}
