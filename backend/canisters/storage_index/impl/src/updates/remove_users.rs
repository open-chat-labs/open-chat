use crate::guards::caller_is_user_controller;
use crate::model::bucket_event_batch::EventToSync;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_index_canister::remove_users::*;

#[update(guard = "caller_is_user_controller")]
#[trace]
fn remove_users(args: Args) -> Response {
    mutate_state(|state| remove_users_impl(args, state))
}

fn remove_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    for user_id in args.user_ids {
        state.data.users.remove(&user_id);
        state.push_event_to_buckets(EventToSync::UserRemoved(user_id));
    }
    Response::Success
}
