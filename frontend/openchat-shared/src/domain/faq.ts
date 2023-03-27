export const allQuestions = [
    "airdrop",
    "voting",
    "wallet",
    "buychat",
    "send_tokens",
    "diamond",
    "ios_app",
    "android_app",
    "find_groups",
    "style_messages",
    "storage",
    "security",
    "roadmap",
    "shortcuts",
] as const;

type QuestionsType = typeof allQuestions;
export type Questions = QuestionsType[number];
