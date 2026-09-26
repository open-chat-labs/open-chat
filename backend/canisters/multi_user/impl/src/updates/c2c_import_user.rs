use crate::guards::caller_is_local_user_index;
use crate::model::users::AddUserError;
use crate::{RuntimeState, jobs, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use multi_user_canister::c2c_import_user::{Response::*, *};
use oc_error_codes::OCErrorCode;
use tracing::info;
use types::{OCResult, UserId};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_import_user(args: Args) -> Response {
    match mutate_state(|state| c2c_import_user_impl(args, state)) {
        Ok(user_id) => Success(user_id),
        Err(error) => Error(error),
    }
}

fn c2c_import_user_impl(args: Args, state: &mut RuntimeState) -> OCResult<UserId> {
    let old_user_id = args.user_id;
    if !old_user_id.is_canister() {
        return Err(OCErrorCode::InvalidRequest.with_message("User isn't in a canister of their own"));
    }

    // The same id is returned if the user is already being imported, or has been
    if let Some(import) = state.data.user_imports.get(&old_user_id) {
        return Ok(state.user_id(import.index));
    }
    let latest_user_id = state.data.migrated_user_ids.latest(old_user_id);
    if latest_user_id != old_user_id && state.index_of_local_user(latest_user_id).is_some() {
        return Ok(latest_user_id);
    }

    let index = state.data.users.reserve_index().map_err(|error| match error {
        AddUserError::CanisterFull => OCErrorCode::UserLimitReached,
        AddUserError::PrincipalAlreadyRegistered => OCErrorCode::AlreadyRegistered,
    })?;
    let now = state.env.now();
    state.data.user_imports.add(old_user_id, index, now);
    jobs::import_users::start_job_if_required(state);

    let new_user_id = state.user_id(index);
    info!(%old_user_id, %new_user_id, "User import started");
    Ok(new_user_id)
}
