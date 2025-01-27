<script lang="ts">
    import LinkVariantOff from "svelte-material-icons/LinkVariantOff.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { iconSize } from "../../../stores/iconSize";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import { AuthProvider, type AuthenticationPrincipal, type OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import AlertBox from "../../AlertBox.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let account: AuthenticationPrincipal & { provider: AuthProvider };

    let error: string | undefined;
    let step: "unlink" | "error" | "done" = "unlink";
    let inProgress = false;

    function unlinkAccount() {
        inProgress = true;
        client
            .removeIdentityLink(account.principal)
            .then((res) => {
                inProgress = false;
                switch (res) {
                    case "success":
                        step = "done";
                        break;
                    case "cannot_unlink_active_principal":
                        step = "error";
                        error = "identity.failure.unlinkActivePrincipal";
                        break;
                    case "identity_link_not_found":
                        step = "error";
                        error = "identity.failure.identityNotFound";
                        break;
                    case "user_not_found":
                        step = "error";
                        error = "identity.failure.userNotFound";
                }
            })
            .catch((e) => {
                inProgress = false;
                step = "error";
                error = "identity.failure.unexpectedError";
                console.error("ERR", e);
            });
    }
</script>

<div class="header">
    <LinkVariantOff size={$iconSize} color={"var(--txt)"} />
    <div class="title">
        <Translatable resourceKey={i18nKey("identity.unlinkIdentity")} />
    </div>
</div>

<div class="content">
    {#if step == "unlink"}
        <AlertBox>
            <p class="info">
                <Translatable
                    resourceKey={i18nKey("identity.linkedAccounts.unlinkAdvice", {
                        provider: account.provider,
                    })} />
            </p>
        </AlertBox>
        <p class="unlink-note">
            <Translatable resourceKey={i18nKey("identity.linkedAccounts.unlinkNote")} />
        </p>
    {:else if step == "error"}
        {#if error}
            <p class="info">
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey(error)} />
                </ErrorMessage>
            </p>
        {/if}
    {:else if step == "done"}
        <AlertBox>
            <div class="info">
                <Translatable
                    resourceKey={i18nKey("identity.linkedAccounts.unlinkingDone", {
                        provider: account.provider,
                    })} />
            </div>
        </AlertBox>
    {/if}
</div>

<div class="footer">
    <ButtonGroup>
        {#if step == "unlink"}
            <Button secondary disabled={inProgress} on:click={() => dispatch("close")}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </Button>
            <Button disabled={inProgress} loading={inProgress} on:click={() => unlinkAccount()}>
                <Translatable resourceKey={i18nKey("identity.linkedAccounts.unlinkAction")} />
            </Button>
        {:else}
            <Button secondary on:click={() => dispatch("close")}>
                <Translatable resourceKey={i18nKey("close")} />
            </Button>
        {/if}
    </ButtonGroup>
</div>

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        margin-bottom: $sp4;
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .content {
        .unlink-note {
            padding-left: 3rem;
            margin-bottom: 2rem;
            margin-top: -0.5rem;
            font-size: 14px;
            color: var(--warn);
        }

        .info {
            padding: 0.25rem 0 1rem;
        }
    }
</style>
