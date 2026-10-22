use crate::{RuntimeState, UserRecordInternal};
use storage_bucket_canister::StorageIndexEvent;
use storage_index_canister::UserConfig;

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
