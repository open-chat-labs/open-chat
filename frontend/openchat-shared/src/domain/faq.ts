export const allQuestions = [
    "wallet",
    "buychat",
    "buyicp",
    "send_tokens",
    "diamond",
    "referral_rewards",
    "voting",
    "airdrop",
    "ios_app",
    "android_app",
    "style_messages",
    "storage",
    "security",
    "info",
    "shortcuts",
    "content",
    "translation",
] as const;

type QuestionsType = typeof allQuestions;
export type Questions = QuestionsType[number];
