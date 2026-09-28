use crate::guards::caller_is_identity_canister;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{DeleteUser, UserIndexEvent};
use oc_error_codes::OCErrorCode;
use user_index_canister::c2c_delete_user::*;

#[update(guard = "caller_is_identity_canister", msgpack = true)]
#[trace]
fn c2c_delete_user(args: Args) -> Response {
    mutate_state(|state| c2c_delete_user_impl(args, state))
}

fn c2c_delete_user_impl(args: Args, state: &mut RuntimeState) -> Response {
    // The Identity canister may not yet have been told the new id of a user migrated to a MultiUser
    // canister
    let user_id = state.data.migrated_user_ids.latest(args.user_id);
    // A user being migrated isn't deleted, since the MultiUser canister may be importing them, and
    // the copy it ends up with would be left behind. They can try again once the migration is over.
    if state.data.user_migrations.is_in_progress(&user_id) {
        return Response::Error(OCErrorCode::AlreadyInProgress.with_message("The user is being migrated"));
    }

    if state.delete_user(user_id, true) {
        state.push_event_to_all_local_user_indexes(
            UserIndexEvent::DeleteUser(DeleteUser {
                user_id,
                #[allow(deprecated)]
                triggered_by_user: true,
            }),
            None,
        );
        Response::Success
    } else {
        Response::Error(OCErrorCode::TargetUserNotFound.into())
    }
}
