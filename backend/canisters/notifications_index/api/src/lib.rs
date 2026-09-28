use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use types::{FcmToken, SubscriptionInfo, UserId};

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
    FcmTokenAdded(UserId, FcmToken),
    FcmTokenRemoved(UserId, FcmToken),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum UserIndexEvent {
    UserIdMigrated(UserIdMigrated),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserIdMigrated {
    pub user_principal: Principal,
    pub old_user_id: UserId,
    pub new_user_id: UserId,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SubscriptionAdded {
    pub user_id: UserId,
    pub subscription: SubscriptionInfo,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SubscriptionRemoved {
    pub user_id: UserId,
    pub endpoint: String,
}
