use crate::domain::chat::Message;
use crate::services::notifications::shared::NOTIFICATIONS_CANISTER_ID;
use ic_cdk::api::call::CallResult;
use ic_cdk::export::candid::CandidType;
use ic_cdk::export::Principal;
use serde::{Deserialize, Serialize};
use shared::c2c::call_with_logging;
use shared::user_id::UserId;

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Notification {
    pub chat_id: String,
    pub sender: UserId,
    pub sender_name: String,
    pub message: Message,
}

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub recipient: UserId,
    pub notification: Notification,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}

pub fn fire_and_forget(recipient: UserId, notification: Notification) {
    async fn do_push(recipient: UserId, notification: Notification) {
        let canister_id = Principal::from_text(NOTIFICATIONS_CANISTER_ID).unwrap();
        let args = Args {
            recipient,
            notification,
        };
        let _: CallResult<(Response,)> =
            call_with_logging(canister_id, "push_v1direct_message_notification", (args,)).await;
    }

    let push_notification_future = do_push(recipient, notification);
    ic_cdk::block_on(push_notification_future);
}
