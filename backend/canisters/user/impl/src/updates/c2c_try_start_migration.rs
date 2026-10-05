use crate::guards::caller_is_local_user_index;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_try_start_migration::{Response::*, *};

// Called by the LocalUserIndex to start migrating the user to a MultiUser canister. Not run via
// `execute_update`, since a repeated call must still be answered once the canister is frozen for
// the migration, and nothing else may run which could change the canister's state.
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_try_start_migration(args: Args) -> Response {
    mutate_state(|state| {
        let now = state.env.now();
        match state.data.try_start_migration(args.multi_user_canister_id, now) {
            Ok(migration) => Success(SuccessResult {
                user_bytes: migration.user.len() as u64,
                wasm_version: migration.wasm_version,
                user_hash: migration.user_hash,
            }),
            Err(error) => Error(error),
        }
    })
}

#[cfg(test)]
mod tests {
    use crate::{Data, WASM_VERSION};
    use candid::Principal;
    use constants::HOUR_IN_MS;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use oc_error_codes::OCErrorCode;
    use types::{
        BuildVersion, CanisterId, Chat, FrozenUserInfo, MessageId, P2PSwapLocation, TimestampMillis, Timestamped, TokenInfo,
    };
    use user_core::P2PSwap;
    use user_core::migration::MigratingUser;
    use utils::async_work::AsyncWorkGuard;

    fn data() -> Data {
        init_stable_memory_map();
        Data::new(
            Principal::from_slice(&[1]),
            Principal::from_slice(&[2]),
            Principal::from_slice(&[3]),
            Principal::from_slice(&[4]),
            Principal::from_slice(&[5]),
            Principal::from_slice(&[6]),
            Vec::new(),
            "username".to_string(),
            true,
            None,
            1,
        )
    }

    fn multi_user_canister(i: u8) -> CanisterId {
        Principal::from_slice(&[10, i])
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }

    fn version(patch: u32) -> BuildVersion {
        BuildVersion::new(2, 0, patch)
    }

    fn set_wasm_version(patch: u32) {
        WASM_VERSION.set(Timestamped::new(version(patch), 0));
    }

    #[test]
    fn starts_migration_and_stores_the_user() {
        let mut data = data();
        set_wasm_version(1);

        let migration = data.try_start_migration(multi_user_canister(1), 2).unwrap();

        let MigratingUser { user, timer_jobs }: MigratingUser = msgpack::deserialize_then_unwrap(&migration.user);
        assert_eq!(migration.multi_user_canister_id, multi_user_canister(1));
        assert_eq!(migration.started, 2);
        assert_eq!(migration.wasm_version, version(1));
        assert_eq!(user.principal, data.user.principal);
        assert_eq!(user.username.value, data.user.username.value);
        assert!(timer_jobs.is_empty());
        assert!(data.is_frozen());
    }

    #[test]
    fn repeated_call_returns_the_same_migration() {
        let mut data = data();
        set_wasm_version(1);

        let first = data.try_start_migration(multi_user_canister(1), 2).unwrap().user.clone();

        // Even if the canister has since been upgraded, the user as they were serialized is returned
        set_wasm_version(2);
        let second = data.try_start_migration(multi_user_canister(1), 3).unwrap();

        assert_eq!(second.user, first);
        assert_eq!(second.started, 2);
        assert_eq!(second.wasm_version, version(1));
    }

    #[test]
    fn migration_to_another_canister_is_rejected() {
        let mut data = data();
        data.try_start_migration(multi_user_canister(1), 2).unwrap();

        let error = data.try_start_migration(multi_user_canister(2), 3).map(|_| ()).unwrap_err();

        assert!(error.matches_code(OCErrorCode::AlreadyInProgress));
        assert_eq!(data.migration.unwrap().multi_user_canister_id, multi_user_canister(1));
    }

    #[test]
    fn canister_with_async_work_in_progress_is_not_ready() {
        let mut data = data();
        let _guard = AsyncWorkGuard::new();

        let error = data.try_start_migration(multi_user_canister(1), 2).map(|_| ()).unwrap_err();

        assert!(error.matches_code(OCErrorCode::NotReadyForMigration));
        assert!(data.migration.is_none());
    }

    #[test]
    fn frozen_canister_can_start_migrating() {
        let mut data = data();
        data.frozen = Some(FrozenUserInfo {
            timestamp: 1,
            frozen_by: Principal::from_slice(&[7]).into(),
            reason: None,
        });

        let migration = data.try_start_migration(multi_user_canister(1), 2).unwrap();

        assert_eq!(migration.multi_user_canister_id, multi_user_canister(1));
    }

    #[test]
    fn user_with_a_swap_is_not_ready_until_an_hour_after_it_expires() {
        let mut data = data();
        data.user.p2p_swaps.add(p2p_swap(1_000));

        let error = data
            .try_start_migration(multi_user_canister(1), 1_000 + HOUR_IN_MS - 1)
            .map(|_| ())
            .unwrap_err();

        assert!(error.matches_code(OCErrorCode::NotReadyForMigration));
        assert!(data.migration.is_none());

        data.try_start_migration(multi_user_canister(1), 1_000 + HOUR_IN_MS).unwrap();
    }

    #[test]
    fn canister_with_stable_memory_to_garbage_collect_is_not_ready() {
        let mut data = data();
        data.stable_memory_keys_to_garbage_collect
            .push(stable_memory_map::ChatEventKeyPrefix::new_from_direct_chat_key_id(1, None).into());

        let error = data.try_start_migration(multi_user_canister(1), 2).map(|_| ()).unwrap_err();

        assert!(error.matches_code(OCErrorCode::NotReadyForMigration));
        assert!(data.migration.is_none());
    }

    fn p2p_swap(expires_at: TimestampMillis) -> P2PSwap {
        let token = TokenInfo {
            symbol: "ICP".to_string(),
            ledger: Principal::from_slice(&[30]),
            decimals: 8,
            fee: 10_000,
        };
        P2PSwap {
            id: 1,
            location: P2PSwapLocation::from_message(
                Chat::Direct(Principal::from_slice(&[31]).into()),
                None,
                MessageId::from(1u64),
            ),
            created_by: Principal::from_slice(&[20]).into(),
            created: 0,
            token0: token.clone(),
            token0_amount: 100,
            token1: token,
            token1_amount: 100,
            expires_at,
        }
    }
}
