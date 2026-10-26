import type { CandidateGroupChat } from "@client";

/** What NewChannelDialog hands back. */
export type NewChannelForm = {
    name: string;
    about: string;
    isPublic: boolean;
    /** An embedded channel shows a web app (its `url`) in place of messages. */
    embedded: boolean;
    url: string;
};

/**
 * The channel to create, from the client's blank one for the community (`createCandidateGroup`)
 * and the dialog's form: its name, description and visibility, and an embedded channel's URL.
 * The rest (permissions, rules, history) stays as the client's defaults, as the old flows left it.
 */
export function newChannelCandidate(
    blank: CandidateGroupChat,
    form: NewChannelForm,
): CandidateGroupChat {
    return {
        ...blank,
        name: form.name.trim(),
        description: form.about.trim(),
        public: form.isPublic,
        externalUrl: form.embedded ? form.url.trim() : undefined,
    };
}
