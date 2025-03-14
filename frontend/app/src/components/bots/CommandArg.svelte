<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CommandParam, CommandArg, UserSummary } from "openchat-client";
    import Legend from "../Legend.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Input from "../Input.svelte";
    import SingleUserSelector from "../home/SingleUserSelector.svelte";
    import Select from "../Select.svelte";
    import IntegerInput from "../IntegerInput.svelte";
    import NumberInput from "../NumberInput.svelte";
    import Translatable from "../Translatable.svelte";
    import MultiLineInput from "../home/MultiLineInput.svelte";
    import DateInput from "../DateInput.svelte";

    interface Props {
        param: CommandParam;
        arg: CommandArg;
        onChange: () => void;
    }

    let { param, arg, onChange }: Props = $props();
</script>

<div class="param">
    {#if arg.kind === "user" && param.kind === "user"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <SingleUserSelector
            on:userSelected={(ev: CustomEvent<UserSummary>) => {
                arg.userId = ev.detail.userId;
                onChange();
            }}
            on:userRemoved={() => {
                arg.userId = undefined;
                onChange();
            }}
            autofocus={false}
            direction={"down"}
            placeholder={$_(param.placeholder ?? "")} />
    {:else if arg.kind === "string" && param.kind === "string"}
        <Legend
            label={i18nKey(param.name)}
            required={param.required}
            rules={param.choices.length > 0
                ? undefined
                : i18nKey(`Max length ${param.maxLength}`)} />
        {#if param.choices?.length ?? 0 > 0}
            <Select onchange={onChange} bind:value={arg.value}>
                <option value={""} selected disabled>{`Choose ${$_(param.name)}`}</option>
                {#each param.choices as choice}
                    <option value={choice.value}>
                        <Translatable resourceKey={i18nKey(choice.name)} />
                    </option>
                {/each}
            </Select>
        {:else if param.multi_line}
            <MultiLineInput
                minLines={2}
                placeholder={i18nKey(param.description ?? "")}
                oninput={onChange}
                bind:value={arg.value} />
        {:else}
            <Input
                minlength={param.minLength}
                maxlength={param.maxLength}
                placeholder={i18nKey(param.placeholder ?? "")}
                on:change={onChange}
                bind:value={arg.value} />
        {/if}
    {:else if arg.kind === "boolean" && param.kind === "boolean"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <Select bind:value={arg.value} onchange={onChange}>
            <option value={""} selected disabled>{`Choose ${$_(param.name)}`}</option>
            <option value={true}>True</option>
            <option value={false}>False</option>
        </Select>
    {:else if (arg.kind === "integer" && param.kind === "integer") || (arg.kind === "decimal" && param.kind === "decimal")}
        <Legend label={i18nKey(param.name)} required={param.required} />
        {#if param.choices?.length ?? 0 > 0}
            <Select bind:value={arg.value} onchange={onChange}>
                <option value={null} selected disabled>{`Choose ${$_(param.name)}`}</option>
                {#each param.choices as choice}
                    <option value={choice.value}>
                        <Translatable resourceKey={i18nKey(choice.name)} />
                    </option>
                {/each}
            </Select>
        {:else if arg.kind === "integer" && param.kind === "integer"}
            <IntegerInput
                min={param.minValue}
                max={param.maxValue}
                shouldClamp={false}
                change={onChange}
                placeholder={i18nKey(param.placeholder ?? "")}
                bind:value={arg.value} />
        {:else if arg.kind === "decimal" && param.kind === "decimal"}
            <NumberInput
                min={param.minValue}
                max={param.maxValue}
                shouldClamp={false}
                on:change={onChange}
                placeholder={i18nKey(param.placeholder ?? "")}
                bind:value={arg.value} />
        {/if}
    {:else if arg.kind === "dateTime" && param.kind === "dateTime"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <DateInput
            value={arg.value}
            futureOnly={param.future_only}
            placeholder={i18nKey(param.placeholder ?? "")}
            onchange={(value) => {
                arg.value = value;
                onChange();
            }} />
    {/if}
</div>

<style lang="scss">
    .param {
        margin-top: $sp3;
    }

    .param:not(:last-child) {
        /* Gives a bit more spacing between param inputs */
        margin-bottom: $sp4;
    }
</style>
