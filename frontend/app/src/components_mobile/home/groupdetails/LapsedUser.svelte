<script lang="ts">
    import { MenuItem } from "component-lib";
    import type { UserSummary } from "openchat-shared";
    import Cancel from "svelte-material-icons/Cancel.svelte";
    import MinusCircleOutline from "svelte-material-icons/MinusCircleOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import User from "../User.svelte";

    interface Props {
        user: UserSummary;
        searchTerm?: string;
        me?: boolean;
        onBlockUser?: (userId: string) => void;
        onRemoveMember?: (userId: string) => void;
    }

    let { user, searchTerm = "", me = false, onBlockUser, onRemoveMember }: Props = $props();
</script>

<User {me} {user} {searchTerm}>
    {#if onBlockUser || onRemoveMember}
        {#if onBlockUser}
            <MenuItem onclick={() => onBlockUser(user.userId)}>
                {#snippet icon(color, size)}
                    <Cancel {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("blockUser")} />
            </MenuItem>
        {/if}
        {#if onRemoveMember}
            <MenuItem onclick={() => onRemoveMember(user.userId)}>
                {#snippet icon(color, size)}
                    <MinusCircleOutline {size} {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("remove")} />
            </MenuItem>
        {/if}
    {/if}
</User>
