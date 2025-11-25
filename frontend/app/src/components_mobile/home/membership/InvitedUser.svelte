<script lang="ts">
    import { MenuItem } from "component-lib";
    import { iconSize } from "openchat-client";
    import type { UserSummary } from "openchat-shared";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import User from "../User.svelte";

    interface Props {
        user: UserSummary;
        me?: boolean;
        onCancelInvite?: (userId: string) => void;
    }

    let { user, me = false, onCancelInvite }: Props = $props();
</script>

<User {me} {user}>
    {#if onCancelInvite !== undefined}
        <MenuItem onclick={() => onCancelInvite(user.userId)}>
            {#snippet icon()}
                <Cancel size={$iconSize} color={"var(--icon-inverted-txt)"} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cancelInvite")} />
        </MenuItem>
    {/if}
</User>
