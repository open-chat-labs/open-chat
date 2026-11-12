import type { PublicProfile, UserBadges } from "@client";
import { senderColor } from "@src/logic/conversation/messageRow";
import { cssImage } from "../profile/profile.adapter";

// UserDialog's props from someone's profile, as the screen has loaded and formatted it.

export type UserDialogInput = {
    // their name where the card was opened (a community display name in a community)
    name: string;
    // whose card it is: their swatch, without a picture of their own
    userId: string;
    profile: PublicProfile;
    // their own picture (profileAvatarUrl); none shows their swatch
    avatarUrl: string | undefined;
    // their profile background, if they've set one
    coverUrl: string | undefined;
    online: boolean;
    // their account is suspended (by a platform moderator)
    suspended: boolean;
    joined: string;
    // their CHIT badges, which userBadges leaves out when the viewer has turned CHIT off
    chit: UserBadges["chit"];
};

export function userDialogProps(input: UserDialogInput) {
    return {
        title: input.name,
        handle: input.profile.username,
        about: input.profile.bio,
        avatar: input.avatarUrl === undefined ? undefined : cssImage(input.avatarUrl),
        color: senderColor(input.userId),
        cover: input.coverUrl === undefined ? "" : cssImage(input.coverUrl),
        online: input.online,
        suspended: input.suspended,
        // the unique-person badge is suspended (userBadges has none)
        verified: false,
        facts: [
            { label: "ui.dmPanel.memberSince", value: input.joined },
            ...(input.chit === undefined
                ? []
                : [
                      {
                          label: "ui.dmPanel.chitEarned",
                          value: input.chit.earned.toLocaleString(),
                          highlight: true,
                      },
                  ]),
        ],
    };
}
