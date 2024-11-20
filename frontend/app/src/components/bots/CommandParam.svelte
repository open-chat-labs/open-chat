<script lang="ts">
    import type {
        SlashCommandParam,
        SlashCommandParamInstance,
        UserSummary,
    } from "openchat-client";
    import { onMount } from "svelte";
    import Legend from "../Legend.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Input from "../Input.svelte";
    import SingleUserSelector from "../home/SingleUserSelector.svelte";
    import Select from "../Select.svelte";

    interface Props {
        param: SlashCommandParam;
        index: number;
        instance: SlashCommandParamInstance;
    }

    let { param, index, instance }: Props = $props();

    let inp: HTMLInputElement;

    onMount(() => {
        if (index === 0) {
            inp.focus();
        }
    });
</script>

<div class="param">
    {#if instance.kind === "user" && param.kind === "user"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <SingleUserSelector
            on:userSelected={(ev: CustomEvent<UserSummary>) => (instance.value = ev.detail.userId)}
            on:userRemoved={() => (instance.value = undefined)}
            autofocus={false}
            direction={"down"}
            placeholder={param.placeholder} />
    {/if}
    {#if instance.kind === "string" && param.kind === "string"}
        <Legend
            label={i18nKey(param.name)}
            required={param.required}
            rules={param.choices.length > 0
                ? undefined
                : i18nKey(`Max length ${param.maxLength}`)} />
        {#if param.choices?.length ?? 0 > 0}
            <Select bind:value={instance.value}>
                <option value={""} selected disabled>{`Choose ${param.name}`}</option>
                {#each param.choices as choice}
                    <option value={choice.value}>{choice.name}</option>
                {/each}
            </Select>
        {:else}
            <Input
                minlength={param.minLength}
                maxlength={param.maxLength}
                placeholder={i18nKey(param.placeholder ?? "")}
                bind:value={instance.value} />
        {/if}
    {/if}
</div>

<style lang="scss">
</style>
