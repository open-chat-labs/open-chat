Summary
This is the proposal for the NNS to create
an SNS DAO called SNS-1 to govern the SNS-1 dapp.

Purpose
The SNS-1 DAO is the first of hopefully many SNS DAOs to be created
on the Internet Computer. Its goal is, first and foremost, to be a production
dress rehearsal for SNS DAO creation, and for it to then
live on as a community owned experimental DAO.  As a pioneer it exists to be
an early adopter of the technology, as the ecosystem around SNSs evolves.
The dapp it controls is initially a very simple asset canister, that
displays an open letter to the community. The vision is that
the SNS-1 DAO community will evolve this dapp into something inspiring.
What that something is, is for the community, not DFINITY to decide.
The letter hopefully inspires the future SNS-1 community
to take SNS-1 to places unforeseen.

Proposed Token Distribution
Drawing inspiration from the SNS-1 letter, total token supply: 10,000.
Initially distributed:

3860: Allocated to principals collected from the presale airdrop.
3141: To be distributed by the NNS run decentralization sale.
2937: Reserved for the SNS-1 treasury & under control of the SNS-1 DAO
12: Allocated to SNS developers (needed to manage the dapp between now
and the end of the decentralization sale)
50: Allocated to ludo for his creative contributions to the SNS-1

Ledger transaction fee: 0.00001 SNS-1 tokens

Governance
All tokens will be placed in neurons except the ones that make up the
SNS-1 treasury. The SNS-1 neurons are proposed to be created as follows:

The 3860 SNS-1 tokens allocated to the presale airdrop, the 12 allocated to SNS developers & the 50 allocated to ludo will be staked in a single neuron per principal with a 1 month dissolve delay.
The 3141 SNS-1 tokens distributed by the NNS decentralization sale will be staked in 2 neurons per principal, each with ½ of the allocated tokens. One neuron will have a zero delay period and the second neuron will have a 1 month dissolve delay.

The governance parameters for SNS-1 are proposed to be initially set as:

Min stake 0.01 SNS-1 tokens
Min stake period for voting: 1 month
Max staking period: 100 years

Voting Rewards: 0% (no token inflation)
These parameters can be verified by querying the governance canister's
get_nervous_system_parameters method at https://dashboard.internetcomputer.org/canister/zqfso-syaaa-aaaaq-aaafq-cai

Decentralization Sale
3141 or 31.4% of the total supply of tokens are proposed to be distributed
via an SNS decentralization sale. The sale will start when this proposal
is accepted and is scheduled to conclude end of day Friday 9th Dec AoE.
If the maximum number of ICP configured below is raised before that date
the sale will conclude earlier.
Sale participation parameters

Min participation: 0.1 ICP
Max participation: 1 ICP
Max ICP to be raised: 3141
Min ICP to be raised: 50
Min participants: 50

The sale is open to anyone. Participation is via the launchpad in the
NNS front end: https://nns.ic0.app/.

The dapp
The SNS-1 dapp canister can be found here: https://sqbzf-5aaaa-aaaam-aavya-cai.ic0.app/
The controller of this canister has been set to be the root canister
of the initialized SNS-1: https://dashboard.internetcomputer.org/canister/zxeu2-7aaaa-aaaaq-aaafa-cai

Verification
All the details above can be verified, by examining the initialized SNS-1 canisters.
More detailed instructions
here).