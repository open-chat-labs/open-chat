<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { CommonButton } from "component-lib";
    import type { UserSummary } from "openchat-shared";
    import Share from "svelte-material-icons/Share.svelte";
    import Translatable from "../../Translatable.svelte";
    import User from "../User.svelte";

    interface Props {
        user: UserSummary;
        searchTerm?: string;
        me?: boolean;
        onInvite?: (userId: string) => void;
    }

    let { user, searchTerm = "", me = false, onInvite }: Props = $props();
</script>

{#snippet action()}
    <CommonButton
        mode={"active"}
        size={"small_text"}
        onClick={onInvite ? () => onInvite(user.userId) : undefined}>
        {#snippet icon(color, size)}
            <Share {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Invite")} />
    </CommonButton>
{/snippet}

<User action={onInvite ? action : undefined} {me} {user} {searchTerm}></User>
