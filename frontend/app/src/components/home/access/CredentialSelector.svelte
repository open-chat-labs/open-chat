<script lang="ts">
    import Delete from "svelte-material-icons/Delete.svelte";
    import Legend from "../../Legend.svelte";
    import Input from "../../Input.svelte";
    import type { CredentialGate, Credential } from "openchat-client";
    import { onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { Principal } from "@dfinity/principal";
    import Translatable from "../../Translatable.svelte";

    const MIN_LENGTH = 1;
    const MAX_LENGTH = 50;

    export let gate: CredentialGate;
    export let valid: boolean;
    export let editable: boolean;

    let selectedCredentialIssuer: Credential;
    let credentialArguments: [string, string][] = [];

    // I'm going to bin the predefined credentials for now because we don't really have any that make sense.
    // If / when we do have them I think we will just have a pop up that you select from and it populates the form
    // and from there it's exactly the same as a custom credential.

    $: originValid = validateOrigin(selectedCredentialIssuer?.issuerOrigin);
    $: nameValid = stringValid(selectedCredentialIssuer?.credentialName);
    $: canisterValid = validateCanister(selectedCredentialIssuer?.issuerCanisterId);
    $: typeValid = stringValid(selectedCredentialIssuer?.credentialType);
    $: argsValid = validateArguments(credentialArguments);
    $: valid = argsValid && originValid && nameValid && canisterValid && typeValid;

    function validateArguments(args: [string, string][]): boolean {
        return args.every(([k, v]) => {
            return stringValid(k) && stringValid(v);
        });
    }

    function validateOrigin(origin: string | undefined): boolean {
        if (!origin) return false;
        try {
            const o = new URL(origin);
            return o.origin === origin;
        } catch (_) {
            return false;
        }
    }

    function validateCanister(canister: string | undefined): boolean {
        if (!canister) return false;
        try {
            Principal.fromText(canister);
            return true;
        } catch (_) {
            return false;
        }
    }

    function stringValid(str: string | undefined): boolean {
        return str !== undefined && str.length >= MIN_LENGTH && str.length <= MAX_LENGTH;
    }

    onMount(() => {
        selectedCredentialIssuer = gate.credential;
        if (gate.credential.credentialArguments) {
            credentialArguments = Object.entries(gate.credential.credentialArguments).map(
                ([k, v]) => [k, v.toString()],
            );
        }
    });

    function sync() {
        gate.credential = { ...selectedCredentialIssuer };

        gate.credential.credentialArguments =
            credentialArguments.length > 0
                ? Object.fromEntries(credentialArguments.map(([k, v]) => [k, maybeNumber(v)]))
                : undefined;
    }

    function maybeNumber(val: string): number | string {
        const regex = /^-?\d+(\.\d+)?$/;
        return regex.test(val) ? parseFloat(val) : val;
    }

    // function issuerChanged() {
    //     sync();
    // }

    function addArgument() {
        const num = credentialArguments.length;
        credentialArguments = [
            ...credentialArguments,
            [`Arg ${num + 1} name`, `Arg ${num + 1} value`],
        ];
    }

    function deleteArgument(name: string) {
        credentialArguments = credentialArguments.filter(([k]) => k !== name);
    }
</script>

{#if selectedCredentialIssuer}
    <Legend required={editable} label={i18nKey("access.credential.credentialName")} />
    <Input
        bind:value={selectedCredentialIssuer.credentialName}
        on:change={sync}
        disabled={!editable}
        invalid={!nameValid}
        minlength={MIN_LENGTH}
        maxlength={MAX_LENGTH}
        placeholder={i18nKey("access.credential.credentialNamePlaceholder")} />

    <Legend required={editable} label={i18nKey("access.credential.issuerCanisterId")} />
    <Input
        bind:value={selectedCredentialIssuer.issuerCanisterId}
        invalid={!canisterValid}
        on:change={sync}
        disabled={!editable}
        minlength={MIN_LENGTH}
        maxlength={MAX_LENGTH}
        placeholder={i18nKey("access.credential.issuerCanisterIdPlaceholder")} />

    <Legend required={editable} label={i18nKey("access.credential.issuerOrigin")} />
    <Input
        bind:value={selectedCredentialIssuer.issuerOrigin}
        invalid={!originValid}
        on:change={sync}
        disabled={!editable}
        minlength={MIN_LENGTH}
        maxlength={MAX_LENGTH}
        placeholder={i18nKey("access.credential.issuerOriginPlaceholder")} />

    <Legend required={editable} label={i18nKey("access.credential.credentialType")} />
    <Input
        bind:value={selectedCredentialIssuer.credentialType}
        invalid={!typeValid}
        on:change={sync}
        disabled={!editable}
        minlength={MIN_LENGTH}
        maxlength={MAX_LENGTH}
        placeholder={i18nKey("access.credential.credentialTypePlaceholder")} />

    {#each credentialArguments as [name, value]}
        <div class="argument">
            <div class="argument-name">
                <Legend required={editable} label={i18nKey("access.credential.argumentName")} />
                <Input
                    bind:value={name}
                    invalid={!stringValid(name)}
                    on:change={sync}
                    disabled={!editable}
                    minlength={MIN_LENGTH}
                    maxlength={MAX_LENGTH}
                    placeholder={i18nKey("access.credential.argumentNamePlaceholder")} />
            </div>
            <div class="argument-value">
                <Legend required={editable} label={i18nKey("access.credential.argumentValue")} />
                <Input
                    bind:value
                    invalid={!stringValid(value)}
                    on:change={sync}
                    disabled={!editable}
                    minlength={MIN_LENGTH}
                    maxlength={MAX_LENGTH}
                    placeholder={i18nKey("access.credential.argumentValuePlaceholder")} />
            </div>
            {#if editable}
                <div on:click={() => deleteArgument(name)} class="delete-icon">
                    <Delete size={$iconSize} color={"var(--icon-txt)"} />
                </div>
            {/if}
        </div>
    {/each}

    {#if editable}
        <div class="add">
            <Button tiny on:click={addArgument}>
                <Translatable resourceKey={i18nKey("access.credential.addArgument")} />
            </Button>
        </div>
    {/if}
{/if}

<!-- <Legend label={i18nKey("access.predefinedCredentialIssuer")} />
<Select on:change={issuerChanged} bind:value={selectedCredentialIssuer}>
    {#each credentialIssuers as issuer}
        <option value={issuer}>{issuer.name}</option>
    {/each}
</Select> -->

<!-- {#if selectedCredentialIssuer === credentialIssuers[0]}
    <Legend label={i18nKey("Name")} />
    <Input bind:value={customIssuer.name} />

    <Legend label={i18nKey("CanisterId")} />
    <Input bind:value={customIssuer.issuerCanisterId} />

    <Legend label={i18nKey("Origin")} />
    <Input bind:value={customIssuer.issuerOrigin} />

    <Legend label={i18nKey("Credential type")} />
    <Input bind:value={customIssuer.credentialType} />
{/if} -->

<style lang="scss">
    .argument {
        display: flex;
        gap: $sp3;
    }

    .argument-name,
    .argument-value {
        flex: auto;
    }

    .delete-icon {
        align-self: flex-end;
        border: 1px solid var(--bd);
        border-radius: var(--rd);
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: $sp3;
        padding: $sp3;
        transition:
            background ease-in-out 200ms,
            color ease-in-out 200ms;

        @media (hover: hover) {
            &:hover {
                background: var(--input-bg);
            }
        }
    }

    .add {
        margin-top: $sp4;
    }
</style>
