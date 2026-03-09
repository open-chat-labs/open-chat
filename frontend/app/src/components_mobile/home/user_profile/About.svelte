<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, ColourVars, Container, Logo, Overview } from "component-lib";
    import { publish, type OpenChat } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { openUrl } from "tauri-plugin-oc-api";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    type OnClick = { kind: "route"; url: string } | { kind: "action"; action: () => void };

    const client = getContext<OpenChat>("client");

    //@ts-ignore
    let version = window.OC_WEBSITE_VERSION;

    function goTo(url: string, local: boolean = true) {
        if (client.isNativeApp()) {
            openUrl({ url: new URL(url, local ? client.canonicalOrigin() : undefined).toString() });
        } else {
            page(url);
        }
    }
</script>

{#snippet menuitem(label: string, onclick: OnClick)}
    <Container
        onClick={onclick.kind === "action" ? onclick.action : () => goTo(onclick.url)}
        crossAxisAlignment={"center"}>
        <Body fontWeight={"bold"}>{label}</Body>
        <ChevronRight color={ColourVars.primary} />
    </Container>
{/snippet}

<SlidingPageContent title={i18nKey("About")}>
    <Container
        padding={["sm", "xxl", "xxl", "xxl"]}
        height={"fill"}
        gap={"xs"}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Logo size={"huge"} />
        <Overview align={"center"} colour={"primary"}>OpenChat</Overview>
        <BodySmall fontWeight={"bold"} align={"center"} colour={"textSecondary"}
            >Android / {version}</BodySmall>
        <div class="line"></div>
        <Container direction={"vertical"} gap={"xl"}>
            {@render menuitem("Architecture", {
                kind: "action",
                action: () => publish("architecture"),
            })}
            {@render menuitem("Blog", { kind: "route", url: "/blog" })}
            {@render menuitem("FAQ", { kind: "route", url: "/faq" })}
            {@render menuitem("Features", { kind: "route", url: "/features" })}
            {@render menuitem("Guidelines", { kind: "route", url: "/guidelines" })}
            {@render menuitem("Metrics", {
                kind: "route",
                url: "https://tokenterminal.com/explorer/projects/openchat",
            })}
            {@render menuitem("Roadmap", { kind: "route", url: "/roadmap" })}
            {@render menuitem("Whitepaper", { kind: "route", url: "/whitepaper" })}
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    .line {
        margin: var(--sp-xl) 0;
        height: 6px;
        width: 100%;
        border-radius: var(--rad-circle);
        background-color: var(--primary);
    }
</style>
