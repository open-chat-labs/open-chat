import {
    ErrorCode,
    type PublicProfile,
    type SetBioResponse,
    type SetDisplayNameResponse,
    type SetUsernameResponse,
} from "@shared";

export type ProfileChanges = { username: boolean; displayName: boolean; bio: boolean };

/** Which of the editable profile fields differ from what was loaded */
export function profileChanges(original: PublicProfile, candidate: PublicProfile): ProfileChanges {
    return {
        username: candidate.username !== original.username,
        displayName: candidate.displayName !== original.displayName,
        bio: candidate.bio !== original.bio,
    };
}

/**
 * How saving one profile field went: saved, rejected with the i18n key of a reason the user can fix in the form,
 * or failed for a reason they can't.
 */
export type ProfileFieldResult =
    | { kind: "saved" }
    | { kind: "rejected"; message: string }
    | { kind: "failed" };

const saved: ProfileFieldResult = { kind: "saved" };
const failed: ProfileFieldResult = { kind: "failed" };

function rejected(message: string): ProfileFieldResult {
    return { kind: "rejected", message };
}

export function usernameResult(resp: SetUsernameResponse): ProfileFieldResult {
    if (typeof resp === "object") return failed;
    switch (resp) {
        case "success":
            return saved;
        case "username_taken":
            return rejected("register.usernameTaken");
        case "user_not_found":
            return rejected("register.userNotFound");
        case "username_too_short":
            return rejected("register.usernameTooShort");
        case "username_too_long":
            return rejected("register.usernameTooLong");
        case "username_invalid":
            return rejected("register.usernameInvalid");
        case "offline":
            return failed;
        default:
            return resp satisfies never;
    }
}

export function displayNameResult(resp: SetDisplayNameResponse): ProfileFieldResult {
    if (typeof resp === "object") return failed;
    switch (resp) {
        case "success":
            return saved;
        case "user_not_found":
            return rejected("register.userNotFound");
        case "display_name_too_short":
            return rejected("register.displayNameTooShort");
        case "display_name_too_long":
            return rejected("register.displayNameTooLong");
        case "display_name_invalid":
            return rejected("register.displayNameInvalid");
        case "offline":
            return failed;
        default:
            return resp satisfies never;
    }
}

export function bioResult(resp: SetBioResponse): ProfileFieldResult {
    switch (resp.kind) {
        case "success":
            return saved;
        case "error":
            return resp.code === ErrorCode.TextTooLong ? rejected("register.bioTooLong") : failed;
        case "offline":
            return failed;
        default:
            return resp satisfies never;
    }
}
