<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, CommonButton, Container } from "component-lib";
    import { publish } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Translatable from "../../Translatable.svelte";
    import { UpdateGroupState } from "../createOrUpdateGroup/group.svelte";
    import GroupCard from "../createOrUpdateGroup/GroupCard.svelte";
    import type { UpdateGroupOrCommunityState } from "../groupOrCommunity.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    interface Props {
        data: UpdateGroupOrCommunityState;
    }

    let { data }: Props = $props();
</script>

<SlidingPageContent title={i18nKey("Permission")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        {#if data instanceof UpdateGroupState}
            <GroupCard candidateGroup={data.candidateGroup} />
        {/if}

        <Container padding={["zero", "md"]} gap={"sm"} direction={"vertical"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Permissions")}></Translatable>
            </Body>

            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Blah blah blah some explanatory text about permissions that we have to fill in later. Let's worry about how this works first",
                    )}></Translatable>
            </BodySmall>
        </Container>

        <Container padding={["xl", "zero", "zero", "zero"]} mainAxisAlignment={"end"}>
            <CommonButton onClick={() => publish("closeModalPage")} mode="active" size={"medium"}>
                {#snippet icon(color)}
                    <ArrowLeft {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Done, go back")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
