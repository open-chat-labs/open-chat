<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, CommonButton, Container } from "component-lib";
    import Translatable from "../Translatable.svelte";
</script>

<Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
    <Container>
        <Body fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Bot permissions")} />
        </Body>
        <CommonButton size={"small_text"} mode={"active"}>
            <a
                href={"https://github.com/open-chat-labs/open-chat-bots/blob/main/OVERVIEW.md"}
                target={"_blank"}>
                <Translatable resourceKey={i18nKey("Find out more")} />
            </a>
        </CommonButton>
    </Container>
    <Body colour={"textSecondary"}>
        <Translatable
            resourceKey={i18nKey(
                "Bots use command and autonomous permissions. Command permissions are required by the bot’s commands, while autonomous permissions are required for bot’s autonomous operations. ",
            )} />
    </Body>
</Container>
