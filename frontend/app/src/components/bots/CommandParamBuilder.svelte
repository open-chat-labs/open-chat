<script lang="ts">
    import {
        defaultBooleanParam,
        defaultNumberParam,
        defaultStringParam,
        defaultUserParam,
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

    interface Props {
        param: SlashCommandParam;
        onAddAnother: () => void;
    }

    let { param = $bindable(), onAddAnother }: Props = $props();

    function changeType() {
        switch (param.kind) {
            case "string":
                param = defaultStringParam();
                break;
            case "user":
                param = defaultUserParam();
                break;
            case "number":
                param = defaultNumberParam();
                break;
            case "boolean":
                param = defaultBooleanParam();
                break;
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
                <p>String fields</p>
            {:else if param.kind === "user"}
                <p>User fields</p>
            {:else if param.kind === "boolean"}
                <p>Bool fields</p>
            {:else if param.kind === "number"}
                <p>Number fields</p>
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
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp3;
    }
</style>
