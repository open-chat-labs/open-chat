// Where a call's audio goes, without the audio session
public enum CallAudioRoute: Equatable {
    case earpiece
    case speaker
    case headset
}

public enum CallAudioPolicy {
    // A connected headset takes the call. Otherwise a voice call is held to the ear and a video call
    // is watched, so it starts on the speaker.
    public static func initialRoute(video: Bool, headsetConnected: Bool) -> CallAudioRoute {
        if headsetConnected { return .headset }
        return video ? .speaker : .earpiece
    }
}
