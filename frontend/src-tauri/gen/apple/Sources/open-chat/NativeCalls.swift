import AVFoundation
import Daily
import SwiftUI
import UIKit

// The app's end of a native call (#10445). This lives in the app target because the Daily
// framework is linked here, and is driven by notifications from the plugin's NativeCallBridge.
@MainActor
@objc(OCNativeCalls)
final class NativeCalls: NSObject {
    private static var shared: NativeCalls?
    private var call: NativeCallController?
    private var screen: UIViewController?
    // A join that came while the previous call was still leaving, as with End & Accept
    private var pendingJoin: [AnyHashable: Any]?

    @objc static func start() {
        MainActor.assumeIsolated {
            guard shared == nil else { return }
            let calls = NativeCalls()
            shared = calls
            calls.observe()
        }
    }

    private func observe() {
        let center = NotificationCenter.default
        center.addObserver(forName: .init("ocNativeCallJoin"), object: nil, queue: .main) { note in
            let info = note.userInfo ?? [:]
            nonisolated(unsafe) let args = info
            Task { @MainActor in self.join(args) }
        }
        center.addObserver(forName: .init("ocNativeCallLeave"), object: nil, queue: .main) { _ in
            Task { @MainActor in self.call?.leave() }
        }
        center.addObserver(forName: .init("ocNativeCallHangUp"), object: nil, queue: .main) { _ in
            Task { @MainActor in self.call?.hangUp() }
        }
        center.addObserver(forName: .init("ocNativeCallControl"), object: nil, queue: .main) { note in
            let kind = note.userInfo?["kind"] as? String
            let on = note.userInfo?["on"] as? Bool ?? false
            Task { @MainActor in self.control(kind, on: on) }
        }
        center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            Task { @MainActor in self.call?.applicationBecameActive() }
        }
    }

    private func join(_ info: [AnyHashable: Any]) {
        guard let reply = info["reply"] as? ([String: Any]) -> Void else { return }
        guard let url = (info["url"] as? String).flatMap(URL.init(string:)), let token = info["token"] as? String else {
            reply(["error": "The call's room is invalid"])
            return
        }
        // A ring the shell answered, which the web layer has now caught up with
        if let call, call.settings.url == url {
            call.whenJoined(reply)
            return
        }
        if let call, call.isEnding {
            if let replaced = pendingJoin?["reply"] as? ([String: Any]) -> Void {
                replaced(["error": "Another call was joined"])
            }
            pendingJoin = info
            return
        }
        guard call == nil else {
            reply(["error": "A call is already running"])
            return
        }

        let settings = NativeCallSettings(
            url: url,
            token: token,
            userName: info["userName"] as? String ?? "",
            title: info["title"] as? String ?? "",
            video: info["video"] as? Bool ?? false,
            cameraOn: info["cameraOn"] as? Bool ?? false,
            micOn: info["micOn"] as? Bool ?? true,
            cameraWhenActive: info["cameraWhenActive"] as? Bool ?? false,
            broadcast: info["broadcast"] as? Bool ?? false,
            callId: info["callId"] as? String,
            audioDevice: AudioDeviceType(named: info["audioDevice"] as? String) ?? .earpiece
        )
        let call = NativeCallController(settings: settings) { event in
            NotificationCenter.default.post(name: .init("ocNativeCallEvent"), object: nil, userInfo: event)
        }
        call.onFinished = { [weak self] in self?.finish() }
        call.onMinimise = { [weak self] in self?.minimise() }
        self.call = call
        present(call)
        UIApplication.shared.isIdleTimerDisabled = settings.video

        Task {
            do {
                reply(try await call.join())
            } catch {
                self.finish()
                reply(["error": "\(error)"])
            }
        }
    }

    private func control(_ kind: String?, on: Bool) {
        guard let call else { return }
        switch kind {
        case "mic": call.setMicOn(on)
        case "camera": call.setCameraOn(on)
        case "speaker": call.setSpeakerOn(on)
        case "show": if screen == nil { present(call) }
        default: break
        }
    }

    // Back to the chat. The web layer shows the call as minimised and asks for the screen back.
    private func minimise() {
        guard let screen, let call else { return }
        self.screen = nil
        screen.dismiss(animated: true)
        call.minimised()
    }

    private func present(_ call: NativeCallController) {
        let host = UIHostingController(rootView: NativeCallScreen(call: call))
        host.modalPresentationStyle = .overFullScreen
        host.view.backgroundColor = .black
        screen = host

        let root = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
        var top = root
        while let presented = top?.presentedViewController { top = presented }
        top?.present(host, animated: true)
    }

    private func finish() {
        call = nil
        UIApplication.shared.isIdleTimerDisabled = false
        screen?.dismiss(animated: true)
        screen = nil
        if let next = pendingJoin {
            pendingJoin = nil
            join(next)
        }
    }
}

