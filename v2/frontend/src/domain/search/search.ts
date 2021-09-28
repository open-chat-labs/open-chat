export type GroupMatch = {
    chatId: string;
    name: string;
    description: string;
};

export type GroupSearchResponse = TermInvalid | TermTooLong | TermTooShort | GroupSearchSuccess;

export type TermTooShort = {
    kind: "term_too_short";
};

export type TermTooLong = {
    kind: "term_too_long";
};

export type TermInvalid = {
    kind: "term_invalid";
};

export type GroupSearchSuccess = {
    kind: "success";
    matches: GroupMatch[];
};
