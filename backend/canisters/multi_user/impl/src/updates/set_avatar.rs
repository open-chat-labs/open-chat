use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use multi_user_canister::set_avatar::*;
use oc_error_codes::OCErrorCode;
use stable_memory_map::ProfileDocumentType;
use types::{Achievement, OCResult};
use utils::document::validate_avatar;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn set_avatar(args: Args) -> Response {
    execute_update(|state| set_avatar_impl(args, state)).into()
}

fn set_avatar_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if let Err(error) = validate_avatar(args.avatar.as_ref()) {
        return Err(OCErrorCode::AvatarTooBig.with_json(&error));
    }

    let id = args.avatar.as_ref().map(|a| a.id);
    let now = state.env.now();
    let my_index = state.with_caller_user_mut(|my_index, user| -> OCResult<u16> {
        user.verify_not_suspended()?;
        user.avatar.set(ProfileDocumentType::Avatar, args.avatar, now);
        Ok(my_index)
    })?;

    state.award_achievement_and_notify(my_index, Achievement::SetAvatar, now);
    state.push_local_user_index_canister_event(my_index, LocalUserIndexEvent::UserSetAvatar(id), now);

    Ok(())
}
