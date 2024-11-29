<script lang="ts">
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import {
        defaultBooleanParam,
        defaultNumberParam,
        defaultStringParam,
        defaultUserParam,
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

    interface Props {
        param: SlashCommandParam;
        onAddAnother: () => void;
    }

    let { param = $bindable(), onAddAnother }: Props = $props();

    function changeType() {
        switch (param.kind) {
            case "string":
                param = defaultStringParam(param);
                break;
            case "user":
                param = defaultUserParam(param);
                break;
            case "number":
                param = defaultNumberParam(param);
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
            case "number":
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
        if (param.kind === "number") {
            param.choices = param.choices.filter((c) => c !== choice);
        }
    }
</script>

<Overlay>
    <ModalContent on:close>
        <div slot="header" class="header">
            <Translatable resourceKey={i18nKey(`Param: ${param.name}`)}></Translatable>
        </div>
        <div class="body" slot="body">
            <section>
                <Legend label={i18nKey("Parameter type")}></Legend>
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
                    label={i18nKey("Required parameter")}
                    bind:checked={param.required}
                    align={"start"}>
                    <Translatable resourceKey={i18nKey("Required parameter")} />
                    <div class="info">
                        <Translatable
                            resourceKey={i18nKey("Is this a required parameter for the command")}
                        ></Translatable>
                    </div>
                </Checkbox>
            </section>
            <section>
                <Legend
                    required
                    label={i18nKey("Parameter name")}
                    rules={i18nKey(
                        "Must be unique and contain alphanumeric characters and underscores only",
                    )}></Legend>
                <Input
                    minlength={3}
                    maxlength={25}
                    placeholder={i18nKey("Enter parameter name")}
                    bind:value={param.name} />
            </section>
            <section>
                <Legend label={i18nKey("Parameter description")} rules={i18nKey("optional")}
                ></Legend>
                <Input
                    minlength={3}
                    maxlength={200}
                    placeholder={i18nKey("Enter parameter descritpion")}
                    bind:value={param.description} />
            </section>
            <section>
                <Legend label={i18nKey("Parameter placeholder")} rules={i18nKey("optional")}
                ></Legend>
                <Input
                    minlength={3}
                    maxlength={200}
                    placeholder={i18nKey("Enter parameter placeholder")}
                    bind:value={param.placeholder} />
            </section>
            {#if param.kind === "string"}
                <section class="minmax">
                    <div class="min">
                        <Legend
                            label={i18nKey("Minimum length")}
                            rules={i18nKey(`up to ${param.maxLength}`)}></Legend>
                        <NumberInput
                            min={0}
                            max={param.maxLength}
                            placeholder={i18nKey("Enter minimum length")}
                            bind:value={param.minLength} />
                    </div>
                    <div class="max">
                        <Legend label={i18nKey("Maximum length")} rules={i18nKey("up to 1000")}
                        ></Legend>
                        <NumberInput
                            min={param.minLength}
                            max={1000}
                            placeholder={i18nKey("Enter maximum length")}
                            bind:value={param.maxLength} />
                    </div>
                </section>
            {:else if param.kind === "number"}
                <section class="minmax">
                    <div class="min">
                        <Legend
                            label={i18nKey("Minimum value")}
                            rules={i18nKey(`up to ${param.maxValue}`)}></Legend>
                        <NumberInput
                            min={0}
                            max={param.maxValue}
                            placeholder={i18nKey("Enter minimum value")}
                            bind:value={param.minValue} />
                    </div>
                    <div class="max">
                        <Legend label={i18nKey("Maximum value")} rules={i18nKey("up to 1000")}
                        ></Legend>
                        <NumberInput
                            min={param.minValue}
                            max={1000}
                            placeholder={i18nKey("Enter maximum value")}
                            bind:value={param.maxValue} />
                    </div>
                </section>
            {/if}

            {#if param.kind === "string" || param.kind === "number"}
                <section>
                    <Legend label={i18nKey("Choices")}></Legend>
                    <p class="info">
                        <Translatable
                            resourceKey={i18nKey(
                                "If you enter a set of choices for your parameter, the user will be presented with a drop down to choose the correct value.",
                            )}></Translatable>
                    </p>
                    <div class="choices">
                        {#each param.choices as choice, i}
                            <div class="choice">
                                <div class="choice-name">
                                    <Input
                                        minlength={3}
                                        maxlength={100}
                                        placeholder={i18nKey("Choice name")}
                                        bind:value={param.choices[i].name} />
                                </div>
                                <div class="choice-value">
                                    <Input
                                        minlength={3}
                                        maxlength={100}
                                        placeholder={i18nKey("Choice value")}
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
                        <Translatable resourceKey={i18nKey("Add a choice")}></Translatable>
                    </Link>
                </section>
            {/if}
        </div>

        <div let:onClose slot="footer" class="footer">
            <ButtonGroup>
                <Button secondary on:click={onAddAnother} small={!$mobileWidth} tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("Add another")} />
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
