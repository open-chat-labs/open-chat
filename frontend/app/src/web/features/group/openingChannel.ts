import { chatIdentifiersEqual, type ChannelIdentifier, type ChatIdentifier } from "@client";

/**
 * A channel the community's Manage opened under itself (navigateUnderDialogs), whose Manage it
 * hands off to once it's the open chat; `from`: the chat open when it was picked.
 */
export type OpeningChannel = { channelId: ChannelIdentifier; from: ChatIdentifier | undefined };

/**
 * What the community's Manage does about the channel it's opening, as the open chat changes: hand
 * off once the channel is the open chat (`ready`: its summary is loaded); give up once another
 * chat than the one it was picked from is open instead (a redirect, a failed load …), so that
 * selecting the channel later some other way doesn't hand off; wait otherwise (the navigation
 * hasn't landed yet, or the channel is still loading).
 */
export function openingChannelStep(
    opening: OpeningChannel,
    selected: ChatIdentifier | undefined,
    ready: boolean,
): "hand_off" | "give_up" | "wait" {
    if (ready) return "hand_off";
    if (
        selected !== undefined &&
        !chatIdentifiersEqual(selected, opening.channelId) &&
        (opening.from === undefined || !chatIdentifiersEqual(selected, opening.from))
    ) {
        return "give_up";
    }
    return "wait";
}
