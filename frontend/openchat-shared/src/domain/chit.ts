import type { ReferralStatus } from "./user";

export type ClaimDailyChitResponse =
    | { kind: "already_claimed"; nextDailyChitClaim: bigint }
    | {
          kind: "success";
          streak: number;
          chitBalance: number;
          chitEarned: number;
          nextDailyChitClaim: bigint;
      };

export type ChitLeaderboardResponse = {
    allTime: ChitUserBalance[];
    lastMonth: ChitUserBalance[];
    thisMonth: ChitUserBalance[];
};

export type ChitUserBalance = {
    userId: string;
    balance: number;
    username: string;
};

export type DailyClaim = {
    kind: "daily_claim";
};

export type MemeContestWinner = {
    kind: "meme_contest_winner";
};

export const achievements = [
    "joined_community",
    "joined_group",
    "sent_text",
    "reacted_to_message",
    "set_bio",
    "set_avatar",
    "sent_direct_message",
    "received_direct_message",
    "edited_message",
    "deleted_message",
    "forwarded_message",
    "tipped_message",
    "sent_image",
    "sent_file",
    "sent_poll",
    "sent_crypto",
    "sent_video",
    "sent_audio",
    "sent_giphy",
    "sent_prize",
    "sent_meme",
    "started_call",
    "joined_call",
    "quote_replied",
    "replied_in_thread",
    "changed_theme",
    "upgraded_to_diamond",
    "set_community_display_name",
    "set_display_name",
    "sent_swap_offer",
    "streak_3",
    "streak_7",
    "streak_14",
    "streak_30",
    "streak_100",
    "streak_365",
    "sent_reminder",
    "proved_unique_personhood",
    "pinned_message",
    "favourited_chat",
    "received_reaction",
    "voted_on_poll",
    "enabled_disappearing_messages",
    "joined_gated_group_or_community",
    "set_pin",
    "set_community_access_gate",
    "had_message_tipped",
    "swapped_from_wallet",
    "accepted_swap_offer",
    "followed_thread",
    "received_crypto",
    "direct_chat_5",
    "direct_chats_10",
    "direct_chats_20",
    "suggested_translation",
    "translation_accepted",
    "set_group_access_gate",
    "appointed_group_mod",
    "appointed_group_admin",
    "appointed_group_owner",
    "appointed_as_group_mod",
    "appointed_as_group_admin",
    "appointed_as_group_owner",
    "upgrade_to_gold_diamond",
    "owned_group_with_1_diamond_member",
    "owned_group_with_10_diamond_members",
    "owned_group_with_100_diamond_members",
    "owned_group_with_1000_diamond_members",
    "referred_1st_user",
    "referred_3rd_user",
    "referred_10th_user",
    "referred_20th_user",
    "referred_50th_user",
] as const;
type AchievementType = typeof achievements;
export type Achievement = AchievementType[number];

export type AchievementUnlocked = {
    kind: "achievement_unlocked";
    type: Achievement;
};

export type ExternalAchievementUnlocked = {
    kind: "external_achievement_unlocked";
    name: string;
};

export type ReferralType = {
    kind: "referral";
    type: ReferralStatus;
};

export type ChitEarnedReason =
    | DailyClaim
    | MemeContestWinner
    | AchievementUnlocked
    | ReferralType
    | ExternalAchievementUnlocked;

export type ChitEarned = {
    amount: number;
    timestamp: bigint;
    reason: ChitEarnedReason;
};

export type ChitEventsResponse = {
    events: ChitEarned[];
    total: number;
};

export type ChitEventsRequest = {
    kind: "getChitEvents";
    from: bigint;
    to: bigint;
    max: number;
    ascending: boolean;
};

export type ExternalAchievementsResponse =
    | ExternalAchievementsSuccess
    | { kind: "success_no_updates" };

export type ExternalAchievementsSuccess = {
    kind: "success";
    achievementsRemoved: ExternalAchievement[];
    lastUpdated: bigint;
    achievementsAdded: ExternalAchievement[];
};

export type ExternalAchievement = {
    id: number;
    url: string;
    name: string;
    chitReward: number;
};
