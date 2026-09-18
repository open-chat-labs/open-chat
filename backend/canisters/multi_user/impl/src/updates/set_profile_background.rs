use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::OCErrorCode;
use stable_memory_map::ProfileDocumentType;
use types::OCResult;
use user_canister::set_profile_background::*;
use utils::document::validate_profile_background;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_profile_background(args: Args) -> Response {
    mutate_state(|state| set_profile_background_impl(args, state)).into()
}

fn set_profile_background_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    validate_profile_background(args.profile_background.as_ref())
        .map_err(|e| OCErrorCode::ProfileBackgroundTooBig.with_json(&e))?;

    let now = state.env.now();
    let (my_index, id) = state.with_caller_user_mut(|index, user| -> OCResult<_> {
        user.verify_not_suspended()?;
        user.profile_background
            .set(ProfileDocumentType::ProfileBackground, args.profile_background, now);
        Ok((index, user.profile_background.id()))
    })?;

    state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserSetProfileBackground(id), now);
    Ok(())
}
