use crate::guards::caller_is_user_controller;
use crate::{RuntimeState, UserRecordInternal, mutate_state};
use canister_tracing_macros::trace;
use ic_cdk::update;
use storage_bucket_canister::StorageIndexEvent;
use storage_index_canister::add_or_update_users::*;

#[update(guard = "caller_is_user_controller")]
#[trace]
fn add_or_update_users(args: Args) -> Response {
    mutate_state(|state| add_or_update_users_impl(args, state))
}

fn add_or_update_users_impl(args: Args, state: &mut RuntimeState) -> Response {
    for user_config in args.users {
        add_or_update_user(user_config, state);
    }
    Response::Success
}

pub(crate) fn add_or_update_user(user_config: UserConfig, state: &mut RuntimeState) {
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
        state.push_event_to_buckets(StorageIndexEvent::UserAdded(user_config.user_id));
    }
}
