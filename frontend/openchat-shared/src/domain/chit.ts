export type ClaimDailyChitResponse =
    | { kind: "already_claimed"; nextDailyChitClaim: bigint }
    | {
          kind: "success";
          streak: number;
          chitBalance: number;
          chitEarned: number;
          nextDailyChitClaim: bigint;
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
    "streak_3",
    "streak_7",
    "streak_14",
    "streak_30",
    "set_bio",
    "set_avatar",
    "joined_group",
    "joined_community",
    "sent_direct_message",
    "received_direct_message",
    "upgraded_to_diamond",
    "set_display_name",
    "upgrade_to_gold_diamond",

    "sent_text", // SUCCEEDED
    "sent_image", // SUCCEEDED
    "sent_file", // SUCCEEDED
    "quote_replied", // SUCCEEDED
    "replied_in_thread", // FAILED
    "sent_poll",
    "sent_crypto",
    "sent_video",
    "sent_audio",
    "sent_giphy",
    "sent_prize",
    "sent_meme",
    "sent_reminder",
    "sent_swap_offer",
    "started_call",
    "edited_message",
    "reacted_to_message",
    "forwarded_message",
    "deleted_message",
    "tipped_message",

    "proved_unique_personhood",
    "set_community_display_name",
    "appointed_group_owner",
    "joined_gated_group_or_community",
    "appointed_as_group_owner",
    "set_community_access_gate",
    "had_message_tipped",
    "swapped_from_wallet",
    "accepted_swap_offer",
    "joined_call",
    "enabled_disappearing_messages",
    "followed_thread",
    "proved_unique_personhood",
    "pinned_message",
    "received_crypto",
    "translation_accepted",
    "set_group_access_gate",
    "suggested_translation",
    "appointed_group_mod",
    "changed_theme",
    "appointed_as_group_mod",
    "favourited_chat",
    "appointed_group_admin",
    "received_reaction",
    "voted_on_poll",
    "appointed_as_group_admin",
    "owned_group_with_1_diamond_member",
    "own_group_with_10_diamond_members",
    "own_group_with_100_diamond_members",
    "owned_group_with_1000_diamond_members",
    "direct_chat_5",
    "direct_chats_10",
    "direct_chats_20",
] as const;
type AchievementType = typeof achievements;
export type Achievement = AchievementType[number];

export type AchievementUnlocked = {
    kind: "achievement_unlocked";
    type: Achievement;
};

export type ChitEarnedReason = DailyClaim | MemeContestWinner | AchievementUnlocked;

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
