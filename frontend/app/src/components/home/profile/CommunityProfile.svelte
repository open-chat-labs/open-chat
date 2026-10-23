<script lang="ts">
    import { memberDisplayNameResult, type CommunitySummary, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Legend from "../../Legend.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

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
                const result = memberDisplayNameResult(resp);
                if (result.kind === "rejected") {
                    displayNameError = result.message;
                } else if (result.kind === "failed") {
                    toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
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
