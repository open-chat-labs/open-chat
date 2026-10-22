use crate::RuntimeState;
use candid::Principal;
use storage_bucket_canister::StorageIndexEvent;

pub(crate) fn remove_user(user_id: Principal, state: &mut RuntimeState) {
    state.data.users.remove(&user_id);
    state.push_event_to_buckets(StorageIndexEvent::UserRemoved(user_id));
}
