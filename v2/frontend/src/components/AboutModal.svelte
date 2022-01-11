<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Link from "./Link.svelte";
    import ModalContent from "./ModalContent.svelte";
    import type { Canister } from "../domain/canister";
    import { rtlStore } from "../stores/rtl";

    const dispatch = createEventDispatcher();

    export let canister: Canister | undefined = undefined;
</script>

<ModalContent large={true} compactFooter={canister !== undefined} on:close>
    <div slot="header">About OpenChat</div>
    <div slot="body">
        <p>
            We are pleased to be able to open up OpenChat for beta testing! The number of users has been limited to <strong>5000</strong> for now
            but this will soon increase.
        </p>
        <p>
            We have been building this new version over the last 6+ months and it is the platform for OpenChat going forwards. 
            With a canister per user and per group this will ultimately allow OpenChat to scale indefinitely. 
        </p>
        <p>
            Unfortunately we won't be able to migrate accounts from the orginal test version which is still 
            running at <a href="https://oc.app" target="_blank">https://oc.app</a>. When we finish beta testing the oc.app domain will
            re-direct to this new version and we will keep the old version running as long as possible (hopefully forever) so
            you can continue to access your old messages.
        </p>
        <strong>New feature highlights</strong>
        <ul>
            <li>Message reactions 👍️</li>
            <li>Searchable public groups</li>
            <li>Group admin</li>
            <li>Group preview</li>
            <li>Voice messages</li>
            <li>@user mentions</li>
            <li>Inline <em>markdown</em></li>
        </ul>
        <strong>Upcoming features/developments</strong>
        <ul>
            <li>Send cycles and ICP as chat messages</li>            
            <li><a target="_blank" href="https://medium.com/dfinity/how-the-service-nervous-system-sns-will-bring-tokenized-governance-to-on-chain-dapps-b74fb8364a5c">SNS integration</a> / tokenisation</li>
            <li>Tag/filter messages</li>
            <li>Invite contacts</li>
            <li>Edit sent messages</li>            
            <li>Message forwarding</li>
            <li>Voice and video calls</li>
            <li>Native apps</li>
        </ul>        
        <p>
            <em>Enjoy! - OpenChat devs</em>
        </p>
        <p class="limitations">
            (Each user is currently limited to 100Mb storage for media messages. If the limit is exceeded old media will be deleted leaving a 
            thumbnail only. Each user is limited to creating 10 groups - you can join as many as you like!)
        </p>
    </div>
    <div class="footer" class:rtl={$rtlStore} slot="footer">
        {#if canister !== undefined}
            <div class="version">
                <div><code>user canister <strong>{canister.id}</strong></code></div>
                <div><code>version&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>{canister.wasmVersion.toText()}</strong></code></div>
            </div>
        {/if}
        <Link on:click={() => dispatch("close")}>Close</Link>
    </div>
</ModalContent>

<style type="text/scss">
    .version {
        display: flex;
        flex-direction: column;
        text-align: left;
        &.rtl {
            text-align: right;
        }
        flex: 1;
        @include font(book, normal, fs-50);
    }

    ul {
        margin-left: 20px;
        margin-bottom: $sp4;
    }

    p {
        margin-bottom: $sp4;

        &:last-child {
            margin-bottom: 0;
        }
    }

    a {
        text-decoration: underline;
    }

    .limitations {
        @include font-size(fs-50);
    }

    .footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }
</style>
