<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import { rtlStore } from "../stores/rtl";
</script>

<ModalContent large={true} on:close>
    <div slot="header">Roadmap</div>
    <div slot="body" class:rtl={$rtlStore}>
        <p>
            Here is a list of features/capabilities currently planned for OpenChat. It roughly
            corresponds to the order we are likely to start development of each item. Obviously
            priorities change and new ideas come up so don't hold us to this!
        </p>
        <ul>
            <li><del>Remove SMS or payment requirement for registration</del></li>
            <li><del>Support multiple languages (with help from the community)</del></li>
            <li><del>Pinned messages</del></li>
            <li><del>Create polls</del></li>
            <li><del>Group permissions including read-only groups</del></li>
            <li><del>Double-click to show images full-screen</del></li>
            <li>
                <del
                    >Deposit ICP into your OpenChat account, send ICP as messages, withdraw ICP</del>
            </li>
            <li><del>Share messages and receive shares from other apps</del></li>
            <li>Send additional tokens as messages, such as BTC, ETH, Cycles, etc</li>
            <li>Message forwarding</li>
            <li>Improved UI design</li>
            <li>Tag messages (eg star) and search/filter by tag</li>
            <li>Edit sent messages</li>
            <li>Organise events with calendar</li>
            <li>Performance enhancements (asset caching with etags, WebRTC improvements)</li>
            <li>Streamlined sign-in</li>
            <li>2-way voice calls</li>
            <li>2-way video calls</li>
            <li>Send "red-letters" containing tokens</li>
            <li>Native iOS app</li>
            <li>Disappearing messages</li>
            <li>Tag groups and search/filter by tag</li>
            <li>Optionally sync with phone contacts and invite contacts</li>
            <li>Custom emojis, stickers</li>
            <li>Link previews</li>
            <li>Communities (think Slack workspaces or Discord servers)</li>
            <li>Report inappropriate content</li>
            <li>Incorporate token swap to allow other tokens to be sent</li>
            <li>Native Android app</li>
            <li>Group video calls (up to some limited number of participants)</li>
            <li>E2E encryption of messages</li>
            <li>
                Broadcast groups
                <ul>
                    <li>stream video 1-many</li>
                    <li>broadcast group roles (owner, admin, participant, viewer)</li>
                    <li>viewers can tip using cycles</li>
                </ul>
            </li>
            <li>Squash bugs and improve general usability</li>
            <li>
                When it becomes available, incorporate the <a
                    target="_blank"
                    href="https://forum.dfinity.org/t/open-governance-canister-for-sns-design-proposal/10224"
                    >SNS</a>
                <ul>
                    <li>Open source</li>
                    <li>Establish an OpenChat token</li>
                    <li>Auction OpenChat tokens</li>
                    <li>Airdrop tokens on active users, early adopters, and for referrals</li>
                    <li>Cede control of OpenChat to the SNS</li>
                    <li><strong>Future roadmap now determined by the community!</strong></li>
                </ul>
            </li>
        </ul>
    </div>
</ModalContent>

<style type="text/scss">
    a {
        text-decoration: underline;
    }

    p {
        margin-bottom: $sp4;
    }

    ul {
        margin-left: 20px;
    }

    .rtl {
        ul {
            margin-right: 20px;
            margin-left: 0;
        }
    }
</style>
