export const allQuestions = [
    "ios_app",
    "android_app",
    "find_groups",
    "style_messages",
    "storage",
    "airdrop",
    "security",
    "send_icp",
    "icp_account",
    "roadmap",
    "shortcuts",
] as const;

type QuestionsType = typeof allQuestions;
export type Questions = QuestionsType[number];
