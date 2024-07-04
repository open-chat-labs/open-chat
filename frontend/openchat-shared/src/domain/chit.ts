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
