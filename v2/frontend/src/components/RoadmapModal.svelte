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
            <li>Squash bugs and improve general usability</li>
            <li>Remove SMS or payment requirement for registration</li>
            <li>Support multiple languages (with help from the community)</li>
            <li>
                Deposit tokens into your OpenChat wallet, send tokens as messages, withdraw tokens<br />
                (cycles and ICP first, then Bitcoin and Ether later, plus more)
            </li>
            <li>Message forwarding</li>
            <li>Pin message</li>
            <li>Click to show images full-screen</li>
            <li>Improved UI design</li>
            <li>Performance enhancements (asset caching with etags, webrtc improvements)</li>
            <li>2-way voice calls</li>
            <li>2-way video calls</li>
            <li>Native iOS app</li>
            <li>Disappearing messages</li>
            <li>Edit sent messages</li>
            <li>Tag messages (eg star) and search/filter by tag</li>
            <li>Tag groups and search/filter by tag</li>
            <li>Optionally sync with phone contacts and invite contacts</li>
            <li>Custom emojis, stickers</li>
            <li>Link previews</li>
            <li>Report inappropriate content</li>
            <li>Incorporate token swap to allow other tokens to be sent</li>
            <li>Streamlined sign-in</li>
            <li>Native Android app</li>
            <li>Organise events with calendar</li>
            <li>Create polls</li>
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
            <li>
                When it becomes available, incorporate the <a
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
