use crate::guards::caller_is_user_controller;
use crate::model::bucket_sync_state::EventToSync;
use crate::{mutate_state, RuntimeState, UserRecordInternal};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use storage_index_canister::add_or_update_users::{Response::*, *};

#[update(guard = "caller_is_user_controller")]
#[trace]
fn add_or_update_users(args: Args) -> Response {
    mutate_state(|state| add_or_update_users_impl(args, state))
}

fn add_or_update_users_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for user_config in args.users {
        if let Some(user) = runtime_state.data.users.get_mut(&user_config.user_id) {
            user.byte_limit = user_config.byte_limit;
        } else {
            runtime_state.data.users.insert(
                user_config.user_id,
                UserRecordInternal {
                    byte_limit: user_config.byte_limit,
                    bytes_used: 0,
                    delete_oldest_if_limit_exceeded: true,
                },
            );

            runtime_state
                .data
                .buckets
                .sync_event(EventToSync::UserAdded(user_config.user_id));
        }
    }

    Success
}
