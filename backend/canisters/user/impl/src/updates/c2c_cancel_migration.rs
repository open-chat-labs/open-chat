use crate::guards::caller_is_user_index_or_multi_user_canister_migrating_to;
use crate::{jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_cancel_migration::{Response::*, *};

// Called by the UserIndex, or by the MultiUser canister the user is being migrated to, to cancel the
// migration, after which the canister carries on serving the user as before. Succeeds if there is no
// migration to cancel, so that the call can be retried. Not run via `execute_update`, since the
// canister is frozen for the migration.
#[update(guard = "caller_is_user_index_or_multi_user_canister_migrating_to", msgpack = true)]
#[trace]
fn c2c_cancel_migration(_args: Args) -> Response {
    mutate_state(|state| {
        let now = state.env.now();
        if state.data.cancel_migration(now) {
            // The jobs weren't started while the user was being migrated
            jobs::start(state);
        }
        Success
    })
}

#[cfg(test)]
mod tests {
    use crate::Data;
    use candid::Principal;
    use types::CanisterId;

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
    fn cancelling_unfreezes_the_canister() {
        let mut data = data();
        data.try_start_migration(multi_user_canister(1), 2).unwrap();

        assert!(data.cancel_migration(3));

        assert!(data.migration.is_none());
        assert!(!data.is_frozen());
    }

    #[test]
    fn cancelling_without_a_migration_does_nothing() {
        let mut data = data();

        assert!(!data.cancel_migration(2));
        assert!(!data.is_frozen());
    }

    #[test]
    fn migration_can_start_again_once_cancelled() {
        let mut data = data();
        data.try_start_migration(multi_user_canister(1), 2).unwrap();
        data.cancel_migration(3);

        let migration = data.try_start_migration(multi_user_canister(2), 4).unwrap();

        assert_eq!(migration.multi_user_canister_id, multi_user_canister(2));
        assert_eq!(migration.started, 4);
    }
}
