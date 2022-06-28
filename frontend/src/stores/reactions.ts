import type { LocalReaction, Reaction } from "../domain/chat/chat";

const PRUNE_LOCAL_REACTIONS_INTERVAL = 30 * 1000;

export let localReactions: Record<string, LocalReaction[]> = {};
let pruneInterval: number | undefined = undefined;

export function pruneLocalReactions(): void {
    const limit = Date.now() - 10000;
    localReactions = Object.entries(localReactions).reduce((pruned, [k, v]) => {
        const filtered = v.filter((r) => r.timestamp > limit);
        if (filtered.length > 0) {
            pruned[k] = filtered;
        }
        return pruned;
    }, {} as Record<string, LocalReaction[]>);
}

export function mergeReactions(incoming: Reaction[], localReactions: LocalReaction[]): Reaction[] {
    const merged = localReactions.reduce<Reaction[]>((result, local) => {
        return applyLocalReaction(local, result);
    }, incoming);
    return merged;
}

// todo - this needs tweaking because local reactions may have come via rtc and therefore not might not be mine
function applyLocalReaction(local: LocalReaction, reactions: Reaction[]): Reaction[] {
    const r = reactions.find((r) => r.reaction === local.reaction);
    if (r === undefined) {
        if (local.kind === "add") {
            reactions.push({ reaction: local.reaction, userIds: new Set([local.userId]) });
        }
    } else {
        if (local.kind === "add") {
            r.userIds.add(local.userId);
        } else {
            r.userIds.delete(local.userId);
            if (r.userIds.size === 0) {
                reactions = reactions.filter((r) => r.reaction !== local.reaction);
            }
        }
    }
    return reactions;
}

export function toggleReaction(
    userId: string,
    reactions: Reaction[],
    reaction: string
): Reaction[] {
    const result: Reaction[] = [];
    let found = false;

    reactions.forEach((r) => {
        if (r.reaction === reaction) {
            const userIds = new Set(r.userIds);
            if (userIds.delete(userId)) {
                if (userIds.size > 0) {
                    result.push({
                        ...r,
                        userIds,
                    });
                }
            } else {
                userIds.add(userId);
                result.push({
                    ...r,
                    userIds,
                });
            }
            found = true;
        } else {
            result.push(r);
        }
    });

    if (!found) {
        result.push({ reaction, userIds: new Set([userId]) });
    }

    return result;
}

export function startPruningLocalReactions(): void {
    pruneInterval = window.setInterval(() => {
        pruneLocalReactions();
    }, PRUNE_LOCAL_REACTIONS_INTERVAL);
}
