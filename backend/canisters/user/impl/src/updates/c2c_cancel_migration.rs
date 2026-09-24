use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_canister::c2c_cancel_migration::{Response::*, *};

// Called by the UserIndex, or by the MultiUser canister the user is being migrated to, to cancel the
// migration, after which the canister carries on serving the user as before. Succeeds if there is no
// migration to cancel, so that the call can be retried. Not run via `execute_update`, since the
// canister is frozen for the migration. The caller is checked here rather than by a guard, since the
// MultiUser canister may retry once the migration is already cancelled.
#[update(msgpack = true)]
#[trace]
fn c2c_cancel_migration(args: Args) -> Response {
    mutate_state(|state| c2c_cancel_migration_impl(args, state))
}

fn c2c_cancel_migration_impl(args: Args, state: &mut RuntimeState) -> Response {
    if !state.is_caller_user_index() && state.env.caller() != args.multi_user_canister_id {
        return Error(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();
    match state.data.cancel_migration(args.multi_user_canister_id, now) {
        Ok(cancelled) => {
            if cancelled {
                // The jobs aren't started while the user is being migrated
                jobs::start(state);
            }
            Success
        }
        Err(error) => Error(error),
    }
}

#[cfg(test)]
mod tests {
    use crate::Data;
    use candid::Principal;
    use oc_error_codes::OCErrorCode;
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

        assert!(data.cancel_migration(multi_user_canister(1), 3).unwrap());

        assert!(data.migration.is_none());
        assert!(!data.is_frozen());
    }

    #[test]
    fn cancelling_without_a_migration_does_nothing() {
        let mut data = data();

        assert!(!data.cancel_migration(multi_user_canister(1), 2).unwrap());
        assert!(!data.is_frozen());
    }

    #[test]
    fn migration_to_another_canister_is_not_cancelled() {
        let mut data = data();
        data.try_start_migration(multi_user_canister(1), 2).unwrap();

        let error = data.cancel_migration(multi_user_canister(2), 3).unwrap_err();

        assert!(error.matches_code(OCErrorCode::AlreadyInProgress));
        assert_eq!(data.migration.unwrap().multi_user_canister_id, multi_user_canister(1));
    }

    #[test]
    fn migration_can_start_again_once_cancelled() {
        let mut data = data();
        data.try_start_migration(multi_user_canister(1), 2).unwrap();
        data.cancel_migration(multi_user_canister(1), 3).unwrap();

        let migration = data.try_start_migration(multi_user_canister(2), 4).unwrap();

        assert_eq!(migration.multi_user_canister_id, multi_user_canister(2));
        assert_eq!(migration.started, 4);
    }
}
