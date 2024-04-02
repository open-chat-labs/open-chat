Features:

e33a10e1b Consensus(ecdsa): Enable reduced tECDSA latency feature
Review: Looks fine + matches description
Notes: Sets the `ECDSA_IMPROVED_LATENCY` flag to true.

cb144e1a7 Crypto: add threshold Schnorr vault signer trait
Review: Looks fine + matches description
Notes: Adds the `ThresholdSchnorrSignerCspVault` trait, implementations will follow.

f5bf35a12 Execution: Limit the total size of canister logs buffer
Review: Looks fine + matches description
Notes: Always clears space if needed before adding entries to the canister log to ensure it never exceeds `MAX_ALLOWED_CANISTER_LOG_BUFFER_SIZE`.

a23f854de Execution,Message Routing: Implement MessagePool
Review: Looks fine + matches description
Notes: Implements `MessagePool` which supports messages with deadlines and load shedding (as opposed to the current model where every request that is sent to another canister is guaranteed a response from that canister).

2a6eb75b9 Networking: allow fetching api boundary nodes via subnet read state request
Review: Looks fine + matches description
Notes: Adds paths containing `api_boundary_nodes` to th list of valid paths when calling `read_state`.

cf1afec73 Runtime,Execution: Update format of logging canister traps
Review: Looks fine + matches description
Notes: Updates the format of 'canister trapped' log messages to all start with the prefix '[TRAP]:'.

Bugfixes:

5d5d7425c Execution: Support both versions of chunk_hash type for install_chunked_code
Review: Looks fine + matches description
Notes: Attempts to deserialize `install_chunked_code` args as `InstallChunkedCodeArgs` and falls back to deserializing as `InstallChunkedCodeArgsLegacy` if that fails allowing either type to be used.

e4f38e051 Networking: state sync manager fixes
Review: Looks fine + matches description
Notes: Implements graceful shutdown by passing a cancellation token to the inner broadcast tasks + refactors how the `tracker` is passed through to `spawn_chunk_downloads`.

Chores:

baf0963ee Boundary Nodes,Node(nginx): remove add_header instructions that have no effect
Review: Looks fine + matches description
Notes: Removes 3 `add_header` instructions from the Nginx config.

23ecad053 Consensus(ecdsa): move ecdsa_key_id from QuadrupleId to QuadrupleInCreation and PreSignatureQuadrupleRef.
Review: Looks fine + matches description
Notes: Moves `ecdsa_key_id` into the inner structs, simplifying `QuadrupleId` usage and creation.

469babde6 Crypto: Add a Ed25519 key conversion routine
Review: Looks fine + matches description
Notes: Implements `convert_raw_to_der` for `Ed25519` public keys.

e9bd734d0 Execution: Add proto de/serialization for SchnorrKeyId and MasterPublicKeyId
Review: Looks fine + matches description
Notes: Shortens the names of the `MasterPublicKeyId` enum subtype names + implements conversion between `pb_registry_crypto::SchnorrAlgorithm` and `SchnorrAlgorithm`.

b412b7931 Financial Integrations,Crypto: Move hex dependency to workspace
Review: Looks fine + matches description
Notes: Uses `hex = { workspace = true }` whenever there is a dependency on `hex`.

c0f74b193 Networking: Add metric for HTTP version used for incoming requests.
Review: Looks fine + matches description
Notes: Adds the `request_http_version_counts` counter to count number of requests of each HTTP version.

8d2804339 Networking(http_endpoint): migrate pprof and dashboard endpoint to axum
Review: Looks fine + matches description
Notes: Switches the dashboard and performance profiling endpoints over to being served up by `axum`.

6668eb3f4 Networking(http_endpoint): migrate read state endpoinst to axum
Review: Looks fine + matches description
Notes: Switches the read_state endpoint over to being served up by `axum`.

1ba61ea0c Runtime: Add Wasmtime store limits
Review: Looks fine + matches description
Notes: Sets the `memory_size`, `tables` and `table_elements` wasmtime store limits. 

Refactoring:

a6e9e06df Consensus: Introduce ConsensusResponse with optional fields
Review: Looks fine + matches description
Notes: Adds `ConsensusResponse` where all fields other than `callback` and `payload` are optional. This is in preparation for the optional fields being removed in a subsequent change.

Tests:

897f61fec Consensus: Add a unit test for make_reshare_dealings_response
Review: Looks fine + matches description
Notes: Only touches test code.

fece3b6c0 Consensus(ecdsa): prepare some unit tests for multiple ecdsa keys
Review: Looks fine + matches description
Notes: Only touches test code.

ba810441f Crypto: Fix threshold ECDSA serialization stability tests
Review: Looks fine + matches description
Notes: Only touches test code.

e3aa7a17e Execution,Runtime: Add heartbeat and timers canister logging tests
Review: Looks fine + matches description
Notes: Only touches test code.

fdd49e523 Message Routing,Runtime: proptest for sharded overlays
Review: Looks fine + matches description
Notes: Only touches test code other than change to rename a function.

Other changes:

fc6386010 Boundary Nodes,Node: () BN network tuning
Review: Looks fine + matches description
Notes: Tweaks a few settings in the boundary node config.

4c63db7e7 Execution,Interface: Make SnapshotId unique over all subnets.
Review: Looks fine + matches description
Notes: Appends the canisterId to each snapshotId to ensure snapshotIds are all globally unique.

86f415458 Execution,Runtime: Remove remaining traces of unused query_allocation
Review: Looks fine + matches description
Notes: Removes all usage of `query_allocation`.

a893e9b56 Message Routing,Interface: Canister stores the belonging snapshot ids
Review: Looks fine + matches description
Notes: Adds the `snapshot_ids` field to the canister state which will be used to store the list of snapshots that exist for the canister.

da0184fb0 Node: Improve image caching
Review: Looks fine + matches description
Notes: I don't fully understand what this change is doing, but it's all to do with how files are opened, so I trust that it is doing what it says it is doing.

92c810e22 Node: Updating container base images refs [2024-03-21-0830]
Review: Looks fine + matches description
Notes: Updates the image hashes in the docker-base files.