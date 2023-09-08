<script lang="ts">
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { CommunitySummary, OpenChat } from "openchat-client";
    import Legend from "../../Legend.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";

    const client = getContext<OpenChat>("client");

    export let community: CommunitySummary;

    let displayName: string | undefined = undefined;
    let displayNameValid = false;
    let displayNameError: string | undefined = undefined;
    let saving = false;

    $: originalDisplayName = community.membership.displayName;
    $: displayNameDirty = displayName !== originalDisplayName;
    $: buttonEnabled = displayNameValid && displayNameDirty && !saving;

    $: {
        displayName = originalDisplayName;
        displayNameError = undefined;
    }

    function saveUser() {
        saving = true;

        client
            .setMemberDisplayName(community.id, displayName)
            .then((resp) => {
                if (resp !== "success") {
                    if (resp === "display_name_too_short") {
                        displayNameError = "register.displayNameTooShort";
                    } else if (resp === "display_name_too_long") {
                        displayNameError = "register.displayNameTooLong";
                    } else if (resp === "display_name_invalid") {
                        displayNameError = "register.displayNameInvalid";
                    } else {
                        displayNameError = "unexpectedError";
                    }
                }
            })
            .catch((err) => {
                toastStore.showFailureToast($_("unableToSaveUserProfile"));
                client.logError("Unable to save display name: ", err);
            })
            .finally(() => {
                saving = false;
            });
    }
</script>

<form on:submit|preventDefault={saveUser}>
    <Legend label={$_("displayName")} rules={$_("commnunityDisplayNameRules")} />
    <DisplayNameInput
        {client}
        {originalDisplayName}
        disabled={false}
        bind:displayName
        bind:displayNameValid>
        {#if displayNameError !== undefined}
            <ErrorMessage>{$_(displayNameError)}</ErrorMessage>
        {/if}
    </DisplayNameInput>
    <div class="full-width-btn">
        <Button loading={saving} disabled={!buttonEnabled} fill small>{$_("update")}</Button>
    </div>
</form>

<style lang="scss">
    .full-width-btn {
        display: flex;
        justify-content: center;
        margin-top: $sp4;
    }
</style>
