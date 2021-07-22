use crate::domain::user_notifications_status::UserNotificationsStatusMap;
use ic_cdk::storage;

pub fn update(enabled: bool) {
    let me = shared::user_id::get_current();
    let user_notifications_status_map: &mut UserNotificationsStatusMap = storage::get_mut();
    user_notifications_status_map.set(me, enabled);
}