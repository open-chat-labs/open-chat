use crate::guards::caller_is_user_index;
use crate::{WASM_VERSION, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_try_start_migration::{Response::*, *};

// Called by the UserIndex to start migrating the user to a MultiUser canister. Not run via
// `execute_update`, since a repeated call must still be answered once the canister is frozen for the
// migration, and nothing else may run which could change the canister's state.
#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_try_start_migration(args: Args) -> Response {
    match mutate_state(|state| state.data.try_start_migration(args.multi_user_canister_id)) {
        Ok(user_bytes) => Success(SuccessResult {
            user_bytes,
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
        }),
        Err(error) => Error(error),
    }
}

#[cfg(test)]
mod tests {
    use crate::Data;
    use candid::Principal;
    use oc_error_codes::OCErrorCode;
    use types::{CanisterId, FrozenUserInfo};

    fn data() -> Data {
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

    #[test]
    fn starts_migration_and_returns_the_size_of_the_user() {
        let mut data = data();

        let user_bytes = data.try_start_migration(multi_user_canister(1)).unwrap();

        assert_eq!(user_bytes, msgpack::serialize_then_unwrap(&data.user).len() as u64);
        assert_eq!(data.migrating_to, Some(multi_user_canister(1)));
        assert!(data.is_frozen());
    }

    #[test]
    fn repeated_call_returns_the_same_size() {
        let mut data = data();

        let first = data.try_start_migration(multi_user_canister(1)).unwrap();
        let second = data.try_start_migration(multi_user_canister(1)).unwrap();

        assert_eq!(first, second);
    }

    #[test]
    fn migration_to_another_canister_is_rejected() {
        let mut data = data();
        data.try_start_migration(multi_user_canister(1)).unwrap();

        let error = data.try_start_migration(multi_user_canister(2)).unwrap_err();

        assert!(error.matches_code(OCErrorCode::AlreadyInProgress));
        assert_eq!(data.migrating_to, Some(multi_user_canister(1)));
    }

    #[test]
    fn frozen_canister_is_not_ready() {
        let mut data = data();
        data.frozen = Some(FrozenUserInfo {
            timestamp: 1,
            frozen_by: Principal::from_slice(&[7]).into(),
            reason: None,
        });

        let error = data.try_start_migration(multi_user_canister(1)).unwrap_err();

        assert!(error.matches_code(OCErrorCode::NotReadyForMigration));
        assert!(data.migrating_to.is_none());
    }

    #[test]
    fn canister_with_stable_memory_to_garbage_collect_is_not_ready() {
        let mut data = data();
        data.stable_memory_keys_to_garbage_collect
            .push(stable_memory_map::ChatEventKeyPrefix::new_from_direct_chat_key_id(1, None).into());

        let error = data.try_start_migration(multi_user_canister(1)).unwrap_err();

        assert!(error.matches_code(OCErrorCode::NotReadyForMigration));
        assert!(data.migrating_to.is_none());
    }
}
