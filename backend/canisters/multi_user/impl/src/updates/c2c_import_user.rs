use crate::guards::caller_is_local_user_index;
use crate::model::users::AddUserError;
use crate::{RuntimeState, execute_update, jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{UserEvent as LocalUserIndexEvent, UserImported};
use multi_user_canister::c2c_import_user::{Response::*, *};
use oc_error_codes::OCErrorCode;
use tracing::info;
use types::{OCResult, UserId};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_import_user(args: Args) -> Response {
    match execute_update(|state| c2c_import_user_impl(args, state)) {
        Ok(user_id) => Success(user_id),
        Err(error) => Error(error),
    }
}

fn c2c_import_user_impl(args: Args, state: &mut RuntimeState) -> OCResult<UserId> {
    let old_user_id = args.user_id;
    if !old_user_id.is_canister() {
        return Err(OCErrorCode::InvalidRequest.with_message("User isn't in a canister of their own"));
    }

    let now = state.env.now();

    // If the user has already been imported, the LocalUserIndex is told so again, in case the
    // earlier event was lost
    let latest_user_id = state.data.migrated_user_ids.latest(old_user_id);
    if latest_user_id != old_user_id
        && let Some(index) = state.index_of_local_user(latest_user_id)
    {
        let (canisters_to_notify, users_to_notify) = state
            .data
            .users
            .with_user(index, |user| {
                (
                    user.group_and_community_canisters(),
                    user.direct_chat_user_ids(latest_user_id),
                )
            })
            .unwrap_or_default();
        state.push_local_user_index_canister_event(
            index,
            LocalUserIndexEvent::UserImported(UserImported {
                old_user_id,
                canisters_to_notify,
                users_to_notify,
            }),
            now,
        );
        return Ok(latest_user_id);
    }

    if state.data.abandoned_user_imports.contains(&args.user_hash) {
        return Err(OCErrorCode::InvalidRequest.with_message("The user's migration has been cancelled"));
    }

    if let Some(import) = state.data.user_imports.get(&old_user_id) {
        // The same id is returned if the user is already being imported for this migration
        if import.user_hash == args.user_hash {
            return Ok(state.user_id(import.index));
        }
        // Whereas an import for an earlier migration, eg. one which was cancelled, is abandoned,
        // since the user may have changed since
        abandon_import(old_user_id, state);
    }

    let index = state.data.users.reserve_index().map_err(|error| match error {
        AddUserError::CanisterFull => OCErrorCode::UserLimitReached,
        AddUserError::PrincipalAlreadyRegistered => OCErrorCode::AlreadyRegistered,
    })?;
    state.data.user_imports.add(old_user_id, index, args.user_hash, now);
    jobs::import_users::start_job_if_required(state);

    let new_user_id = state.user_id(index);
    info!(%old_user_id, %new_user_id, "User import started");
    Ok(new_user_id)
}

// Abandons the user's import, if there is one in progress. Whatever has been inserted under its index
// is garbage collected, and the index is never reused. A page being pulled for it is discarded when
// it arrives, since the import is no longer found.
pub(crate) fn abandon_import(old_user_id: UserId, state: &mut RuntimeState) -> bool {
    let Some(import) = state.data.user_imports.remove(&old_user_id) else {
        return false;
    };
    state.data.deleted_users_to_garbage_collect.push(import.index);
    jobs::garbage_collect_stable_memory::start_job_if_required(&state.data);
    info!(%old_user_id, "User import abandoned");
    true
}
