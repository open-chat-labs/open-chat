<script lang="ts">
    import XL from "./ExternalLink.svelte";
    import CollapsibleCard from "../CollapsibleCard.svelte";
    import Headline from "./Headline.svelte";

    function x(id: string): string {
        return `https://twitter.com/OpenChat/status/${id}`;
    }
</script>

<div class="roadmap">
    <Headline>Roadmap</Headline>

    <p>
        Here is a summary of the past, present and future development of OpenChat. Looking forwards
        we don't have a fixed roadmap, preferring to keep flexible, and as such it is subject to
        change at any point.
    </p>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2020</div>
                <div class="quarter">DEC</div>
            </div>
            <div class="title">Development started</div>
        </div>
        <div class="body">
            <p>
                Before the Internet Computer mainnet launched and before the grants programme
                existed, DFINITY contracted a small team of software developers, consisting of Matt
                Grogan and Hamish Peebles, to build a dapp on the Internet Computer.
            </p>
            <p>
                The remit was broad. It could be any dapp, but it needed to be ambitious and show
                what was possible on the Internet Computer. Quite quickly the team chose to build an
                instant messaging app and OpenChat was born!
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2021</div>
                <div class="quarter">Q1-4</div>
            </div>
            <div class="title">Test version launched</div>
        </div>
        <div class="body">
            <p>
                On May 7th the Internet Computer mainnet launched and, on June 3rd, the <XL
                    href={x("1400560603391987721")}>OpenChat test version launched</XL
                >. It consisted of one canister and the design was quite primitive but it can still
                be found
                <XL href="https://7e6iv-biaaa-aaaaf-aaada-cai.ic0.app">here</XL> (fix needed for the
                sign-in coming soon).
            </p>
            <p>
                Around the same time, Julian Jelfs joined to become the 3rd member of the OpenChat
                team, and started building a new version of the website in Svelte, whilst the others
                began desiging and and building the new backend system. It consisted of a user index
                canister, a group index canister, 1 canister per user, 1 canister per group, and
                some other miscellaneous canisters. Together the team spent most of the rest of the
                year building the long term version of OpenChat but also made some improvements to
                the test version:
            </p>
            <ul>
                <li>
                    <XL href={x("1409468345242505219")}
                        >Private chat history optionally visible to new joiners</XL>
                </li>
                <li>
                    <XL href={x("1412719705589227524")}
                        >Block users - prevent users from DMing you</XL>
                </li>
                <li>
                    <XL href={x("1439682958047293442")}
                        >OpenChat team wins first DFINITY hackathon with PrivIC</XL>
                </li>
                <li><XL href={x("1442447454985674753")}>Push notifications on Android</XL></li>
                <li>
                    <XL href={x("1443676254541070337")}>Option to mute notifications per chat</XL>
                </li>
                <li><XL href={x("1443890265903730707")}>Mark all messages read</XL></li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2022</div>
                <div class="quarter">Q1</div>
            </div>
            <div class="title">Main version launched</div>
        </div>
        <div class="body">
            <p>
                On Jan 14th, <XL href={x("1482014849479716871")}>OpenChat officially launched</XL>
                with a redesigned website and some new features: searchable public groups, group avatars,
                message reactions, voice and video messages, message deletion, changing username, and
                drag & drop or paste into message box.
            </p>
            <p>This was followed up by:</p>
            <ul>
                <li>
                    <XL href={x("1485711784954769413")}>Clickable @mentions and inline markdown</XL>
                </li>
                <li>
                    <XL href={x("1487025329248079872")}
                        >View/edit your own profile, FAQ, roadmap, multi-language support</XL>
                </li>
                <li><XL href={x("1488903198366650378")}>View user profiles</XL></li>
                <li><XL href={x("1496800276245893123")}>Pin messages in groups</XL></li>
                <li><XL href={x("1499414982978646020")}>Create polls</XL></li>
                <li><XL href={x("1499735315887632384")}>Custom group permissions by role</XL></li>
                <li><XL href={x("1503720630734270466")}>Click/tap to zoom images</XL></li>
                <li><XL href={x("1504491087427248130")}>Send ICP in chat messages</XL></li>
                <li><XL href={x("1504842883882496000")}>Search messages in selected chat</XL></li>
                <li>
                    <XL href={x("1507296066194006019")}>Send ICP as a message within groups</XL>
                </li>
                <li>
                    <XL href={x("1507390403603050500")}
                        >OpenChat enabled as a share target on compatible devices</XL>
                </li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2022</div>
                <div class="quarter">Q2</div>
            </div>
            <div class="title">Edit message, forwarding, translations</div>
        </div>
        <div class="body">
            <ul>
                <li><XL href={x("1512114949480456197")}>Send giphy messages</XL></li>
                <li><XL href={x("1522152787022389249")}>On demand message translation</XL></li>
                <li><XL href={x("1524043440434171906")}>Edit messages</XL></li>
                <li><XL href={x("1531270838045093888")}>Invite link for private groups</XL></li>
                <li>
                    <XL href={x("1531270838045093888")}>Three column layout for larger screens</XL>
                </li>
                <li><XL href={x("1531270838045093888")}>OpenChatBot to notify users</XL></li>
                <li><XL href={x("1535305502745321474")}>Message forwarding</XL></li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2022</div>
                <div class="quarter">Q3</div>
            </div>
            <div class="title">Threads and proposals</div>
        </div>
        <div class="body">
            <ul>
                <li><XL href={x("1542920057831002113")}>Pin chats</XL></li>
                <li><XL href={x("1554426885031006209")}>Reply to a message in a thread</XL></li>
                <li>
                    <XL href={x("1555600823576576001")}
                        >View, discuss, and vote on NNS and SNS proposals within OpenChat</XL>
                </li>
                <li><XL href={x("1564574439257395201")}>Tweet previews</XL></li>
                <li><XL href={x("1565751401208324099")}>Sign-in with NFID</XL></li>
                <li><XL href={x("1573359592943353856")}>Asset caching</XL></li>
                <li><XL href={x("1575458674134450176")}>Group owners can set rules</XL></li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2022</div>
                <div class="quarter">Q4</div>
            </div>
            <div class="title">Redesign plus prep for SNS launch</div>
        </div>
        <div class="body">
            <ul>
                <li><XL href={x("1577324722257264641")}>OpenChat goes open source</XL></li>
                <li><XL href={x("1580590323327434753")}>OpenChat whitepaper published</XL></li>
                <li><XL href={x("1590040124041359361")}>Professional website redesign</XL></li>
                <li><XL href={x("1592565875789660160")}>SNS1 airdrop to 2000 OC OGs</XL></li>
                <li><XL href={x("1592804695554535425")}>System architecture published</XL></li>
                <li><XL href={x("1597562858484924416")}>Professional app redesign</XL></li>
                <li><XL href={x("1597589887787892736")}>Search group messages by @username</XL></li>
                <li><XL href={x("1597589887787892736")}>Undelete messages you have deleted</XL></li>
                <li>
                    <XL href={x("1597589887787892736")}
                        >Platform moderators can suspend user accounts and groups</XL>
                </li>
                <li><XL href={x("1601267654148620288")}>Custom themes</XL></li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2023</div>
                <div class="quarter">Q1</div>
            </div>
            <div class="title">SNS DAO launched</div>
        </div>
        <div class="body">
            <p>
                When the OpenChat SNS was created, control of OpenChat was handed from the core dev
                team to the SNS. The decentralization swap, initiated by NNS proposal, decentralized
                the governance of OpenChat by distributing the CHAT utility token to the wider
                community. This also raise an endowment to fund the ongoing development and growth
                of OpenChat.
            </p>
            <p>
                This was a crucial step in the decentralisation journey. With this in place the
                system is now not under any centralised control. The developement team are here to
                provide direction and to implement the roadmap but are only able to make changes to
                the system via an approved SNS proposal voted on by those who have demonstrated
                their commitment to the long term future of OpenChat by staking their CHAT tokens.
            </p>
            <p>
                Those users are invested in the future of the system through the voting rewards they
                receive. This way, OpenChat has enlisted an army of powerful advocates and we can be
                confident that the proposals the community approves will be in the long term
                interest of OpenChat as a whole.
            </p>
            <ul>
                <li><XL href={x("1613137952502054913")}>Scale horizontally to 2nd subnet</XL></li>
                <li>
                    <XL href={x("1618174498309812225")}
                        >Support for ICRC-1 fungible token standard</XL>
                </li>
                <li><XL href={x("1623739037029638148")}>Diamond membership</XL></li>
                <li><XL href={x("1623741108000854019")}>Rolling file storage for all users</XL></li>
                <li><XL href={x("1623799209987014657")}>Send ckBTC as chat messages</XL></li>
                <li><XL href={x("1624034867468959747")}>ckBTC giveaway with prize messages</XL></li>
                <li>
                    <XL href={x("1627685470762156036")}
                        >Proposal to allow DFINITY agents to create OpenChat SNS canisters</XL>
                </li>
                <li>
                    <XL href={x("1629223644650930181")}>OpenChat SNS created in dormant mode</XL>
                </li>
                <li>
                    <XL href={x("1631216322435592194")}
                        >NNS proposal to launch the decentralization swap passed</XL>
                </li>
                <li>
                    <XL href={x("1631642541954154497")}
                        >OpenChat decentralization swap completed</XL>
                </li>
                <li>
                    <XL href={x("1636935550753198084")}>CHAT/ICP liquidity added to ICPSwap</XL>
                </li>
                <li>
                    <XL href={x("1640013861032951809")}
                        >CHAT/ICP liquidity added to Infinity Swap</XL>
                </li>
                <li>
                    <XL href={x("1641779183662641152")}
                        >OC DAO controlled canister market making on ICDex</XL>
                </li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2023</div>
                <div class="quarter">Q2</div>
            </div>
            <div class="title">CHAT airdrop</div>
        </div>
        <div class="body">
            <ul>
                <li>
                    <XL href={x("1647226037141479425")}
                        >Airdrop of 1M CHAT to participating users</XL>
                </li>
                <li>
                    <XL href={x("1648373664872579072")}
                        >Access gates for Diamond members and SNS neuron holders</XL>
                </li>
                <li><XL href={x("1648374267933868034")}>Message reminders</XL></li>
                <li><XL href={x("1648686766721835008")}>Referral rewards</XL></li>
                <li><XL href={x("1659487606541828096")}>OpenChat Labs Ltd</XL></li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2023</div>
                <div class="quarter">Q3</div>
            </div>
            <div class="title">Communities</div>
        </div>
        <div class="body">
            <p>
                Communities allow chats and users to be grouped together according to some common
                factor. Perhaps they all use the same language, or they all relate to a particular
                area of interest, or a particular project. In this sense, communities are a bit like
                Discord servers.
            </p>
            <p>
                Furthermore, a community may wish to restict and control its membership creating
                private communities. This as an important step for the future monetization of
                OpenChat as it can be used as an internal communication tool within a corporate
                setting. In that sense, communities can also be thought of like Slack workspaces.
            </p>
            <ul>
                <li><XL href={x("1686744703994052608")}>Communities released</XL></li>
                <li><XL href={x("1691402008039669760")}>Link previews</XL></li>
                <li>Automatic wallet support for SNS tokens</li>
                <li><XL href={x("1695044139497214260")}>IFrame based OpenChat integration</XL></li>
                <li><XL href={x("1696452607907147965")}>Meme Fighter integration</XL></li>
                <li><XL href={x("1699504687861334305")}>Display names</XL></li>
                <li><XL href={x("1707773095694446672")}>Message tipping</XL></li>
                <li>
                    <XL href={x("1707774965213209023")}
                        >Mention @everyone and custom @usergroups</XL>
                </li>
                <li>Follow/un-follow threads</li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2023</div>
                <div class="quarter">Q4</div>
            </div>
            <div class="title">Swaps, disappearing messages</div>
        </div>
        <div class="body">
            <ul>
                <li><XL href={x("1712121536461619511")}>Make SNS proposals in OpenChat</XL></li>
                <li><XL href={x("1712128651079078356")}>Send and claim prize messages</XL></li>
                <li><XL href={x("1712410519787725254")}>OpenChat meme competition</XL></li>
                <li><XL href={x("1715379590019928235")}>Halloween theme</XL></li>
                <li><XL href={x("1712121536461619511")}>Make SNS proposals for other SNSs</XL></li>
                <li><XL href={x("1715383274283905112")}>More miscellaneous features</XL></li>
                <li>View transactions in wallet</li>
                <li>Automatically get up-to-date exchange rates from ICPCoins</li>
                <li>Optionally show token balances in USD or ICP + show total wallet value</li>
                <li>
                    <XL href="https://twitter.com/OpenFPL_DAO/status/1725067760760140217"
                        >OpenChat sponsors OpenFPL paying for kids football kits</XL>
                </li>
                <li><XL href={x("1725124141294997676")}>Configure disappearing messages</XL></li>
                <li>Fine grained message/thread permissions</li>
                <li>
                    <XL href={x("1725156479135617396")}
                        >Partner with Modclub for content moderation</XL>
                </li>
                <li>
                    <XL href={x("1725198075205951977")}
                        >Anonymous mode (no need to sign-in to view public chats)</XL>
                </li>
                <li><XL href={x("1725207447093072185")}>Stake 60% ICP treasury as neurons</XL></li>
                <li>
                    <XL href={x("1729886570269090076")}>Community/channel/group payment gates</XL>
                </li>
                <li><XL href={x("1732860417708343365")}>Swap directly from OpenChat wallet</XL></li>
                <li><XL href={x("1733040851582960055")}>Lifetime (Gold) diamond membership</XL></li>
                <li>Continued advancing iframe based integrations of OpenChat into other dApps</li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2024</div>
                <div class="quarter">Q1</div>
            </div>
            <div class="title">Voice and video calls</div>
        </div>
        <div class="body">
            <p>
                We are pleased to introduce the first phase of video and voice chat support in
                OpenChat. This is the final remaining big piece of core chat app functionality and
                has always been an important milestone.
            </p>
            <ul>
                <li>
                    <XL href={x("1750920544097010089")}
                        >P2P/OTC trades via secure escrow canister</XL>
                </li>
                <li><XL href={x("1755894524457468209")}>Crowd sourced translation system</XL></li>
                <li>Events aggregation system (number of messages, reactions, DAUs, etc)</li>
                <li><XL href={x("1762898467666411944")}>Token Terminal integration</XL></li>
                <li><XL href={x("1768326238563607003")}>Voice & Video calls</XL></li>
                <li>Removed default service worker and greatly enhanced Offline mode</li>
                <li><XL href={x("1771129208397332673")}>Recruited a Chief Growth Officer</XL></li>
                <li>
                    <XL href="https://twitter.com/HelixMarkets/status/1772715541880275217"
                        >Buy CHAT with USDC on Helix Markets</XL>
                </li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2024</div>
                <div class="quarter">Q2</div>
            </div>
            <div class="title">Tokenisation and Growth</div>
        </div>
        <div class="body">
            <ul>
                <li>
                    <XL href={x("1782434609554170024")}
                        >Launched real-time carbon footprint dashboard</XL>
                </li>
                <li>
                    <XL href={x("1783066249674543120")}
                        >Point based reward scheme called CHIT to tie in with quarterly CHAT
                        airdrops</XL>
                </li>
                <li>
                    <XL
                        href="/community/dgegb-daaaa-aaaar-arlhq-cai/channel/213879932851725513516678778767199309579/863"
                        >List on various centralized exchanges</XL>
                </li>
                <li>
                    <XL
                        href="/community/dgegb-daaaa-aaaar-arlhq-cai/channel/213879932851725513516678778767199309579/830"
                        >Incorporate OpenChat DAO as a LLC in Marshall Islands</XL>
                </li>
                <li>
                    A new identity layer allowing users to sign in with Email, Ethereum, Solana,
                    Google, Plug etc
                </li>
                <li>PIN Number verification for token transfers</li>
                <li>Large scale video & audio live spaces</li>
                <li>Improved integration options for third party bots e.g. ELNA.ai etc</li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2024</div>
                <div class="quarter">Q3</div>
            </div>
            <div class="title">Tokenisation and Growth continued</div>
        </div>
        <div class="body">
            <ul>
                <li>
                    <XL href="https://oc.app/blog/chit"
                        >Extended CHIT reward scheme with achievements, user referrals, leaderboard,
                        badges etc</XL>
                </li>
                <li>
                    <XL href={x("1821139921244946577")}
                        >Monthly CHIT for CHAT airdrops including lottery</XL>
                </li>
                <li>
                    <XL href={x("1817903346885259698")}
                        >Introduced Proof of Unique Personhood to gate airdrops</XL>
                </li>
                <li>
                    <XL
                        href="https://tokenterminal.com/explorer/projects/openchat?v=M2ViOTBjYTRlYzg2OTA3NTI4ZWE0YmI5"
                        >DAUs grew from around 3K to 10K</XL>
                </li>
                <li>
                    $CHAT listed on <XL
                        href="https://x.com/LBank_Exchange/status/1818225021992497568">LBank</XL
                    >, <XL href="https://x.com/BitrueOfficial/status/1818550356047200703"
                        >Bitrue</XL> and <XL
                        href="https://x.com/CoinstoreExc/status/1831973943462531167">Coinstore</XL>
                </li>
                <li>
                    Improved wallet UX to account for a large number of tokens and giving the user
                    more control
                </li>
                <li>
                    Enhanced community/channel/group access control with new access gates
                    <ul>
                        <li>lifetime diamond</li>
                        <li>unique person</li>
                        <li>verified credential</li>
                        <li>member referral</li>
                        <li>composite gates</li>
                    </ul>
                </li>
                <li>Performance enhancements making OpenChat faster</li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2024</div>
                <div class="quarter">Q4</div>
            </div>
            <div class="title">Scalability and performance</div>
        </div>
        <div class="body">
            <ul>
                <li>
                    <XL href={x("1867622369537536337")}>Scalability and performance</XL>
                    <ul>
                        <li>
                            Migrated large majority of user/group/community data (incl messages and
                            members) to stable memory allowing for huge communities/groups and
                            faster/cheaper canister upgrades
                        </li>
                        <li>
                            Migrated canister APIs to use msgpack rather than candid greatly
                            reducing network bandwidth thus improving performance
                        </li>
                        <li>Scaled OpenChat onto a 3rd subnet</li>
                    </ul>
                </li>
                <li>
                    <XL
                        href="https://tokenterminal.com/explorer/projects/openchat?v=M2ViOTBjYTRlYzg2OTA3NTI4ZWE0YmI5"
                        >DAUs grew from around 10K to 15.5K</XL>
                </li>
                <li>
                    <XL href={x("1873018431622275241")}
                        >Recruited a full-stack developer, and a product and marketing specialist,
                        both starting in early January</XL>
                </li>
                <li>
                    $CHAT listed on <XL
                        href="https://x.com/BitMartExchange/status/1843939377476767839">Bitmart</XL>
                    and <XL href="https://x.com/kongswap/status/1847125452491837880">Kongswap</XL>
                </li>
                <li>
                    View activity feed showing messages where you have been mentioned, replied to,
                    tipped, etc
                </li>
                <li>
                    Link additional sign-in providers to your OpenChat account (eg. recovery email /
                    ETH wallet)
                </li>
                <li>
                    <XL href="/blog/access_gate_expiry"
                        >Support expiry of community/channel/group access gates and "lapsing"
                        membership</XL>
                </li>
                <li>
                    <XL href="/community/u7zzf-hyaaa-aaaaf-bm63a-cai"
                        >Created the "OpenChat Arcade" community with Minesweeper and Cupetopia
                        (more to follow)</XL>
                </li>
                <li>
                    Phase 1 Bots framework - think Discord or Telegram bots - public release in
                    January
                </li>
                <li>
                    <XL href={x("1843917939558494695")}
                        >Kong Swap added to OpenChat as a swap provider.</XL> For each swap OpenChat
                    uses the provider giving the best price.
                </li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle">
                <div class="year">2025</div>
                <div class="quarter">Q1</div>
            </div>
            <div class="title">Bots and e2e encryption</div>
        </div>
        <div class="body">
            <p>Here is a list of features we expect to build this year.</p>
            <h4>Bots</h4>
            <p>
                Bots are a key feature of modern chat apps. They can be used to automate tasks,
                provide information, or just for fun. We plan to build a small suite of initial bots
                and then release a bot framework allowing users to interact with bots by typing
                commands into the chat box. We will also write developer documentation to help
                others build their own bots. We will then extend the bot framework to support
                webhooks and autonomous agents. And we will integrate an AI chat bot that can hold a
                conversation with users.
            </p>
            <h4>End-to-end encryption</h4>
            <p>
                We plan to add end-to-end encryption for 1-1 chats. This will ensure that only the
                sender and recipient can read the messages. As a stretch goal, we will add the
                option to enable end-to-end encryption for private group chats.
            </p>
            <h4>Wallet</h4>
            <p>
                By implementing the new ICRC wallet standards we will allow users to connect
                3rd-party wallets, including Oisy, to support transfer, swap, etc. We will also
                allow users to deposit Bitcoin directly into their OpenChat wallet by automatically
                converting it to ckBTC. And we will allow users to withdraw ckBTC from their
                OpenChat wallet to a BTC address.
            </p>
            <h4>User profiles</h4>
            <p>
                We will add the ability for users to create a public profile page optionally
                including a personal feed of messages. This is a pre-cursor to the concept of
                "following" other users and ultimately the development of aggregated feeds of all
                users that you choose to follow.
            </p>
            <h4>Communities</h4>
            <ul>
                <li>
                    We will add a proposal mechanism to support verified communities (blue tick).
                </li>
                <li>
                    Allow owners to turn on advertising (using FairBuy) to help monetise their
                    communities/groups
                </li>
                <li>
                    Allow owners to pay to boost their communities in the community explorer
                    (stretch goal)
                </li>
                <li>
                    Enhanced tooling for community governance. This may include quorum decision
                    making for community owners to avoid centralised community control (stretch
                    goal)
                </li>
            </ul>
            <h4>Native apps</h4>
            <p>
                We will investigate the viability of building native apps for iOS and Android
                devices. The aim is to build thin native "wrappers" around the core web components
                used by the existing web app such that the large majority of code is shared. As a
                strech goal for the quarter we will build proof of concept OpenChat apps hosted in
                the app stores with native app notifications.
            </p>
            <h4>Onboarding</h4>
            <p>
                We will improve the onboarding experience for new users to help them understand the
                key features of OpenChat and how to use them. We will also make it simpler for new
                and existing users to link an optional email address to allow account recovery if
                the user loses access to their primary sign-in method.
            </p>
            <h4>Monetisation</h4>
            <p>
                We will introduce some additional monetisation features including, CHIT streak
                insurance, and a 5% fee on prize messages.
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle future">Future</div>
            <div class="title">NFTs, contacts, personas and more</div>
        </div>
        <div class="body">
            <h4>NFTs</h4>
            <p>
                It is expected the ICRC NFT proposals
                <XL href="https://github.com/dfinity/ICRC/blob/icrc_7_and_37/ICRCs/ICRC-7/ICRC-7.md"
                    >ICRC-7</XL>
                and
                <XL
                    href="https://github.com/dfinity/ICRC/blob/icrc_7_and_37/ICRCs/ICRC-37/ICRC-37.md"
                    >ICRC-37</XL>
                will <XL
                    href="https://forum.dfinity.org/t/nft-standards-icrc-7-and-icrc-37-ready-for-nns-vote/29618"
                    >soon be approved</XL>
                at which point we can start to bring NFT functionality to OpenChat.
            </p>
            <ul class="inset">
                <li>Hold NFTs in your wallet</li>
                <li>Send/receive NFTs as messages</li>
                <li>Verified NFT avatars</li>
                <li>Gate group/community/channel membership by NFT collection</li>
                <li>Display NFTs in your profile</li>
                <li>Buy/sell NFTs</li>
                <li>Bitcoin Rune integration(?)</li>
            </ul>
            <h4>Contacts/friends</h4>
            <p>Each user would have a list of contacts.</p>
            <ul class="inset">
                <li>import contacts from phone or google etc</li>
                <li>invite contacts to become OpenChat users</li>
                <li>invite users to become contacts</li>
                <li>
                    optionally various profile/contact information made available only to contacts
                </li>
                <li>optionally only allow DMs from contacts</li>
                <li>verifiable contact information (using verified credentials)</li>
                <li>build a social graph to help spot mercenary/farming behaviour</li>
            </ul>
            <h4>Personas</h4>
            <p>
                Create multiple personas on OpenChat each with their own canister but tied to the
                same account. Easily swap between personas without signing up/in again. This helps
                you remain anonymous where you want to be or explore different sides of your
                personality!
            </p>
            <h4>More</h4>
            <ul class="inset">
                <li>OpenChat on Utopia (aka the _Intranet_ Computer)</li>
                <li>Tag groups and communities and search/filter by tag</li>
                <li>Gallery view for chats showing all images</li>
                <li>Events calendar for a community</li>
                <li>Custom emojis, stickers</li>
            </ul>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle future">Future</div>
            <div class="title">Native apps</div>
        </div>
        <div class="body">
            <p>
                Currently OpenChat is delivered as a responsive progressive web app. This means that
                it performs well on <em>any</em> device via the platform's browser. It can also be saved
                or "installed" to your device's home screen for an even more app-like experience. There
                are great advantages to this approach. We can deliver for all platforms using a single
                codebase which allows us to deliver features faster and without preference to any one
                particular platform.
            </p>
            <p>
                However, the native web apis available to us are a work in progress and not all
                platforms develop at the same speed. Furthermore, some people simply prefer to get
                their apps in their chosen app store and there is an undeniable stickiness in this
                approach.
            </p>
            <p>
                In the medium term, the team will explore options to preserve the single codebase
                benefits and combine it with a platform specific native app shell which will provide
                full access to the native platform apis that we need.
            </p>
            <p>
                In the longer term, it may be possible to develop fully native mobile apps for each
                platform.
            </p>
        </div>
    </CollapsibleCard>

    <CollapsibleCard transition={false} open={false}>
        <div class="header" slot="titleSlot">
            <div class="date subtitle future">Future</div>
            <div class="title">Blue sky thinking</div>
        </div>
        <div class="body">
            <p>
                The list of ways OpenChat could be extended and enhanced is virtually endless. Here
                are a few more ideas.
            </p>
            <h4>Like/dislike messages</h4>
            <p>
                Chat is chronologically ordered. If we were to introduce the ability to like/dislike
                posts we could start offering alternative ways to view messages such as by
                popularity and/or in a tree view. Think Reddit.
            </p>
            <h4>Following</h4>
            <p>
                We could further expand OpenChat by allowing users to follow each other and
                subscribe to feeds. Think Twitter/X.
            </p>
            <h4>Job boards</h4>
            <p>
                A DAO member recently <XL
                    href="/community/dgegb-daaaa-aaaar-arlhq-cai/channel/309853277321768416862922950227002295881/150"
                    >floated the idea</XL>
                that OpenChat could host a "world beating Web3 version of Upwork or Fiverr".
            </p>
        </div>
    </CollapsibleCard>
