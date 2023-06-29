/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

// this ridiculous thing is used just to stop jest panicking when trying to import svelte-spa-router
export function process() {
    return {
        code: 'module.exports = ""',
    };
}

export function emptyChatMetrics() {
    return {
        audioMessages: 0,
        edits: 0,
        icpMessages: 0,
        giphyMessages: 0,
        deletedMessages: 0,
        reportedMessages: 0,
        fileMessages: 0,
        pollVotes: 0,
        textMessages: 0,
        imageMessages: 0,
        replies: 0,
        videoMessages: 0,
        polls: 0,
        reactions: 0,
    };
}

export function userStatus(now, user) {
    if (user === undefined) return 0;
    const secondsSinceOnline = (now - user.lastOnline) / 1000;
    return secondsSinceOnline < 120 ? 1 : 0;
}

export const UserStatus = {
    Offline: 0,
    Online: 1,
    None: 2,
};

export class MessageContextMap extends Map {
    set(key, value) {
        return super.set(JSON.stringify(key), value);
    }
    get(key) {
        return super.get(JSON.stringify(key));
    }
    has(key) {
        return super.has(JSON.stringify(key));
    }
}

export class ChatMap extends Map {
    set(key, value) {
        return super.set(JSON.stringify(key), value);
    }
    get(key) {
        return super.get(JSON.stringify(key));
    }
    has(key) {
        return super.has(JSON.stringify(key));
    }
}

export class MessageMap extends Map {}

export class CommunityMap extends Map {}

export class ObjectSet extends Set {}
