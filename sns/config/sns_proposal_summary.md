# Summary

This is the proposal for the NNS to create an SNS DAO called OpenChat to govern the [OpenChat dapp](https://oc.app).

# Purpose

OpenChat is a decentralized chat app governed by the people for the people. 

It is fully featured, runs on the Internet Computer blockchain, and is similar to WhatsApp, Signal and Telegram. It is [open source](https://github.com/dfinity-lab/open-chat) and the code running on any canister smart contract [verifiably links back a particular version](https://oc.app/#/architecture?section=3). Users can send messages to each other containing tokens such as ICP and ckBTC.

The OpenChat DAO is being formed to operate and steer the direction of OpenChat as a public good, owned by no-one. Holders of CHAT tokens can stake them as neurons which allow them to make and vote on proposals to change the OpenChat dapp. 

The SNS DAO will hold a treasury of CHAT tokens and ICP which can be used to fund the ongoing development of the dapp and to algorithmically reward users to encourage positive usage and growth. The intention is that by rewarding contributing users with CHAT tokens and neurons so they benefit from the long-term success of OpenChat this will foster a large team of advocates.

CHAT tokens will also be used to pay for "diamond" tier membership and other future premium features.

For more information on the OpenChat SNS please read the [whitepaper here](https://oc.app/#/whitepaper).

# Proposed Token Distribution

Total token supply: 100 million CHAT tokens

Initially distributed:
- 52%: Reserved for the SNS treasury & under control of the OpenChat DAO
- 25%: To be distributed by the NNS run decentralization sale which includes the Community Fund
- 15%: Allocated to the OpenChat dev team which vests over 4 years
- 8%: Allocated to DFINITY for providing seed funding which vests over 2 years

Ledger transaction fee: 0.001 CHAT tokens

For more information on the initial token allocation please [read here](https://oc.app/#/whitepaper?section=5).

# Governance

- Each decentralization sale participant (including the Community Fund) will receive their tokens in a basket of 5 equal value CHAT neurons with dissolve delays of 0, 3, 6, 9 and 12 months respectively
- The founding dev team will receive their tokens in a basket of 5 neurons, the first with zero dissolve delay, and the rest with a dissolve delay of 1 month but with vesting periods of 1, 2, 3 and 4 years respectively
- DFINITY will receive their tokens in a basket of 4 neurons all with a dissolve delay of 1 month but with vesting periods of 6, 12, 18 and 24 months respectively

The governance parameters for OpenChat are proposed to be initially set as:

- Min stake 4 CHAT tokens
- Min stake period for voting: 1 month
- Max staking period: 1 year

Voting Rewards: 2.5% of CHAT token supply minted annually

- Max staking bonus (for 1 year): 2x
- Max age for age bonus: 6 months
- Max age bonus: 1.25x

These parameters can be verified by querying the governance canister's get_nervous_system_parameters method at https://dashboard.internetcomputer.org/canister/<INSERT_GOVERNANCE_CANISTER_ID>

# Decentralization Sale

25% of the total supply of tokens are proposed to be distributed via an SNS decentralization sale. The sale will start when this proposal is accepted and is scheduled to conclude midday on Tuesday 14th March UTC. If the maximum number of ICP configured below is raised before that date the sale will conclude earlier.

Sale participation parameters

- Min participation: 1 ICP
- Max participation: 100,000 ICP
- Max to be raised: 1,000,000 ICP
- Min to be raised: 500,000 ICP
- From Community Fund: 333,333 ICP
- Min participants: 500

The sale is open to anyone. Participation is either via the launchpad in the NNS front end: https://nns.ic0.app/ or on the command line using [quill](https://github.com/dfinity/quill/).

```
quill sns new-sale-ticket [OPTIONS] --amount-icp-e8s <AMOUNT_ICP_E8S>.
```

# The dapp

The OpenChat dapp consists of a set of canister smart contracts:

Top-level canisters controlled by the [OpenChat SNS root canister](https://dashboard.internetcomputer.org/canister/<INSERT_ROOT_CANISTER_ID>)
- 1 Website asset canister (6hsbt-vqaaa-aaaaf-aaafq-cai)
- 1 UserIndex (4bkt6-4aaaa-aaaaf-aaaiq-cai)
- 1 GroupIndex (4ijyc-kiaaa-aaaaf-aaaja-cai)
- 1 NotificationsIndex (4glvk-ryaaa-aaaaf-aaaia-cai)
- 1 StorageIndex (rturd-qaaaa-aaaaf-aabaq-cai)
- 1 OnlineUsers (3vlw6-fiaaa-aaaaf-aaa3a-cai)
- 1 ProposalsBot (iywa7-ayaaa-aaaaf-aemga-cai)
- 1 CyclesDispenser (gonut-hqaaa-aaaaf-aby7a-cai)

Controlled by top-level canisters
- 1 LocalUserIndex per subnet
- 1 LocalGroupIndex per subnet
- 1 Notification canister per subnet
- Several StorageBuckets per subnet
- 1 User canister per user
- 1 Group canister per group

For more information please see a description of the architecture [here](https://oc.app/#/architecture).

# Verification

All the details above can be verified, by examining the initialized OpenChat SNS canisters. [More detailed instructions here](https://wiki.internetcomputer.org/wiki/How-to:_Verify_SNS_decentralization_sale_proposal).