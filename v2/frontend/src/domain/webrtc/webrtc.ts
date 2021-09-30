export type WebRtcSessionDetails = WebRtcOffer | WebRtcAnswer;

export type WebRtcOffer = {
    kind: "offer";
    id: string;
    userId: string;
    connectionString: string;
    iceCandidates: string[];
    ageSeconds: number;
};

export type WebRtcAnswer = {
    kind: "answer";
    id: string;
    offerId: string;
    userId: string;
    connectionString: string;
    iceCandidates: string[];
    ageSeconds: number;
};

export type AddWebRtcResponse = "success" | "blocked";
