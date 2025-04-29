<script lang="ts">
    import { currentUser, emptyBotInstance, ui } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";

    //const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        mode: "register" | "update";
    }

    let { onClose, mode = "register" }: Props = $props();

    let valid = $state(false);
    let busy = $state(false);
    let step: "choose" | "edit" = $state(mode === "update" ? "choose" : "edit");

    let botState = $state({
        original: emptyBotInstance($currentUser.userId),
        current: emptyBotInstance($currentUser.userId),
    });

    let titleKey = $derived.by(() => {
        switch (mode) {
            case "register":
                return i18nKey("bots.builder.title");
            case "update":
                return step === "choose"
                    ? i18nKey("bots.update_bot.select")
                    : i18nKey("bots.update_bot.title", { name: botState.current.name });
        }
    });

    function register() {}

    function update() {}
</script>

<ModalContent {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable resourceKey={titleKey}></Translatable>
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            <!-- {#if step === "choose"}
                {#if !busy && mode === "update"}
                    <ChooseBot ownedOnly onSelect={selectBot} />
                {/if}
            {:else if step === "edit" && botState.current !== undefined}
                <form onsubmit={onSubmit} class="bot">
                    <Legend label={i18nKey("bots.builder.iconLabel")} />
                    <div class="photo">
                        <EditableAvatar
                            overlayIcon
                            size={"medium"}
                            image={candidate.avatarUrl}
                            onImageSelected={botAvatarSelected} />
                    </div>

                    <Legend
                        required
                        label={i18nKey("bots.builder.nameLabel")}
                        rules={i18nKey("bots.builder.nameRules")}></Legend>
                    <ValidatingInput
                        minlength={3}
                        maxlength={25}
                        invalid={errors.has("bot_name")}
                        placeholder={i18nKey("bots.builder.namePlaceholder")}
                        error={errors.get("bot_name")}
                        bind:value={candidate.name}>
                    </ValidatingInput>
                </form>
            {/if} -->
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="footer">
            <ButtonGroup>
                <Button secondary small={!ui.mobileWidth} tiny={ui.mobileWidth} onClick={onClose}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                <Button
                    onClick={mode === "update" ? update : register}
                    disabled={!valid || busy}
                    loading={busy}
                    small={!ui.mobileWidth}
                    tiny={ui.mobileWidth}>
                    <Translatable
                        resourceKey={mode === "update"
                            ? i18nKey("bots.update_bot.action")
                            : i18nKey("bots.add.action")} />
                </Button>
            </ButtonGroup>
        </div>
    {/snippet}
</ModalContent>
