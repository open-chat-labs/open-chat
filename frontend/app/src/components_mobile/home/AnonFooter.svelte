<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, ColourVars, Container, Sheet } from "component-lib";
    import { type OpenChat, pageReplace, publish, routeStore } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import MulticolourText, { type TextPart } from "../MulticolourText.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        children?: Snippet;
    }

    let { children }: Props = $props();

    const signInMsg = [
        {
            text: i18nKey("Back to "),
            colour: "textSecondary",
        },
        {
            text: i18nKey("create account "),
            colour: "primary",
        },
        {
            text: i18nKey("& "),
            colour: "textSecondary",
        },
        {
            text: i18nKey("sign in"),
            colour: "primary",
        },
    ];
    const backToExploreMsg = [
        {
            text: i18nKey("Back to "),
            colour: "textSecondary",
        },
        {
            text: i18nKey("Communities explorer"),
            colour: "primary",
        },
    ];

    let msg = $derived.by<TextPart[]>(() => {
        switch ($routeStore.kind) {
            case "communities_route":
                return signInMsg as TextPart[];
            default:
                return backToExploreMsg as TextPart[];
        }
    });

    function back() {
        publish("closeModalStack");
        if ($routeStore.kind === "communities_route") {
            client.updateIdentityState({ kind: "logging_in" });
        } else {
            pageReplace("/communities");
        }
    }
</script>

<Sheet transparent animate={false}>
    <Container
        gap={"sm"}
        mainAxisAlignment={children ? "spaceBetween" : "center"}
        supplementalClass={"anon-footer"}
        padding={["lg", "lg", "zero", "lg"]}>
        <Container
            width={"hug"}
            height={{ size: "3.5rem" }}
            padding={["md", "xl", "md", "sm"]}
            gap={"sm"}
            shadow={"var(--shadow-menu)"}
            borderRadius={"circle"}
            mainAxisAlignment={"center"}
            crossAxisAlignment={"center"}
            background={ColourVars.background2}
            onClick={back}>
            <ChevronLeft size={"1.6rem"} color={ColourVars.textSecondary} />
            <Body width={"hug"}>
                <MulticolourText parts={msg}></MulticolourText>
            </Body>
        </Container>
        {@render children?.()}
    </Container>
</Sheet>
