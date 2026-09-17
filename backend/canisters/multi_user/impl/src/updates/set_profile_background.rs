use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use stable_memory_map::ProfileDocumentType;
use types::OCResult;
use user_canister::set_profile_background::*;
use utils::document::validate_profile_background;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_profile_background(args: Args) -> Response {
    mutate_state(|state| set_profile_background_impl(args, state)).into()
}

fn set_profile_background_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    validate_profile_background(args.profile_background.as_ref())
        .map_err(|e| OCErrorCode::ProfileBackgroundTooBig.with_json(&e))?;

    let now = state.env.now();
    state.with_caller_user_mut(|_, user| -> OCResult<()> {
        user.verify_not_suspended()?;
        user.profile_background
            .set(ProfileDocumentType::ProfileBackground, args.profile_background, now);
        Ok(())
    })?;

    // TODO: Tell the LocalUserIndex the new background id (`UserSetProfileBackground`), as the User
    // canister does, once the MultiUser canister has a queue of events for it

    Ok(())
}
