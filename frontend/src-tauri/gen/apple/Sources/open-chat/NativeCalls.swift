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
        center.addObserver(forName: .init("ocNativeCallMute"), object: nil, queue: .main) { note in
            let muted = note.userInfo?["muted"] as? Bool ?? false
            Task { @MainActor in self.call?.setMuted(muted) }
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
            broadcast: info["broadcast"] as? Bool ?? false
        )
        let call = NativeCallController(settings: settings) { event in
            NotificationCenter.default.post(name: .init("ocNativeCallEvent"), object: nil, userInfo: event)
        }
        call.onFinished = { [weak self] in self?.finish() }
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

    private let client = CallClient()
    private let send: ([String: Any]) -> Void
    private var finished = false
    private var joinResult: Result<[String: Any], Error>?
    private var joinWaiters: [([String: Any]) -> Void] = []
    private var cameraWanted: Bool
    private var leaveRequested = false

    init(settings: NativeCallSettings, send: @escaping ([String: Any]) -> Void) {
        self.settings = settings
        self.send = send
        micOn = settings.micOn && !settings.broadcast
        cameraOn = settings.cameraOn && !settings.broadcast
        cameraWanted = settings.cameraWhenActive
        // Voice calls are held to the ear, video calls are watched
        speakerOn = settings.video
        super.init()
        client.delegate = self
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
        try? await client.setPreferredAudioDevice(speakerOn ? .speakerphone : .earpiece)
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

    func setMuted(_ muted: Bool) {
        guard micOn == muted else { return }
        toggleMic()
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
        let device: AudioDeviceType = speakerOn ? .speakerphone : .earpiece
        Task { try? await client.setPreferredAudioDevice(device) }
    }

    // The web layer runs a hang-up, as it knows whether this was the last person there. If it
    // doesn't answer, leave anyway.
    func hangUp() {
        send(["kind": "hangup"])
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            leave()
        }
    }

    func leave() {
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
        send(["kind": "left"])
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
