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
    "joined_community",
    "joined_group",
    "streak_14",
    "streak_30",
    "upgraded_to_diamond",
    "received_direct_message",
    "set_display_name",
    "set_bio",
    "streak_3",
    "streak_7",
    "upgrade_to_gold_diamond",
    "sent_direct_message",
    "set_avatar",
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
