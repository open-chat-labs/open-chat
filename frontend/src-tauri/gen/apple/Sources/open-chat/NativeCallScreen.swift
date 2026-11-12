import Daily
import SwiftUI

struct NativeCallScreen: View {
    @ObservedObject var call: NativeCallController

    private var remote: [NativeCallTile] { call.tiles.filter { !$0.isLocal } }
    private var local: NativeCallTile? { call.tiles.first { $0.isLocal } }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 16) {
                ZStack {
                    Text(call.settings.title)
                        .font(.headline)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .padding(.horizontal, 48)
                    HStack {
                        Button(action: call.minimise) {
                            Image(systemName: "chevron.down")
                                .font(.title3)
                                .foregroundColor(.white)
                                .frame(width: 44, height: 44)
                        }
                        .accessibilityLabel("Minimise")
                        Spacer()
                    }
                }
                .padding(.top, 8)

                if call.settings.video && remote.count <= 1 {
                    tile(remote.first).clipShape(RoundedRectangle(cornerRadius: 16))
                } else {
                    grid
                }

                controls
            }
            .padding(.horizontal, 12)

            if call.settings.video, call.cameraOn, let local {
                NativeCallVideo(track: local.track)
                    .frame(width: 96, height: 144)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.top, 48)
                    .padding(.trailing, 20)
            }
        }
    }

    private var grid: some View {
        let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 2)
        return ScrollView {
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(remote) { participant in
                    tile(participant)
                        .aspectRatio(1, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
        }
        .frame(maxHeight: .infinity)
    }

    @ViewBuilder
    private func tile(_ participant: NativeCallTile?) -> some View {
        ZStack(alignment: .bottomLeading) {
            Color(white: 0.15)
            if let track = participant?.track {
                NativeCallVideo(track: track)
            } else if let participant {
                Text(String(participant.name.prefix(1)).uppercased())
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            if let participant {
                HStack(spacing: 4) {
                    if !participant.micOn {
                        Image(systemName: "mic.slash.fill").font(.caption2)
                    }
                    Text(participant.name).font(.caption).lineLimit(1)
                }
                .foregroundColor(.white)
                .padding(8)
            }
        }
    }

    private var controls: some View {
        HStack(spacing: 20) {
            if !call.settings.broadcast {
                control(call.micOn ? "mic.fill" : "mic.slash.fill", "Microphone", on: call.micOn) { call.toggleMic() }
                if call.settings.video {
                    control(call.cameraOn ? "video.fill" : "video.slash.fill", "Camera", on: call.cameraOn) {
                        call.toggleCamera()
                    }
                }
            }
            control("speaker.wave.2.fill", "Speaker", on: call.speakerOn) { call.toggleSpeaker() }
            Button(action: call.hangUp) {
                Image(systemName: "phone.down.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 60, height: 60)
                    .background(Color.red)
                    .clipShape(Circle())
            }
            .accessibilityLabel("Hang up")
        }
        .padding(.bottom, 16)
    }

    private func control(_ icon: String, _ label: LocalizedStringKey, on: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(on ? .black : .white)
                .frame(width: 60, height: 60)
                .background(on ? Color.white : Color(white: 0.25))
                .clipShape(Circle())
        }
        .accessibilityLabel(label)
    }
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
