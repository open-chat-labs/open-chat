export function isDisplayNameValid(displayName: string): boolean {
    const MIN_DISPLAY_NAME_LENGTH = 3;
    const MAX_DISPLAY_NAME_LENGTH = 25;

    if (
        displayName.length < MIN_DISPLAY_NAME_LENGTH ||
        displayName.length > MAX_DISPLAY_NAME_LENGTH
    ) {
        return false;
    }

    const invalidChars = "@<>/\\#\"'`💎\f\n\r\t\v\u00A0\u2028\u2029";

    for (let i = 0; i < displayName.length; i++) {
        if (invalidChars.includes(displayName[i])) {
            return false;
        }
    }

    if (displayName.startsWith(" ") || displayName.endsWith(" ") || displayName.includes("  ")) {
        return false;
    }

    return true;
}

export function isUsernameValid(displayName: string): boolean {
    const MIN_USERNAME_LENGTH = 5;
    const MAX_USERNAME_LENGTH = 20;

    if (displayName.length < MIN_USERNAME_LENGTH || displayName.length > MAX_USERNAME_LENGTH) {
        return false;
    }

    const validChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";

    for (let i = 0; i < displayName.length; i++) {
        if (!validChars.includes(displayName[i])) {
            return false;
        }
    }

    if (displayName.startsWith("_") || displayName.endsWith("_") || displayName.includes("__")) {
        return false;
    }

    return true;
}
