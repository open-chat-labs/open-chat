use crate::queries::notifications_v2;
use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{IndexedEvent, NotificationEnvelope, NotificationSubscription, TimestampMillis, UserId};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub from_notification_index: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub notifications: Vec<IndexedEvent<NotificationEnvelope>>,
    pub subscriptions: HashMap<UserId, Vec<NotificationSubscription>>,
    pub bot_endpoints: HashMap<UserId, String>,
    pub timestamp: TimestampMillis,
}

// TODO remove with notifications_v2.rs
impl From<Response> for notifications_v2::Response {
    fn from(response: Response) -> Self {
        match response {
            Response::Success(result) => notifications_v2::Response::Success(result.into()),
        }
    }
}

// TODO remove with notifications_v2.rs
impl From<SuccessResult> for notifications_v2::SuccessResult {
    fn from(result: SuccessResult) -> Self {
        notifications_v2::SuccessResult {
            notifications: result.notifications,
            subscriptions: result
                .subscriptions
                .into_iter()
                .filter_map(|(user_id, subs)| {
                    let subscription_infos = subs
                        .into_iter()
                        .filter_map(|sub| match sub {
                            NotificationSubscription::WebPush(web_push) => Some(web_push),
                            _ => None,
                        })
                        .collect::<Vec<_>>();

                    if !subscription_infos.is_empty() { Some((user_id, subscription_infos)) } else { None }
                })
                .collect(),
            bot_endpoints: result.bot_endpoints,
            timestamp: result.timestamp,
        }
    }
}
