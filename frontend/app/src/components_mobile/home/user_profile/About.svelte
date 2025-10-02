<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, ColourVars, Container, Logo, Overview } from "component-lib";
    import page from "page";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import ProfileSectionHeader from "./ProfileSectionHeader.svelte";

    //@ts-ignore
    let version = window.OC_WEBSITE_VERSION;
</script>

{#snippet menuitem(label: string, route: string)}
    <Container onClick={() => page(route)} crossAxisAlignment={"center"}>
        <Body fontWeight={"bold"}>{label}</Body>
        <ChevronRight color={ColourVars.primary} />
    </Container>
{/snippet}

<Container
    mainAxisAlignment={"spaceBetween"}
    background={ColourVars.background0}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <ProfileSectionHeader titleKey={i18nKey("About")} />
    <Container
        padding={["sm", "xxl", "xxl", "xxl"]}
        height={{ kind: "fill" }}
        gap={"xs"}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Logo size={"huge"} />
        <Overview align={"center"} colour={"primary"}>OpenChat</Overview>
        <BodySmall fontWeight={"bold"} align={"center"} colour={"textSecondary"}
            >Android / {version}</BodySmall>
        <div class="line"></div>
        <Container direction={"vertical"} gap={"xl"}>
            {@render menuitem("Architecture", "/architecture")}
            {@render menuitem("Blog", "/blog")}
            {@render menuitem("FAQ", "/faq")}
            {@render menuitem("Features", "/features")}
            {@render menuitem("Guidelines", "/guidelines")}
            {@render menuitem("Metrics", "/metrics")}
            {@render menuitem("Roadmap", "/roadmap")}
            {@render menuitem("Whitepaper", "/whitepaper")}
        </Container>
    </Container>
</Container>

<style lang="scss">
    .line {
        margin: var(--sp-xl) 0;
        height: 6px;
        width: 100%;
        border-radius: var(--rad-circle);
        background-color: var(--primary);
    }
</style>
