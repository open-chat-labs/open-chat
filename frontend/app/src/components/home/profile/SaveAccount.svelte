<script lang="ts">
    import type { NamedAccount, OpenChat } from "openchat-client";
    import Input from "../../Input.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Legend from "../../Legend.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    interface Props {
        account: string;
        accounts: NamedAccount[];
        valid?: boolean;
    }

    let { account, accounts, valid = $bindable(false) }: Props = $props();

    let name = $state("");
    let trimmedName = $derived(name.trim());

    $effect(() => {
        const isValid =
            trimmedName.length > 0 &&
            accounts.find((a) => a.name.toLowerCase() === trimmedName.toLowerCase()) === undefined;
        if (isValid !== valid) {
            valid = isValid;
        }
    });

    export function saveAccount() {
        return client.saveCryptoAccount({
            account,
            name: trimmedName,
        });
    }
</script>

<Legend label={i18nKey("tokenTransfer.saveAccountMessage")} />

<p class="account">{account}</p>

<Input
    bind:value={name}
    autofocus
    countdown={false}
    maxlength={100}
    placeholder={i18nKey("tokenTransfer.enterAccountName")} />

<style lang="scss">
    .account {
        @include input();
        margin-bottom: $sp3;
    }
</style>
