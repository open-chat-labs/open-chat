use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::OCErrorCode;
use types::{OCResult, Timestamped};
use user_canister::set_profile_background::*;
use utils::document::validate_profile_background;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_profile_background(args: Args) -> Response {
    execute_update(|state| set_profile_background_impl(args, state)).into()
}

fn set_profile_background_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    validate_profile_background(args.profile_background.as_ref())
        .map_err(|e| OCErrorCode::ProfileBackgroundTooBig.with_json(&e))?;

    let id = args.profile_background.as_ref().map(|a| a.id);
    let now = state.env.now();

    state.data.profile_background = Timestamped::new(args.profile_background, now);
    state.push_local_user_index_canister_event(LocalUserIndexEvent::UserSetProfileBackground(id), now);
    Ok(())
}
