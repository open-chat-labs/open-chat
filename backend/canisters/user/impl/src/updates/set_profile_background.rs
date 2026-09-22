use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::OCResult;
use user_canister::set_profile_background::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn set_profile_background(args: Args) -> Response {
    execute_update(|state| set_profile_background_impl(args, state)).into()
}

fn set_profile_background_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let id = user_core::updates::set_profile_background(&mut state.data.user, args.profile_background, now)?;
    state.push_local_user_index_canister_event(LocalUserIndexEvent::UserSetProfileBackground(id), now);
    Ok(())
}
