<script lang="ts">
    import { Column, Input, Option, Select, TextArea } from "component-lib";
    import type { CommandArg, CommandParam } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import DateInput from "../DateInput.svelte";
    import SingleUserSelector from "../home/SingleUserSelector.svelte";
    import IntegerInput from "../IntegerInput.svelte";
    import Legend from "../Legend.svelte";
    import NumberInput from "../NumberInput.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        param: CommandParam;
        arg: CommandArg;
    }

    let { param, arg = $bindable() }: Props = $props();
</script>

<div class="param">
    {#snippet subtext()}
        <Translatable resourceKey={i18nKey(param.name)} />
        {#if param.required}
            <Translatable resourceKey={i18nKey("(required)")} />
        {/if}
    {/snippet}

    {#if arg.kind === "user" && param.kind === "user"}
        <SingleUserSelector
            onUserSelected={(user) => {
                arg.userId = user.userId;
            }}
            placeholder={$_(param.placeholder ?? "")} />
    {:else if arg.kind === "string" && param.kind === "string"}
        {#if param.choices?.length ?? 0 > 0}
            <Select
                {subtext}
                value={arg.value}
                placeholder={interpolate(
                    $_,
                    i18nKey("bots.builder.chooseOption", {
                        option: interpolate($_, i18nKey(param.name)),
                    }),
                )}
                onSelect={(val) => (arg.value = val)}>
                {#snippet selectedValue(val)}
                    {#if val === ""}
                        <Translatable
                            resourceKey={i18nKey("bots.builder.chooseOption", {
                                option: interpolate($_, i18nKey(param.name)),
                            })} />
                    {:else}
                        {val}
                    {/if}
                {/snippet}
                {#snippet selectOptions(onSelect)}
                    <Column padding={"lg"}>
                        {#each param.choices as choice}
                            <Option
                                value={choice.value}
                                onClick={onSelect}
                                selected={choice.value === arg.value}>
                                <Translatable resourceKey={i18nKey(choice.name)} />
                            </Option>
                        {/each}
                    </Column>
                {/snippet}
            </Select>
        {:else if param.multi_line}
            <TextArea
                {subtext}
                rows={2}
                placeholder={interpolate($_, i18nKey(param.placeholder ?? ""))}
                minlength={param.minLength}
                maxlength={param.maxLength}
                bind:value={arg.value}>
            </TextArea>
        {:else}
            <Input
                {subtext}
                minlength={param.minLength}
                maxlength={param.maxLength}
                placeholder={interpolate($_, i18nKey(param.placeholder ?? ""))}
                countdown
                bind:value={arg.value}>
            </Input>
        {/if}
    {:else if arg.kind === "boolean" && param.kind === "boolean"}
        <Select
            {subtext}
            value={arg.value}
            placeholder={`Choose ${$_(param.name)}`}
            onSelect={(val) => (arg.value = val)}>
            {#snippet selectedValue(val)}
                {#if val}
                    True
                {:else}
                    False
                {/if}
            {/snippet}
            {#snippet selectOptions(onSelect)}
                <Column padding={"lg"}>
                    <Option value={true} onClick={onSelect} selected={true === arg.value}>
                        <Translatable resourceKey={i18nKey("true")} />
                    </Option>
                    <Option value={false} onClick={onSelect} selected={false === arg.value}>
                        <Translatable resourceKey={i18nKey("false")} />
                    </Option>
                </Column>
            {/snippet}
        </Select>
    {:else if (arg.kind === "integer" && param.kind === "integer") || (arg.kind === "decimal" && param.kind === "decimal")}
        {#if param.choices?.length ?? 0 > 0}
            <Select
                {subtext}
                value={arg.value}
                placeholder={`Choose ${$_(param.name)}`}
                onSelect={(val) => (arg.value = val)}>
                {#snippet selectedValue(val)}
                    {#if val == null}
                        <Translatable
                            resourceKey={i18nKey("bots.builder.chooseOption", {
                                option: interpolate($_, i18nKey(param.name)),
                            })} />
                    {:else}
                        {val}
                    {/if}
                {/snippet}
                {#snippet selectOptions(onSelect)}
                    <Column padding={"lg"}>
                        {#each param.choices as choice}
                            <Option
                                value={choice.value}
                                onClick={onSelect}
                                selected={choice.value === arg.value}>
                                <Translatable resourceKey={i18nKey(choice.name)} />
                            </Option>
                        {/each}
                    </Column>
                {/snippet}
            </Select>
        {:else if arg.kind === "integer" && param.kind === "integer"}
            <IntegerInput
                {subtext}
                min={param.minValue}
                max={param.maxValue}
                shouldClamp={false}
                placeholder={i18nKey(param.placeholder ?? "")}
                bind:value={arg.value} />
        {:else if arg.kind === "decimal" && param.kind === "decimal"}
            <NumberInput
                {subtext}
                min={param.minValue}
                max={param.maxValue}
                shouldClamp={false}
                placeholder={i18nKey(param.placeholder ?? "")}
                bind:value={arg.value}>
            </NumberInput>
        {/if}
    {:else if arg.kind === "dateTime" && param.kind === "dateTime"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <DateInput
            value={arg.value}
            futureOnly={param.future_only}
            placeholder={i18nKey(param.placeholder ?? "")}
            onchange={(value) => {
                arg.value = value;
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
