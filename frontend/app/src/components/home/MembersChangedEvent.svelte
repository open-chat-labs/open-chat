<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { Level, UserSummary } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { buildDisplayName } from "../../utils/user";
    import { i18nKey, interpolate } from "../../i18n/i18n";

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
    let changedByStr = $derived(`**${buildDisplayName($userStore, changedBy, me)}**`);
    let members = $derived(
        client.getMembersString(
            user!,
            $userStore,
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
