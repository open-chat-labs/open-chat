import type { UserSummary } from "@client";
import { activeVideoCall, type RequestToSpeak } from "@src/stores/video";
import type { CallFace } from "./callPeople";

/** A request to speak as the call views show it: who's asking, by the request's participant. */
export type SpeakRequestCard = CallFace & { id: string };

/** A broadcast host's requests to speak, as every tree's call views show them. */
export function speakRequestCards(
    requests: RequestToSpeak[],
    users: ReadonlyMap<string, UserSummary>,
    face: (userId: string, userName: string) => CallFace,
): SpeakRequestCard[] {
    return requests.map((r) => ({
        id: r.participantId,
        ...face(r.userId, users.get(r.userId)?.username ?? ""),
    }));
}

/** The host lets the one asking speak, or not. */
export function answerSpeakRequest(requests: RequestToSpeak[], id: string, approve: boolean) {
    const request = requests.find((r) => r.participantId === id);
    if (request === undefined) return;
    if (approve) activeVideoCall.approveAccessRequest(request);
    else activeVideoCall.rejectAccessRequest(request);
}
