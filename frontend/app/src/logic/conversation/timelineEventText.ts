import {
    compareIsNotYouThenUsername,
    formatDuration,
    getMembersString,
    roleAsText,
    type AggregateCommonEvents,
    type ChatEvent,
    type Level,
    type MessageFormatter,
    type UserLookup,
} from "@client";

export type EventTextContext = {
    /** The app's translator ($_). */
    formatter: MessageFormatter;
    /** The signed-in user's id: their own changes are "you". */
    me: string;
    users: UserLookup;
    /** A user's name as the timeline shows it, in bold (buildDisplayName). */
    displayName: (userId: string, kind: "user" | "me") => string;
    /** "group" or "channel". */
    level: Level;
    /** Whether the reader can invite users: only they see changes to the invite link. */
    canInvite: boolean;
    /** An installed bot's name (botState.externalBots). */
    botName: (botId: string) => string | undefined;
};

const TEXT_EVENT_KINDS = [
    "group_chat_created",
    "direct_chat_created",
    "members_added",
    "users_invited",
    "members_removed",
    "users_blocked",
    "users_unblocked",
    "name_changed",
    "desc_changed",
    "rules_changed",
    "avatar_changed",
    "gate_updated",
    "external_url_updated",
    "group_visibility_changed",
    "group_invite_code_changed",
    "permissions_changed",
    "events_ttl_updated",
    "chat_frozen",
    "chat_unfrozen",
    "bot_added",
    "bot_removed",
    "bot_updated",
] as const;

/** An event the timeline shows as one line of text. */
export type TextEvent = Extract<ChatEvent, { kind: (typeof TEXT_EVENT_KINDS)[number] }>;

export function isTextEvent(event: ChatEvent): event is TextEvent {
    return (TEXT_EVENT_KINDS as readonly string[]).includes(event.kind);
}

function by(ctx: EventTextContext, userId: string): string {
    return ctx.displayName(userId, userId === ctx.me ? "me" : "user");
}

function members(ctx: EventTextContext, userIds: string[], truncate: boolean): string {
    return getMembersString(
        ctx.me,
        ctx.users,
        userIds,
        ctx.formatter("unknownUser"),
        ctx.formatter("you"),
        compareIsNotYouThenUsername(ctx.me),
        truncate,
    );
}

function levelText(ctx: EventTextContext): string {
    return ctx.formatter(`level.${ctx.level}`).toLowerCase();
}

/**
 * The line an event other than a message shows in the timeline (markdown, names in bold), the
 * same in every tree; none for a change the reader isn't shown (rules left off, a visibility
 * change with nothing in it, an invite link the reader can't share).
 */
