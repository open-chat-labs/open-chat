import type { PublicProfile, UserBadges } from "@client";
import { ttlDurationId } from "@src/logic/chats/disappearingMessages";
import { senderColor } from "@src/logic/conversation/messageRow";
import { cssImage } from "../profile/profile.adapter";

// DmPanel's props from the other person's profile and the DM's settings, as the screen has loaded
// and formatted them.

export type DmPanelInput = {
    name: string;
    // the other person: their swatch, without a picture of their own
    userId: string;
    profile: PublicProfile;
    // their own picture (profileAvatarUrl); none shows their swatch
    avatarUrl: string | undefined;
    online: boolean;
    joined: string;
    // their CHIT badges, which userBadges leaves out when the viewer has turned CHIT off
    chit: UserBadges["chit"];
    eventsTTL: bigint | undefined;
    muted: boolean;
    favourite: boolean;
    blocked: boolean;
};

export function dmPanelProps(input: DmPanelInput) {
    return {
        title: input.name,
        handle: input.profile.username,
        about: input.profile.bio,
        avatar: input.avatarUrl === undefined ? undefined : cssImage(input.avatarUrl),
        color: senderColor(input.userId),
        online: input.online,
        memberSince: input.joined,
        chit: input.chit?.earned.toLocaleString(),
        fav: input.favourite,
        muted: input.muted ? ("always" as const) : null,
        disappearOn: input.eventsTTL !== undefined,
        disappearAfter: ttlDurationId(input.eventsTTL),
        blocked: input.blocked,
    };
}
