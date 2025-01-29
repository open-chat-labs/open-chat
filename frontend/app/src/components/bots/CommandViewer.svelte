<script lang="ts">
    import {
        type SlashCommandParam,
        type SlashCommandSchema,
        ValidationErrors,
    } from "openchat-client";
    import Input from "../Input.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import Translatable from "../Translatable.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import ValidatingInput from "./ValidatingInput.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import CommandParameterViewer from "./CommandParameterViewer.svelte";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import { iconSize } from "../../stores/iconSize";
    import BotPermissionViewer from "./BotPermissionViewer.svelte";

    interface Props {
        errors: ValidationErrors;
        errorPath: string;
        command: SlashCommandSchema;
        onNext?: () => void;
        onPrevious?: () => void;
    }

    let { command, errors, errorPath, onNext, onPrevious }: Props = $props();

    let selectedParam = $state<SlashCommandParam | undefined>(undefined);
    let selectedParamIndex = $state<number | undefined>(undefined);
    let showNext = $derived(
        selectedParamIndex !== undefined && selectedParamIndex < command.params.length - 1,
    );
    let showPrev = $derived(selectedParamIndex !== undefined && selectedParamIndex > 0);

    function onSelectParam(param: SlashCommandParam, index: number) {
        selectedParam = param;
        selectedParamIndex = index;
    }

    function traverseParams(add: number) {
        if (selectedParamIndex === undefined) return;

        selectedParamIndex += add;
        selectedParam = command.params[selectedParamIndex];
        if (selectedParam === undefined) {
            selectedParamIndex = undefined;
        }
    }

    function nextParam() {
        traverseParams(1);
    }

    function previousParam() {
        traverseParams(-1);
    }
</script>

{#if selectedParam !== undefined && selectedParamIndex !== undefined}
    <CommandParameterViewer
        errorPath={`${errorPath}_param_${selectedParamIndex}`}
        {errors}
        onNext={showNext ? nextParam : undefined}
        onPrevious={showPrev ? previousParam : undefined}
        on:close={() => (selectedParam = undefined)}
        param={selectedParam}></CommandParameterViewer>
{/if}

<Overlay dismissible>
    <ModalContent closeIcon on:close>
        <div slot="header">
            <Translatable resourceKey={i18nKey("bots.builder.commandLabel", { name: command.name })}
            ></Translatable>
        </div>
        <div slot="body">
            <section>
                <Legend required label={i18nKey("bots.builder.commandNameLabel")}></Legend>
                <ValidatingInput
                    disabled
                    error={errors.get(`${errorPath}_name`)}
                    minlength={3}
                    maxlength={25}
                    invalid={errors.has(`${errorPath}_name`)}
                    placeholder={i18nKey("bots.builder.commandNamePlaceholder")}
                    value={command.name} />
            </section>

            <section>
                <Legend required label={i18nKey("bots.builder.commandDescLabel")}></Legend>
                <Input
                    disabled
                    minlength={5}
                    maxlength={500}
                    placeholder={i18nKey("bots.builder.commandDescPlaceholder")}
                    value={command.description} />
            </section>

            <section>
                <Legend label={i18nKey("bots.builder.commandPlaceholderLabel")}></Legend>
                <Input
                    disabled
                    minlength={5}
                    maxlength={500}
                    placeholder={i18nKey("bots.builder.commandPlaceholderPlaceholder")}
                    value={command.placeholder} />
            </section>

            <section>
                <BotPermissionViewer
                    title={i18nKey("bots.builder.commandPermissionsLabel")}
                    permissions={command.permissions} />
            </section>

            {#if command.params.length > 0}
                <section>
                    <Legend label={i18nKey("bots.builder.paramsLabel")}></Legend>
                    <div class="params">
                        {#each command.params as param, i}
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div
                                onclick={() => onSelectParam(param, i)}
                                class="param"
                                class:param-error={errors.has(`${errorPath}_param_${i}`)}>
                                <Translatable resourceKey={i18nKey(param.name)}></Translatable>
                            </div>
                        {/each}
                    </div>
                </section>
            {/if}

            {#if errors.has(`${errorPath}_duplicate_params`)}
                <ErrorMessage>{errors.get(`${errorPath}_duplicate_params`)}</ErrorMessage>
            {/if}
        </div>

        <div slot="footer" class="footer">
            <div class="navigate">
                <HoverIcon disabled={onPrevious === undefined} onclick={onPrevious}>
                    <ChevronLeft size={$iconSize} color={"var(--icon-txt)"}></ChevronLeft>
                </HoverIcon>
                <HoverIcon disabled={onNext === undefined} onclick={onNext}>
                    <ChevronRight size={$iconSize} color={"var(--icon-txt)"}></ChevronRight>
                </HoverIcon>
            </div>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    section {
        margin-bottom: $sp4;
    }

    .navigate {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .params {
        margin: 0 0 $sp3 0;
        display: flex;
        gap: $sp3;
        flex-wrap: wrap;

        .param {
            padding: $sp3 $sp4;
            cursor: pointer;
            align-items: center;
            background-color: var(--button-bg);
            color: var(--button-txt);
            transition:
                background ease-in-out 200ms,
                color ease-in-out 200ms;
            border-radius: var(--button-rd);

            @media (hover: hover) {
                &:hover {
                    background: var(--button-hv);
                    color: var(--button-hv-txt);
                }
            }

            &.param-error {
                background-color: var(--error);
                @media (hover: hover) {
                    &:hover {
                        background: var(--error);
                    }
                }
            }
        }
    }
</style>