</div>

<style lang="scss">
    :global(.roadmap .icon) {
        display: none;
    }

    :global(.roadmap .card.open .title) {
        white-space: unset;
    }

    .roadmap {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }

    ul {
        @include bullet_list();
    }

    ul.inset {
        margin-left: 3rem;
    }

    :global(.roadmap ul ul) {
        list-style: none;
        left: 4px;
    }

    :global(.roadmap ul ul li) {
        margin-left: 0;
    }

    h4 {
        margin-top: 1.5rem;
        margin-bottom: 1rem;
        font-size: 1.2rem;
    }

    .body {
        padding: 0 0 toRem(30) toRem(160);
        max-width: 75%;

        @include mobile() {
            padding: 0 0 toRem(24) 0;
            max-width: 100%;
        }
    }

    p,
    li {
        @include font(book, normal, fs-100, 28);
    }

    p {
        margin-bottom: toRem(24);
    }

    .header {
        display: flex;
        align-items: center;
        flex: auto;
        gap: $sp2;
        color: var(--landing-txt);
        width: 90%;
        @include font(medium, normal, fs-160, 38);

        @include mobile() {
            @include font(medium, normal, fs-110, 24);
        }
    }

    .subtitle {
        flex: 0 0 toRem(160);

        @include mobile() {
            flex: 0 0 toRem(80);
        }
    }

    .title {
        flex: auto;
        @include ellipsis();
    }

    .date {
        display: flex;
        align-items: flex-start;
        gap: toRem(15);
        @include font(bold, normal, fs-160, 38);

        .year {
            color: #23a2ee;
        }

        .quarter {
            @include font(book, normal, fs-100, 28);
            color: var(--landing-txt-light);
        }

        &.future {
            @include font(book, normal, fs-100, 38);
            font-weight: 500;
        }

        @include mobile() {
            gap: toRem(8);
            @include font(medium, normal, fs-110, 24);

            .quarter {
                @include font(book, normal, fs-80, 28);
            }
        }
    }
</style>
