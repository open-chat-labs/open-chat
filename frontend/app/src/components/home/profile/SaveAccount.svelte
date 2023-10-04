<script lang="ts">
    import type { NamedAccount, OpenChat } from "openchat-client";
    import Input from "../../Input.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Legend from "../../Legend.svelte";

    const client = getContext<OpenChat>("client");

    export let account: string;
    export let accounts: NamedAccount[];
    export let valid = false;

    let name = "";

    $: {
        valid =
            name.length > 0 &&
            accounts.find((a) => a.name.toLowerCase() === name.toLowerCase()) === undefined;
    }

    export function saveAccount() {
        return client.saveCryptoAccount({
            account,
            name,
        });
    }
</script>

<Legend label={$_("tokenTransfer.saveAccountMessage")} />

<p class="account">{account}</p>

<Input
    bind:value={name}
    autofocus
    countdown={false}
    maxlength={100}
    placeholder={$_("tokenTransfer.enterAccountName")} />

<style lang="scss">
    .account {
        @include input();
        margin-bottom: $sp3;
    }
</style>
