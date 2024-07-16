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
    "appointed_group_mod",
    "direct_chat_5",
    "changed_theme",
    "appointed_as_group_mod",
    "favourited_chat",
    "appointed_group_admin",
    "received_reaction",
    "voted_on_poll",
    "appointed_as_group_admin",
    "own_group_with_100_diamond_members",
    "set_community_display_name",
    "appointed_group_owner",
    "own_group_with_10_diamond_members",
    "joined_gated_group_or_community",
    "started_call",
    "appointed_as_group_owner",
    "tipped_message",
    "sent_giphy",
    "set_community_access_gate",
    "had_message_tipped",
    "swapped_from_wallet",
    "edited_message",
    "reacted_to_message",
    "accepted_swap_offer",
    "joined_call",
    "sent_image",
    "enabled_disappearing_messages",
    "forwarded_message",
    "sent_prize",
    "followed_thread",
    "sent_reminder",
    "proved_unique_personhood",
    "deleted_messge",
    "sent_text",
    "owned_group_with_1000_diamond_members",
    "sent_swap_offer",
    "quote_replied",
    "owned_group_with_1_diamond_member",
    "sent_crypto",
    "pinned_message",
    "received_crypto",
    "translation_accepted",
    "replied_in_thread",
    "direct_chats_10",
    "direct_chats_20",
    "set_group_access_gate",
    "sent_file",
    "sent_meme",
    "sent_poll",
    "sent_audio",
    "suggested_translation",
    "sent_video",
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
