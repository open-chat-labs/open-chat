import CoreGraphics
import Foundation

/// The call screen's stage (#10529 invariant 1, as the Android app's `callStage`). Video: up to 3
/// people, the user among them, stack the others in one column with the user's camera floating;
/// 4 or more are all in a 2-column grid, the user too. Voice: everyone as an avatar.
public struct CallStage: Equatable {
    public let tiles: [String]
    public let floatSelf: Bool
    public let columns: Int

    public init(tiles: [String], floatSelf: Bool, columns: Int) {
        self.tiles = tiles
        self.floatSelf = floatSelf
        self.columns = columns
    }

    public static func layout(others: [String], selfId: String?, video: Bool) -> CallStage {
        let everyone = others + (selfId.map { [$0] } ?? [])
        if video, selfId != nil, everyone.count <= 3 {
            return CallStage(tiles: others, floatSelf: true, columns: 1)
        }
        // up to three people stack in one column; a broadcast viewer has no tile of their own
        return CallStage(tiles: everyone, floatSelf: false, columns: video && everyone.count > 3 ? 2 : 1)
    }
}

/// A round control under the call (#10529 invariant 2). A broadcast viewer on iOS only watches
/// and listens: no microphone or camera.
public enum CallControl: String, CaseIterable {
    case mic, camera, speaker, leave

    public static func controls(video: Bool, broadcastViewer: Bool) -> [CallControl] {
        if broadcastViewer { return [.speaker, .leave] }
        return video ? [.mic, .camera, .speaker, .leave] : [.mic, .speaker, .leave]
    }
}

/// Whether the controls show (#10529 invariant 3, as the Android app's `CallChrome`). In a video
/// call they hide `hideAfter` seconds after they last showed or a control was pressed, so the
/// video grows; a tap on the stage hides them at once or brings them back. In a voice call they
/// always show. Time is passed in, so the screen asks with a timeline and tests with dates.
public struct CallChrome {
    public static let hideAfter: TimeInterval = 4

    private var video = false
    private var hiddenAt: Date?

    public init() {}

    public func shown(at now: Date) -> Bool {
        guard video, let hiddenAt else { return true }
        return now < hiddenAt
    }

    /// The call's media; a change shows them and starts the wait again.
    public mutating func update(video: Bool, now: Date) {
        guard video != self.video || hiddenAt == nil else { return }
        self.video = video
        wake(now: now)
    }

    /// A control was used, or the screen opened.
    public mutating func wake(now: Date) {
        hiddenAt = now.addingTimeInterval(Self.hideAfter)
    }

    public mutating func tapStage(now: Date) {
        if video, shown(at: now) {
            hiddenAt = now
        } else {
            wake(now: now)
        }
    }

    /// When they next hide, for the screen to redraw then; none while they always show.
    public func nextChange(after now: Date) -> Date? {
        guard video, let hiddenAt, hiddenAt > now else { return nil }
        return hiddenAt
    }
}

/// The six spots the user's own camera settles on (#10529 invariant 4, as the Android app's
/// `SnapFloat` with `sides`): the corners and the sides' middles, no centre column. The drop
/// point's third of the area picks the row, its half the side.
public enum SelfSpot: CaseIterable {
    case topLeft, topRight, middleLeft, middleRight, bottomLeft, bottomRight

    public static func nearest(to point: CGPoint, in area: CGRect) -> SelfSpot {
        let left = point.x < area.midX
        let third = area.height / 3
        if point.y < area.minY + third { return left ? .topLeft : .topRight }
        if point.y > area.maxY - third { return left ? .bottomLeft : .bottomRight }
        return left ? .middleLeft : .middleRight
    }

    /// The tile's frame at this spot, `margin` inside the area.
    public func frame(of tile: CGSize, in area: CGRect, margin: CGFloat) -> CGRect {
        let left = [.topLeft, .middleLeft, .bottomLeft].contains(self)
        let x = left ? area.minX + margin : area.maxX - margin - tile.width
        let y: CGFloat
        switch self {
        case .topLeft, .topRight: y = area.minY + margin
        case .middleLeft, .middleRight: y = area.midY - tile.height / 2
        case .bottomLeft, .bottomRight: y = area.maxY - margin - tile.height
        }
        return CGRect(origin: CGPoint(x: x, y: y), size: tile)
    }
}

/// What Speaker does (#10529 invariant 5): with headphones connected it opens the system's
/// output picker, else it toggles the loudspeaker. Ports are `AVAudioSession.Port` raw values.
public enum SpeakerButton: Equatable {
    case toggle, picker

    static let headphones: Set<String> = [
        "Headphones", "BluetoothHFP", "BluetoothA2DPOutput", "BluetoothLE", "USBAudio", "CarAudio",
        // a wired headset's mic, still an input after the user sends the call to the speaker
        "MicrophoneWired",
    ]

    public static func kind(ports: [String]) -> SpeakerButton {
        ports.contains(where: headphones.contains) ? .picker : .toggle
    }
}

/// The route the call plays through, which the picker's button shows as Android's output button
/// does (#10529 invariant 5). `port` is the current route's output, an `AVAudioSession.Port` raw value.
public enum CallOutput: Equatable {
    case headphones, speaker, phone

    public static func of(port: String?) -> CallOutput {
        guard let port else { return .phone }
        if SpeakerButton.headphones.contains(port) { return .headphones }
        return port == "Speaker" ? .speaker : .phone
    }
}

/// When the call follows the audio route (#10529 invariant 7). The call screen's Speaker button
/// shows the route, and Daily is told about a route someone else picked so it doesn't move it
/// back. While Daily sets up the audio session the route can flip between the speaker and the
/// earpiece; following each flip asks Daily for it and starts the next one. So a move is followed
/// only once the route has stayed put for `settleAfter` seconds, and then once.
public struct RouteFollower<Route: Equatable> {
    public static var settleAfter: TimeInterval { 0.4 }

    private var pending: (route: Route, at: Date)?

    public init() {}

    public mutating func moved(to route: Route, at now: Date) {
        pending = (route, now)
    }

    /// The route it settled on, once it has stayed put long enough; asked again, nil.
    public mutating func settled(at now: Date) -> Route? {
        guard let pending, now.timeIntervalSince(pending.at) >= Self.settleAfter else { return nil }
        self.pending = nil
        return pending.route
    }
}
