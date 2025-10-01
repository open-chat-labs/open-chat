<script lang="ts">
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Caption,
        ColourVars,
        CommonButton,
        Container,
        Form,
        Input,
        TextArea,
    } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        OpenChat,
        publish,
        type PublicProfile,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import SparkleBox from "../../SparkleBox.svelte";
    import Translatable from "../../Translatable.svelte";
    import ProfileSettingsHeader from "./ProfileSettingsHeader.svelte";
    import UserProfileSummaryCard from "./UserProfileSummaryCard.svelte";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 40;
    const MAX_DESC_LENGTH = 1024;
    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let verified = $derived(user?.isUniquePerson ?? false);
    let profile: PublicProfile | undefined = $state();
</script>

<Container
    mainAxisAlignment={"spaceBetween"}
    backgroundColour={ColourVars.background0}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <ProfileSettingsHeader />
    <Container
        padding={["zero", "lg", "zero", "lg"]}
        gap={"lg"}
        height={{ kind: "fill" }}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"lg"} direction={"vertical"}>
            {#if user !== undefined && profile !== undefined}
                <UserProfileSummaryCard {user} {profile} />
            {/if}
            {#if !verified}
                <SparkleBox buttonText={i18nKey("Get Diamond")} onClick={() => publish("upgrade")}>
                    {#snippet title()}
                        <MulticolourText
                            parts={[
                                {
                                    text: i18nKey("Upgrade to "),
                                    colour: "primaryLight",
                                },
                                {
                                    text: i18nKey("Diamond"),
                                    colour: "secondary",
                                },
                            ]} />
                    {/snippet}
                    {#snippet body()}
                        <MulticolourText
                            parts={[
                                {
                                    text: i18nKey(
                                        "Diamond members get access to many additional features including extra storage, translation and much more. ",
                                    ),
                                    colour: "primaryLight",
                                },
                                {
                                    text: i18nKey("Join now!"),
                                    colour: "textPrimary",
                                },
                            ]} />
                    {/snippet}
                    {#snippet buttonIcon(color)}
                        <DiamondOutline {color} />
                    {/snippet}
                </SparkleBox>
            {/if}
            <Container padding={["zero", "xl"]}>
                <Caption>
                    <Translatable resourceKey={i18nKey("Profile data")}></Translatable>
                </Caption>
            </Container>
            <Form onSubmit={() => console.log("On submit")}>
                <Container
                    direction={"vertical"}
                    gap={"lg"}
                    supplementalClass={"user_profile_info"}>
                    <Input
                        minlength={MIN_LENGTH}
                        maxlength={MAX_LENGTH}
                        countdown
                        id={"username"}
                        placeholder={"Username"}>
                        {#snippet subtext()}
                            <Translatable
                                resourceKey={i18nKey(
                                    "Username, alphanumeric characters & underscrores only",
                                )}></Translatable>
                        {/snippet}
                    </Input>
                    <Input
                        minlength={MIN_LENGTH}
                        maxlength={MAX_LENGTH}
                        countdown
                        id={"display_name"}
                        placeholder={"Dispaly name"}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("Optional, your display name")}
                            ></Translatable>
                        {/snippet}
                    </Input>
                    <TextArea
                        maxlength={MAX_DESC_LENGTH}
                        countdown
                        id={"user_bio"}
                        placeholder={"Bio"}>
                        {#snippet subtext()}
                            <Translatable resourceKey={i18nKey("Tell us a bit about yourself")}
                            ></Translatable>
                        {/snippet}
                    </TextArea>
                    <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
                        <CommonButton
                            onClick={() => console.log("save")}
                            size={"medium"}
                            mode={"active"}>
                            {#snippet icon(color)}
                                <Save {color}></Save>
                            {/snippet}
                            <Translatable resourceKey={i18nKey("Save profile")}></Translatable>
                        </CommonButton>
                    </Container>
                </Container>
            </Form>
        </Container>
    </Container>
</Container>

<style lang="scss">
</style>
