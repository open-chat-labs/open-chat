<script lang="ts">
    import type { Level, OpenChat, UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { buildDisplayName } from "../../utils/user";
    import NonMessageEvent from "./NonMessageEvent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        user: UserSummary | undefined;
        changedBy: string;
        changed: string[];
        timestamp: bigint;
        resourceKey: string;
        level: Level;
    }

    let { user, changedBy, changed, timestamp, resourceKey, level }: Props = $props();

    let me = $derived(changedBy === user?.userId);
    let changedByStr = $derived(
        `**${buildDisplayName(userStore.allUsers, changedBy, me ? "me" : "user")}**`,
    );
    let members = $derived(
        client.getMembersString(
            user!,
            userStore.allUsers,
            changed,
            $_("unknownUser"),
            $_("you"),
            user ? client.compareIsNotYouThenUsername(user.userId) : client.compareUsername,
        ),
    );

    let text = $derived(
        interpolate(
            $_,
            i18nKey(
                resourceKey,
                {
                    changed: members,
                    changedBy: changedByStr,
                },
                level,
                true,
            ),
        ),
    );
</script>

<NonMessageEvent {text} {timestamp} />
