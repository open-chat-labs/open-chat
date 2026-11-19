import AVKit
import CallScreenCore
import Daily
import SwiftUI

// The iOS call screen in the native design (#10529; design notes §3.5, as the Android app's
// `native/features/call/CallScreen.svelte`). Always dark: a top bar with minimise, the call's name
// over its timer and the people count; the stage (CallScreenCore's CallStage); the controls,
// which hide in a video call (CallChrome). The rules a test can check are CallScreenCore's.
struct NativeCallScreen: View {
    @ObservedObject var call: NativeCallController
    @State private var chrome = CallChrome()

    private var others: [NativeCallTile] { call.tiles.filter { !$0.isLocal } }
    private var local: NativeCallTile? { call.tiles.first { $0.isLocal } }
    private var stage: CallStage {
        CallStage.layout(others: others.map(\.id), selfId: local?.id, video: call.settings.video)
    }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { context in
            let shown = chrome.shown(at: context.date)
            VStack(spacing: 0) {
                topBar(now: context.date)
                stageView
                    .contentShape(Rectangle())
                    .onTapGesture { chrome.tapStage(now: Date()) }
                controls
                    .opacity(shown ? 1 : 0)
                    .offset(y: shown ? 0 : 16)
                    .allowsHitTesting(shown)
                    .frame(height: shown ? nil : 0, alignment: .top)
            }
            .animation(.spring(response: 0.3, dampingFraction: 0.9), value: shown)
        }
        .background(CallColors.background.ignoresSafeArea())
        .foregroundColor(.white)
        .preferredColorScheme(.dark)
        .onAppear { chrome.update(video: call.settings.video, now: Date()) }
    }

    // MARK: top bar

    private func topBar(now: Date) -> some View {
        HStack(spacing: 6) {
            Button(action: call.minimise) {
                glyph(.chevronDown, 20)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(Color.white.opacity(0.08)))
            }
            .accessibilityLabel(localized("Minimise call"))

            VStack(spacing: 4) {
                Text(call.settings.title)
                    .font(.system(size: 16, weight: .bold))
                    .lineLimit(1)
                Text(status(now: now))
                    .font(.system(size: 12.5, weight: .medium, design: .monospaced))
                    .foregroundColor(Color.white.opacity(0.65))
                    .frame(minHeight: 13)
            }
            .frame(maxWidth: .infinity)

            HStack(spacing: 6) {
                glyph(.users, 16)
                Text(verbatim: "\(call.tiles.count)").font(.system(size: 13, weight: .semibold))
            }
            .padding(.horizontal, 12)
            .frame(minWidth: 44, minHeight: 44)
            .background(Capsule().fill(Color.white.opacity(0.08)))
        }
        .padding(EdgeInsets(top: 8, leading: 6, bottom: 8, trailing: 8))
    }

    private func status(now: Date) -> String {
        guard let joinedAt = call.joinedAt else { return localized("Joining…") }
        let seconds = max(0, Int(now.timeIntervalSince(joinedAt)))
        let (h, m, s) = (seconds / 3600, seconds / 60 % 60, seconds % 60)
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }

    // MARK: stage

    @ViewBuilder
    private var stageView: some View {
        if call.settings.video {
            GeometryReader { geo in
                ZStack(alignment: .topLeading) {
                    tiles(stage, size: geo.size)
                    if stage.floatSelf, let local {
                        FloatingSelf(area: CGRect(origin: .zero, size: geo.size)) {
                            selfTile(local, small: true)
                        }
                    }
                }
            }
            .padding(EdgeInsets(top: 4, leading: 8, bottom: 8, trailing: 8))
        } else {
            voiceStage.frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func tiles(_ stage: CallStage, size: CGSize) -> some View {
        let people = stage.tiles.compactMap { id in call.tiles.first { $0.id == id } }
        let columns = stage.columns
        let rows = max(1, Int(ceil(Double(people.count) / Double(columns))))
        let gap: CGFloat = 8
        let width = (size.width - gap * CGFloat(columns - 1)) / CGFloat(columns)
        let height = (size.height - gap * CGFloat(rows - 1)) / CGFloat(rows)
        return VStack(spacing: gap) {
            ForEach(0..<rows, id: \.self) { row in
                HStack(spacing: gap) {
                    ForEach(people[(row * columns)..<min(people.count, (row + 1) * columns)]) { person in
                        Group {
                            if person.isLocal { selfTile(person, small: false) } else { tile(person) }
                        }
                        .frame(width: width, height: height)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func tile(_ person: NativeCallTile, mirrored: Bool = false, big: Bool = false) -> some View {
        let speaking = call.activeSpeakerId == person.id && !others.isEmpty
        return ZStack(alignment: .bottomLeading) {
            CallColors.tile
            if let track = person.track {
                NativeCallVideo(track: track).scaleEffect(x: mirrored ? -1 : 1, y: 1)
            } else {
                avatar(person, size: big ? 112 : 64)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            HStack(spacing: 6) {
                glyph(person.micOn ? .mic : .micOff, 12)
                    .foregroundColor(person.micOn ? .white : CallColors.danger)
                Text(person.isLocal ? localized("You") : person.name)
                    .font(.system(size: 12, weight: .semibold))
                    .lineLimit(1)
            }
            .padding(.horizontal, 9)
            .frame(height: 24)
            .background(Capsule().fill(Color.black.opacity(0.55)))
            .padding(8)
        }
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(speaking ? CallColors.online : Color.white.opacity(0.06), lineWidth: speaking ? 2.5 : 1)
        )
    }

    // The user's own tile: mirrored on the front camera, with the flip button
    private func selfTile(_ person: NativeCallTile, small: Bool) -> some View {
        ZStack(alignment: .topTrailing) {
            if small {
                tile(person, mirrored: call.facing == .user)
                .frame(width: 104, height: 140)
                .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.white.opacity(0.18), lineWidth: 1.5))
                .shadow(color: .black.opacity(0.55), radius: 14, y: 10)
                .accessibilityLabel(localized("Your camera. Drag to move"))
            } else {
                tile(person, mirrored: call.facing == .user, big: stage.tiles.count <= 2)
            }
            if call.cameraOn {
                Button(action: call.flipCamera) {
                    glyph(.camera, 16)
                        .frame(width: 32, height: 32)
                        .background(Circle().fill(Color.black.opacity(0.45)))
                }
                .padding(6)
                .accessibilityLabel(localized("Flip camera"))
            }
        }
    }

    private var voiceStage: some View {
        let people = stage.tiles.compactMap { id in call.tiles.first { $0.id == id } }
        let pair = people.count <= 2
        let avatar: CGFloat = pair ? 104 : 72
        let columns = [GridItem(.adaptive(minimum: pair ? 150 : 88), spacing: 22)]
        return LazyVGrid(columns: columns, spacing: 26) {
            ForEach(people) { person in
                VStack(spacing: 10) {
                    ZStack(alignment: .bottomTrailing) {
                        self.avatar(person, size: avatar)
                            .overlay(
                                Circle()
                                    .stroke(CallColors.online, lineWidth: 3)
                                    .padding(-4.5)
                                    .opacity(call.activeSpeakerId == person.id ? 1 : 0)
                            )
                        if !person.micOn {
                            glyph(.micOff, 13)
                                .frame(width: 26, height: 26)
                                .background(Circle().fill(Color(red: 0.165, green: 0.165, blue: 0.2)))
                                .overlay(Circle().stroke(CallColors.background, lineWidth: 3))
                                .offset(x: 2, y: 2)
                        }
                    }
                    Text(person.isLocal ? localized("You") : person.name)
                        .font(.system(size: pair ? 16 : 13, weight: .semibold))
                        .lineLimit(1)
                }
            }
        }
        .frame(maxWidth: 320)
        .padding(.horizontal, 24)
    }

    // MARK: controls

    private var controls: some View {
        HStack(alignment: .top) {
            ForEach(CallControl.controls(video: call.settings.video, broadcastViewer: call.settings.broadcast), id: \.self) {
                control in
                Spacer(minLength: 0)
                controlView(control)
                Spacer(minLength: 0)
            }
        }
        .padding(EdgeInsets(top: 14, leading: 8, bottom: 12, trailing: 8))
    }

    @ViewBuilder
    private func controlView(_ control: CallControl) -> some View {
        switch control {
        case .mic:
            round(call.micOn ? .mic : .micOff, on: !call.micOn,
                  label: call.micOn ? localized("Mute") : localized("Unmute")) { press(call.toggleMic) }
        case .camera:
            round(call.cameraOn ? .video : .videoOff, on: !call.cameraOn,
                  label: call.cameraOn ? localized("Camera off") : localized("Camera on")) { press(call.toggleCamera) }
        case .speaker:
            if SpeakerButton.kind(ports: call.routePorts) == .picker {
                // headphones: the system's output picker, under a button showing the route, as Android's
                let output = CallOutput.of(port: call.routeOutput)
                let (label, icon): (String, OCIcon) = switch output {
                case .headphones: (localized("Headphones"), .headphones)
                case .speaker: (localized("Speaker"), .volume)
                case .phone: (localized("Phone"), .phoneEar)
                }
                labelled(label) {
                    ZStack {
                        circle(on: output == .speaker, icon: icon)
                        RoutePicker().frame(width: 52, height: 52)
                    }
                }
            } else {
                round(.volume, on: call.speakerOn, label: localized("Speaker")) {
                    press(call.toggleSpeaker)
                }
            }
        case .leave:
            labelled(localized("Leave")) {
                Button(action: call.hangUp) {
                    glyph(.phoneOff, 21)
                        .frame(width: 52, height: 52)
                        .background(Circle().fill(CallColors.danger))
                }
                .accessibilityLabel(localized("Leave"))
            }
        }
    }

    private func press(_ action: () -> Void) {
        action()
        chrome.wake(now: Date())
    }

    private func round(_ icon: OCIcon, on: Bool, label: String, action: @escaping () -> Void) -> some View {
        labelled(label) {
            Button(action: action) { circle(on: on, icon: icon) }.accessibilityLabel(label)
        }
    }

    private func circle(on: Bool, icon: OCIcon) -> some View {
        glyph(icon, 21)
            .foregroundColor(on ? Color(red: 0.043, green: 0.043, blue: 0.063) : .white)
            .frame(width: 52, height: 52)
            .background(Circle().fill(on ? Color.white : Color.white.opacity(0.12)))
    }

    private func avatar(_ person: NativeCallTile, size: CGFloat) -> some View {
        Text(String(person.name.prefix(1)).uppercased())
            .font(.system(size: size * 0.36, weight: .bold))
            .foregroundColor(Color(red: 0.055, green: 0.055, blue: 0.07))
            .frame(width: size, height: size)
            .background(Circle().fill(CallColors.gradient(for: person.name)))
    }

    private func labelled<Content: View>(_ label: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(spacing: 6) {
            content()
            Text(label)
                .font(.system(size: 11.5, weight: .medium))
                .foregroundColor(Color.white.opacity(0.75))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(width: 64)
    }
}

// The glyphs the call screen draws, from the v3 icon set (openchat-ui's lib/icons.js) as the web
// and Android call screens. `node src-tauri/scripts/ios-icons.mjs` writes each one's imageset into
// Assets.xcassets; tests/nativeIcons.spec.ts fails when one is missing or differs from icons.js.
enum OCIcon: String {
    case camera = "camera"
    case chevronDown = "chevron-down"
    case headphones = "headphones"
    case mic = "mic"
    case micOff = "mic-off"
    case phoneEar = "phone-ear"
    case phoneOff = "phone-off"
    case users = "users"
    case video = "video"
    case videoOff = "video-off"
    case volume = "volume"
}

// A glyph at the web's size: the 24 unit icon scaled, so its stroke scales with it as on the web
private func glyph(_ icon: OCIcon, _ size: CGFloat) -> some View {
    Image("oc-" + icon.rawValue).renderingMode(.template).resizable().frame(width: size, height: size)
}

// The user's camera over a stage of up to 3: dragged anywhere, it settles on the nearest of six
// spots (CallScreenCore's SelfSpot)
private struct FloatingSelf<Content: View>: View {
    let area: CGRect
    @ViewBuilder let content: () -> Content
    @State private var spot: SelfSpot = .topRight
    @State private var drag: CGSize = .zero

    private static var size: CGSize { CGSize(width: 104, height: 140) }

    var body: some View {
        let frame = spot.frame(of: Self.size, in: area, margin: 12)
        content()
            .offset(x: frame.minX + drag.width, y: frame.minY + drag.height)
            .gesture(
                DragGesture()
                    .onChanged { drag = $0.translation }
                    .onEnded { value in
                        let dropped = CGPoint(
                            x: frame.midX + value.translation.width, y: frame.midY + value.translation.height)
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                            spot = SelfSpot.nearest(to: dropped, in: area)
                            drag = .zero
                        }
                    }
            )
    }
}

// The system's output picker, drawn invisibly over the Speaker button
private struct RoutePicker: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let view = AVRoutePickerView()
        view.tintColor = .clear
        view.activeTintColor = .clear
        view.prioritizesVideoDevices = false
        return view
    }

    func updateUIView(_ view: AVRoutePickerView, context: Context) {}
}

private enum CallColors {
    static let background = Color(red: 0.02, green: 0.02, blue: 0.027)
    static let tile = Color(red: 0.07, green: 0.07, blue: 0.09)
    static let online = Color(red: 0.18, green: 0.9, blue: 0.66)
    static let danger = Color(red: 0.96, green: 0.29, blue: 0.24)

    // An avatar's gradient, picked by name so a person keeps theirs
    private static let swatches: [(Color, Color)] = [
        (Color(red: 0.55, green: 0.86, blue: 1.0), Color(red: 0.35, green: 0.55, blue: 1.0)),
        (Color(red: 1.0, green: 0.78, blue: 0.5), Color(red: 1.0, green: 0.5, blue: 0.45)),
        (Color(red: 0.6, green: 0.95, blue: 0.75), Color(red: 0.25, green: 0.8, blue: 0.6)),
        (Color(red: 0.85, green: 0.7, blue: 1.0), Color(red: 0.6, green: 0.45, blue: 1.0)),
        (Color(red: 1.0, green: 0.7, blue: 0.85), Color(red: 0.95, green: 0.45, blue: 0.65)),
    ]

    static func gradient(for name: String) -> LinearGradient {
        let index = name.unicodeScalars.reduce(0) { ($0 &* 31 &+ Int($1.value)) & 0xffff } % swatches.count
        let (from, to) = swatches[index]
        return LinearGradient(colors: [from, to], startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

// The label in the language chosen in the app, as ShareCore's AppLanguage, which saves its .lproj
// in the App Group. The app target can't import ShareCore, the plugin's.
private func localized(_ key: String) -> String {
    let bundle = UserDefaults(suiteName: "group.com.oclabs.openchat")?.string(forKey: "appLanguage")
        .flatMap { Bundle.main.path(forResource: $0, ofType: "lproj") }
        .flatMap { Bundle(path: $0) }
    return (bundle ?? .main).localizedString(forKey: key, value: nil, table: nil)
}

struct NativeCallVideo: UIViewRepresentable {
    let track: VideoTrack?

    func makeUIView(context: Context) -> VideoView {
        let view = VideoView()
        view.videoScaleMode = .fill
        return view
    }

    func updateUIView(_ view: VideoView, context: Context) {
        view.track = track
    }
}
