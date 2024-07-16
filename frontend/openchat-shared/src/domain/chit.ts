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
    "accepted_swap_offer",
    "appointed_as_group_admin",
    "appointed_as_group_mod",
    "appointed_as_group_owner",
    "appointed_group_admin",
    "appointed_group_mod",
    "appointed_group_owner",
    "changed_theme",
    "deleted_messge",
    "direct_chat_5",
    "direct_chats_10",
    "direct_chats_20",
    "edited_message",
    "enabled_disappearing_messages",
    "favourited_chat",
    "followed_thread",
    "forwarded_message",
    "had_message_tipped",
    "joined_call",
    "joined_community",
    "joined_gated_group_or_community",
    "joined_group",
    "own_group_with_100_diamond_members",
    "own_group_with_10_diamond_members",
    "owned_group_with_1000_diamond_members",
    "owned_group_with_1_diamond_member",
    "pinned_message",
    "proved_unique_personhood",
    "quote_replied",
    "reacted_to_message",
    "received_crypto",
    "received_direct_message",
    "received_reaction",
    "replied_in_thread",
    "sent_audio",
    "sent_crypto",
    "sent_direct_message",
    "sent_file",
    "sent_giphy",
    "sent_image",
    "sent_meme",
    "sent_poll",
    "sent_prize",
    "sent_reminder",
    "sent_swap_offer",
    "sent_text",
    "sent_video",
    "set_avatar",
    "set_bio",
    "set_community_access_gate",
    "set_community_display_name",
    "set_display_name",
    "set_group_access_gate",
    "started_call",
    "streak_14",
    "streak_3",
    "streak_30",
    "streak_7",
    "suggested_translation",
    "swapped_from_wallet",
    "tipped_message",
    "translation_accepted",
    "upgrade_to_gold_diamond",
    "upgraded_to_diamond",
    "voted_on_poll",
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
