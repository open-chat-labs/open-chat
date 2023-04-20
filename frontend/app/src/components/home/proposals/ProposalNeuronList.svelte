<script lang="ts">
    import { getContext, onMount } from "svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import { _ } from "svelte-i18n";
    import type { Ballot, OpenChat } from "openchat-client";

    export let governanceCanisterId: string;
    export let proposalId: bigint;
    export let isNns: boolean;

    let ballots: Ballot[] = [];

    const client = getContext<OpenChat>("client");

    onMount(() => {
        client.getProposalVoteDetails(governanceCanisterId, proposalId, isNns).then((res) => {
            console.debug("XXX: proposal details: ", res);
            ballots = res.ballots;
        });
    });
</script>

<Overlay on:close dismissible>
    <ModalContent closeIcon on:close>
        <div slot="header">{$_("proposal.eligibleNeurons")}</div>
        <div slot="body">
            {#each ballots as ballot}
                <div class="ballot">
                    {JSON.stringify(ballot)}
                </div>
            {/each}
        </div>
    </ModalContent>
</Overlay>
