<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { CommonButton } from "component-lib";
    import type { UserSummary } from "openchat-shared";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import User from "../User.svelte";

    interface Props {
        user: UserSummary;
        searchTerm?: string;
        me?: boolean;
        onAdd?: (userId: string) => void;
    }

    let { user, searchTerm = "", me = false, onAdd }: Props = $props();
</script>

{#snippet action()}
    <CommonButton
        mode={"active"}
        size={"small_text"}
        onClick={onAdd ? () => onAdd(user.userId) : undefined}>
        {#snippet icon(color, size)}
            <AccountPlus {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Add")} />
    </CommonButton>
{/snippet}

<User
    profile={false}
    onClick={onAdd ? () => onAdd(user.userId) : undefined}
    action={onAdd ? action : undefined}
    {me}
    {user}
    {searchTerm}></User>
