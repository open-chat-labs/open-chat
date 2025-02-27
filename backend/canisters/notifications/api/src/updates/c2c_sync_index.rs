use notifications_index_canister::NotificationsIndexEvent;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<NotificationsIndexEvent>,
}

pub type Response = crate::c2c_notifications_index::Response;
