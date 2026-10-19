import type { RoadmapItem } from "@openchat/ui/src/pages/learnContent";

// The roadmap from the old landing pages (components/landingpages/RoadmapPage.svelte), converted
// to data: the "Future" items up next, then the rest newest first.

// a link to one of OpenChat's posts on X, as the old page links them
function x(id: string): string {
    return `https://twitter.com/OpenChat/status/${id}`;
}

export const roadmap: RoadmapItem[] = [
    {
        title: "NFTs, contacts, personas and more",
        status: "next",
        detail: {
            paras: [
                "**NFTs**",
                "It is expected the ICRC NFT proposals [ICRC-7](https://github.com/dfinity/ICRC/blob/icrc_7_and_37/ICRCs/ICRC-7/ICRC-7.md) and [ICRC-37](https://github.com/dfinity/ICRC/blob/icrc_7_and_37/ICRCs/ICRC-37/ICRC-37.md) will [soon be approved](https://forum.dfinity.org/t/nft-standards-icrc-7-and-icrc-37-ready-for-nns-vote/29618) at which point we can start to bring NFT functionality to OpenChat.",
                "**Contacts/friends**",
                "Each user would have a list of contacts.",
                "**Personas**",
                "Create multiple personas on OpenChat each with their own canister but tied to the same account. Easily swap between personas without signing up/in again. This helps you remain anonymous where you want to be or explore different sides of your personality!",
                "**More**",
            ],
            points: [
                { label: "Hold NFTs in your wallet" },
                { label: "Send/receive NFTs as messages" },
                { label: "Verified NFT avatars" },
                { label: "Gate group/community/channel membership by NFT collection" },
                { label: "Display NFTs in your profile" },
                { label: "Buy/sell NFTs" },
                { label: "Bitcoin Rune integration(?)" },
                { label: "import contacts from phone or google etc" },
                { label: "invite contacts to become OpenChat users" },
                { label: "invite users to become contacts" },
                {
                    label: "optionally various profile/contact information made available only to contacts",
                },
                { label: "optionally only allow DMs from contacts" },
                { label: "verifiable contact information (using verified credentials)" },
                { label: "build a social graph to help spot mercenary/farming behaviour" },
                { label: "OpenChat on Utopia (aka the _Intranet_ Computer)" },
                { label: "Tag groups and communities and search/filter by tag" },
                { label: "Gallery view for chats showing all images" },
                { label: "Events calendar for a community" },
                { label: "Custom emojis, stickers" },
            ],
        },
    },
    {
        title: "Native apps",
        status: "next",
        detail: {
            paras: [
                "Currently OpenChat is delivered as a responsive progressive web app. This means that it performs well on any device via the platform's browser. It can also be saved or \"installed\" to your device's home screen for an even more app-like experience. There are great advantages to this approach. We can deliver for all platforms using a single codebase which allows us to deliver features faster and without preference to any one particular platform.",
                "However, the native web apis available to us are a work in progress and not all platforms develop at the same speed. Furthermore, some people simply prefer to get their apps in their chosen app store and there is an undeniable stickiness in this approach.",
                "In the medium term, the team will explore options to preserve the single codebase benefits and combine it with a platform specific native app shell which will provide full access to the native platform apis that we need.",
                "In the longer term, it may be possible to develop fully native mobile apps for each platform.",
            ],
        },
    },
    {
        title: "Blue sky thinking",
        status: "next",
        detail: {
            paras: [
                "The list of ways OpenChat could be extended and enhanced is virtually endless. Here are a few more ideas.",
                "**Like/dislike messages**",
                "Chat is chronologically ordered. If we were to introduce the ability to like/dislike posts we could start offering alternative ways to view messages such as by popularity and/or in a tree view. Think Reddit.",
                "**Following**",
                "We could further expand OpenChat by allowing users to follow each other and subscribe to feeds. Think Twitter/X.",
                "**Job boards**",
                'A DAO member recently [floated the idea](/community/dgegb-daaaa-aaaar-arlhq-cai/channel/309853277321768416862922950227002295881/150) that OpenChat could host a "world beating Web3 version of Upwork or Fiverr".',
            ],
        },
    },
    {
        title: "Bots and e2e encryption",
        status: "done",
        year: "2025",
        when: "Q1",
        detail: {
            paras: [
                "Here is a list of features we expect to build this year.",
                "**Bots**",
                "Bots are a key feature of modern chat apps. They can be used to automate tasks, provide information, or just for fun. We plan to build a small suite of initial bots and then release a bot framework allowing users to interact with bots by typing commands into the chat box. We will also write developer documentation to help others build their own bots. We will then extend the bot framework to support webhooks and autonomous agents. And we will integrate an AI chat bot that can hold a conversation with users.",
                "**End-to-end encryption**",
                "We plan to add end-to-end encryption for 1-1 chats. This will ensure that only the sender and recipient can read the messages. As a stretch goal, we will add the option to enable end-to-end encryption for private group chats.",
                "**Wallet**",
                "By implementing the new ICRC wallet standards we will allow users to connect 3rd-party wallets, including Oisy, to support transfer, swap, etc. We will also allow users to deposit Bitcoin directly into their OpenChat wallet by automatically converting it to ckBTC. And we will allow users to withdraw ckBTC from their OpenChat wallet to a BTC address.",
                "**User profiles**",
                'We will add the ability for users to create a public profile page optionally including a personal feed of messages. This is a pre-cursor to the concept of "following" other users and ultimately the development of aggregated feeds of all users that you choose to follow.',
                "**Communities**",
                "**Native apps**",
                'We will investigate the viability of building native apps for iOS and Android devices. The aim is to build thin native "wrappers" around the core web components used by the existing web app such that the large majority of code is shared. As a strech goal for the quarter we will build proof of concept OpenChat apps hosted in the app stores with native app notifications.',
                "**Onboarding**",
                "We will improve the onboarding experience for new users to help them understand the key features of OpenChat and how to use them. We will also make it simpler for new and existing users to link an optional email address to allow account recovery if the user loses access to their primary sign-in method.",
                "**Monetisation**",
                "We will introduce some additional monetisation features including, CHIT streak insurance, and a 5% fee on prize messages.",
            ],
            points: [
                {
                    label: "We will add a proposal mechanism to support verified communities (blue tick).",
                },
                {
                    label: "Allow owners to turn on advertising (using FairBuy) to help monetise their communities/groups",
                },
                {
                    label: "Allow owners to pay to boost their communities in the community explorer (stretch goal)",
                },
                {
                    label: "Enhanced tooling for community governance. This may include quorum decision making for community owners to avoid centralised community control (stretch goal)",
                },
            ],
        },
    },
    {
        title: "Scalability and performance",
        status: "done",
        year: "2024",
        when: "Q4",
        detail: {
            points: [
                { label: "Scalability and performance", href: x("1867622369537536337") },
                {
                    label: "Migrated large majority of user/group/community data (incl messages and members) to stable memory allowing for huge communities/groups and faster/cheaper canister upgrades",
                },
                {
                    label: "Migrated canister APIs to use msgpack rather than candid greatly reducing network bandwidth thus improving performance",
                },
                { label: "Scaled OpenChat onto a 3rd subnet" },
                {
                    label: "DAUs grew from around 10K to 15.5K",
                    href: "https://tokenterminal.com/explorer/projects/openchat?v=M2ViOTBjYTRlYzg2OTA3NTI4ZWE0YmI5",
                },
                {
                    label: "Recruited a full-stack developer, and a product and marketing specialist, both starting in early January",
                    href: x("1873018431622275241"),
                },
                {
                    label: "$CHAT listed on [Bitmart](https://x.com/BitMartExchange/status/1843939377476767839) and [Kongswap](https://x.com/kongswap/status/1847125452491837880)",
                },
                {
                    label: "View activity feed showing messages where you have been mentioned, replied to, tipped, etc",
                },
                {
                    label: "Link additional sign-in providers to your OpenChat account (eg. recovery email / ETH wallet)",
                },
                {
                    label: 'Support expiry of community/channel/group access gates and "lapsing" membership',
                    href: "/blog/access_gate_expiry",
                },
                {
                    label: 'Created the "OpenChat Arcade" community with Minesweeper and Cupetopia (more to follow)',
                    href: "/community/u7zzf-hyaaa-aaaaf-bm63a-cai",
                },
                {
                    label: "Phase 1 Bots framework - think Discord or Telegram bots - public release in January",
                },
                {
                    label: `[Kong Swap added to OpenChat as a swap provider.](${x("1843917939558494695")}) For each swap OpenChat uses the provider giving the best price.`,
                },
            ],
        },
    },
    {
        title: "Tokenisation and Growth continued",
        status: "done",
        year: "2024",
        when: "Q3",
        detail: {
            points: [
                {
                    label: "Extended CHIT reward scheme with achievements, user referrals, leaderboard, badges etc",
                    href: "https://oc.app/blog/chit",
                },
                {
                    label: "Monthly CHIT for CHAT airdrops including lottery",
                    href: x("1821139921244946577"),
                },
                {
                    label: "Introduced Proof of Unique Personhood to gate airdrops",
                    href: x("1817903346885259698"),
                },
                {
                    label: "DAUs grew from around 3K to 10K",
                    href: "https://tokenterminal.com/explorer/projects/openchat?v=M2ViOTBjYTRlYzg2OTA3NTI4ZWE0YmI5",
                },
                {
                    label: "$CHAT listed on [LBank](https://x.com/LBank_Exchange/status/1818225021992497568), [Bitrue](https://x.com/BitrueOfficial/status/1818550356047200703) and [Coinstore](https://x.com/CoinstoreExc/status/1831973943462531167)",
                },
                {
                    label: "Improved wallet UX to account for a large number of tokens and to give the user more control",
                },
                {
                    label: "Enhanced community/channel/group access control with new access gates",
                },
                { label: "lifetime diamond" },
                { label: "unique person" },
                { label: "verified credential" },
                { label: "member referral" },
                { label: "composite gates" },
                { label: "Performance enhancements making OpenChat faster" },
            ],
        },
    },
    {
        title: "Tokenisation and Growth",
        status: "done",
        year: "2024",
        when: "Q2",
        detail: {
            points: [
                {
                    label: "Launched real-time carbon footprint dashboard",
                    href: x("1782434609554170024"),
                },
                {
                    label: "Point based reward scheme called CHIT to tie in with quarterly CHAT airdrops",
                    href: x("1783066249674543120"),
                },
                {
                    label: "List on various centralized exchanges",
                    href: "/community/dgegb-daaaa-aaaar-arlhq-cai/channel/213879932851725513516678778767199309579/863",
                },
                {
                    label: "Incorporate OpenChat DAO as a LLC in Marshall Islands",
                    href: "/community/dgegb-daaaa-aaaar-arlhq-cai/channel/213879932851725513516678778767199309579/830",
                },
                {
                    label: "A new identity layer allowing users to sign in with Email, Ethereum, Solana, Google, Plug etc",
                },
                { label: "PIN Number verification for token transfers" },
                { label: "Large scale video & audio live spaces" },
                { label: "Improved integration options for third party bots e.g. ELNA.ai etc" },
            ],
        },
    },
    {
        title: "Voice and video calls",
        status: "done",
        year: "2024",
        when: "Q1",
        detail: {
            paras: [
                "We are pleased to introduce the first phase of video and voice chat support in OpenChat. This is the final remaining big piece of core chat app functionality and has always been an important milestone.",
            ],
            points: [
                {
                    label: "P2P/OTC trades via secure escrow canister",
                    href: x("1750920544097010089"),
                },
                { label: "Crowd sourced translation system", href: x("1755894524457468209") },
                { label: "Events aggregation system (number of messages, reactions, DAUs, etc)" },
                { label: "Token Terminal integration", href: x("1762898467666411944") },
                { label: "Voice & Video calls", href: x("1768326238563607003") },
                { label: "Removed default service worker and greatly enhanced Offline mode" },
                { label: "Recruited a Chief Growth Officer", href: x("1771129208397332673") },
                {
                    label: "Buy CHAT with USDC on Helix Markets",
                    href: "https://twitter.com/HelixMarkets/status/1772715541880275217",
                },
            ],
        },
    },
    {
        title: "Swaps, disappearing messages",
        status: "done",
        year: "2023",
        when: "Q4",
        detail: {
            points: [
                { label: "Make SNS proposals in OpenChat", href: x("1712121536461619511") },
                { label: "Send and claim prize messages", href: x("1712128651079078356") },
                { label: "OpenChat meme competition", href: x("1712410519787725254") },
                { label: "Halloween theme", href: x("1715379590019928235") },
                { label: "Make SNS proposals for other SNSs", href: x("1712121536461619511") },
                { label: "More miscellaneous features", href: x("1715383274283905112") },
                { label: "View transactions in wallet" },
                { label: "Automatically get up-to-date exchange rates from ICPCoins" },
                { label: "Optionally show token balances in USD or ICP + show total wallet value" },
                {
                    label: "OpenChat sponsors OpenFPL paying for kids football kits",
                    href: "https://twitter.com/OpenFPL_DAO/status/1725067760760140217",
                },
                { label: "Configure disappearing messages", href: x("1725124141294997676") },
                { label: "Fine grained message/thread permissions" },
                {
                    label: "Partner with Modclub for content moderation",
                    href: x("1725156479135617396"),
                },
                {
                    label: "Anonymous mode (no need to sign-in to view public chats)",
                    href: x("1725198075205951977"),
                },
                { label: "Stake 60% ICP treasury as neurons", href: x("1725207447093072185") },
                {
                    label: "Community/channel/group payment gates",
                    href: x("1729886570269090076"),
                },
                { label: "Swap directly from OpenChat wallet", href: x("1732860417708343365") },
                { label: "Lifetime (Gold) diamond membership", href: x("1733040851582960055") },
                {
                    label: "Continued advancing iframe based integrations of OpenChat into other dApps",
                },
            ],
        },
    },
    {
        title: "Communities",
        status: "done",
        year: "2023",
        when: "Q3",
        detail: {
            paras: [
                "Communities allow chats and users to be grouped together according to some common factor. Perhaps they all use the same language, or they all relate to a particular area of interest, or a particular project. In this sense, communities are a bit like Discord servers.",
                "Furthermore, a community may wish to restict and control its membership creating private communities. This as an important step for the future monetization of OpenChat as it can be used as an internal communication tool within a corporate setting. In that sense, communities can also be thought of like Slack workspaces.",
            ],
            points: [
                { label: "Communities released", href: x("1686744703994052608") },
                { label: "Link previews", href: x("1691402008039669760") },
                { label: "Automatic wallet support for SNS tokens" },
                { label: "IFrame based OpenChat integration", href: x("1695044139497214260") },
                { label: "Meme Fighter integration", href: x("1696452607907147965") },
                { label: "Display names", href: x("1699504687861334305") },
                { label: "Message tipping", href: x("1707773095694446672") },
                {
                    label: "Mention @everyone and custom @usergroups",
                    href: x("1707774965213209023"),
                },
                { label: "Follow/un-follow threads" },
            ],
        },
    },
    {
        title: "CHAT airdrop",
        status: "done",
        year: "2023",
        when: "Q2",
        detail: {
            points: [
                {
                    label: "Airdrop of 1M CHAT to participating users",
                    href: x("1647226037141479425"),
                },
                {
                    label: "Access gates for Diamond members and SNS neuron holders",
                    href: x("1648373664872579072"),
                },
                { label: "Message reminders", href: x("1648374267933868034") },
                { label: "Referral rewards", href: x("1648686766721835008") },
                { label: "OpenChat Labs Ltd", href: x("1659487606541828096") },
            ],
        },
    },
    {
        title: "SNS DAO launched",
        status: "done",
        year: "2023",
        when: "Q1",
        detail: {
            paras: [
                "When the OpenChat SNS was created, control of OpenChat was handed from the core dev team to the SNS. The decentralization swap, initiated by NNS proposal, decentralized the governance of OpenChat by distributing the CHAT utility token to the wider community. This also raise an endowment to fund the ongoing development and growth of OpenChat.",
                "This was a crucial step in the decentralisation journey. With this in place the system is now not under any centralised control. The developement team are here to provide direction and to implement the roadmap but are only able to make changes to the system via an approved SNS proposal voted on by those who have demonstrated their commitment to the long term future of OpenChat by staking their CHAT tokens.",
                "Those users are invested in the future of the system through the voting rewards they receive. This way, OpenChat has enlisted an army of powerful advocates and we can be confident that the proposals the community approves will be in the long term interest of OpenChat as a whole.",
            ],
            points: [
                { label: "Scale horizontally to 2nd subnet", href: x("1613137952502054913") },
                {
                    label: "Support for ICRC-1 fungible token standard",
                    href: x("1618174498309812225"),
                },
                { label: "Diamond membership", href: x("1623739037029638148") },
                { label: "Rolling file storage for all users", href: x("1623741108000854019") },
                { label: "Send ckBTC as chat messages", href: x("1623799209987014657") },
                { label: "ckBTC giveaway with prize messages", href: x("1624034867468959747") },
                {
                    label: "Proposal to allow DFINITY agents to create OpenChat SNS canisters",
                    href: x("1627685470762156036"),
                },
                { label: "OpenChat SNS created in dormant mode", href: x("1629223644650930181") },
                {
                    label: "NNS proposal to launch the decentralization swap passed",
                    href: x("1631216322435592194"),
                },
                {
                    label: "OpenChat decentralization swap completed",
                    href: x("1631642541954154497"),
                },
                { label: "CHAT/ICP liquidity added to ICPSwap", href: x("1636935550753198084") },
                {
                    label: "CHAT/ICP liquidity added to Infinity Swap",
                    href: x("1640013861032951809"),
                },
                {
                    label: "OC DAO controlled canister market making on ICDex",
                    href: x("1641779183662641152"),
                },
            ],
        },
    },
    {
        title: "Redesign plus prep for SNS launch",
        status: "done",
        year: "2022",
        when: "Q4",
        detail: {
            points: [
                { label: "OpenChat goes open source", href: x("1577324722257264641") },
                { label: "OpenChat whitepaper published", href: x("1580590323327434753") },
                { label: "Professional website redesign", href: x("1590040124041359361") },
                { label: "SNS1 airdrop to 2000 OC OGs", href: x("1592565875789660160") },
                { label: "System architecture published", href: x("1592804695554535425") },
                { label: "Professional app redesign", href: x("1597562858484924416") },
                { label: "Search group messages by @username", href: x("1597589887787892736") },
                { label: "Undelete messages you have deleted", href: x("1597589887787892736") },
                {
                    label: "Platform moderators can suspend user accounts and groups",
                    href: x("1597589887787892736"),
                },
                { label: "Custom themes", href: x("1601267654148620288") },
            ],
        },
    },
    {
        title: "Threads and proposals",
        status: "done",
        year: "2022",
        when: "Q3",
        detail: {
            points: [
                { label: "Pin chats", href: x("1542920057831002113") },
                { label: "Reply to a message in a thread", href: x("1554426885031006209") },
                {
                    label: "View, discuss, and vote on NNS and SNS proposals within OpenChat",
                    href: x("1555600823576576001"),
                },
                { label: "Tweet previews", href: x("1564574439257395201") },
                { label: "Sign-in with NFID", href: x("1565751401208324099") },
                { label: "Asset caching", href: x("1573359592943353856") },
                { label: "Group owners can set rules", href: x("1575458674134450176") },
            ],
        },
    },
    {
        title: "Edit message, forwarding, translations",
        status: "done",
        year: "2022",
        when: "Q2",
        detail: {
            points: [
                { label: "Send giphy messages", href: x("1512114949480456197") },
                { label: "On demand message translation", href: x("1522152787022389249") },
                { label: "Edit messages", href: x("1524043440434171906") },
                { label: "Invite link for private groups", href: x("1531270838045093888") },
                {
                    label: "Three column layout for larger screens",
                    href: x("1531270838045093888"),
                },
                { label: "OpenChatBot to notify users", href: x("1531270838045093888") },
                { label: "Message forwarding", href: x("1535305502745321474") },
            ],
        },
    },
    {
        title: "Main version launched",
        status: "done",
        year: "2022",
        when: "Q1",
        detail: {
            paras: [
                `On Jan 14th, [OpenChat officially launched](${x("1482014849479716871")}) with a redesigned website and some new features: searchable public groups, group avatars, message reactions, voice and video messages, message deletion, changing username, and drag & drop or paste into message box.`,
                "This was followed up by:",
            ],
            points: [
                {
                    label: "Clickable @mentions and inline markdown",
                    href: x("1485711784954769413"),
                },
                {
                    label: "View/edit your own profile, FAQ, roadmap, multi-language support",
                    href: x("1487025329248079872"),
                },
                { label: "View user profiles", href: x("1488903198366650378") },
                { label: "Pin messages in groups", href: x("1496800276245893123") },
                { label: "Create polls", href: x("1499414982978646020") },
                { label: "Custom group permissions by role", href: x("1499735315887632384") },
                { label: "Click/tap to zoom images", href: x("1503720630734270466") },
                { label: "Send ICP in chat messages", href: x("1504491087427248130") },
                { label: "Search messages in selected chat", href: x("1504842883882496000") },
                {
                    label: "Send ICP as a message within groups",
                    href: x("1507296066194006019"),
                },
                {
                    label: "OpenChat enabled as a share target on compatible devices",
                    href: x("1507390403603050500"),
                },
            ],
        },
    },
    {
        title: "Test version launched",
        status: "done",
        year: "2021",
        when: "Q1-4",
        detail: {
            paras: [
                `On May 7th the Internet Computer mainnet launched and, on June 3rd, the [OpenChat test version launched](${x("1400560603391987721")}). It consisted of one canister and the design was quite primitive but it can still be found [here](https://7e6iv-biaaa-aaaaf-aaada-cai.ic0.app) (fix needed for the sign-in coming soon).`,
                "Around the same time, Julian Jelfs joined to become the 3rd member of the OpenChat team, and started building a new version of the website in Svelte, whilst the others began desiging and building the new backend system. It consisted of a user index canister, a group index canister, 1 canister per user, 1 canister per group, and some other miscellaneous canisters. Together the team spent most of the rest of the year building the long term version of OpenChat but also made some improvements to the test version:",
            ],
            points: [
                {
                    label: "Private chat history optionally visible to new joiners",
                    href: x("1409468345242505219"),
                },
                {
                    label: "Block users - prevent users from DMing you",
                    href: x("1412719705589227524"),
                },
                {
                    label: "OpenChat team wins first DFINITY hackathon with PrivIC",
                    href: x("1439682958047293442"),
                },
                { label: "Push notifications on Android", href: x("1442447454985674753") },
                {
                    label: "Option to mute notifications per chat",
                    href: x("1443676254541070337"),
                },
                { label: "Mark all messages read", href: x("1443890265903730707") },
            ],
        },
    },
    {
        title: "Development started",
        status: "done",
        year: "2020",
        when: "DEC",
        detail: {
            paras: [
                "Before the Internet Computer mainnet launched and before the grants programme existed, DFINITY contracted a small team of software developers, consisting of Matt Grogan and Hamish Peebles, to build a dapp on the Internet Computer.",
                "The remit was broad. It could be any dapp, but it needed to be ambitious and show what was possible on the Internet Computer. Quite quickly the team chose to build an instant messaging app and OpenChat was born!",
            ],
        },
    },
];
