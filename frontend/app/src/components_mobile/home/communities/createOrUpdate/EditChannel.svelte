<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BodySmall, CommonButton, Container, Form, Input, Sheet, Title } from "component-lib";
    import Close from "svelte-material-icons/Close.svelte";
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
    }

    let { channelName = $bindable(), onCancel, onSave }: Props = $props();

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
            <Title fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Edit channel name")} />
            </Title>

            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Update your channel name so that people know what this channel is about. Channels names must be unique within thiss community.",
                    )} />
            </BodySmall>

            <Form {onSubmit}>
                <Input
                    minlength={MIN_LENGTH}
                    maxlength={MAX_LENGTH}
                    countdown
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

            <Container gap={"md"} crossAxisAlignment={"end"} mainAxisAlignment={"end"}>
                <CommonButton onClick={onCancel} size={"medium"}>
                    {#snippet icon(color)}
                        <Close {color} />
                    {/snippet}
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
