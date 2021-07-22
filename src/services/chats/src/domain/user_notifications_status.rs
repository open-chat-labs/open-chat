use ic_cdk::export::candid::CandidType;
use serde::Deserialize;
use shared::user_id::UserId;
use std::collections::HashMap;

#[derive(Default, CandidType, Deserialize)]
pub struct UserNotificationsStatusMap {
    map: HashMap<UserId, bool>
}

impl UserNotificationsStatusMap {
    pub fn get(&self, user_id: &UserId) -> UserNotificationStatus {
        match self.map.get(user_id) {
            Some(enabled) => if *enabled { UserNotificationStatus::Enabled } else { UserNotificationStatus::Disabled },
            None => UserNotificationStatus::Unknown
        }
    }    

    pub fn set(&mut self, user_id: UserId, enabled: bool) {
        self.map.insert(user_id, enabled);    
    }
}


#[derive(CandidType)]
pub enum UserNotificationStatus {
    Unknown,
    Disabled,
    Enabled
}
