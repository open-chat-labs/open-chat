<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BodySmall, CommonButton, Container, Form, Input, Sheet, Title } from "component-lib";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import Translatable from "../../../Translatable.svelte";
    import { updateCommunityState } from "./community.svelte";

    const MAX_LENGTH = 40;
    const MIN_LENGTH = 3;
    let ucs = updateCommunityState;

    interface Props {
        channelName: string;
        onCancel: () => void;
        onSave: () => void;
        mode: "add" | "edit";
    }

    let { channelName = $bindable(), onCancel, onSave, mode }: Props = $props();

    let duplicate = $derived(ucs.isDuplicateChannelName(channelName));
    let tooShort = $derived(channelName.length < MIN_LENGTH);
    let tooLong = $derived(channelName.length > MAX_LENGTH);
    let valid = $derived(!tooShort && !tooLong && !duplicate);

    function onSubmit() {
        if (valid) {
            onSave();
        }
    }
</script>

<Sheet onClose={() => {}}>
    {#snippet sheet()}
        <Container height={{ kind: "hug" }} padding={"xl"} gap={"xl"} direction={"vertical"}>
            <Container gap={"lg"} padding={"md"} direction={"vertical"}>
                <Title fontWeight={"bold"}>
                    <Translatable
                        resourceKey={i18nKey(
                            mode === "edit" ? "Edit channel name" : "Add a new channel",
                        )} />
                </Title>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Use the channel name to let people know what this channel is about. Channels names must be unique within this community.",
                        )} />
                </BodySmall>
            </Container>

            <Form {onSubmit}>
                <Input
                    minlength={MIN_LENGTH}
                    maxlength={MAX_LENGTH}
                    countdown
                    placeholder={"Channel name"}
                    autofocus
                    error={!valid}
                    bind:value={channelName}>
                    {#snippet subtext()}
                        {#if duplicate}
                            You already have a channel with this name
                        {:else if tooShort}
                            Your channel name is too short
                        {:else if tooLong}
                            Your channel name is too long
                        {:else}
                            Enter a unique channel name
                        {/if}
                    {/snippet}
                </Input>
            </Form>

            <Container gap={"md"} crossAxisAlignment={"end"} mainAxisAlignment={"spaceBetween"}>
                <CommonButton onClick={onCancel} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
                <CommonButton disabled={!valid} mode={"active"} onClick={onSave} size={"medium"}>
                    {#snippet icon(color)}
                        <Save {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("save")} />
                </CommonButton>
            </Container>
        </Container>
    {/snippet}
</Sheet>
