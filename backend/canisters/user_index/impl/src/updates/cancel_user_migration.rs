use crate::guards::caller_is_platform_operator;
use crate::jobs::start_user_migrations;
use crate::{mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use user_index_canister::cancel_user_migration::{Response::*, *};

// Cancels the migration of a user in a canister of their own to a MultiUser canister, unfreezing
// their canister
#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
async fn cancel_user_migration(args: Args) -> Response {
    let is_single_user =
        read_state(|state| state.data.users.get_by_user_id(&args.user_id).is_some() && args.user_id.is_canister());
    if !is_single_user {
        return Error(OCErrorCode::TargetUserNotFound.into());
    }

    match user_canister_c2c_client::c2c_cancel_migration(
        args.user_id.canister_id(),
        &user_canister::c2c_cancel_migration::Args {
            multi_user_canister_id: args.multi_user_canister_id,
        },
    )
    .await
    {
        Ok(user_canister::c2c_cancel_migration::Response::Success) => {
            mutate_state(|state| {
                if state
                    .data
                    .user_migrations
                    .mark_cancelled(args.user_id, args.multi_user_canister_id)
                {
                    start_user_migrations::run(state);
                }
            });
            Success
        }
        Ok(user_canister::c2c_cancel_migration::Response::Error(error)) => Error(error),
        Err(error) => Error(error.into()),
    }
}
