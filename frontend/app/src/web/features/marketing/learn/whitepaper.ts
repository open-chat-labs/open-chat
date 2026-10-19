import type { LearnDoc } from "@openchat/ui/src/pages/learnContent";

// The OpenChat SNS whitepaper, converted from components/landingpages/WhitepaperPage.svelte. Section ids are the old
// page's `?section=<id>` ids, so existing deep links keep working.
export const whitepaper: LearnDoc = {
    kicker: "Whitepaper",
    title: "OpenChat SNS Whitepaper",
    lede: "OpenChat is a fully featured chat application running on the Internet Computer blockchain similar to WhatsApp, Signal and Telegram, and will soon be getting a major new capability called “communities” which are like Slack workspaces or Discord servers.",
    allocation: [
        { label: "Decentralization sale - CF", share: 8.25 },
        { label: "Decentralization sale - non CF", share: 16.75 },
        { label: "Founding developer team", share: 15 },
        { label: "Seed funders", share: 8 },
        { label: "Treasury", share: 52 },
    ],
    sections: [
        {
            id: "1",
            title: "Product / Service Overview",
            paras: [
                "OpenChat is a fully featured chat application running on the [Internet Computer](/whitepaper?section=2) blockchain similar to WhatsApp, Signal and Telegram, and will soon be getting a major new capability called “communities” which are like Slack workspaces or Discord servers.",
                "It is a responsive, progressive web application (PWA) and as such scales to take advantage of any screen size and integrates with devices in a similar way to native apps, with notifications on desktop and Android devices, and on [iOS from next year](https://www.apple.com/ios/ios-16/features/). You can find the full development roadmap [here](/roadmap).",
                "The app is [open source](https://github.com/dfinity-lab/open-chat) and runs as a collection of [canister smart-contracts](/whitepaper?section=2-1). It is possible to see the code running on any canister at any time with a link back to the particular version in source control and to independently verify this is true.",
                "A canister is created for each user which holds their direct chat data, links to the groups they are members of, and also serves as a wallet allowing OpenChat users to hold and manage tokens. Each group (and soon “community”) is also implemented as its own canister. This architecture will allow OpenChat to scale to every person on the planet. For details of the architecture please [see here](/architecture).",
                "OpenChat users can send messages to each other containing tokens such as BTC and ICP and so can be used for global remittance.",
                "However, the ground-breaking difference between OpenChat and other similar apps, is that it will soon be governed as a DAO with its own token called CHAT, analogous to ICP. The DAO will be realized by a system called the [SNS](https://internetcomputer.org/docs/current/tokenomics/sns/sns-intro-tokens) (Service Nervous System) analogous to the [NNS](https://internetcomputer.org/docs/current/tokenomics/nns/nns-intro) (Network Nervous System) on the Internet Computer.",
                "The focus of the founding dev team has been first and foremost on building a rich, fully featured chat app on par with its web2 counterparts. Only by first building an app that people are happy to use will the rocket fuel of tokenization enable OpenChat to grow and challenge monopolistic big tech incumbents.",
            ],
        },
        {
            id: "2",
            title: "Internet Computer Overview",
            paras: [
                "The [Internet Computer](https://medium.com/dfinity/the-internet-computer-for-geeks-a-new-dfinity-white-paper-ecb075b2d525) (IC) is a decentralized global compute platform which uses ground-breaking blockchain technology to achieve consensus within subnets. It is globally distributed in numerous independent data centers, is tamper proof and unstoppable.",
                "It can serve applications fully on-chain without needing any centralized frontend layer. It is extremely efficient and is several orders of magnitude cheaper to run and store data than most other blockchains. It uses a reverse-gas model so computation and storage costs are paid by the app/service providers rather than users.",
            ],
        },
        {
            id: "2-1",
            title: "Canister smart-contracts",
            paras: [
                "Applications on the IC are composed of canister smart-contracts organized into subnets. A subnet can contain 100,000s of canisters and is composed of (typically 13) node machines each of which runs in a different independent data center around the globe such that the nodes within each subnet are as geographically and jurisdictionally diverse as possible. Canisters can communicate securely with canisters on other subnets allowing the IC to scale horizontally.",
                "A canister runs on a virtual machine (as a WASM) that is replicated across a subnet. It implements the actor model, and so is single threaded, processing a queue of input messages one at a time, optionally sending messages to other canisters, and adding a response message to an output queue.",
                "It can be called by clients (or other canisters) using queries or updates. A query can be served immediately from any node but cannot change state. An update can change state and goes through a process of consensus for the nodes to agree on the same result before responding to the caller. Achieving consensus is where the blockchain comes into play but is beyond the scope of this document.",
                "Canisters have the property of [orthogonal persistence](https://en.wikipedia.org/wiki/Persistence_(computer_science)) which means as a programmer you just write data objects to memory and they are automatically persisted by the system. This removes the need for a database and is one of the reasons writing and running applications on the IC is simplified compared to traditional IT stacks.",
            ],
        },
        {
            id: "2-2",
            title: "Network Nervous System (NNS)",
            paras: [
                "A key feature of the Internet Computer blockchain is the Network Nervous System (NNS), an open algorithmic governance system that oversees the network and the token economics.",
                "Holders of the Internet Computer’s ICP utility tokens can lock their tokens in neurons to participate in governance and contribute to decision-making, such as voting to determine whether or not a new subnet should be added to the network. By participating in governance, voters earn rewards which can be converted to ICP. In turn they can burn ICP to fuel the computation of their canisters.",
                "[Read here](https://internetcomputer.org/nns/) for more information on the NNS.",
            ],
        },
        {
            id: "3",
            title: "OpenChat DAO",
            paras: [],
        },
        {
            id: "3-1",
            title: "Summary",
            paras: [],
            list: [
                "The OpenChat DAO is being formed to operate and steer the direction of OpenChat and can be considered a public good, owned by no-one.",
                "The OpenChat DAO and the OpenChat service are fully on-chain with no direct dependencies on off-chain services.",
                "The OpenChat DAO is operated using NNS blessed SNS canisters and SNS subnet.",
                "A proposal to the NNS will be made to ask for the approval necessary to create this DAO and associated public good.",
            ],
        },
        {
            id: "3-2",
            title: "Creation of the DAO",
            paras: [
                "The OpenChat SNS will be created from the latest NNS blessed SNS canisters by the founding dev team. Its [initial configuration](/whitepaper?section=5-2) will be held permanently by the SNS and be publicly inspectable. At this point control of the existing OpenChat operating canisters will be transferred from the founding dev team to the SNS, such that, henceforth, only the SNS may change OpenChat.",
                "To initiate creation of the OpenChat DAO an NNS proposal will be submitted specifying the parameters of the decentralization sale and an initial token allocation. If the proposal is accepted the NNS will immediately start a decentralization sale of CHAT tokens based on this proposal, to decentralize governance control to the public and raise an endowment for ongoing development and growth.",
                "Anyone can take part in the sale by depositing ICP into the SNS using the NNS launchpad. Once the sale has completed each participant will receive the same proportion of CHAT tokens as their share of the ICP deposited and the proceeds of the sale will be held in an ICP ledger account owned by the SNS governance canister.",
                "At this point the DAO creation is completed and the running OpenChat service can be considered a public good.",
            ],
        },
        {
            id: "3-3",
            title: "Control of the DAO",
            paras: [
                "After the decentralization sale the SNS will be in control of the dapp including its treasury of CHAT and ICP. In other words, only the SNS will be able to upgrade the OpenChat canisters and only the SNS will have access to its treasury.",
                "The SNS is itself controlled by the action of proposals. Anyone can submit a proposal to the SNS and then CHAT neuron holders can vote on these proposals.",
                "In exceptional circumstances an NNS proposal could theoretically be used to sanction an SNS by stopping an SNS canister(s). One example could be if an IC app were to copy the source code of another IC app, breaking its licensing terms.",
            ],
        },
        {
            id: "3-4",
            title: "Governance of the DAO",
            paras: [],
        },
        {
            id: "3-4-1",
            title: "Proposals",
            paras: [
                "SNS proposals have the following types.",
                "• **Motions** are statements of intent but do not have any actual action that is automatically taken if they succeed. They could be used, for example, to propose new features or capabilities for development or to set the dev team’s priorities.",
                "• **Canister upgrade** proposals contain a canister Id and a wasm module and instruct the SNS to upgrade the specified canister’s code to the wasm module. This can be used to upgrade dapp canisters controlled by the SNS and the SNS canisters themselves.",
                "• **SNS config change** proposals allow various SNS parameters to be changed. Part of the boot-strapping process for the SNS is to provide [initial values for all of these parameters](/whitepaper?section=5-2) which will be covered later.",
                "• **Token transfer** proposals allow tokens to be transferred to/from the specified SNS owned account. The SNS “treasury” can potentially include any IC native token such as ICP, not just CHAT, and so this proposal can be used to transfer any IC native token.",
                "• **Burn token** proposals will allow CHAT to be burned to reduce the total supply.",
                "• **Custom function** proposals allow for an arbitrary function to be called on a given canister by the SNS governance canister. In practice this allows for arbitrarily complex behavior to be controlled by the OpenChat community DAO. Some examples of custom functions:",
                "◦ **Rolling upgrade**. By calling an upgrade method on an OpenChat canister the proposal can provide a canister WASM + version number and initiate a rolling upgrade of say the User canisters.",
                "◦ **Add SNS**. When a new SNS is launched this proposal can call a method on the proposal_bot canister to create a new group which syncs proposals from the SNS's governance canister.",
                "◦ **Add subnet**. When OpenChat needs to expand on to another subnet this proposal can be used to call a method on an OpenChat canister to orchestrate the necessary steps such as installing new local_user_index, local_group_index and notifications canisters.",
                "There will be some proposals to look out for soon after the decentralization sale including…",
            ],
            list: [
                "One or more proposals to transfer some ICP and CHAT to one or more [DEXes](https://docs.google.com/document/d/1V4CLsujL9HeZt3eP-LSr3hBS5iGcmNfa17d7ZaVKmLc/edit#heading=h.bn2twif6p6wt) to create initial liquidity pools to enable trading of CHAT",
                "A proposal to transfer a portion of the ICP to the OpenChat cycles dispenser so it can pay for ongoing hosting costs.",
                "The core dev team will engage with the community and then use a motion proposal with a development roadmap for the following quarter which will likely include designing and building the [communities](/whitepaper?section=4-1-2) feature and/or a [user reward system](/whitepaper?section=4-2).",
            ],
        },
        {
            id: "3-4-2",
            title: "Voting and voting rewards",
            paras: [
                "Proposals are used to govern all aspects of the OpenChat dapp. Token holders are rewarded for participating in votes on proposals so that decisions are decentralized and reflect the will of the community.",
                "Neurons have a property called dissolve delay which is the length of time it would take to dissolve the neuron into liquid tokens. Voting rewards increase with longer dissolve delay which aligns voters with the long term interests of OpenChat.",
                "If CHAT is staked in a neuron with a dissolve delay set to at least 1 month then this neuron can be used to vote on proposals.",
                "You can either vote on a proposal with a neuron(s) explicitly using the NNS Dapp (which will soon have a section for SNS’s) or the “OpenChat Proposals” group within the OpenChat dapp, or you can configure your neuron to follow another neuron(s) per proposal type, in which case your vote will be implicitly cast when it votes. By default, newly created neurons will have no followees so this would need to be manually configured.",
                'The dev team will configure a small neuron to be a "beacon" which anyone is welcome to follow on any topic. This beacon neuron will itself follow the neurons of each member of the dev team and will implicitly vote when a majority of the dev team vote the same way. The dev team will vote on every proposal so if you are happy to follow their lead you will implicitly participate in every vote and so maximise your voting rewards. After the SNS decentralization sale the dev team will publish their beacon neuron id.',
                "Each neuron has “voting power” which is calculated as the token value multiplied by the dissolve delay bonus multiplied by the age bonus. The dissolve delay bonus starts at 1x with zero dissolve delay and linearly increases up to 2x for neurons with the maximum 1 year dissolve delay. The age bonus starts at 1x at zero age and linearly increases up to 1.25x for the maximum 6 months age. This means for neurons with the same value, those that have spent 6 months with a dissolve delay of 1 year will have a voting power 2.5x those with a newly set 1 month dissolve delay.",
                "For a proposal to be adopted the sum of the voting power of the “adopt” votes must exceed the sum of the voting power of the “reject” votes after 4 days or after a period of quiet. Also the “adopt” votes must have at least 3% of the total voting power. The vote will end immediately if either the “adopt” or “reject” votes exceed 50% of available voting power. It is possible to participate in a vote for a proposal if still within the 4 day period even if it has already been resolved. This is so the neuron can still be a beneficiary of voting rewards.",
                "Voting rewards are generated by the SNS and accumulate in neurons that have participated in voting as maturity. Maturity can be disbursed to an account according to [maturity modulation](https://wiki.internetcomputer.org/wiki/Maturity_modulation) Alternatively it can be staked or auto-staked. For a given proposal vote, the voting reward earned by a given neuron is in proportion to its voting power compared to the overall voting power of participating neurons. The voting rewards are distributed daily and take into account all of the votes that ended on that day. If there are no proposals on a given day the rewards are carried over to the next day. The proportion of total token supply that is generated annually for voting rewards is 2.5%. In practice, given that much of the supply will not be in voting neurons, a neuron with a 1 year dissolve delay would expect a voting reward significantly higher than this figure.",
                "Please refer to [this document](https://internetcomputer.org/docs/current/tokenomics/sns/rewards#voting-rewards) for a full description of SNS voting and rewards.",
            ],
        },
        {
            id: "3-5",
            title: "The power of the DAO",
            paras: [
                "There are many factors which will influence the success of OpenChat. It must have a great development team building an app with a great user experience. It must have the standard features expected of a chat app and new capabilities and properties which set it apart from the competition. But even when getting all this right it is hard to break into a market with such established players. A crucial ingredient available to OpenChat to help it succeed is tokenization.",
            ],
        },
        {
            id: "3-5-1",
            title: "Growth",
            paras: [
                "The OpenChat system will automatically reward users with CHAT tokens for using the app positively and for inviting friends and family to join if they also go on to use the app positively. This improves the user experience by encouraging positive behavior and also builds an exponential viral growth loop. Users rewarded with CHAT tokens are invested in the future success of OpenChat and so a powerful team of 100,000s of advocates is created helping drive growth further.",
            ],
        },
        {
            id: "3-5-2",
            title: "Trust",
            paras: [
                "An essential condition for tokenization to be viable in the first place is trust. OpenChat runs on the Internet Computer, a decentralized, unstoppable software platform with decentralized governance using the NNS. OpenChat will itself be controlled by a DAO which is aligned to its long-term success. Even the process of creating the DAO, with a decentralization sale proposed to the NNS and then started automatically by the NNS, ensures there is no foul play. All this means that token holders can trust their investment is secure.",
            ],
        },
        {
            id: "4",
            title: "Purpose of the CHAT utility token",
            paras: [],
            list: [
                "It can be staked as neurons (very similar to ICP neurons) allowing token holders to participate in the governance of OpenChat by [voting](/whitepaper?section=3-4-2) on SNS proposals, and by doing so, earn voting rewards. These rewards increase the longer the tokens are staked and so token holders are incentivised to act in the long term interests of OpenChat.",
                "It can be used by OpenChat users to pay for [premium features](/whitepaper?section=4-1).",
                "It can be used to reward contributions to the evolution or growth of the OpenChat service either through automated [user rewards](/whitepaper?section=4-2) or by SNS proposal.",
            ],
        },
        {
            id: "4-1",
            title: "Premium features",
            paras: [
                "There are many ways OpenChat could evolve to allow users to spend their CHAT tokens for premium features within the dapp. To pay for a feature a user would need to have first deposited CHAT tokens to their OpenChat user canister which acts as a wallet. OpenChat will transfer the payment from the user’s canister to the SNS treasury account and then grant the feature.",
            ],
        },
        {
            id: "4-1-1",
            title: "Current premium features",
            paras: [
                "There are already some premium features that OpenChat offers which for the time being can be obtained either by paying with ICP or verifying a phone number.",
            ],
            list: [
                "Storage for uploading/sending/storing “file” messages such as images and videos",
                "On demand message translation",
                "Increased group creation limit from 10 to 25",
            ],
        },
        {
            id: "4-1-2",
            title: "Communities",
            paras: [
                "A key feature we are planning to build soon is called “communities”. These will be like Slack workspaces or Discord servers and consist of a set of users, groups, and configuration. We will aim to provide a way to import existing Slack workspaces and Discord servers into OpenChat communities. Initially we will focus on encouraging IC communities to migrate to OpenChat, following that, the wider crypto space, before ultimately everyone else. There are various ways communities could be monetised, the most simple being to charge per user. Community owners themselves could potentially monetise their communities and revenue share with OpenChat by, for example, charging for admittance to a community.",
            ],
        },
        {
            id: "4-1-3",
            title: "Other possible future premium features",
            paras: [
                "Here are some more features that OpenChat could offer and charge for in the future.",
            ],
            list: [
                "Custom reactions, themes, stickers etc",
                "OpenChat NFTs",
                "Short usernames",
                "Voice and video chat",
                "‘Featured’ public groups / communities",
                "Custom bots (e.g. a bot controlled chat could support token swaps using messages)",
            ],
        },
        {
            id: "4-1-4",
            title: "Additional potential revenue",
            paras: [],
            list: [
                "Provide chat functionality to other IC apps with an OpenChat integration",
                "Transaction charge on sending tokens as messages",
            ],
        },
        {
            id: "4-2",
            title: "User rewards",
            paras: [
                "The design of the user reward system has not been confirmed yet and we will consult with the OpenChat community before finalizing the design and making a proposal to carry it out. This system can of course evolve over time with further proposals. Once it is ready, a proposal will be made to transfer some CHAT from the SNS treasury to an OpenChat canister where it will be available to the OpenChat dapp to algorithmically reward users.",
                "There are challenges to creating an effective reward system. The aim is to incentivise usage and growth of OpenChat, and ultimately the value of the CHAT token, by rewarding users who further that goal. One significant hurdle is that with a financial reward there is an incentive for unscrupulous users to try to game the system and “farm” CHAT tokens by creating multiple accounts to spam content. This challenge is made harder still because any system designed to reward users will, like all OpenChat code, be open source and visible to anyone.",
            ],
        },
        {
            id: "4-2-1",
            title: "User reputation",
            paras: [
                "We think a reward system should be based on reputation. Each user would have a reputation score taking into account positive and negative activity on the dapp. Positive signals could include inviting other users (if they themselves go on to gain a sufficiently high reputation), owner/admin/moderator of popular groups, sending messages and reactions, moderating content and users, etc. Negative signals could include cross-posting, sending spam messages, creating multiple accounts etc. We expect to add a feature to allow users to mark messages as spam (or more generally unwanted content).",
                "We can also derive a positive signal for a user if they hold tokens (ICP, CHAT, ckBTC) in their OpenChat account, or even better, neurons.",
            ],
        },
        {
            id: "4-2-2",
            title: "Rewards",
            paras: [
                "The reward algorithm can use reputation to determine which users are rewarded and the value of the reward. We could either give a small reward to lots of users or larger rewards to a smaller group perhaps where you get entered into a lottery if your reputation is high enough, or a combination of both. The advantage to having larger rewards is that those users are more likely to become strong advocates for the long term success of OpenChat whereas a small reward might not provide sufficient incentive.",
                "If a user qualifies for a reward, CHAT tokens will be transferred from a designated OpenChat canister to their OpenChat user canister. Using the dapp the user can then access their CHAT tokens and send some to other users, withdraw them to sell on an exchange, or buy premium features. Using the SNS UI users will also be able to stake their CHAT as neurons, take part in OpenChat governance and earn voting rewards.",
            ],
        },
        {
            id: "5",
            title: "Token allocation at SNS genesis",
            paras: [],
        },
        {
            id: "5-1",
            title: "Initial token allocation",
            paras: [
                "The SNS will be initialized with 100 million CHAT tokens allocated in the following proportions.",
            ],
            figure: "allocation",
        },
        {
            id: "5-1-1",
            title: "Decentralization sale (yellow)",
            paras: [
                "25% of the total supply will be put up for sale to decentralize the governance and raise funds for the SNS. The maximum that can be raised will be configured to 1,000,000 ICP and the minimum to 500,000 ICP.",
                "We are asking for 333,333 ICP from the Community Fund (CF) and so hope to raise the remaining 666,667 ICP from decentralization sale participants.",
                "Participants in the decentralization sale will deposit ICP into the SNS and once the sale has completed they will receive the same proportion of CHAT tokens as their share of the ICP deposited. Each participant will receive their CHAT as a basket of 5 equal value neurons. The first neuron will have a zero dissolve delay and so be immediately disbursable to liquid CHAT tokens. The other neurons will have dissolve delays of 3, 6, 9 and 12 months respectively.",
                "Each Community Fund participant will also receive their share of tokens as a basket of 5 neurons with the same configuration.",
            ],
        },
        {
            id: "5-1-2",
            title: "Founders and funders (purple)",
            paras: [
                "OpenChat has been built by a team of 3 developers since January 2021 and has received seed funding from the [DFINITY foundation](https://dfinity.org/).",
                'Each founding developer will receive 5% of the CHAT tokens as a basket of 5 equal value neurons. Each neuron will have a dissolve delay of 1 month but with an additional "vesting period" of 0, 1, 2, 3, and 4 years respectively.',
                'DFINITY will receive 8% of the CHAT tokens as a basket of 4 equal neurons each with a dissolve delay of 1 month and with "vesting periods" of 6, 12, 18, and 24 months respectively.',
                'If a neuron has a "vesting period" it cannot be touched until the period is over (and that includes increasing the dissolve delay). This ensures that the founders/funders cannot rug-pull investors and provides an ongoing incentive to make OpenChat successful.',
                "As these founder/funder neurons all have a relatively short dissolve delay of 1 month which cannot be increased, this ensures a reduced voting power compared to the community so that governance is properly decentralized.",
            ],
        },
        {
            id: "5-1-3",
            title: "SNS treasury (blue)",
            paras: [
                "After the decentralization sale the SNS will be left with a treasury of the remaining 52% of CHAT tokens. The bulk is likely to be used over time to automatically [reward users](/whitepaper?section=4-2) who positively contribute and help OpenChat grow. It will also be available to pay community bounties, by SNS proposal, to compensate people who contribute to OpenChat more generally. This could be used for instance to reward 3rd party developers for code contributions.",
                "A small portion, around 2%, will be used to provide initial liquidity pools for DEXes (decentralized exchanges). In order for CHAT tokens to be traded it is necessary to list CHAT on one or more exchanges. The intention is to trade on IC based DEXes. To list CHAT on a DEX implementing an [AMM](https://academy.binance.com/en/articles/what-is-an-automated-market-maker-amm) it is necessary to provide a liquidity pool of CHAT backed by another token, in our case ICP raised from the decentralization sale. We plan to make CHAT available on several DEXes as and when they are available. For each DEX it will be necessary to create a proposal to transfer some CHAT from the SNS to the DEX, and another proposal to transfer an equal value of ICP from the SNS to the DEX.",
            ],
        },
        {
            id: "5-2",
            title: "Initial SNS configuration",
            paras: [
                "The SNS will initially be configured with the values shown in the tables below which can all subsequently be changed by proposal.",
            ],
            list: [
                "Transaction fee in CHAT tokens that must be paid for ledger transfers: 0.001",
                "Number of CHAT tokens that a rejected proposal costs the proposer: 10",
                "Minimum number of CHAT tokens that can be staked in a neuron: 4",
                "Maximum voting period for a proposal: 4 days",
                "Proportion of voting power needed for a proposal to be accepted: 3%",
                "Minimum neuron dissolve delay to vote: 1 month",
                "Maximum neuron dissolve delay: 1 year",
                "Maximum dissolve delay bonus: 2x",
                "Maximum age for age bonus: 6 months",
                "Maximum age bonus: 1.25x",
                "Percentage of total supply that will be generated annually for rewards: 2.5%",
            ],
        },
        {
            id: "5-3",
            title: "SNS decentralization sale configuration",
            paras: ["The decentralization sale will be configured with the values shown below."],
            list: [
                "The total number of CHAT tokens to be sold: 25,000,000 (25%)",
                "The maximum ICP to be raised: 1,000,000",
                "The minimum ICP to be raised (otherwise sale fails and ICP returned): 500,000",
                "The ICP to come from the Community Fund: 333,333",
                "End date of sale (unless maximum ICP raised sooner): 14th March 2023 at 12:00 (noon) GMT (TBC)",
                "Minimum number of sale participants: 500",
                "Minimum ICP per buyer: 1",
                "Maximum ICP per buyer: 100,000",
            ],
        },
        {
            id: "5-3-1",
            title: "Valuation range",
            paras: [
                "The reason to impose a maximum target is to give participants a minimum bound on the number of CHAT tokens they will receive for their ICP investment. The lower bound of 0.5M ICP and the upper bound of 1M ICP for 25% of the tokens gives the OpenChat DAO an initial total valuation between 2M ICP and 4M ICP. 1 CHAT token would initially be worth between 0.02 -> 0.04 ICP.",
            ],
        },
        {
            id: "6",
            title: "OpenChat SNS treasury",
            paras: [
                "The SNS will hold a treasury of ICP tokens and CHAT tokens.",
                "Immediately after the decentralization sale the SNS will have an ICP ledger account with the ICP raised in the sale and a CHAT ledger account with 52M tokens. The plan for these CHAT tokens is [described above](/whitepaper?section=5-1-3) but the treasury is available to be used by the DAO through proposals as it sees fit.",
                "Soon after the decentralization sale, as and when DEXes are available, proposals will be made to transfer CHAT and the corresponding value of ICP from the treasury into a handful of AMM liquidity pools. This will enable the trading of CHAT.",
                "We plan to create a proposal to stake a large portion of ICP as an 8 year neuron. This neuron would participate in NNS voting by following an OpenChat beacon neuron which would seek to influence the ICs agenda to suit the long term interests of the OpenChat DAO. It would also earn voting rewards for the DAO which could be used to cover ongoing costs or build up a reserve. This all depends on whether a small but significant change is made to the IC to allow canisters to control neurons.",
                "Any liquid ICP in the reserve could be used directly, or the DAO could swap CHAT from the CHAT reserve for ICP at a DEX, and use it to fund expenses such as [cycles for hosting](/whitepaper?section=6-1), [3rd party services](/whitepaper?section=6-2), and later for [paying the development team](/whitepaper?section=6-3).",
            ],
        },
        {
            id: "6-1",
            title: "ICP for cycles to fund hosting",
            paras: [
                'OpenChat has a "cycles dispenser" canister which keeps all the other OpenChat canisters topped up with cycles. It has a treasury of cycles and ICP. When it is runnning low on cycles it will automatically burn some ICP for more cycles using the NNS cycles minting canister. There will be infrequent proposals to transfer a portion of ICP from the SNS treasury to the "cycles dispenser".',
            ],
        },
        {
            id: "6-2",
            title: "3rd party services",
            paras: [
                "The intention is for OpenChat to have no off-chain dependencies so that it is not necessary to trust any human agent, for example to transact in FIAT currencies. At the moment we have the following off-chain dependencies:",
            ],
            list: [
                "Phone number verification (which we use as evidence of unique humanity and reward verified users with some premium features). At the time of writing this is implemented using a small executable on AWS which polls an OpenChat canister and sends queued text messages, each containing a verification code, using an AWS service. We plan to integrate with NFID (from Identity Labs) and use their service to verify user phone numbers. We can then use an SNS proposal to send ICP to Identity Labs on an ongoing basis as payment.",
                "Sending push notifications to browsers (and later native devices). In a similar vein we use an executable on AWS to query an OpenChat canister and push any queued notifications. This will be replaced by an upcoming capability to make fire and forget HTTP calls directly from IC canisters",
                "Rental of the oc.app domain name has been pre-paid for the maximum of 10 years. Long before this we expect the IC to have an alternative solution.",
            ],
        },
        {
            id: "6-3",
            title: "Pay the development team",
            paras: [
                "For some short initial period DFINITY will continue to fund the OpenChat development team and thus remain a core contributor to the OpenChat open source project. Once this funding has stopped the OpenChat DAO will need to fund its own development. In this case the development team(s) can make proposals to the SNS to receive ICP for ongoing funding. For example the team could make a proposal each quarter with a development plan and a request for funds.",
            ],
        },
        {
            id: "6-4",
            title: "Mitigation against a 51% Attack",
            paras: [
                "There is a danger that the OpenChat SNS treasury could be the target of an attack. One possible scenario is for an attacker to buy a large proportion of the CHAT tokens in the decentralization sale and immediately increase the dissolve delay of all of their neurons to the maximum 1 year in an attempt to gain > 50% of the SNS voting power. If successful they could force through a proposal to transfer the entire ICP and CHAT treasury to themselves. The Community Fund actually provides a great deal of mitigation against this scenario because it limits the proportion of voting power an attacker would be able to acquire.",
                "This chart represents a scenario whereby an attacker manages to buy 75% of the available tokens in the decentralization sale which is already extremely unlikely.",
                "If the attacker then increases the dissolve delay of all their neurons to the max this chart shows how much voting power they would be able to acquire. As can be seen the attacker would still fall significantly short of the necessary voting power to gain control with only 43.1%.",
            ],
        },
        {
            id: "7",
            title: "Tokenomics",
            paras: [],
        },
        {
            id: "7-1",
            title: "Total supply levers",
            paras: [
                "At genesis the total supply of CHAT tokens will be 100M. The supply will increase if more tokens are minted and decrease if tokens are burned.",
                "The SNS is configured to generate 2.5% of the total supply annually to pay voting rewards to participating neurons. Voting rewards accumulate in participating neurons as [maturity](https://wiki.internetcomputer.org/wiki/Maturity_modulation). At the point a neuron’s maturity is disbursed it is burned and the corresponding value of CHAT tokens will be minted by the SNS ledger to an account. It is also possible for the SNS to mint tokens by proposal although it is unlikely the OpenChat DAO will elect to do this.",
                "The only way the SNS can burn tokens is by proposal.",
            ],
        },
        {
            id: "7-2",
            title: "Income and outgoings",
            paras: [
                "At genesis the SNS will have a treasury of ICP from the decentralization sale and 52M CHAT tokens.",
                "The SNS will receive an income in CHAT tokens from premium features, transaction fees, 3rd party integrations etc. The SNS will also receive an income in ICP from the NNS voting rewards of its large ICP neuron assuming that goes ahead.",
                "The SNS will have various outgoings. It will use ICP to pay the OpenChat dapp hosting costs (cycles), 3rd parties for services, and at some point soon, the core dev team. It will use CHAT to pay user rewards and community bounties.",
                "In the early years, outgoings will outstrip income and the CHAT treasury will largely be used to fund user rewards and community bounties. The expectation is that as income grows over time it will eventually balance outgoings. A higher income would also allow a higher rate of user rewards and bounties to encourage higher growth in users and usage.",
                "As the OpenChat DAO sees fit it can choose to burn CHAT tokens to reduce the total supply. The expectation is that over several years the SNS will be able to afford to burn CHAT at an increasing rate until the burn rate exceeds the minting rate from voting rewards and the total supply starts decreasing.",
                "The following diagram depicts a projection of the total supply of CHAT over time. For the purposes of this projection it is assumed that the reward rate will remain at a constant 2.5% and that the burn rate will start at 0.125%, increasing by a factor of 1.37 each year, until it overtakes the reward rate.",
            ],
        },
        {
            id: "7-3",
            title: "Token price",
            paras: [
                "There are various factors that will influence the price of CHAT tokens such as",
                "• Total supply",
                "• Market sentiment",
                "• Income",
                "• Costs",
                "• Liquid supply",
                "We have discussed total supply but arguably liquid supply is a bigger factor when considering the token price.",
                "After the decentralization sale, participants will receive a basket of neurons of varying dissolve delays with only 1/5 being immediately liquid. The voting reward rate, initialized to 2.5%, is expected to encourage token holders to lock up a certain proportion of tokens thus, at least temporarily, removing them from the liquid supply. In the case of the seed funders, their neurons have vesting periods from 6-24 momths before they can even start dissolving. In the case of the founding dev team, the vesting periods are from 0-4 years.",
                "There are various tokenomics parameters which can affect the proportion of CHAT that is locked up. These include the max dissolve delay, the dissolve delay bonus, min dissolve delay to vote, max age, max age bonus, and voting reward rate. We have carefully chosen [initial values](/whitepaper?section=5-2) for these parameters which we believe provide a good balance of incentives but these are all levers available to the DAO to allow it to influence the total and liquid supply and therefore the price if so desired.",
                "Consider the SNS treasury of CHAT tokens. These tokens are liquid but are only being trickled out (in percentage terms) to the community as user rewards and bounties, and then only some proportion will find their way onto the market (DEXes). It is a similar story for the portion of CHAT held in the NNS reserve - it is liquid but will not enter the market unless the DAO decides to conduct a future sale.",
                "As a general rule the DAO will want the price of the token to rise over time but this has to be balanced against other factors such as the growth of the app. For instance it might be desirable in some circumstances to turn the user reward taps up higher to encourage more user growth but in the short term that could negatively impact price by increasing the liquid supply.",
            ],
        },
        {
            id: "7-4",
            title: "Model",
            paras: [
                "You can [view the spreadsheet](https://docs.google.com/spreadsheets/d/17iPPf3BgI2QKEXwK0lJYHlJmgPZtNvBxO8cgZfjZz8o) we have used to model various aspects of the OpenChat tokenomics which is also the source for the various charts in this document.",
            ],
        },
    ],
    foot: "The OpenChat SNS whitepaper.",
};