struct NativeCallSettings {
    let url: URL
    let token: String
    let userName: String
    let title: String
    let video: Bool
    let cameraOn: Bool
    let micOn: Bool
    // A video call answered on a locked phone, where iOS won't give it the camera yet
    let cameraWhenActive: Bool
    let broadcast: Bool
    // The CallKit call, handed back when the call leaves
    let callId: String?
    // Where the audio starts (#10402 invariant B, decided in the plugin)
    let audioDevice: AudioDeviceType
}

extension AudioDeviceType {
    init?(named name: String?) {
        switch name {
        case "earpiece": self = .earpiece
        case "speakerphone": self = .speakerphone
        case "bluetooth": self = .bluetooth
        case "wired": self = .wired
        default: return nil
        }
    }

    // What the system routed the call to, when it's somewhere a call can go
    init?(port: AVAudioSession.Port?) {
        switch port {
        case .builtInSpeaker: self = .speakerphone
        case .builtInReceiver: self = .earpiece
        case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE: self = .bluetooth
        case .headphones, .headsetMic, .usbAudio: self = .wired
        default: return nil
        }
    }
}

struct NativeCallTile: Identifiable {
    let id: String
    let name: String
    let isLocal: Bool
    let track: VideoTrack?
    let micOn: Bool
}

@MainActor
final class NativeCallController: NSObject, ObservableObject, CallClientDelegate {
    let settings: NativeCallSettings
    @Published private(set) var tiles: [NativeCallTile] = []
    @Published private(set) var joined = false
    @Published private(set) var micOn: Bool
    @Published private(set) var cameraOn: Bool
    @Published private(set) var speakerOn: Bool
    @Published private(set) var micDenied = false
    @Published private(set) var cameraDenied = false
    var onFinished: (() -> Void)?
    var onMinimise: (() -> Void)?
    // Leaving, so a new call has to wait for this one to finish
    private(set) var isEnding = false

    private let client = CallClient()
    private let send: ([String: Any]) -> Void
    private var finished = false
    private var joinResult: Result<[String: Any], Error>?
    private var joinWaiters: [([String: Any]) -> Void] = []
    private var cameraWanted: Bool
    private var leaveRequested = false
    private var routeObserver: NSObjectProtocol?
    // The device Daily was last asked for. Daily's own preferredAudioDevice lags while a request is
    // in flight, so a Speaker press made then would be lost.
    private var requestedDevice: AudioDeviceType?

