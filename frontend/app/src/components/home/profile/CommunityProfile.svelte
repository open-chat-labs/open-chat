<script lang="ts">
    import { getContext } from "svelte";
    import type { CommunitySummary, OpenChat } from "openchat-client";
    import { ErrorCode } from "openchat-shared";
    import Legend from "../../Legend.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
    }

    let { community }: Props = $props();

    let displayName: string | undefined = $state(undefined);
    let displayNameValid = $state(false);
    let displayNameError: string | undefined = $state(undefined);
    let saving = $state(false);

    let originalDisplayName = $derived(community.membership.displayName);
    let displayNameDirty = $derived(displayName !== originalDisplayName);
    let buttonEnabled = $derived(displayNameValid && displayNameDirty && !saving);

    $effect(() => {
        displayName = originalDisplayName;
        displayNameError = undefined;
    });

    function saveUser(e: Event) {
        e.preventDefault();
        saving = true;

        client
            .setMemberDisplayName(community.id, displayName)
            .then((resp) => {
                if (resp.kind === "error") {
                    if (resp.code === ErrorCode.DisplayNameTooShort) {
                        displayNameError = "register.displayNameTooShort";
                    } else if (resp.code === ErrorCode.DisplayNameTooLong) {
                        displayNameError = "register.displayNameTooLong";
                    } else if (resp.code === ErrorCode.InvalidDisplayName) {
                        displayNameError = "register.displayNameInvalid";
                    } else {
                        displayNameError = "unexpectedError";
                    }
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
                client.logError("Unable to save display name: ", err);
            })
            .finally(() => {
                saving = false;
            });
    }
</script>

<form class="form" onsubmit={saveUser}>
    <div class="form-fields">
        <Legend label={i18nKey("displayName")} rules={i18nKey("communityDisplayNameRules")} />
        <DisplayNameInput
            {client}
            {originalDisplayName}
            disabled={false}
            bind:displayName
            bind:displayNameValid>
            {#if displayNameError !== undefined}
                <ErrorMessage
                    ><Translatable resourceKey={i18nKey(displayNameError)} /></ErrorMessage>
            {/if}
        </DisplayNameInput>
    </div>
    <div class="cta">
        <Button square fill loading={saving} disabled={!buttonEnabled}
            ><Translatable resourceKey={i18nKey("update")} /></Button>
    </div>
</form>

<style lang="scss">
    .form {
        display: flex;
        flex-direction: column;
        height: 100%;
        justify-content: space-between;
    }

    .form-fields {
        padding: 0 $sp5 $sp3 $sp5;
        @include mobile() {
            padding: 0 $sp4 $sp3 $sp4;
        }
    }
    .cta {
        flex: 0 0 toRem(60);
    }
</style>
