import type { PublicProfile } from "@client";
import { cssImage } from "../profile/profile.adapter";

// UserDialog's props from someone's profile, as the screen has loaded and formatted it.

export type UserDialogInput = {
    // their name where the card was opened (a community display name in a community)
    name: string;
    profile: PublicProfile;
    avatarUrl: string;
    // their profile background, if they've set one
    coverUrl: string | undefined;
    online: boolean;
    joined: string;
    // undefined when the viewer has turned CHIT off (userBadges)
    chitEarned: string | undefined;
};

export function userDialogProps(input: UserDialogInput) {
    return {
        title: input.name,
        handle: input.profile.username,
        about: input.profile.bio,
        avatar: cssImage(input.avatarUrl),
        cover: input.coverUrl === undefined ? "" : cssImage(input.coverUrl),
        online: input.online,
        // the unique-person badge is suspended (userBadges has none)
        verified: false,
        facts: [
            { label: "ui.dmPanel.memberSince", value: input.joined },
            ...(input.chitEarned === undefined
                ? []
                : [{ label: "ui.dmPanel.chitEarned", value: input.chitEarned, highlight: true }]),
        ],
    };
}
