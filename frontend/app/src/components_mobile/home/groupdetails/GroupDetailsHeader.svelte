<script lang="ts">
    import { MenuItem, SectionHeader } from "component-lib";
    import { publish, type Level } from "openchat-client";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        canEdit: boolean;
        level: Level;
        onEditGroup: () => void;
        onClose: () => void;
    }

    let { canEdit, level, onEditGroup, onClose }: Props = $props();

    function showGroupMembers() {
        publish("showGroupMembers");
    }
    function editGroup() {
        if (canEdit) {
            onEditGroup();
        }
    }
</script>

{#snippet menu()}
    <MenuItem onclick={editGroup}>
        <Translatable resourceKey={i18nKey("Edit details")} />
    </MenuItem>
    <MenuItem onclick={showGroupMembers}>
        <Translatable resourceKey={i18nKey("Members")} />
    </MenuItem>
{/snippet}

<SectionHeader menu={canEdit ? menu : undefined} onBack={onClose} onAction={showGroupMembers}>
    {#snippet action(color)}
        <AccountMultiple {color} />
    {/snippet}
    {#snippet title()}
        <Translatable resourceKey={i18nKey("groupDetails", undefined, level)} />
    {/snippet}
</SectionHeader>