export function timelineEventText(event: TextEvent, ctx: EventTextContext): string | undefined {
    const t = ctx.formatter;
    const level = levelText(ctx);
    const membersChanged = (key: string, userIds: string[], changedBy: string) =>
        t(key, {
            values: { changed: members(ctx, userIds, true), changedBy: by(ctx, changedBy), level },
        });
    const groupChanged = (changed: string, changedBy: string) =>
        t("groupChangedBy", { values: { changed, changedBy: by(ctx, changedBy), level } });
    const property = (key: string) => t(key, { values: { level } });
    const bot = (key: string, botId: string, changedBy: string) =>
        t(key, { values: { botname: ctx.botName(botId), username: by(ctx, changedBy) } });

    switch (event.kind) {
        case "group_chat_created":
            return t("groupCreatedBy", { values: { username: by(ctx, event.created_by), level } });
        case "direct_chat_created":
            return t("directChatCreatedAt");
        case "members_added":
            return membersChanged("addedBy", event.userIds, event.addedBy);
        case "users_invited":
            return membersChanged("invitedBy", event.userIds, event.invitedBy);
        case "members_removed":
            return membersChanged("removedBy", event.userIds, event.removedBy);
        case "users_blocked":
            return membersChanged("blockedBy", event.userIds, event.blockedBy);
        case "users_unblocked":
            return membersChanged("unblockedBy", event.userIds, event.unblockedBy);
        case "name_changed":
            return groupChanged(property("groupName"), event.changedBy);
        case "desc_changed":
            return groupChanged(property("groupDesc"), event.changedBy);
        case "avatar_changed":
            return groupChanged(property("groupAvatar"), event.changedBy);
        case "gate_updated":
            return groupChanged(t("access.gate").toLowerCase(), event.updatedBy);
        case "external_url_updated":
            return groupChanged(t("externalContent.name").toLowerCase(), event.updatedBy);
        case "rules_changed": {
            if (!event.enabled && !event.enabledPrev) return undefined;
            const values = { changed: t("groupRules"), changedBy: by(ctx, event.changedBy) };
            return t(
                event.enabled && event.enabledPrev
                    ? "groupChangedBy"
                    : event.enabled
                      ? "groupRulesEnabled"
                      : "groupRulesDisabled",
                { values },
            );
        }
        case "group_visibility_changed":
            if (event.public === undefined && event.messagesVisibleToNonMembers === undefined) {
                return undefined;
            }
            return t("groupVisibilityChangedBy", {
                values: { changedBy: by(ctx, event.changedBy), level },
            });
        case "group_invite_code_changed":
            if (!ctx.canInvite) return undefined;
            return t("groupInviteChangedBy", {
                values: {
                    changedBy: by(ctx, event.changedBy),
                    changed: t(`invite.${event.change}`),
                },
            });
        case "permissions_changed":
            return t("permissionsChangedBy", {
                values: { changedBy: by(ctx, event.changedBy), level },
            });
        case "events_ttl_updated":
            return event.newTimeToLive !== undefined
                ? t("disappearingMessages.timeUpdatedBy", {
                      values: {
                          changedBy: by(ctx, event.updatedBy),
                          duration: formatDuration(Number(event.newTimeToLive)),
                      },
                  })
                : t("disappearingMessages.disabledBy", {
                      values: { changedBy: by(ctx, event.updatedBy) },
                  });
        case "chat_frozen": {
            const frozen = t("chatFrozenBy", { values: { frozenBy: by(ctx, event.frozenBy) } });
            return event.reason ? `${frozen}\n${t("reason")}: ${event.reason}` : frozen;
        }
        case "chat_unfrozen":
            return t("chatUnfrozenBy", { values: { unfrozenBy: by(ctx, event.unfrozenBy) } });
        case "bot_added":
            return bot("bots.events.add", event.userId, event.addedBy);
        case "bot_removed":
            return bot("bots.events.remove", event.userId, event.removedBy);
        case "bot_updated":
            return bot("bots.events.update", event.userId, event.updatedBy);
        default:
            return event satisfies never;
    }
}

export type AggregateEventText = {
    /** Who joined, or how many past ten. */
    joined: string | undefined;
    /** How many messages were deleted; the line expands them (client.expandDeletedMessages). */
    deleted: string | undefined;
    /** A line per role given, per user who gave it. */
    rolesChanged: string[];
};

/** The lines a run of joins, deletions and role changes shows in the timeline, in every tree. */
export function aggregateEventText(
    event: AggregateCommonEvents,
    ctx: EventTextContext,
): AggregateEventText {
    const t = ctx.formatter;
    const level = levelText(ctx);
    const joined = event.usersJoined;
    const deleted = event.messagesDeleted.length;
    return {
        joined:
            joined.size > 10
                ? t("nUsersJoined", { values: { number: joined.size.toString(), level } })
                : joined.size > 0
                  ? t("userJoined", {
                        values: { username: members(ctx, [...joined], false), level },
                    })
                  : undefined,
        deleted:
            deleted === 0
                ? undefined
                : deleted === 1
                  ? t("oneMessageDeleted")
                  : t("nMessagesDeleted", { values: { number: deleted } }),
        rolesChanged: [...event.rolesChanged].flatMap(([changedBy, roles]) =>
            [...roles].map(([role, userIds]) => {
                const ids = [...userIds];
                const mine = ids.length === 1 && ids[0] === ctx.me;
                return t(mine ? "yourRoleChanged" : "roleChanged", {
                    values: {
                        changed: members(ctx, ids, false),
                        changedBy: by(ctx, changedBy),
                        newRole: t(roleAsText(role)),
                    },
                });
            }),
        ),
    };
}
