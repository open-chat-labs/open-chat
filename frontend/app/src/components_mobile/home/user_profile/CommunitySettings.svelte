<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { Body, BodySmall, Chip, CommonButton, Container, Option, Select } from "component-lib";
    import {
        type CommunitySummary,
        ErrorCode,
        i18nKey,
        OpenChat,
        ROLE_NONE,
        sortedCommunitiesStore,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    let selectedCommunity = $state<CommunitySummary | undefined>(undefined);
    let displayName = $state<string>();
    let displayNameValid = $state<boolean>(true);
    let displayNameError = $state<string>();
    let originalDisplayName = $state<string>();
    let saving = $state(false);

    let displayNames = $derived<[CommunitySummary, string][]>(
        $sortedCommunitiesStore
            .filter(
                (c) => c.membership.role !== ROLE_NONE && c.membership.displayName !== undefined,
            )
            .map((c) => [c, c.membership.displayName!]),
    );

    function onCommunitySelected() {
        displayName = originalDisplayName = selectedCommunity?.membership?.displayName;
        displayNameError = undefined;
    }

    function save() {
        if (selectedCommunity === undefined) return;
        saveDisplayName(selectedCommunity, displayName);
    }

    function deleteDisplayName(community: CommunitySummary) {
        saveDisplayName(community);
    }

    function saveDisplayName(community: CommunitySummary, displayName?: string) {
        saving = true;

        client
            .setMemberDisplayName(community.id, displayName)
            .then((resp) => {
                if (resp.kind === "error") {
                    if (resp.code === ErrorCode.DisplayNameTooShort) {
                        displayNameError = "register.displayNameTooShort";
                    } else if (resp.code === ErrorCode.DisplayNameTooLong) {
                        displayNameError = "register.displayNameTooLong";
                    } else if (resp.code === ErrorCode.InvalidDisplayName) {
                        displayNameError = "register.displayNameInvalid";
                    } else {
                        displayNameError = "unexpectedError";
                    }
                }
            })
            .catch(() => {
                toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
            })
            .finally(() => {
                saving = false;
            });
    }
</script>

<SlidingPageContent title={i18nKey("Communities")} subtitle={i18nKey("General options")}>
    <Container
        padding={["xxl", "lg"]}
        gap={"lg"}
        height={"fill"}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            {#if displayNames.length > 0}
                <Container padding={["zero", "lg"]} direction={"vertical"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Existing associations")}></Translatable>
                    </Body>

                    <BodySmall colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "Below is an existing list of associated custom display names with your communities. Tap to remove any existing associations.",
                            )}></Translatable>
                    </BodySmall>
                </Container>
                <Container padding={["zero", "lg"]} gap={"sm"} direction={"vertical"}>
                    {#each displayNames as [community, displayName]}
                        <Chip onRemove={() => deleteDisplayName(community)}>
                            {community.name} / {displayName}
                        </Chip>
                    {/each}
                </Container>
            {/if}

            <Container padding={["zero", "lg"]} direction={"vertical"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Select a community")}></Translatable>
                </Body>

                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            "Display names can be set per community. Select a community for which you would like to set a custom display name.",
                        )}></Translatable>
                </BodySmall>
            </Container>
            <Select
                onSelect={(val) => {
                    selectedCommunity = val;
                    onCommunitySelected();
                }}
                disabled={saving}
                placeholder={"Select a community"}
                value={selectedCommunity}>
                {#snippet selectedValue(community)}
                    {community.name}
                {/snippet}
                {#snippet selectOptions(onSelect)}
                    <Container padding={"lg"} direction={"vertical"}>
                        {#each $sortedCommunitiesStore.filter((s) => s.membership?.role !== ROLE_NONE) as community (community.id.communityId)}
                            <Option
                                value={community}
                                onClick={onSelect}
                                selected={selectedCommunity?.id.communityId ===
                                    community.id.communityId}>
                                {community.name}
                            </Option>
                        {/each}
                    </Container>
                {/snippet}
                {#snippet subtext()}
                    <Translatable
                        resourceKey={i18nKey("This does not apply to messages sent or received")}
                    ></Translatable>
                {/snippet}
            </Select>

            {#if selectedCommunity !== undefined}
                <Container padding={["zero", "lg"]} direction={"vertical"}>
                    <Body fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Display name")}></Translatable>
                    </Body>

                    <BodySmall colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                `Provide your custom display name for the "${selectedCommunity.name}" community.`,
                            )}></Translatable>
                    </BodySmall>
                </Container>

                <DisplayNameInput
                    disabled={saving}
                    {client}
                    errorMsg={displayNameError}
                    {originalDisplayName}
                    bind:displayName
                    bind:displayNameValid>
                </DisplayNameInput>

                <Container mainAxisAlignment={"end"}>
                    <CommonButton
                        disabled={!displayNameValid}
                        loading={saving}
                        onClick={save}
                        size={"medium"}
                        mode={"active"}>
                        {#snippet icon(color, size)}
                            <Plus {color} {size}></Plus>
                        {/snippet}
                        <Translatable resourceKey={i18nKey("Add association")}></Translatable>
                    </CommonButton>
                </Container>
            {/if}
        </Container>
    </Container>
</SlidingPageContent>
