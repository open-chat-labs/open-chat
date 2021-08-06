use shared::user_id::UserId;
use ic_cdk::export::Principal;
use crate::services::notifications::shared::NOTIFICATIONS_CANISTER_ID;
use crate::domain::chat::Message;
use ic_cdk::export::candid::CandidType;
use ic_cdk::api::call::CallResult;
use serde::{Deserialize, Serialize};
use shared::c2c::call_with_logging;

#[derive(CandidType, Serialize, Deserialize, Clone)]
pub struct Notification {
    pub sender: UserId,
    pub sender_name: String,
    pub recipient: UserId,
    pub message: Message,
}

#[derive(CandidType, Deserialize)]
pub struct Args {
    pub notification: Notification,
}

#[derive(CandidType, Deserialize)]
pub enum Response {
    Success,
}

pub fn fire_and_forget(notification: Notification) {

    async fn do_push(notification: Notification) {
        let canister_id = Principal::from_text(NOTIFICATIONS_CANISTER_ID).unwrap();
        let args = Args { notification };
        let _: CallResult<(Response,)> =
            call_with_logging(canister_id, "push_v1direct_message_notification", (args,)).await;    
    }
     
    let push_notification_future = do_push(notification);
    ic_cdk::block_on(push_notification_future);
}
