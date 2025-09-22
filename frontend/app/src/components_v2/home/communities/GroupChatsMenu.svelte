<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { anonUserStore, iconSize, identityStateStore, publish } from "openchat-client";
    import { getContext, tick } from "svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    import { MenuItem } from "component-lib";

    const client = getContext<OpenChat>("client");

    interface Props {
        canMarkAllRead: boolean;
    }

    let { canMarkAllRead }: Props = $props();

    function newGroup() {
        if ($anonUserStore) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "create_group" },
            });
        } else {
            publish("newGroup");
        }
    }
    $effect(() => {
        if (
            $identityStateStore.kind === "logged_in" &&
            $identityStateStore.postLogin?.kind === "create_group"
        ) {
            client.clearPostLoginState();
            tick().then(() => newGroup());
        }
    });
</script>

<MenuItem onclick={newGroup}>
    {#snippet icon()}
        <AccountMultiplePlus size={$iconSize} color={"var(--icon-inverted-txt)"} />
    {/snippet}
    <Translatable resourceKey={i18nKey("newGroup")} />
</MenuItem>
<MenuItem disabled={!canMarkAllRead} onclick={() => client.markAllReadForCurrentScope()}>
    {#snippet icon()}
        <CheckboxMultipleMarked size={$iconSize} color={"var(--icon-inverted-txt)"} />
    {/snippet}
    <Translatable resourceKey={i18nKey("markAllRead")} />
</MenuItem>
