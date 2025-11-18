<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { Body, Button, ColourVars, Container, H2, Input } from "component-lib";
    import {
        chatListScopeStore,
        OpenChat,
        publish,
        routeForChatIdentifier,
        routeForScope,
        type MultiUserChat,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import MulticolourText from "../../MulticolourText.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
    }

    let { chat }: Props = $props();

    let chatName = $state<string>();
    let deleting = $state(false);

    function deleteChat() {
        deleting = true;
        if (chat.id.kind === "channel") {
            page(`/community/${chat.id.communityId}`);
        } else {
            page(routeForScope($chatListScopeStore));
        }
        client
            .deleteGroup(chat.id)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(
                        i18nKey("deleteGroupSuccess", undefined, chat.level),
                    );
                    publish("closeModalStack");
                } else {
                    toastStore.showFailureToast(
                        i18nKey("deleteGroupFailure", undefined, chat.level, true),
                    );
                    page(routeForChatIdentifier($chatListScopeStore.kind, chat.id));
                }
            })
            .finally(() => (deleting = false));
    }
</script>

<SlidingPageContent title={i18nKey("Delete a chat")} subtitle={i18nKey(chat.name)}>
    <Container direction={"vertical"} gap={"xxl"} padding={["xxl", "lg"]}>
        <Container padding={["zero", "lg"]} gap={"sm"} direction={"vertical"}>
            <Delete color={ColourVars.primary} size={"7rem"} />
            <H2>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey("Delete the "),
                            colour: "textPrimary",
                        },
                        {
                            text: i18nKey(chat.name),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(" chat"),
                            colour: "textPrimary",
                        },
                    ]}></MulticolourText>
            </H2>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Do you definitely want to delete this chat? All of your chat history will be lost, and this cannot be undone.",
                    )} />
            </Body>
        </Container>

        <Container>
            <Input
                error={chatName !== chat.name}
                bind:value={chatName}
                placeholder={"Type in chat name..."}
                minlength={0}
                maxlength={200}
                countdown={false}>
                {#snippet subtext()}
                    <Translatable
                        resourceKey={i18nKey(
                            "Type in the exact name of the chat to confirm deletion",
                        )} />
                {/snippet}
            </Input>
        </Container>

        <Container direction={"vertical"} gap={"lg"}>
            <Button
                loading={deleting}
                disabled={chatName !== chat.name}
                danger
                onClick={deleteChat}>
                <Translatable resourceKey={i18nKey("Delete")} />
                {#snippet icon(color)}
                    <Delete {color} />
                {/snippet}
            </Button>
            <Button secondary onClick={() => publish("closeModalStack")}>
                <Translatable resourceKey={i18nKey("No, back to safety")} />
                {#snippet icon(color)}
                    <ChevronRight {color} />
                {/snippet}
            </Button>
        </Container>
    </Container>
</SlidingPageContent>
