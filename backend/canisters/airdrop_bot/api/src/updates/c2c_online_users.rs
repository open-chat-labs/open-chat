use serde::{Deserialize, Serialize};
use types::{IdempotentEnvelope, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub events: Vec<IdempotentEnvelope<OnlineUsersEvent>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum OnlineUsersEvent {
    OnlineForMinutes(OnlineForMinutes),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OnlineForMinutes {
    pub user_id: UserId,
    pub year: u32,
    pub month: u8,
    pub minutes_online: u16,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success,
}
