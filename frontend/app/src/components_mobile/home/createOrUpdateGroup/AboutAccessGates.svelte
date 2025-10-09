<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, Container } from "component-lib";
    import Translatable from "../../Translatable.svelte";
</script>

{#snippet gate(icon: string, alt: string, title: string, sub: string)}
    <Container crossAxisAlignment={"center"} gap={"xl"}>
        <img class={"icon"} src={`/assets/access_gate/${icon}`} {alt} />
        <Container gap={"xs"} direction={"vertical"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey(title)}></Translatable>
            </Body>
            <BodySmall colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey(sub)}></Translatable>
            </BodySmall>
        </Container>
    </Container>
{/snippet}

<Container
    supplementalClass={"group_general_setup"}
    height={{ kind: "fill" }}
    gap={"xl"}
    direction={"vertical"}
    padding={"xl"}>
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
    {@render gate(
        "neuron.svg",
        "neuron holder",
        "Neuron holder",
        "Users must stake a neuron with specific criteria (e.g. dissolve delay, stake amount).",
    )}
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

<style lang="scss">
    img.icon {
        width: 3rem;
    }
</style>
