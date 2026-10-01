use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::UserId;
use user_canister::c2c_remove_from_group::*;

#[update(msgpack = true)]
#[trace]
fn c2c_remove_from_group(args: Args) -> Response {
    execute_update(|state| c2c_remove_from_group_impl(args, state))
}

fn c2c_remove_from_group_impl(args: Args, state: &mut RuntimeState) -> Response {
    remove_from_group(args.removed_by, args.blocked, args.group_name, args.public, state);
    Response::Success
}

// Removes the group which is the caller, either by this endpoint or by the event it also sends,
// whichever arrives first
pub(crate) fn remove_from_group(removed_by: UserId, blocked: bool, group_name: String, public: bool, state: &mut RuntimeState) {
    let chat_id = state.env.caller().into();
    let now = state.env.now();

    if state.data.remove_group(chat_id, now).is_some() {
        openchat_bot::send_removed_from_group_or_community_message(true, removed_by, group_name, public, blocked, state);
    }
}
