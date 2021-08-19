use crate::model::events::PushMessageArgs;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use notifications_canister::push_direct_message_notification;
use types::{CanisterId, DirectMessageNotification, UserId};
use user_canister::handle_message_received::{Response::*, *};
use utils::rand::get_random_item;

#[update]
fn handle_message_received(args: Args) -> Response {
    RUNTIME_STATE.with(|state| handle_message_received_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn handle_message_received_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    // TODO validate that this request came from an OpenChat canister
    let sender_user_id = runtime_state.env.caller().into();

    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sent_by_me: false,
        content: args.content,
        replies_to: args.replies_to,
        now: runtime_state.env.now(),
    };

    let my_user_id = runtime_state.env.canister_id().into();
    let (_, _, message) = runtime_state
        .data
        .direct_chats
        .push_message(my_user_id, sender_user_id, push_message_args);

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
    let _ = notifications_canister_client::push_direct_message_notification(canister_id, &args).await;
}

mod c2c {
    use super::*;
    use ic_cdk::api::call::CallResult;
    use log::error;
    use utils::generate_c2c_call;

    pub mod notifications {
        use super::*;

        generate_c2c_call!(push_direct_message_notification);
    }
}
