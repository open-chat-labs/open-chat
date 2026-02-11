<script lang="ts">
    import { MenuItem } from "component-lib";
    import type { UserSummary } from "openchat-shared";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import User from "../User.svelte";

    interface Props {
        user: UserSummary;
        searchTerm?: string;
        me?: boolean;
        onUnblockUser?: (userId: string) => void;
    }

    let { user, searchTerm = "", me = false, onUnblockUser }: Props = $props();
</script>

<User {me} {user} {searchTerm}>
    {#if onUnblockUser !== undefined}
        <MenuItem onclick={() => onUnblockUser(user.userId)}>
            {#snippet icon(color, size)}
                <Cancel {size} {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("unblockUser")} />
        </MenuItem>
    {/if}
</User>
