import { AuthClient, IdbStorage } from "@dfinity/auth-client";
import type { Identity } from "@dfinity/agent";
import { getCachedChats, openCache, setCachedChats } from "openchat-agent";
import type { DirectChatSummary, EventWrapper, GroupChatSummary, Message } from "openchat-shared";

let auth: Promise<AuthClient> | undefined;

function getAuthClient(): Promise<AuthClient> {
    if (auth === undefined) {
        auth = AuthClient.create({
            idleOptions: {
                disableIdle: true,
            },
            storage: new IdbStorage(),
        });
    }
    return auth;
}

function getIdentity(): Promise<Identity | undefined> {
    return getAuthClient().then((a) => {
        const id = a.getIdentity();
        const p = id.getPrincipal();
        if (p.isAnonymous()) {
            return undefined;
        }
        return id;
    });
}

export async function getUnreadCount(
    latest: [string, EventWrapper<Message>],
    overwrite = true
): Promise<number | undefined> {
    try {
        console.debug("BADGE: about to get identity");
        const id = await getIdentity();
        console.debug("BADGE: got identity", id);
        if (id === undefined) return undefined;
        console.debug("BADGE: about to open cache");
        const db = openCache(id.getPrincipal());
        if (db === undefined) return undefined;
        console.debug("BADGE: opened cache");
        const principal = id.getPrincipal();
        const chatState = await getCachedChats(db, principal);
        console.debug("BADGE: got cached chats", chatState);
        if (chatState === undefined) return undefined;
        const allChats = [...chatState.directChats, ...chatState.groupChats];
        const [chatId, latestMessage] = latest;
        const unread = allChats.reduce((count, chat) => {
            if (chat.notificationsMuted) return count; // don't count muted chats
            const latest = chatId === chat.chatId ? latestMessage : chat.latestMessage;
            const latestIdx = latest?.event.messageIndex ?? 0;
            const readUpTo = chat.readByMeUpTo ?? 0;
            return latestIdx > readUpTo ? count + 1 : count;
        }, 0);
        console.debug("BADGE: worked out unread count", unread);
        if (overwrite) {
            await setCachedChats(
                db,
                principal,
                {
                    ...chatState,
                    directChats: allChats.filter(
                        (chat) => chat.kind === "direct_chat"
                    ) as DirectChatSummary[],
                    groupChats: allChats.filter(
                        (chat) => chat.kind === "group_chat"
                    ) as GroupChatSummary[],
                },
                {}
            );
        }
        console.debug("BADGE: set cached chats");
        return unread === 0 ? undefined : unread;
    } catch (err) {
        console.error("BADGE: unable to determine the unread message count", err);
        return undefined;
    }
}
