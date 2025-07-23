<script lang="ts">
    import { type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Button from "../../Button.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import { type AccountLinkingCode } from "openchat-shared";

    const client = getContext<OpenChat>("client");

    type ModalStatus = "closed" | "initialLoad" | "open";
    type CodeStatus = "notRequested" | "success" | "error";

    let modalStatus = $state<ModalStatus>("closed");
    let codeStatus = $state<CodeStatus>("notRequested")
    let loadingCode = $state(false);
    let remaining = $state(undefined);
    let remainingInterval = $state(undefined);
    let accountLinkingCode: AccountLinkingCode | undefined = $state(undefined);

    function showModal() {
        modalStatus = "initialLoad";
        fetchAccountLinkingCode();
    }
    
    function fetchAccountLinkingCode() {
        loadingCode = true;
        client.createAccountLinkingCode()
            .then((res) => {
                // codeStatus = "error";
                codeStatus = "success";
                accountLinkingCode = res;

                // Init remaining
                calculateRemaining();
                // Sets the interval that counts down the code validity!
                remainingInterval = setInterval(calculateRemaining, 1000);
            }).catch((e) => {
                codeStatus = "error";
            }).finally(() => {
                modalStatus = "open";
                loadingCode = false;
            });
    }

    function calculateRemaining() {
        if (accountLinkingCode) {
            remaining = Math.max(0, Math.floor((Number(accountLinkingCode.expiresAt) - Date.now()) / 1000));

            if (!remaining) {
                clearInterval(remainingInterval);
            }
        }
    }

    function formatRemaining() {
        const remainingMin = Math.floor(remaining / 60);
        const remainingSec = remaining % 60;
        const padValue = n => n.toString().padStart(2, '0');
        return `${padValue(remainingMin)}:${padValue(remainingSec)}`;
    }

    function modalClose() {
        modalStatus = "closed";
        codeStatus = "notRequested";
        clearInterval(remainingInterval);
    }
</script>


{#if "open" === modalStatus}
    <Overlay>
        <ModalContent fadeDelay={0} fadeDuration={0} fixedWidth={false}>
            {#snippet header()}
                <div class="header">
                    <div class="title">
                        <Translatable resourceKey={i18nKey("accountLinkingCode.webModal.title")} />
                    </div>
                    {#if "success" === codeStatus}
                        <p class="subtitle">
                            <Translatable resourceKey={i18nKey("accountLinkingCode.webModal.subtitle")} />
                        </p>
                    {/if}
                </div>
            {/snippet}
            {#snippet body()}
                <div class="code-content {!remaining ? 'expired' : ''}">
                    {#if "success" === codeStatus}
                        <div class="code-chars">
                            {#each accountLinkingCode.value as char}
                                <div class="char">{char}</div>
                            {/each}
                        </div>
                        <div class="remaining">
                            {#if !remaining}
                                <Translatable resourceKey={i18nKey("accountLinkingCode.webModal.expired")} />
                            {:else}
                                <Translatable resourceKey={i18nKey("accountLinkingCode.webModal.willExpireIn", { remaining: formatRemaining()})} />
                            {/if}
                        </div>
                    {:else if "error" === codeStatus}
                        <div class="error">
                            <div class="msg">
                                <Translatable resourceKey={i18nKey("accountLinkingCode.webModal.error.msg")} />
                            </div>
                        </div>
                    {/if}
                </div>
            {/snippet}
            {#snippet footer()}
            <div class="footer">
                {#if "success" === codeStatus}
                    <Button onClick={modalClose} fill={true} danger={!remaining}>
                        <Translatable resourceKey={i18nKey("accountLinkingCode.webModal.close")} />
                    </Button>
                {:else if "error" === codeStatus}
                    <Button onClick={fetchAccountLinkingCode} loading={loadingCode}>
                        <Translatable resourceKey={i18nKey("accountLinkingCode.webModal.error.tryAgain")} />
                    </Button>
                    <Button onClick={modalClose} secondary={true}>
                        <Translatable resourceKey={i18nKey("accountLinkingCode.webModal.error.cancel")} />
                    </Button>
                {/if}
            </div>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<div class="account-linking">
    <p class="para">
        <Translatable resourceKey={i18nKey("accountLinkingCode.settingsMenu.disclaimer")} />
    </p>
    <Button onClick={showModal} loading={"initialLoad" === modalStatus}>
        <Translatable resourceKey={i18nKey("accountLinkingCode.settingsMenu.cta")} />
    </Button>
</div>

<style lang="scss">
    :global(.modal-content) {
        width: 32rem;
    }

    .subtitle {
        @include font(book, normal, fs-100);
        padding-top: $sp4;
        padding-bottom: $sp4;
        color: var(--txt-light);
    }

    .header, .footer, .error {
        padding-left: $sp4;
        padding-right: $sp4;
    }

    .account-linking {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .code-content.expired {
        .code-chars .char:after {
            background-color: var(--toast-failure-bg);
        }

        .remaining {
            color: var(--toast-failure-bg);
        }
    }

    .code-chars {
        display: flex;
        gap: $sp4;
        font-size: 3rem;
        justify-content: center;

        .char {
            position: relative;
            display: flex;
            justify-content: center;
            width: 3.5rem;
            padding: $sp4;
            border-radius: 0.5rem;

            &:after {
                content: "";
                display: block;
                position: absolute;
                bottom: 0;
                width: 100%;
                height: 0.5rem;
                background-color: var(--primary);
                border-radius: 0.5rem;
            }
        }
    }

    .remaining {
        display: flex;
        padding: $sp4 0;
        justify-content: center;
        color: var(--warn);
    }

    .error .msg {
        border: 1px solid var(--toast-failure-bg);
        color: var(--toast-failure-bg);
        padding: $sp3 $sp4;
        border-radius: $sp2;
    }

    .footer {
        display: flex;
        gap: $sp3;
        justify-content: end;
    }
</style>
