<script lang="ts">
    import NonMessageEvent from "./NonMessageEvent.svelte";
    import type { UserSummary, GroupInviteCodeChange } from "openchat-client";
    import { userStore } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { buildDisplayName } from "../../utils/user";

    interface Props {
        user: UserSummary | undefined;
        change: GroupInviteCodeChange;
        changedBy: string;
        timestamp: bigint;
    }

    let { user, change, changedBy, timestamp }: Props = $props();

    let me = $derived(changedBy === user?.userId);
    let changedByStr = $derived(buildDisplayName($userStore, changedBy, me));
    let changedStr = $derived($_(`invite.${change}`));
    let text = $derived(
        $_("groupInviteChangedBy", {
            values: {
                changedBy: changedByStr,
                changed: changedStr,
            },
        }),
    );
</script>

<NonMessageEvent {text} {timestamp} />
