<script lang="ts">
    import { Avatar, Body, Button, Container, Option, Sheet, Subtitle } from "component-lib";
    import {
        type ChatIdentifier,
        type CommunityMap,
        type CommunitySummary,
        type OpenChat,
        publish,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Translatable from "../../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ownedCommunities: CommunityMap<CommunitySummary>;
        groupId: ChatIdentifier;
        onCancel: () => void;
    }

    let { ownedCommunities, groupId, onCancel }: Props = $props();

    let communitiesList = $derived([...ownedCommunities.values()]);

    let importing = $state(false);
    let selected: CommunitySummary | undefined = $state();

    function performImport() {
        if (selected === undefined || groupId.kind !== "group_chat") return;

        importing = true;
        client
            .importToCommunity(groupId, selected.id)
            .then((channelId) => {
                if (channelId === undefined) {
                    toastStore.showFailureToast(i18nKey("communities.errors.importFailed"));
                } else {
                    onCancel();
                    publish("successfulImport", channelId);
                }
            })
            .finally(() => (importing = false));
    }

    function selectCommunity(community: CommunitySummary) {
        selected = community;
    }

    onMount(() => {
        selected = communitiesList.length > 0 ? communitiesList[0] : undefined;
    });

    function areEqual(c1?: CommunitySummary, c2?: CommunitySummary): boolean {
        return c1 !== undefined && c2 !== undefined && c1.id.communityId === c2.id.communityId;
    }
</script>

<Sheet onDismiss={onCancel}>
    <Container
        height={{ kind: "fixed", size: "100%" }}
        supplementalClass={"token_selector"}
        padding={"lg"}
        gap={"xl"}
        direction={"vertical"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("communities.chooseCommunity")}></Translatable>
        </Subtitle>

        <Container gap={"sm"} supplementalClass={"token_selector"} direction={"vertical"}>
            {#each communitiesList as community}
                <Option
                    onClick={() => selectCommunity(community)}
                    padding={["sm", "md", "sm", "sm"]}
                    value={community}
                    selected={areEqual(selected, community)}>
                    <Container crossAxisAlignment={"center"} gap={"sm"}>
                        <Avatar
                            url={client.communityAvatarUrl(
                                community.id.communityId,
                                community.avatar,
                            )} />
                        <Body fontWeight={"bold"}>{community.name}</Body>
                    </Container>
                </Option>
            {/each}
        </Container>
        <Container>
            <Button
                loading={importing}
                disabled={importing || selected === undefined}
                onClick={performImport}
                ><Translatable resourceKey={i18nKey("communities.importBtn")} /></Button>
        </Container>
    </Container>
</Sheet>
