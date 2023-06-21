<script lang="ts">
    import { onMount, getContext } from "svelte";
    import RefreshIcon from "svelte-material-icons/Refresh.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariant.svelte";
    import QR from "svelte-qr";
    import CopyIcon from "svelte-material-icons/ContentCopy.svelte";
    import { _ } from "svelte-i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Toggle from "../../Toggle.svelte";
    import Link from "../../Link.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import AreYouSure from "../../AreYouSure.svelte";
    import { toastStore } from "../../../stores/toast";
    import type { OpenChat, GroupChatSummary } from "openchat-client";
    import { canShare, shareLink } from "../../../utils/share";
    import Markdown from "../Markdown.svelte";

    export let group: GroupChatSummary;

    const client = getContext<OpenChat>("client");
    const unauthorized = $_("permissions.notPermitted", {
        values: { permission: $_("permissions.inviteUsers") },
    });

    let ready = false;
    let code: string | undefined = undefined;
    let error: string | undefined = undefined;
    let checked = false;
    let loading = false;
    let confirmReset = false;

    $: link =
        `${window.location.origin}/group/${group.chatId}/?ref=${client.user.userId}` +
        (!group.public ? `&code=${code}` : "");

    $: spinner = loading && code === undefined;

    export function init(group: GroupChatSummary) {
        ready = false;
        if (group.public) {
            ready = true;
            return;
        }
        loading = true;
        client
            .getInviteCode(group.chatId)
            .then((resp) => {
                if (resp.kind === "success") {
                    ready = true;
                    checked = resp.code !== undefined;
                    code = resp.code;
                } else {
                    error = unauthorized;
                    client.logMessage("Unauthorized response calling getInviteCode");
                }
            })
            .catch((err) => {
                error = $_("group.invite.errorGettingLink");
                client.logError("Unable to get invite code: ", err);
            })
            .finally(() => {
                loading = false;
            });
    }

    /* we need to call this on mount but also when the chat changes. 
       you would think we could do that in a $: block, but that seems to cause it 
       to run twice on initial mount (grrrr)
    */
    onMount(() => init(group));

    function toggleLink() {
        if (loading) return;
        loading = true;
        if (checked) {
            client
                .enableInviteCode(group.chatId)
                .then((resp) => {
                    if (resp.kind === "success") {
                        code = resp.code;
                    } else {
                        error = unauthorized;
                        checked = false;
                        client.logMessage("Unauthorized response calling enableInviteCode");
                    }
                })
                .catch((err) => {
                    checked = false;
                    error = $_("group.invite.errorEnablingLink");
                    client.logError("Unable to enable invite code: ", err);
                })
                .finally(() => {
                    loading = false;
                });
        } else {
            client
                .disableInviteCode(group.chatId)
                .catch((err) => {
                    code = undefined;
                    checked = true;
                    error = $_("group.invite.errorDisablingLink");
                    client.logError("Unable to disable invite code: ", err);
                })
                .finally(() => {
                    loading = false;
                });
        }
    }

    function resetLink(): Promise<void> {
        return client
            .resetInviteCode(group.chatId)
            .then((resp) => {
                if (resp.kind === "success") {
                    code = resp.code;
                } else {
                    error = unauthorized;
                    client.logMessage("Unauthorized response calling resetInviteCode");
                }
            })
            .catch((err) => {
                error = $_("group.invite.errorResettingLink");
                client.logError("Unable to reset invite code: ", err);
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
                toastStore.showSuccessToast("linkCopiedToClipboard");
            },
            () => {
                toastStore.showFailureToast("failedToCopyLinkToClipboard");
            }
        );
    }

    function onShare() {
        shareLink(link);
    }
</script>

{#if !group.public}
    <div class="toggle-row">
        <Toggle
            id="enable-invite-link"
            small
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
            <div class="qr-wrapper">
                <div class="qr">
                    <QR text={link} />
                </div>
            </div>
            <div class="message">
                <Markdown
                    text={$_("group.invite.shareMessage") +
                        (group.public ? "" : $_("group.invite.shareMessageTrust"))} />
            </div>
            <div class="action">
                <CopyIcon size={$iconSize} color={"var(--icon-txt)"} />
                <Link on:click={onCopy}>
                    {$_("copy")}
                </Link>
            </div>
            {#if canShare()}
                <div class="action">
                    <ShareIcon size={$iconSize} color={"var(--icon-txt)"} />
                    <Link on:click={onShare}>
                        {$_("share")}
                    </Link>
                </div>
            {/if}
            {#if !group.public}
                <div class="action">
                    <RefreshIcon size={$iconSize} color={"var(--icon-txt)"} />
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

<style lang="scss">
    .qr-wrapper {
        border: 1px solid var(--bd);
        .qr {
            background-color: #fff;
            margin: $sp5 auto;
            width: 200px;

            @include mobile() {
                width: 100%;
                margin: 0;
            }
        }
    }
    .toggle-row {
        display: flex;
        justify-content: space-between;

        .spinner {
            top: -12px;
            left: -16px;
            @include loading-spinner(1.5em, 0.5em, var(--button-spinner));
        }
    }

    .link,
    .message {
        @include font(book, normal, fs-80);
    }

    .message {
        color: var(--txt-light);
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
