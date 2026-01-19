<script lang="ts">
    import { MenuItem } from "component-lib";
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
            {#snippet icon(color, size)}
                <Cancel {size} {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("cancelInvite")} />
        </MenuItem>
    {/if}
</User>
