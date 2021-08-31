use crate::model::events::PushMessageArgs;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use notifications_canister::push_direct_message_notification;
use types::{CanisterId, DirectMessageNotification, UserId};
use user_canister::c2c_send_message::{Response::*, *};
use utils::rand::get_random_item;

#[update]
fn c2c_send_message(args: Args) -> Response {
    RUNTIME_STATE.with(|state| c2c_send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn c2c_send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    // TODO validate that this request came from an OpenChat canister
    let sender_user_id = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&sender_user_id) {
        return Blocked;
    }

    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sent_by_me: false,
        content: args.content,
        replies_to: args.replies_to,
        now: runtime_state.env.now(),
    };

    let (_, _, message) = runtime_state
        .data
        .direct_chats
        .push_message(sender_user_id, push_message_args);

    let random = runtime_state.env.random_u32() as usize;

    if let Some(canister_id) = get_random_item(&runtime_state.data.notification_canister_ids, random) {
        let notification = DirectMessageNotification {
            sender: sender_user_id,
            sender_name: args.sender_name,
            message,
        };

        let recipient = runtime_state.env.canister_id().into();

        let push_notification_future = push_notification(*canister_id, recipient, notification);
        ic_cdk::block_on(push_notification_future);
    }

    Success
}

async fn push_notification(canister_id: CanisterId, recipient: UserId, notification: DirectMessageNotification) {
    let args = push_direct_message_notification::Args { recipient, notification };
    let _ = notifications_canister_c2c_client::push_direct_message_notification(canister_id, &args).await;
}
