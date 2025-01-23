<script lang="ts">
    import { _ } from "svelte-i18n";
    import type {
        SlashCommandParam,
        SlashCommandParamInstance,
        UserSummary,
    } from "openchat-client";
    import Legend from "../Legend.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Input from "../Input.svelte";
    import SingleUserSelector from "../home/SingleUserSelector.svelte";
    import Select from "../Select.svelte";
    import NumberInput from "../NumberInput.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        param: SlashCommandParam;
        instance: SlashCommandParamInstance;
        onChange: () => void;
    }

    let { param, instance, onChange }: Props = $props();
</script>

<div class="param">
    {#if instance.kind === "user" && param.kind === "user"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <SingleUserSelector
            on:userSelected={(ev: CustomEvent<UserSummary>) => {
                instance.userId = ev.detail.userId;
                onChange();
            }}
            on:userRemoved={() => {
                instance.userId = undefined;
                onChange();
            }}
            autofocus={false}
            direction={"down"}
            placeholder={$_(param.placeholder ?? "")} />
    {:else if instance.kind === "string" && param.kind === "string"}
        <Legend
            label={i18nKey(param.name)}
            required={param.required}
            rules={param.choices.length > 0
                ? undefined
                : i18nKey(`Max length ${param.maxLength}`)} />
        {#if param.choices?.length ?? 0 > 0}
            <Select onchange={onChange} bind:value={instance.value}>
                <option value={""} selected disabled>{`Choose ${$_(param.name)}`}</option>
                {#each param.choices as choice}
                    <option value={choice.value}>
                        <Translatable resourceKey={i18nKey(choice.name)} />
                    </option>
                {/each}
            </Select>
        {:else}
            <Input
                minlength={param.minLength}
                maxlength={param.maxLength}
                placeholder={i18nKey(param.placeholder ?? "")}
                on:change={onChange}
                bind:value={instance.value} />
        {/if}
    {:else if instance.kind === "boolean" && param.kind === "boolean"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <Select bind:value={instance.value} onchange={onChange}>
            <option value={""} selected disabled>{`Choose ${$_(param.name)}`}</option>
            <option value={true}>True</option>
            <option value={false}>False</option>
        </Select>
    {:else if (instance.kind === "integer" && param.kind === "integer") || (instance.kind === "decimal" && param.kind === "decimal")}
        <Legend label={i18nKey(param.name)} required={param.required} />
        {#if param.choices?.length ?? 0 > 0}
            <Select bind:value={instance.value} onchange={onChange}>
                <option value={null} selected disabled>{`Choose ${$_(param.name)}`}</option>
                {#each param.choices as choice}
                    <option value={choice.value}>
                        <Translatable resourceKey={i18nKey(choice.name)} />
                    </option>
                {/each}
            </Select>
        {:else}
            <NumberInput
                min={param.minValue}
                max={param.maxValue}
                shouldClamp={false}
                on:change={onChange}
                placeholder={i18nKey(param.placeholder ?? "")}
                bind:value={instance.value} />
        {/if}
    {/if}
</div>

<style lang="scss">
</style>
