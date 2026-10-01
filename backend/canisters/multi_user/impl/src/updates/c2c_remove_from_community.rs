use crate::{RuntimeState, execute_update, openchat_bot};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::UserId;
use user_canister::c2c_remove_from_community::*;

#[update(msgpack = true)]
#[trace]
fn c2c_remove_from_community(args: Args) -> Response {
    execute_update(|state| c2c_remove_from_community_impl(args, state))
}

// Called by the community the user was removed from, so, as in the User canister, the caller is the
// community to remove
fn c2c_remove_from_community_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user_index) = state.index_of_local_user(args.user_id) else {
        return Response::Success;
    };
    remove_from_community(
        user_index,
        args.removed_by,
        args.blocked,
        args.community_name,
        args.public,
        state,
    );
    Response::Success
}

// Removes the community which is the caller from the user at `user_index`, either by this endpoint or by
// the event it also sends, whichever arrives first
pub(crate) fn remove_from_community(
    user_index: u16,
    removed_by: UserId,
    blocked: bool,
    community_name: String,
    public: bool,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    if state.remove_community(user_index, state.env.caller().into(), now).is_some() {
        openchat_bot::send_removed_from_group_or_community_message(
            user_index,
            false,
            removed_by,
            community_name,
            public,
            blocked,
            state,
        );
    }
}
