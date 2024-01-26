export type ParticipantInfo = {
    _id: string;
    name: string;
};

export type TrackItem = {
    track: MediaStreamTrack;
    participantSessionId: string;
    type: "audio" | "video";
};
