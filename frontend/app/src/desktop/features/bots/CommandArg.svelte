<script lang="ts">
    import type { CommandArg, CommandParam } from "@client";
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import DateInput from "@src/desktop/shared/DateInput.svelte";
    import SingleUserSelector from "@src/desktop/shared/SingleUserSelector.svelte";
    import Input from "@src/desktop/shared/Input.svelte";
    import IntegerInput from "./IntegerInput.svelte";
    import Legend from "@src/desktop/shared/Legend.svelte";
    import NumberInput from "@src/desktop/shared/NumberInput.svelte";
    import Select from "@src/desktop/shared/Select.svelte";
    import TextArea from "@src/desktop/shared/TextArea.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

    interface Props {
        param: CommandParam;
        arg: CommandArg;
    }

    let { param, arg = $bindable() }: Props = $props();
</script>

<div class="param">
    {#if arg.kind === "user" && param.kind === "user"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <SingleUserSelector
            onUserSelected={(user) => {
                arg.userId = user.userId;
            }}
            onUserRemoved={() => {
                arg.userId = undefined;
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
            <Select bind:value={arg.value}>
                <option value={""} selected disabled>
                    {interpolate(
                        $_,
                        i18nKey("bots.builder.chooseOption", {
                            option: interpolate($_, i18nKey(param.name)),
                        }),
                    )}
                </option>
                {#each param.choices as choice}
                    <option value={choice.value}>
                        <Translatable resourceKey={i18nKey(choice.name)} />
                    </option>
                {/each}
            </Select>
        {:else if param.multi_line}
            <TextArea
                rows={2}
                placeholder={i18nKey(param.placeholder ?? "")}
                minlength={param.minLength}
                maxlength={param.maxLength}
                bind:value={arg.value} />
        {:else}
            <Input
                minlength={param.minLength}
                maxlength={param.maxLength}
                placeholder={i18nKey(param.placeholder ?? "")}
                countdown
                bind:value={arg.value} />
        {/if}
    {:else if arg.kind === "boolean" && param.kind === "boolean"}
        <Legend label={i18nKey(param.name)} required={param.required} />
        <Select bind:value={arg.value}>
            <option value={""} selected disabled>{`Choose ${$_(param.name)}`}</option>
            <option value={true}>True</option>
            <option value={false}>False</option>
        </Select>
    {:else if (arg.kind === "integer" && param.kind === "integer") || (arg.kind === "decimal" && param.kind === "decimal")}
        <Legend label={i18nKey(param.name)} required={param.required} />
        {#if param.choices?.length ?? 0 > 0}
            <Select bind:value={arg.value}>
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
                placeholder={i18nKey(param.placeholder ?? "")}
                bind:value={arg.value} />
        {:else if arg.kind === "decimal" && param.kind === "decimal"}
            <NumberInput
                min={param.minValue}
                max={param.maxValue}
                shouldClamp={false}
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
