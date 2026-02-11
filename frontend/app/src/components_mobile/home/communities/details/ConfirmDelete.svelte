<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { Body, Button, ColourVars, Container, H2, Input } from "component-lib";
    import {
        i18nKey,
        OpenChat,
        publish,
        routeForScope,
        type CommunitySummary,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import MulticolourText from "../../../MulticolourText.svelte";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
    }

    let { community }: Props = $props();

    let communityName = $state<string>();
    let deleting = $state(false);

    function deleteCommunity() {
        deleting = true;
        page(routeForScope(client.getDefaultScope()));
        client
            .deleteCommunity(community.id)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("communities.errors.deleteFailed"));
                    page(`/community/${community.id.communityId}`);
                } else {
                    publish("closeModalStack");
                }
            })
            .finally(() => (deleting = false));
    }
</script>

<SlidingPageContent title={i18nKey("Delete a chat")} subtitle={i18nKey(community.name)}>
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
                            text: i18nKey(community.name),
                            colour: "primary",
                        },
                        {
                            text: i18nKey(" community"),
                            colour: "textPrimary",
                        },
                    ]}></MulticolourText>
            </H2>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Do you definitely want to delete this community? All of your history will be lost, and this cannot be undone.",
                    )} />
            </Body>
        </Container>

        <Container>
            <Input
                error={communityName !== community.name}
                bind:value={communityName}
                placeholder={"Type in community name..."}
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
                disabled={communityName !== community.name}
                danger
                onClick={deleteCommunity}>
                <Translatable resourceKey={i18nKey("Delete")} />
                {#snippet icon(color)}
                    <Delete {color} />
                {/snippet}
            </Button>
            <Button secondary onClick={() => publish("closeModalPage")}>
                <Translatable resourceKey={i18nKey("No, back to safety")} />
                {#snippet icon(color)}
                    <ChevronRight {color} />
                {/snippet}
            </Button>
        </Container>
    </Container>
</SlidingPageContent>
