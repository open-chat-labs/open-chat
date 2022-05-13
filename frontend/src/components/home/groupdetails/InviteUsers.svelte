<script lang="ts">
    import { onMount, getContext } from "svelte";
    import RefreshIcon from "svelte-material-icons/Refresh.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { _ } from "svelte-i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { rollbar } from "../../../utils/logging";
    import { apiKey, ServiceContainer } from "../../../services/serviceContainer";
    import Toggle from "../../Toggle.svelte";
    import type { GroupChatSummary } from "../../../domain/chat/chat";
    import Link from "../../Link.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import AreYouSure from "../../AreYouSure.svelte";
    import * as shareFunctions from "../../../domain/share";
    import { toastStore } from "../../../stores/toast";

    export let group: GroupChatSummary;

    const api = getContext<ServiceContainer>(apiKey);
    const unauthorized = $_("group.permissions.notPermitted", {
        values: { permission: $_("group.permissions.inviteUsers") },
    });

    let ready = false;
    let code: string | undefined = undefined;
    let error: string | undefined = undefined;
    let checked = false;
    let loading = false;
    let confirmReset = false;

    $: link =
        `${window.location.origin}/#/${group.chatId}` + (!group.public ? `/?code=${code}` : "");

    $: spinner = loading && code === undefined;

    onMount(() => {
        if (group.public) {
            ready = true;
            return;
        }

        loading = true;
        api.getInviteCode(group.chatId)
            .then((resp) => {
                if (resp.kind === "success") {
                    ready = true;
                    checked = resp.code !== undefined;
                    code = resp.code;
                } else {
                    error = unauthorized;
                    rollbar.error("Unauthorized response calling getInviteCode");
                }
            })
            .catch((err) => {
                error = $_("group.invite.errorGettingLink");
                rollbar.error("Unable to get invite code: ", err);
            })
            .finally(() => {
                loading = false;
            });
    });

    function toggleLink() {
        if (loading) return;
        loading = true;
        if (checked) {
            api.enableInviteCode(group.chatId)
                .then((resp) => {
                    if (resp.kind === "success") {
                        code = resp.code;
                    } else {
                        error = unauthorized;
                        checked = false;
                        rollbar.error("Unauthorized response calling enableInviteCode");
                    }
                })
                .catch((err) => {
                    checked = false;
                    error = $_("group.invite.errorEnablingLink");
                    rollbar.error("Unable to enable invite code: ", err);
                })
                .finally(() => {
                    loading = false;
                });
        } else {
            api.disableInviteCode(group.chatId)
                .catch((err) => {
                    code = undefined;
                    checked = true;
                    error = $_("group.invite.errorDisablingLink");
                    rollbar.error("Unable to disable invite code: ", err);
                })
                .finally(() => {
                    loading = false;
                });
        }
    }

    function resetLink(): Promise<void> {
        return api
            .resetInviteCode(group.chatId)
            .then((resp) => {
                if (resp.kind === "success") {
                    code = resp.code;
                } else {
                    error = unauthorized;
                    rollbar.error("Unauthorized response calling resetInviteCode");
                }
            })
            .catch((err) => {
                error = $_("group.invite.errorResettingLink");
                rollbar.error("Unable to reset invite code: ", err);
            });
    }

    function onConfirmReset(yes: boolean): Promise<void> {
        const result = yes ? resetLink() : Promise.resolve();

        return result.finally(() => {
            confirmReset = false;
        });
    }

    function onCopy() {
        navigator.clipboard.writeText(link).then(
            () => {
                toastStore.showSuccessToast("group.invite.linkCopiedToClipboard");
            },
            () => {
                toastStore.showFailureToast("group.invite.failedToCopyLinkToClipboard");
            }
        );
    }

    function onShare() {
        shareFunctions.shareLink(link);
    }
</script>

{#if !group.public}
    <div class="toggle-row">
        <Toggle
            id={"enable-invite-link"}
            on:change={toggleLink}
            disabled={loading}
            waiting={loading}
            label={$_("group.invite.enableLink")}
            bind:checked />

        <div class:spinner />
    </div>
{/if}
{#if ready}
    {#if group.public || (code !== undefined && checked)}
        <div class="link-enabled">
            <div class="link">{link}</div>
            <div class="message">
                {$_("group.invite.shareMessage") +
                    (group.public ? "" : $_("group.invite.shareMessageTrust"))}
            </div>
            <div class="action">
                <CopyIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                <Link on:click={onCopy}>
                    {$_("copy")}
                </Link>
            </div>
            {#if shareFunctions.canShare()}
                <div class="action">
                    <ShareIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                    <Link on:click={onShare}>
                        {$_("share")}
                    </Link>
                </div>
            {/if}
            {#if !group.public}
                <div class="action">
                    <RefreshIcon size={$iconSize} color={"var(--icon-txt)"} slot="icon" />
                    <Link
                        on:click={() => {
                            confirmReset = true;
                        }}>
                        {$_("group.invite.resetLink")}
                    </Link>
                </div>
            {/if}
        </div>
    {/if}
{/if}

{#if confirmReset}
    <AreYouSure message={$_("group.invite.confirmReset")} action={onConfirmReset} />
{/if}

{#if error !== undefined}
    <ErrorMessage>{error}</ErrorMessage>
{/if}

<style type="text/scss">
    .toggle-row {
        display: flex;
        justify-content: space-between;

        .spinner {
            top: -12px;
            left: -16px;
            @include loading-spinner(1.5em, 0.5em, false, var(--button-spinner));
        }
    }

    .link,
    .message {
        @include font(book, normal, fs-80);
    }

    .link {
        color: var(--link-underline);
    }

    .link-enabled {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }

    .action {
        display: flex;
        gap: $sp4;
        align-items: center;
    }
</style>
