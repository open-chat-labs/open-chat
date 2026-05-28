use canister_time::now_nanos;
use local_user_index_canister::{
    BotRegistered, BotUpdated, DiamondMembershipPaymentReceived, ExternalAchievementAwarded,
    OpenChatBotMessageV2, PhoneNumberConfirmed, ReferralCodeAdded, StorageUpgraded, UserDetailsFull,
    UserIndexEvent, UserJoinedCommunityOrChannel, UserJoinedGroup, UserRegistered, UserSuspended,
};

/// Creates additional wasm-level call sites for `local_user_index_canister::UserIndexEvent::visit_enum`
/// and its variant-payload struct visitors, preventing wasm-opt from inlining single-use functions
/// into them and exceeding ICP's 1,000,000 function-complexity limit.
///
/// # Background
///
/// `ic-wasm optimize Oz` uses wasm-opt's single-use inliner, which inlines any function that has
/// exactly one call site. Without this anchor there are two layers of problem:
///
/// 1. `UserIndexEvent::visit_enum` had only one call site (inside the `Data` deserialization in
///    `post_upgrade`), so wasm-opt inlined its entire body there, ballooning `Data`'s deserializer
///    past the ICP 1,000,000 complexity limit.
///
/// 2. After giving `UserIndexEvent::visit_enum` a second call site, the variant-payload struct
///    visitors (e.g. `BotRegistered::visit_map`, `DiamondMembershipPaymentReceived::visit_map`)
///    become the problem: each is only called from one place (inside `UserIndexEvent::visit_enum`),
///    so wasm-opt inlines them all into `UserIndexEvent::visit_enum`, making it too complex.
///
/// # Why this works
///
/// All deserialization in this codebase goes through `msgpack::deserialize`, which internally
/// uses a concrete `ErasedReader` wrapper (`&mut dyn Read`) before calling `rmp_serde::from_read`.
/// Because `ErasedReader` is a single non-generic type, every call to `msgpack::deserialize<T, _>`
/// — regardless of the underlying reader — produces the **same** serde monomorphization. Adding
/// `msgpack::deserialize::<SomeType, _>()` in the dead branch gives `SomeType::visit_map` (or
/// `visit_enum`) a **second** call site in the Wasm binary, so wasm-opt refuses to inline it.
///
/// Note that types already shared with other msgpack endpoints need no anchor here:
/// - `BotDefinition` / `BotCommandDefinition` — shared via `register_bot` and `update_bot`
/// - `MessageContentInitial` — shared via `c2c_local_user_index` (user_index_canister::LocalUserIndexEvent)
///
/// The structs listed below are variant-payload types **unique** to `UserIndexEvent::visit_enum`.
/// Even though their nested types may be shared, the wrapper struct's own `visit_map` is only
/// called from within `UserIndexEvent::visit_enum` and would be inlined there without these anchors.
///
/// # Why `now_nanos()` and not `now_millis()`
///
/// `now_millis()` divides by 1,000,000 and LLVM's value-range analysis can prove the result
/// fits in `i64`, making `now > i64::MAX as u64` always-false → dead branch → anchor eliminated.
/// `now_nanos()` is a raw `ic0::time() as u64` cast that LLVM treats as opaque, so the branch
/// cannot be proven false and survives to the final binary.
pub fn anchor() {
    let now = now_nanos();

    if now > i64::MAX as u64 {
        // This branch never executes at runtime. Each deserialize call below gives the
        // corresponding type's serde visitor a second call site in the Wasm binary, preventing
        // wasm-opt's single-use inliner from folding it into UserIndexEvent::visit_enum.
        let bytes = now.to_be_bytes();
        let s = bytes.as_slice();

        // Anchor for UserIndexEvent::visit_enum itself (first call site is in post_upgrade
        // via Data.user_index_event_sync_queue deserialization).
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
