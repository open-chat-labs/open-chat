Features:

23af050fb Crypto,Interface(crypto): Support key derivation in ic_crypto_ecdsa_secp256k1 (#706)
Review: Looks fine + matches description
Notes: Implements deriving new keys from an existing key and a derivation path. 

951e895c7 Execution,Interface: Handle stable_read/write with Wasm64 heaps and testing infrastructure (#781)
Review: Looks fine + matches description
Notes: Makes the `max_heap_address` higher when running wasm64 so that canisters can use more than 4GB of heap memory.

07786ecc4 Execution,Interface: add allowed_viewers to canister log visibility management canister types (#606)
Review: Looks fine + matches description
Notes: Introduces `LogVisibilityV2` which has the `allowed_viewers` option, giving more control over who can view canister logs. 

f116e5713 Execution,Interface: Limit number of snapshots stored per canister (#726)
Review: Looks fine + matches description
Notes: Ensures the number of snapshots per canister never exceeds `MAX_NUMBER_OF_SNAPSHOTS_PER_CANISTER`, which is currently set to 1.

78dca2f91 Execution,Interface: add support on canister manager for get block headers (#381)
Review: Looks fine + matches description
Notes: Adds `bitcoin_get_block_headers` to the management canister API.

c0373c673 Execution,Interface,Message Routing: Parallel dirty page copying for page allocator (#733)
Review: Looks fine + matches description
Notes: Implements a new path for allocating memory pages which uses up to 8 threads to allocate the pages in parallel. This new path is only used if more than 64MB of memory needs to be allocated.

2e6584c42 Interface(nns): Implement the execution of UpdateCanisterSettings proposals (#731)
Review: Looks fine + matches description
Notes: Implements the execution of `UpdateCanisterSettings` proposals so that canisters controlled by the NNS Root canister can update their settings (eg. set the log visibility or the wasm memory limit).

168e5cc2f Interface(ckerc20): NNS proposal to add ckWSTETH (#612)
Review: Looks fine + matches description
Notes: Adds the proposal which was submitted recently to add ckWSTETH to the ckERC20 ledger suite.

71838e9c1 Interface,Message Routing: Checkpointing for canister snapshots (#702)
Review: Looks fine + matches description
Notes: Adds the canister snapshots to the state to be persisted to disk during a checkpoint and also implements loading the canister snapshots when loading from a checkpoint.

2bf9d4463 Interface,Message Routing: State layout of canister snapshots (#645)
Review: Looks fine + matches description
Notes: Defines and implements how canister snapshots will be represented when written to disk.

Bugfixes:

799cf9f94 Consensus,Interface(types): Remove serde derive from ThresholdSigInputRefs (#760)
Review: Looks fine + matches description
Notes: Removes some Serde attributes from types where they are no longer needed.

e8a163fda Execution,Interface: Fix the return type of some System APIs (#785)
Review: Looks fine + matches description
Notes: Fixes some system APIs to return unsigned values rather than signed values (eg. u64 rather than i64).

82c76c1bb Execution,Interface: Fix a debug assertion in update_socket_timeout (#779)
Review: Looks fine + matches description
Notes: This won't affect anything running in production because it just updates a debug assertion.

8db01a49c Execution,Interface: Update heap delta debit and estimate when handling snapshots (#727)
Review: Looks fine + matches description
Notes: Fixes the heap delta calculations when taking and loading canister snapshots.

83b0fa536 Execution,Interface,Message Routing: Consider canister snapshots when calculating available subnet memory (#753)
Review: Looks fine + matches description
Notes: Fixes a bug where the memory used by canister snapshots wasn't being taken into account when calculating the remaining available subnet memory.

Chores:

0a12c4b66 Crypto,Interface(crypto): Annotate where parallelism can be used in NIDKG (#671)
Review: Looks fine + matches description
Notes: No change in functionality, but adds annotations marking where crypto computations could be run in parallel.

dae6bbe95 Interface: Update visibility of dfn_* libraries (#804)
Review: Looks fine + matches description
Notes: Reduces the visibility of the deprecated dfn_* libraries in order to prevent new usages and help move towards fully removing them.

80ebdebe5 Interface: Update gz references (#701)
Review: Looks fine + matches description
Notes: Updates some doc references to gz to instead be zst, and then updates some file names to be agnostic of the compression algorithm used. 

fc4f2e385 Interface(IDX): specify which NNS canisters to use via env vars (#675)
Review: Looks fine + matches description
Notes: Specify which NNS canisters to use in tests via env variables so that tests can be run against different canisters without changing the code (eg. mainnet vs HEAD)

b0f4527a2 Interface,Networking(http-handler): Only log every 10 second in the call-v3 handler (#717)
Review: Looks fine + matches description
Notes: Only log once every 10 seconds in the call v3 handler to avoid bloating the logs.

44a966ec6 Interface,Networking(http-handler): Add a 1 second timeout when creating a subscriber in call-v3 handler (#716)
Review: Looks fine + matches description
Notes: Sets a 1 second timeout for creating the certification subscriber in the call v3 handler.

0bd54a27f Interface,Node: Remove obsolete set-node-id command (#778)
Review: Looks fine + matches description
Notes: Removes the `set-node-id` command which was never actually used.

4b51b1e23 Node: Update Base Image Refs [2024-08-06-0146] (#765)
Review: Looks fine + matches description
Notes: Updates the base image references.

Refactoring:

12e89bb81 Interface: Migrate more type dependencies to use ic_nns_governance_api (#628)
Review: Looks fine + matches description
Notes: Migrates more packages from using `ic_nns_governance` to the new `ic_nns_governance_api` package.

Tests:

1a5c96918 Consensus,Interface(consensus): Add exhaustive serialization->deserialization test for ConsensusMessage (#795)
Review: Looks fine + matches description
Notes: Adds the `ExhaustiveSet` attribute to consensus message tests and implements the trait so that they run many times with generated inputs.

d5511c98e Interface,Message Routing: more complex input queues scenario for queue compatibility tests (#745)
Review: Looks fine + matches description
Notes: Extends some message routing tests.

Documentation:

192fc1e12 Node: fix upgrade-install documentation (#786)
Review: Looks fine + matches description
Notes: Updates some comments in the `manageboot.sh` script.
