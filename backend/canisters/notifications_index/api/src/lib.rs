use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{SubscriptionInfo, UserId};

mod lifecycle;
mod queries;
mod updates;

pub use lifecycle::*;
pub use queries::*;
pub use updates::*;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum NotificationsIndexEvent {
    SubscriptionAdded(SubscriptionAdded),
    SubscriptionRemoved(SubscriptionRemoved),
    AllSubscriptionsRemoved(UserId),
    SetNotificationPusherPrincipals(HashSet<Principal>),
    UserBlocked(UserId, UserId),
    UserUnblocked(UserId, UserId),
    BotEndpointUpdated(UserId, String),
    BotRemoved(UserId),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    UserBlocked(UserId, UserId),
    UserUnblocked(UserId, UserId),
    BotEndpointUpdated(UserId, String),
    BotRemoved(UserId),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SubscriptionAdded {
    pub user_id: UserId,
    pub subscription: SubscriptionInfo,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SubscriptionRemoved {
    pub user_id: UserId,
    pub p256dh_key: String,
}
