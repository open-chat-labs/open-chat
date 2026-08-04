use canister_time::now_nanos;
use local_user_index_canister::{
    BotRegistered, BotUpdated, DiamondMembershipPaymentReceived, ExternalAchievementAwarded, OpenChatBotMessageV2,
    PhoneNumberConfirmed, ReferralCodeAdded, StorageUpgraded, UserDetailsFull, UserIndexEvent, UserJoinedCommunityOrChannel,
    UserJoinedGroup, UserRegistered, UserSuspended,
};

/// Creates additional wasm-level call sites for `UserIndexEvent::visit_enum` and its
/// variant-payload struct visitors, preventing wasm-opt from inlining single-use functions into
/// the `c2c_notify_user_index_events` args deserializer and exceeding ICP's 1,000,000
/// function-complexity limit. See the identically-named module in the user_index canister for
/// the full explanation of the mechanism (single-use inliner + the shared `ErasedReader`
/// monomorphization which makes these dead calls hit the same code paths).
///
/// This canister deserializes `UserIndexEvent` in exactly one place, so without an anchor the
/// entire enum visitor (plus every variant-payload visitor) is inlined into that endpoint's
/// deserializer. Adding the `SetModerationReferralConfig` variant pushed it just over the limit.
pub fn anchor() {
    let now = now_nanos();

    if now > i64::MAX as u64 {
        // This branch never executes at runtime. Each deserialize call below gives the
        // corresponding type's serde visitor a second call site in the Wasm binary, preventing
        // wasm-opt's single-use inliner from folding it into UserIndexEvent::visit_enum.
        let bytes = now.to_be_bytes();
        let s = bytes.as_slice();

        assert!(msgpack::deserialize::<UserIndexEvent, _>(s).is_err());

        // Anchors for large variant-payload structs whose visit_map is otherwise unique to
        // UserIndexEvent::visit_enum and would be inlined into it by wasm-opt.
        assert!(msgpack::deserialize::<BotRegistered, _>(s).is_err()); // 11 fields
        assert!(msgpack::deserialize::<DiamondMembershipPaymentReceived, _>(s).is_err()); // 10 fields
        assert!(msgpack::deserialize::<UserDetailsFull, _>(s).is_err()); // 10 serde-renamed fields
        assert!(msgpack::deserialize::<BotUpdated, _>(s).is_err()); // 4 fields incl. BotDefinition
        assert!(msgpack::deserialize::<OpenChatBotMessageV2, _>(s).is_err()); // 4 fields incl. MessageContentInitial
        assert!(msgpack::deserialize::<UserJoinedCommunityOrChannel, _>(s).is_err()); // 5 fields
        assert!(msgpack::deserialize::<UserJoinedGroup, _>(s).is_err()); // 5 fields
        assert!(msgpack::deserialize::<UserSuspended, _>(s).is_err()); // 5 fields incl. SuspensionDuration
        assert!(msgpack::deserialize::<UserRegistered, _>(s).is_err()); // 5 fields
        assert!(msgpack::deserialize::<StorageUpgraded, _>(s).is_err()); // 4 fields, custom Deserialize
        assert!(msgpack::deserialize::<PhoneNumberConfirmed, _>(s).is_err()); // 4 fields
        assert!(msgpack::deserialize::<ExternalAchievementAwarded, _>(s).is_err()); // 4 fields
        assert!(msgpack::deserialize::<ReferralCodeAdded, _>(s).is_err()); // 3 fields
    }
}
