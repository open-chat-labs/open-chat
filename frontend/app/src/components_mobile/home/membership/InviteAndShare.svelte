<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BigButton, Container, transition } from "component-lib";
    import type { CommunitySummary, MultiUserChat, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import AccountPlus from "svelte-material-icons/AccountPlusOutline.svelte";
    import ShareIcon from "svelte-material-icons/ShareVariantOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import InviteList from "./InviteList.svelte";
    import { MemberManagement } from "./membersState.svelte";
    import Share from "./Share.svelte";

    type View = "invite" | "share";

    interface Props {
        collection: MultiUserChat | CommunitySummary;
        view?: View;
    }

    let { collection, view = $bindable("invite") }: Props = $props();
    let membersState = new MemberManagement(getContext<OpenChat>("client"), collection);
    let canInvite = $derived(membersState.canInvite());

    function setView(v: View) {
        transition(["fade"], () => {
            view = v;
        });
    }
</script>

<SlidingPageContent title={i18nKey("Invite to thing")} subtitle={i18nKey(collection.name)}>
    <Container height={{ kind: "fill" }} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={{ kind: "fill" }}
            gap={"lg"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            {#if canInvite && view === "invite"}
                <InviteList {membersState} />
            {:else}
                <Share {membersState} />
            {/if}
        </Container>
        {#if canInvite}
            <Container onSwipe={() => {}} padding={["zero", "md"]} gap={"sm"}>
                <BigButton
                    width={{ kind: "share", value: 1 }}
                    mode={view === "invite" ? "active" : "default"}
                    onClick={() => setView("invite")}>
                    {#snippet icon(color)}
                        <AccountPlus {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Invite users")} />
                </BigButton>
                <BigButton
                    width={{ kind: "share", value: 1 }}
                    mode={view === "share" ? "active" : "default"}
                    onClick={() => setView("share")}>
                    {#snippet icon(color)}
                        <ShareIcon {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Share this thing")} />
                </BigButton>
            </Container>
        {/if}
    </Container>
</SlidingPageContent>
