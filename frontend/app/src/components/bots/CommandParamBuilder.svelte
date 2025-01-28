<script lang="ts">
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import {
        defaultBooleanParam,
        defaultDecimalParam,
        defaultIntegerParam,
        defaultStringParam,
        defaultUserParam,
        type ValidationErrors,
        type SlashCommandOptionChoice,
        type SlashCommandParam,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import Select from "../Select.svelte";
    import Translatable from "../Translatable.svelte";
    import Input from "../Input.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import NumberInput from "../NumberInput.svelte";
    import Link from "../Link.svelte";
    import { iconSize } from "../../stores/iconSize";
    import ValidatingInput from "./ValidatingInput.svelte";
    import IntegerInput from "../IntegerInput.svelte";

    interface Props {
        errorPath: string;
        errors: ValidationErrors;
        param: SlashCommandParam;
        onAddAnother: () => void;
    }

    let { param = $bindable(), onAddAnother, errors, errorPath }: Props = $props();

    function changeType() {
        switch (param.kind) {
            case "string":
                param = defaultStringParam(param);
                break;
            case "user":
                param = defaultUserParam(param);
                break;
            case "integer":
                param = defaultIntegerParam(param);
                break;
            case "decimal":
                param = defaultDecimalParam(param);
                break;
            case "boolean":
                param = defaultBooleanParam(param);
                break;
        }
    }

    function addChoice() {
        switch (param.kind) {
            case "string":
                param.choices.push({
                    name: "",
                    value: "",
                });
                break;
            case "integer":
                param.choices.push({
                    name: "",
                    value: BigInt(0),
                });
                break;
            case "decimal":
                param.choices.push({
                    name: "",
                    value: 0,
                });
                break;
        }
    }

    function deleteChoice(choice: SlashCommandOptionChoice<unknown>) {
        if (param.kind === "string") {
            param.choices = param.choices.filter((c) => c !== choice);
        }
        if (param.kind === "integer") {
            param.choices = param.choices.filter((c) => c !== choice);
        }
        if (param.kind === "decimal") {
            param.choices = param.choices.filter((c) => c !== choice);
        }
    }
</script>

<Overlay>
    <ModalContent on:close>
        <div slot="header" class="header">
            <Translatable resourceKey={i18nKey("bots.builder.paramLabel", { name: param.name })}
            ></Translatable>
        </div>
        <div class="body" slot="body">
            <section>
                <Legend label={i18nKey("bots.builder.paramTypeLabel")}></Legend>
                <Select onchange={changeType} bind:value={param.kind}>
                    <option value={"string"}>
                        <Translatable resourceKey={i18nKey("String")}></Translatable>
                    </option>
                    <option value={"user"}>
                        <Translatable resourceKey={i18nKey("User")}></Translatable>
                    </option>
                    <option value={"boolean"}>
                        <Translatable resourceKey={i18nKey("Boolean")}></Translatable>
                    </option>
                    <option value={"number"}>
                        <Translatable resourceKey={i18nKey("Number")}></Translatable>
                    </option>
                </Select>
            </section>
            <section>
                <Checkbox
                    id={`param_required`}
                    label={i18nKey("bots.builder.required")}
                    bind:checked={param.required}
                    align={"start"}>
                    <Translatable resourceKey={i18nKey("bots.builder.required")} />
                    <div class="info">
                        <Translatable resourceKey={i18nKey("bots.builder.requiredDesc")}
                        ></Translatable>
                    </div>
                </Checkbox>
            </section>
            <section>
                <Legend
                    required
                    label={i18nKey("bots.builder.paramNameLabel")}
                    rules={i18nKey("bots.builder.nameRules")}></Legend>
                <ValidatingInput
                    autofocus
                    error={errors.get(`${errorPath}_name`)}
                    minlength={3}
                    maxlength={25}
                    invalid={errors.has(`${errorPath}_name`)}
                    placeholder={i18nKey("bots.builder.paramNamePlaceholder")}
                    bind:value={param.name} />
            </section>
            <section>
                <Legend
                    label={i18nKey("bots.builder.paramDescLabel")}
                    rules={i18nKey("bots.builder.optional")}></Legend>
                <Input
                    minlength={3}
                    maxlength={200}
                    placeholder={i18nKey("bots.builder.paramDescPlaceholder")}
                    bind:value={param.description} />
            </section>
            <section>
                <Legend
                    label={i18nKey("bots.builder.paramPlaceholderLabel")}
                    rules={i18nKey("bots.builder.optional")}></Legend>
                <Input
                    minlength={3}
                    maxlength={200}
                    placeholder={i18nKey("bots.builder.paramPlaceholderPlaceholder")}
                    bind:value={param.placeholder} />
            </section>
            {#if param.kind === "string"}
                <section class="minmax">
                    <div class="min">
                        <Legend
                            label={i18nKey("bots.builder.minLengthLabel")}
                            rules={i18nKey("bots.builder.uptoN", { n: param.maxLength.toString() })}
                        ></Legend>
                        <NumberInput
                            min={0}
                            max={param.maxLength}
                            placeholder={i18nKey("bots.builder.minLengthPlaceholder")}
                            bind:value={param.minLength} />
                    </div>
                    <div class="max">
                        <Legend
                            label={i18nKey("bots.builder.maxLengthLabel")}
                            rules={i18nKey("bots.builder.uptoN", { n: "1000" })}></Legend>
                        <NumberInput
                            min={param.minLength}
                            max={1000}
                            placeholder={i18nKey("bots.builder.maxLengthPlaceholder")}
                            bind:value={param.maxLength} />
                    </div>
                </section>
            {:else if param.kind === "integer"}
                <section class="minmax">
                    <div class="min">
                        <Legend
                            label={i18nKey("bots.builder.minValueLabel")}
                            rules={i18nKey("bots.builder.uptoN", { n: param.maxValue.toString() })}
                        ></Legend>
                        <IntegerInput
                            min={BigInt(0)}
                            max={param.maxValue}
                            placeholder={i18nKey("bots.builder.minValuePlaceholder")}
                            bind:value={param.minValue} />
                    </div>
                    <div class="max">
                        <Legend
                            label={i18nKey("bots.builder.maxValueLabel")}
                            rules={i18nKey("bots.builder.uptoN", { n: "1000" })}></Legend>
                        <IntegerInput
                            min={param.minValue}
                            max={BigInt(1000)}
                            placeholder={i18nKey("bots.builder.maxValuePlaceholder")}
                            bind:value={param.maxValue} />
                    </div>
                </section>
            {:else if param.kind === "decimal"}
                <section class="minmax">
                    <div class="min">
                        <Legend
                            label={i18nKey("bots.builder.minValueLabel")}
                            rules={i18nKey("bots.builder.uptoN", { n: param.maxValue.toString() })}
                    ></Legend>
                    <NumberInput
                            min={0}
                            max={param.maxValue}
                            placeholder={i18nKey("bots.builder.minValuePlaceholder")}
                            bind:value={param.minValue} />
                    </div>
                    <div class="max">
                        <Legend
                            label={i18nKey("bots.builder.maxValueLabel")}
                            rules={i18nKey("bots.builder.uptoN", { n: "1000" })}></Legend>
                        <NumberInput
                            min={param.minValue}
                            max={1000}
                            placeholder={i18nKey("bots.builder.maxValuePlaceholder")}
                            bind:value={param.maxValue} />
                    </div>
                </section>
            {/if}

            {#if param.kind === "string" || param.kind === "integer" || param.kind === "decimal"}
                <section>
                    <Legend label={i18nKey("bots.builder.choices")}></Legend>
                    <p class="info">
                        <Translatable resourceKey={i18nKey("bots.builder.choicesInfo")}
                        ></Translatable>
                    </p>
                    <div class="choices">
                        {#each param.choices as choice, i}
                            <div class="choice">
                                <div class="choice-name">
                                    <ValidatingInput
                                        error={errors.get(`${errorPath}_choices_${i}_name`)}
                                        invalid={errors.has(`${errorPath}_choices_${i}_name`)}
                                        minlength={3}
                                        maxlength={100}
                                        placeholder={i18nKey("bots.builder.choiceName")}
                                        bind:value={param.choices[i].name} />
                                </div>
                                <div class="choice-value">
                                    <ValidatingInput
                                        error={errors.get(`${errorPath}_choices_${i}_value`)}
                                        invalid={errors.has(`${errorPath}_choices_${i}_value`)}
                                        minlength={3}
                                        maxlength={100}
                                        placeholder={i18nKey("bots.builder.choiceValue")}
                                        bind:value={param.choices[i].value} />
                                </div>
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_static_element_interactions -->
                                <div class="delete-choice" onclick={() => deleteChoice(choice)}>
                                    <DeleteOutline size={$iconSize} color={"var(--txt)"}
                                    ></DeleteOutline>
                                </div>
                            </div>
                        {/each}
                    </div>
                    <Link on:click={addChoice} underline={"never"}>
                        <Translatable resourceKey={i18nKey("bots.builder.addChoice")}
                        ></Translatable>
                    </Link>
                </section>
            {/if}
        </div>

        <div let:onClose slot="footer" class="footer">
            <ButtonGroup>
                <Button secondary on:click={onAddAnother} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("bots.builder.addAnother")} />
                </Button>
                <Button on:click={onClose} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    .info {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        margin-bottom: $sp3;
    }

    .choices {
        margin-bottom: $sp3;
    }

    .choice {
        display: flex;
        align-items: center;
        gap: $sp3;

        .choice-name,
        .choice-value {
            flex: 1;
        }

        .delete-choice {
            flex: 0 0 toRem(30);
            cursor: pointer;
        }
    }

    .minmax {
        display: flex;
        gap: $sp3;

        .min,
        .max {
            flex: 1;
        }
    }
</style>
