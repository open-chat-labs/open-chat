<script lang="ts">
    import LinkVariantOff from "svelte-material-icons/LinkVariantOff.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { iconSize } from "../../../stores/iconSize";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import { AuthProvider, type AuthenticationPrincipal, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import AlertBox from "../../AlertBox.svelte";

    const client = getContext<OpenChat>("client");

    // TODO reduce duplication, this is repeated from LinkedAuthAccounts
    type Account = AuthenticationPrincipal & { provider: AuthProvider };

    let { account, onClose }: { account: Account; onClose: () => void } = $props();

    let error: string | undefined = $state();
    let step: "unlink" | "error" | "done" = $state("unlink");
    let inProgress = $state(false);

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
                console.error(e);
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
            <Button secondary disabled={inProgress} on:click={onClose}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </Button>
            <Button disabled={inProgress} loading={inProgress} on:click={() => unlinkAccount()}>
                <Translatable resourceKey={i18nKey("identity.linkedAccounts.unlinkAction")} />
            </Button>
        {:else}
            <Button secondary on:click={onClose}>
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
            @include font-size(fs-80);
            padding-left: $sp7;
            margin-bottom: $sp6;
            margin-top: -0.5rem;
            color: var(--warn);
        }

        .info {
            padding: $sp2 0 $sp4;
        }
    }
</style>
