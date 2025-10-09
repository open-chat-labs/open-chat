<script lang="ts">
    import { Container } from "component-lib";
    import AboutAccessGate from "./AboutAccessGate.svelte";
    import AboutNeuronGate from "./AboutNeuronGate.svelte";
</script>

{#snippet gate(icon: string, alt: string, title: string, subtitle: string)}
    <AboutAccessGate padding={"md"} {icon} {alt} {title} {subtitle} />
{/snippet}

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
    <AboutNeuronGate padding={"md"} />
    {@render gate(
        "payment.svg",
        "payment",
        "Payment",
        "Access is granted after the user pays a one-time or recurring entry fee.",
    )}
    {@render gate(
        "token_balance.svg",
        "minimum token balance",
        "Minimum token balance",
        "Requires users to hold a minimum amount of a specified token.",
    )}
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