    init(settings: NativeCallSettings, send: @escaping ([String: Any]) -> Void) {
        self.settings = settings
        self.send = send
        micOn = settings.micOn && !settings.broadcast
        cameraOn = settings.cameraOn && !settings.broadcast
        cameraWanted = settings.cameraWhenActive
        speakerOn = settings.audioDevice == .speakerphone
        super.init()
        client.delegate = self
        routeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
        ) { [weak self] note in
            let reason = (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt)
                .flatMap(AVAudioSession.RouteChangeReason.init(rawValue:))
            Task { @MainActor in self?.routeChanged(reason) }
        }
    }


    func join() async throws -> [String: Any] {
        if !settings.broadcast {
            await requestPermissions()
        }
        // Left while waiting for permission: nothing to join or to leave
        guard !leaveRequested else {
            finishIfLeft()
            throw CancellationError()
        }
        var update = ClientSettingsUpdate()
        update.inputs = .set(
            InputSettingsUpdate(
                camera: .set(CameraInputSettingsUpdate(isEnabled: .set(cameraOn))),
                microphone: .set(MicrophoneInputSettingsUpdate(isEnabled: .set(micOn)))
            ))
        _ = try await client.join(url: settings.url, token: MeetingToken(stringValue: settings.token), settings: update)
        joined = true
        guard !leaveRequested else {
            leave()
            return currentState()
        }
        await prefer(settings.audioDevice)
        refreshTiles()
        let state = currentState()
        joinResult = .success(state)
        joinWaiters.forEach { $0(state) }
        joinWaiters = []
        applicationBecameActive()
        return state
    }

    private func currentState() -> [String: Any] {
        ["local": payload(client.participants.local), "present": client.participantCounts.present]
    }

    // The web layer catching up with a call the shell joined on its own
    func whenJoined(_ reply: @escaping ([String: Any]) -> Void) {
        if joined {
            reply(currentState())
        } else {
            joinWaiters.append(reply)
        }
    }

    func applicationBecameActive() {
        guard joined, cameraWanted, UIApplication.shared.applicationState == .active else { return }
        cameraWanted = false
        guard !cameraOn, !cameraDenied else { return }
        toggleCamera()
    }

    func setMicOn(_ on: Bool) {
        guard micOn != on else { return }
        toggleMic()
    }

    func setCameraOn(_ on: Bool) {
        guard settings.video, cameraOn != on else { return }
        toggleCamera()
    }

    func setSpeakerOn(_ on: Bool) {
        guard speakerOn != on else { return }
        toggleSpeaker()
    }

    func minimise() {
        onMinimise?()
    }

    func minimised() {
        send(["kind": "minimised"])
    }

    private func requestPermissions() async {
        if micOn, !(await AVCaptureDevice.requestAccess(for: .audio)) {
            micOn = false
            micDenied = true
        }
        if settings.video, cameraOn || cameraWanted, !(await AVCaptureDevice.requestAccess(for: .video)) {
            cameraOn = false
            cameraDenied = true
        }
    }

    func toggleMic() {
        guard !micDenied else { return openSettings() }
        micOn.toggle()
        client.updateInputs(
            .set(InputSettingsUpdate(microphone: .set(MicrophoneInputSettingsUpdate(isEnabled: .set(micOn))))),
            completion: nil)
    }

    func toggleCamera() {
        guard !cameraDenied else { return openSettings() }
        cameraOn.toggle()
        client.updateInputs(
            .set(InputSettingsUpdate(camera: .set(CameraInputSettingsUpdate(isEnabled: .set(cameraOn))))),
            completion: nil)
    }

    func toggleSpeaker() {
        speakerOn.toggle()
        send(["kind": "route", "speaker": speakerOn])
        let device: AudioDeviceType = speakerOn ? .speakerphone : (headset ?? .earpiece)
        Task { await prefer(device) }
    }

    private func prefer(_ device: AudioDeviceType) async {
        requestedDevice = device
        try? await client.setPreferredAudioDevice(device)
    }

    // A headset still connected, for when the speaker is turned off
    private var headset: AudioDeviceType? {
        let ports = AVAudioSession.sharedInstance().currentRoute.outputs.map(\.portType)
            + (AVAudioSession.sharedInstance().availableInputs ?? []).map(\.portType)
        return ports.compactMap { AudioDeviceType(port: $0) }.first { $0 == .bluetooth || $0 == .wired }
    }

    // The system call screen's Speaker button, or a headset coming or going, moved the audio. The
    // screen follows, and Daily is told so it doesn't move it back. Any reason counts: the Speaker
    // button can arrive as a category change, as Daily reshapes the session around the override.
    // Daily's own moves land on the device it was asked for, so following them changes nothing.
    private func routeChanged(_ reason: AVAudioSession.RouteChangeReason?) {
        let output = AVAudioSession.sharedInstance().currentRoute.outputs.first?.portType
        NSLog("[NativeCall] route %@ reason %d", output?.rawValue ?? "none", Int(reason?.rawValue ?? 0))
        guard joined, let device = AudioDeviceType(port: output) else { return }
        let speaker = device == .speakerphone
        if speakerOn != speaker {
            speakerOn = speaker
            send(["kind": "route", "speaker": speaker])
        }
        if requestedDevice != device {
            NSLog("[NativeCall] following route to %@", "\(device)")
            Task { await prefer(device) }
        }
    }

    // The web layer runs a hang-up, as it knows whether this was the last person there. If it
    // doesn't answer, leave anyway.
    func hangUp() {
        isEnding = true
        send(["kind": "hangup"])
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            leave()
        }
    }

    func leave() {
        isEnding = true
        // Not started yet, so join() has to act on this when it gets there
        if client.callState == .initialized {
            leaveRequested = true
            return
        }
        guard client.callState == .joined || client.callState == .joining else {
            finishIfLeft()
            return
        }
        client.leave(completion: nil)
    }

    private func finishIfLeft() {
        guard !finished else { return }
        finished = true
        joinWaiters.forEach { $0(["error": "The call ended"]) }
        joinWaiters = []
        if let routeObserver {
            NotificationCenter.default.removeObserver(routeObserver)
            self.routeObserver = nil
        }
        var left: [String: Any] = ["kind": "left"]
        if let callId = settings.callId { left["callId"] = callId }
        send(left)
        onFinished?()
    }

    private func openSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }

    private func refreshTiles() {
        let all = client.participants.all.values.sorted { ($0.info.joinedAt ?? .distantPast) < ($1.info.joinedAt ?? .distantPast) }
        tiles = all.filter { $0.info.permissions?.hasPresence ?? true }.map { p in
            NativeCallTile(
                id: "\(p.id)",
                name: p.info.username ?? "",
                isLocal: p.info.isLocal,
                track: p.media?.camera.state == .playable ? p.media?.camera.track : nil,
                micOn: Self.isOn(p.media?.microphone.state)
            )
        }
    }

    private static func isOn(_ state: MediaState?) -> Bool {
        guard let state else { return false }
        if case .off = state { return false }
        return true
    }

    private func payload(_ p: Participant) -> [String: Any] {
        [
            "sessionId": "\(p.id)",
            "userName": p.info.username ?? "",
            "local": p.info.isLocal,
            "owner": p.info.isOwner,
            "audio": Self.isOn(p.media?.microphone.state),
            "video": Self.isOn(p.media?.camera.state),
            "hasPresence": p.info.permissions?.hasPresence ?? true,
        ]
    }

    private func report(_ kind: String, _ participant: Participant) {
        refreshTiles()
        send(["kind": kind, "participant": payload(participant), "present": client.participantCounts.present])
    }

    nonisolated func callClient(_ callClient: CallClient, callStateUpdated state: CallState) {
        Task { @MainActor in
            if state == .left { self.finishIfLeft() }
        }
    }

    nonisolated func callClient(_ callClient: CallClient, error: CallClientError) {
        Task { @MainActor in self.send(["kind": "error", "message": "\(error)"]) }
    }

    nonisolated func callClient(_ callClient: CallClient, participantJoined participant: Participant) {
        Task { @MainActor in self.report("participant-joined", participant) }
    }

    nonisolated func callClient(_ callClient: CallClient, participantUpdated participant: Participant) {
        Task { @MainActor in self.report("participant-updated", participant) }
    }

    nonisolated func callClient(
        _ callClient: CallClient, participantLeft participant: Participant, withReason reason: ParticipantLeftReason
    ) {
        Task { @MainActor in self.report("participant-left", participant) }
    }
}
