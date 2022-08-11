<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import Link from "./Link.svelte";
    import ModalContent from "./ModalContent.svelte";
    import type { Canister } from "../domain/canister";
    import { rtlStore } from "../stores/rtl";
    import Markdown from "./home/Markdown.svelte";

    const dispatch = createEventDispatcher();

    export let canister: Canister | undefined = undefined;

    let body = `
OpenChat (OC) is a fully featured chat application running on the [Internet Computer (IC)](https://medium.com/dfinity/the-internet-computer-for-geeks-a-new-dfinity-white-paper-ecb075b2d525) similar to Signal and Telegram, and will soon be getting a major new capability called “communities” which are like Slack workspaces or Discord servers. It is a responsive, progressive web application (PWA) and as such scales to take advantage of any screen size and integrates with devices in a similar way to native apps, with notifications on desktop and Android devices, and on iOS from next year (once Apple supports web push).

The IC is a decentralized global compute platform which uses novel block-chain technology to achieve consensus within subnets. It is tamperproof, globally distributed in numerous independent data centers, and aims to be truly unstoppable by any centralized authority.

The OC app uses repeatable builds, and runs as a collection of canisters. It will soon be possible for anyone to see the version of the source code that is running on any canister at any given time with a link back to the particular commit on github, and for them to prove this is true. Each user is given their own canister which holds their direct chat data, links to the groups they are members of, and also serves as a wallet allowing OC users to hold and manage tokens.

OC users can send messages to each other containing ICP tokens (and soon BTC) and so can be used for global remittance.

However, the ground-breaking difference between OpenChat and other similar apps, is that it will soon become a decentralized app (dapp), itself governed as a DAO. It will have its own governance token called CHAT, analogous to ICP, and be controlled by a system called the [SNS (Service Nervous System)](https://medium.com/dfinity/how-dapp-developers-placing-their-faith-in-total-decentralization-will-inherit-the-world-79419a3e36c9) which is analogous to the [NNS (Network Nervous System)](https://medium.com/dfinity/the-network-nervous-system-governing-the-internet-computer-1d176605d66a) on the IC.

Users will be automatically rewarded with CHAT tokens for actively using the app and helping it grow. The algorithm used for this will be dicussed with the community and then development will start subject to an approved SNS proposal. Amongst other factors it will likely take into account the following:

- posting relevant messages (no spamming!)
- inviting others to join (if they become active too)
- moderating public groups
- owning/managing popular groups
- time online
`;

    //@ts-ignore
    let version = window.OPENCHAT_WEBSITE_VERSION;
</script>

<ModalContent large={true} compactFooter={canister !== undefined} on:close>
    <div slot="header">About OpenChat</div>
    <div slot="body" class:rtl={$rtlStore}>
        <Markdown text={body} inline={false} />
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
        .version {
            text-align: right;
        }

        td {
            padding-left: $sp4;
            padding-right: 0;
        }
    }
</style>
