<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Link from "./Link.svelte";
    import ModalContent from "./ModalContent.svelte";
    import type { Canister } from "../domain/canister";
    import { rtlStore } from "../stores/rtl";

    const dispatch = createEventDispatcher();

    export let canister: Canister | undefined = undefined;

    //@ts-ignore
    let version = window.OPENCHAT_WEBSITE_VERSION;
</script>

<ModalContent large={true} compactFooter={canister !== undefined} on:close>
    <div slot="header">About OpenChat</div>
    <div slot="body" class:rtl={$rtlStore}>
        <p>
            We are pleased to open up OpenChat for beta testing! The number of users has been
            limited to <strong>25,000</strong> for now but this will soon increase.
        </p>
        <p>
            We have rebuilt OpenChat from the ground up over the last 6+ months giving us a solid
            platform going forwards. With a canister per user and per group this will ultimately
            allow OpenChat to scale indefinitely.
        </p>
        <p>
            Unfortunately we won't be able to migrate accounts from the original test version which
            is still running at <a href="https://v1.oc.app" target="_blank">https://v1.oc.app</a>.
            We will keep the old version running as long as possible (hopefully forever) so you can
            continue to access your old messages.
        </p>
        <strong>New feature highlights</strong>
        <ul>
            <li>Message reactions 👍️</li>
            <li>Searchable public groups</li>
            <li>Group admin</li>
            <li>Group preview</li>
            <li>Voice messages</li>
            <li>@user mentions</li>
            <li>Inline _<em>markdown</em>_</li>
        </ul>
        <strong>Upcoming features/developments</strong>
        <ul>
            <li>Send cycles and ICP as chat messages</li>
            <li>
                <a
                    target="_blank"
                    href="https://forum.dfinity.org/t/open-governance-canister-for-sns-design-proposal/10224"
                    >SNS integration</a> / tokenisation
            </li>
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
            (Each user is currently limited to 100Mb storage for media messages and also to creating
            10 groups - you can join as many as you like!)
        </p>
    </div>
    <div class="footer" class:rtl={$rtlStore} slot="footer">
        {#if canister !== undefined}
            <div class="version">
                <table>
                    <tr>
                        <td>user id</td>
                        <td><code><strong>{canister.id}</strong></code></td>
                    </tr>
                    <tr>
                        <td>version</td>
                        <td><code><strong>{version}</strong></code></td>
                    </tr>
                </table>
            </div>
        {/if}
        <Link on:click={() => dispatch("close")}>Close</Link>
    </div>
</ModalContent>

<style type="text/scss">
    td {
        padding-right: $sp4;
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

    .version {
        text-align: left;
        flex: 1;
        @include font(book, normal, fs-50);
    }

    .rtl {
        ul {
            margin-right: 20px;
            margin-left: 0;
        }

        .version {
            text-align: right;
        }

        td {
            padding-left: $sp4;
            padding-right: 0;
        }
    }
</style>
