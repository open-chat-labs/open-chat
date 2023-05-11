export const allQuestions = [
    "wallet",
    "buychat",
    "send_tokens",
    "diamond",
    "referral_rewards",
    "voting",
    "airdrop",
    "ios_app",
    "android_app",
    "find_groups",
    "style_messages",
    "storage",
    "security",
    "info",
    "shortcuts",
    "content",
] as const;

type QuestionsType = typeof allQuestions;
export type Questions = QuestionsType[number];
