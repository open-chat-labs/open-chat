use crate::guards::caller_is_user_controller;
use crate::model::bucket_event_batch::EventToSync;
use crate::{RuntimeState, UserRecordInternal, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_index_canister::add_or_update_users::{Response::*, *};

#[update(guard = "caller_is_user_controller")]
#[trace]
fn add_or_update_users(args: Args) -> Response {
    mutate_state(|state| add_or_update_users_impl(args, state))
}

fn add_or_update_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    for user_config in args.users {
        if let Some(user) = state.data.users.get_mut(&user_config.user_id) {
            user.byte_limit = user_config.byte_limit;
        } else {
            state.data.users.insert(
                user_config.user_id,
                UserRecordInternal {
                    byte_limit: user_config.byte_limit,
                    bytes_used: 0,
                    delete_oldest_if_limit_exceeded: true,
                },
            );
            state.push_event_to_buckets(EventToSync::UserAdded(user_config.user_id));
        }
    }

    Success
}
