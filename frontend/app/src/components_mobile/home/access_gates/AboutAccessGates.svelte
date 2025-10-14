<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container } from "component-lib";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import AboutAccessGate from "./AboutAccessGate.svelte";
    import AboutBalanceGate from "./AboutBalanceGate.svelte";
    import AboutChitGate from "./AboutChitGate.svelte";
    import AboutNeuronGate from "./AboutNeuronGate.svelte";
    import AboutPaymentGate from "./AboutPaymentGate.svelte";
</script>

{#snippet gate(icon: string, alt: string, title: string, subtitle: string)}
    <AboutAccessGate padding={"md"} {icon} {alt} {title} {subtitle} />
{/snippet}

<SlidingPageContent title={i18nKey("About access gates")}>
    <Container height={{ kind: "fill" }} direction={"vertical"} padding={"xs"}>
        {@render gate(
            "lifetime_diamond.svg",
            "lifetime diamond",
            "Lifetime diamond membership",
            "Grants access to users who hold a lifetime diamond membership.",
        )}
        {@render gate(
            "diamond.svg",
            "diamond",
            "Diamond membership",
            "Users must have an active diamond membership to obtain access.",
        )}
        <AboutChitGate padding={"md"} />
        <AboutNeuronGate padding={"md"} />
        <AboutPaymentGate padding={"md"} />
        <AboutBalanceGate padding={"md"} />
        {@render gate(
            "unique_person.svg",
            "unique person",
            "Unique person",
            "Ensures access is limited to a verified unique human (via the proof of personhood credential).",
        )}
        {@render gate(
            "locked.svg",
            "locked",
            "Locked",
            "Access is retricted to invited users only; not open the public.",
        )}
        {@render gate(
            "nft_holder.svg",
            "nft holder",
            "NFT holder (coming soon)",
            "Must hold a specific NFT gate for useres who own a particular NFT (feature not yet available).",
        )}
    </Container>
</SlidingPageContent>
