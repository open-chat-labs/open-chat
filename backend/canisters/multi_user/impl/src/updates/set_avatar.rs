use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use stable_memory_map::ProfileDocumentType;
use types::OCResult;
use user_canister::set_avatar::*;
use utils::document::validate_avatar;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_avatar(args: Args) -> Response {
    mutate_state(|state| set_avatar_impl(args, state)).into()
}

fn set_avatar_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        return Err(OCErrorCode::AvatarTooBig.with_json(&error));
    }

    let now = state.env.now();
    state.with_caller_user_mut(|_, user| -> OCResult<()> {
        user.verify_not_suspended()?;
        user.avatar.set(ProfileDocumentType::Avatar, args.avatar, now);
        Ok(())
    })?;

    // TODO: Award the `SetAvatar` achievement once achievements are held per user, and tell the
    // UserIndex the new avatar id (`c2c_set_avatar`) once it can take the id of the user it is for

    Ok(())
}
