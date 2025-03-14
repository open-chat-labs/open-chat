<script lang="ts">
    import { type ValidationErrors, type CommandParam } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Legend from "../Legend.svelte";
    import Select from "../Select.svelte";
    import Translatable from "../Translatable.svelte";
    import Input from "../Input.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import NumberInput from "../NumberInput.svelte";
    import ValidatingInput from "./ValidatingInput.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { iconSize } from "../../stores/iconSize";
    import IntegerInput from "../IntegerInput.svelte";

    interface Props {
        errorPath: string;
        errors: ValidationErrors;
        param: CommandParam;
        onNext?: () => void;
        onPrevious?: () => void;
    }

    let { param, errors, errorPath, onNext, onPrevious }: Props = $props();
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close>
        <div slot="header" class="header">
            <Translatable resourceKey={i18nKey("bots.builder.paramLabel", { name: param.name })}
            ></Translatable>
        </div>
        <div class="body" slot="body">
            <section>
                <Legend label={i18nKey("bots.builder.paramTypeLabel")}></Legend>
                <Select disabled value={param.kind}>
                    <option value={"string"}>
                        <Translatable resourceKey={i18nKey("String")}></Translatable>
                    </option>
                    <option value={"user"}>
                        <Translatable resourceKey={i18nKey("User")}></Translatable>
                    </option>
                    <option value={"boolean"}>
                        <Translatable resourceKey={i18nKey("Boolean")}></Translatable>
                    </option>
                    <option value={"integer"}>
                        <Translatable resourceKey={i18nKey("Integer")}></Translatable>
                    </option>
                    <option value={"decimal"}>
                        <Translatable resourceKey={i18nKey("Decimal")}></Translatable>
                    </option>
                    <option value={"dateTime"}>
                        <Translatable resourceKey={i18nKey("DateTime")}></Translatable>
                    </option>
                </Select>
            </section>
            <section>
                <Checkbox
                    id={`param_required`}
                    label={i18nKey("bots.builder.required")}
                    checked={param.required}
                    disabled
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
                    disabled
                    error={errors.get(`${errorPath}_name`)}
                    minlength={3}
                    maxlength={25}
                    invalid={errors.has(`${errorPath}_name`)}
                    placeholder={i18nKey("bots.builder.paramNamePlaceholder")}
                    value={param.name} />
            </section>
            <section>
                <Legend
                    label={i18nKey("bots.builder.paramDescLabel")}
                    rules={i18nKey("bots.builder.optional")}></Legend>
                <Input
                    disabled
                    minlength={3}
                    maxlength={200}
                    placeholder={i18nKey("bots.builder.paramDescPlaceholder")}
                    value={param.description} />
            </section>
            <section>
                <Legend
                    label={i18nKey("bots.builder.paramPlaceholderLabel")}
                    rules={i18nKey("bots.builder.optional")}></Legend>
                <Input
                    disabled
                    minlength={3}
                    maxlength={200}
                    placeholder={i18nKey("bots.builder.paramPlaceholderPlaceholder")}
                    value={param.placeholder} />
            </section>
            {#if param.kind === "string"}
                <section class="minmax">
                    <div class="min">
                        <Legend label={i18nKey("bots.builder.minLengthLabel")}></Legend>
                        <NumberInput
                            disabled
                            min={0}
                            max={param.maxLength}
                            placeholder={i18nKey("bots.builder.minLengthPlaceholder")}
                            value={param.minLength} />
                    </div>
                    <div class="max">
                        <Legend label={i18nKey("bots.builder.maxLengthLabel")}></Legend>
                        <NumberInput
                            disabled
                            min={param.minLength}
                            max={1000}
                            placeholder={i18nKey("bots.builder.maxLengthPlaceholder")}
                            value={param.maxLength} />
                    </div>
                </section>
            {:else if param.kind === "integer"}
                <section class="minmax">
                    <div class="min">
                        <Legend label={i18nKey("bots.builder.minValueLabel")}></Legend>
                        <IntegerInput
                            disabled
                            min={BigInt(0)}
                            max={param.maxValue}
                            placeholder={i18nKey("bots.builder.minValuePlaceholder")}
                            value={param.minValue} />
                    </div>
                    <div class="max">
                        <Legend label={i18nKey("bots.builder.maxValueLabel")}></Legend>
                        <IntegerInput
                            disabled
                            min={param.minValue}
                            max={BigInt(1000)}
                            placeholder={i18nKey("bots.builder.maxValuePlaceholder")}
                            value={param.maxValue} />
                    </div>
                </section>
            {:else if param.kind === "decimal"}
                <section class="minmax">
                    <div class="min">
                        <Legend label={i18nKey("bots.builder.minValueLabel")}></Legend>
                        <NumberInput
                            disabled
                            min={0}
                            max={param.maxValue}
                            placeholder={i18nKey("bots.builder.minValuePlaceholder")}
                            value={param.minValue} />
                    </div>
                    <div class="max">
                        <Legend label={i18nKey("bots.builder.maxValueLabel")}></Legend>
                        <NumberInput
                            disabled
                            min={param.minValue}
                            max={1000}
                            placeholder={i18nKey("bots.builder.maxValuePlaceholder")}
                            value={param.maxValue} />
                    </div>
                </section>
            {:else if param.kind === "dateTime"}
                <section>
                    <Legend
                        label={i18nKey("bots.builder.dateTimeFutureOnly")}
                        rules={i18nKey("bots.builder.dateTimeFutureOnlyDesc")}></Legend>
                    <Input disabled value={param.future_only.toString()} />
                </section>
            {/if}

            {#if (param.kind === "string" || param.kind === "integer" || param.kind === "decimal") && param.choices.length > 0}
                <section>
                    <Legend label={i18nKey("bots.builder.choices")}></Legend>
                    <p class="info">
                        <Translatable resourceKey={i18nKey("bots.builder.choicesInfo")}
                        ></Translatable>
                    </p>
                    <div class="choices">
                        <div class="choice">
                            <div class="choice-name">Name</div>
                            <div class="choice-value">Value</div>
                        </div>
                        {#each param.choices as _, i}
                            <div class="choice">
                                <div class="choice-name">
                                    <ValidatingInput
                                        disabled
                                        error={errors.get(`${errorPath}_choices_${i}_name`)}
                                        invalid={errors.has(`${errorPath}_choices_${i}_name`)}
                                        minlength={3}
                                        maxlength={100}
                                        placeholder={i18nKey("bots.builder.choiceName")}
                                        value={param.choices[i].name} />
                                </div>
                                <div class="choice-value">
                                    <ValidatingInput
                                        disabled
                                        error={errors.get(`${errorPath}_choices_${i}_value`)}
                                        invalid={errors.has(`${errorPath}_choices_${i}_value`)}
                                        minlength={3}
                                        maxlength={100}
                                        placeholder={i18nKey("bots.builder.choiceValue")}
                                        value={param.choices[i].value} />
                                </div>
                            </div>
                        {/each}
                    </div>
                </section>
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
    .navigate {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

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
