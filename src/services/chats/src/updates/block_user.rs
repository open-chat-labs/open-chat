use shared::user_id::UserId;
use ic_cdk::storage;
use crate::domain::blocked_users::BlockedUsers;

pub fn update(user: UserId, unblock: bool) {
    let me = shared::user_id::get_current();
    let blocked_users: &mut BlockedUsers = storage::get_mut();
    if unblock {
        blocked_users.unblock(&me, &user);
    } else {
        blocked_users.block(me, user);
    }
}