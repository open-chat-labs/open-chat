use crate::guards::caller_is_platform_operator;
use crate::jobs::start_user_migrations;
use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::{OCError, OCErrorCode};
use types::{CanisterId, Hash, OCResult, UserId};
use user_index_canister::cancel_user_migration::{Response::*, *};

// Cancels the migration of a user in a canister of their own to a MultiUser canister, unfreezing
// their canister
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
async fn cancel_user_migration(args: Args) -> Response {
    let user_hash = match read_state(|state| {
        // Once the MultiUser canister has imported the user they are switched over to it, so the
        // migration can no longer be cancelled. This is checked first, since the user is then no
        // longer known by the id their canister has.
        if state.data.user_migrations.is_imported(&args.user_id) {
            return Err(OCErrorCode::InvalidRequest.with_message("The user has already been imported"));
        }
        if state.data.users.get_by_user_id(&args.user_id).is_none() || !args.user_id.is_canister() {
            return Err(OCErrorCode::TargetUserNotFound.into());
        }
        // A migration which the UserIndex no longer tracks can still be cancelled, eg. one which was
        // left frozen, in which case there is no import to abandon
        Ok(state
            .data
            .user_migrations
            .get(&args.user_id)
            .filter(|m| m.multi_user_canister_id == args.multi_user_canister_id)
            .and_then(|m| m.started.as_ref())
            .map(|s| s.user_hash))
    }) {
        Ok(user_hash) => user_hash,
        Err(error) => return Error(error),
    };

    match cancel_migration(args.user_id, args.multi_user_canister_id, user_hash).await {
        Ok(()) => mutate_state(|state| {
            if state
                .data
                .user_migrations
                .mark_cancelled(args.user_id, args.multi_user_canister_id, user_hash)
            {
                start_user_migrations::run(state);
                Success
            } else if state
                .data
                .user_migrations
                .get(&args.user_id)
                .is_some_and(|m| m.multi_user_canister_id == args.multi_user_canister_id)
            {
                // The migration started while it was being cancelled, so the user's canister was
                // frozen again, and the MultiUser canister may now be importing them
                Error(OCErrorCode::InvalidRequest.with_message("The migration started while being cancelled, so try again"))
            } else {
                Success
            }
        }),
        Err(error) => Error(error),
    }
}

// Cancels the user's migration to the MultiUser canister, unfreezing their canister. If the migration
// has started, identified by `user_hash`, the MultiUser canister is first made to abandon importing
// the user, so that the user's canister is only unfrozen once they can no longer be imported. Fails
// if they already have been, in which case the migration must carry on.
pub(crate) async fn cancel_migration(user_id: UserId, multi_user_canister_id: CanisterId, user_hash: Option<Hash>) -> OCResult {
    // Only a MultiUser canister known to the UserIndex is told to import the user. Tests may migrate
    // users to other canisters.
    let is_known_multi_user_canister = read_state(|state| {
        state
            .data
            .multi_user_canisters
            .local_user_index(&multi_user_canister_id)
            .is_some()
    });

    if let Some(user_hash) = user_hash
        && is_known_multi_user_canister
    {
        match multi_user_canister_c2c_client::c2c_abandon_user_import(
            multi_user_canister_id,
            &multi_user_canister::c2c_abandon_user_import::Args { user_id, user_hash },
        )
        .await
        {
            Ok(multi_user_canister::c2c_abandon_user_import::Response::Success) => {}
            Ok(multi_user_canister::c2c_abandon_user_import::Response::AlreadyImported(_)) => {
                return Err(OCErrorCode::InvalidRequest.with_message("The user has already been imported"));
            }
            Ok(multi_user_canister::c2c_abandon_user_import::Response::Error(error)) => return Err(error),
            Err(error) => return Err(error.into()),
        }
    }

    match user_canister_c2c_client::c2c_cancel_migration(
        user_id.canister_id(),
        &user_canister::c2c_cancel_migration::Args { multi_user_canister_id },
    )
    .await
    {
        Ok(user_canister::c2c_cancel_migration::Response::Success) => Ok(()),
        Ok(user_canister::c2c_cancel_migration::Response::Error(error)) => Err(error),
        Err(error) => Err(OCError::from(error)),
    }
}
