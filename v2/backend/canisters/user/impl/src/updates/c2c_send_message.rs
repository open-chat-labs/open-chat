use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::PushMessageArgs;
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use notifications_canister::push_direct_message_notification;
use types::{CanisterId, DirectMessageNotification, UserId};
use user_canister::c2c_send_message::{Response::*, *};
use utils::rand::get_random_item;

#[update]
async fn c2c_send_message(args: Args) -> Response {
    check_cycles_balance();

    let sender_user_id = match RUNTIME_STATE.with(|state| get_sender_status(state.borrow().as_ref().unwrap())) {
        SenderStatus::Ok(user_id) => user_id,
        SenderStatus::Blocked => return Blocked,
        SenderStatus::UnknownUser(user_index_canister_id, user_id) => {
            if !verify_user(user_index_canister_id, user_id).await {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    RUNTIME_STATE.with(|state| c2c_send_message_impl(sender_user_id, args, state.borrow_mut().as_mut().unwrap()))
}

enum SenderStatus {
    Ok(UserId),
    Blocked,
    UnknownUser(CanisterId, UserId),
}

fn get_sender_status(runtime_state: &RuntimeState) -> SenderStatus {
    let sender_user_id = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&sender_user_id) {
        SenderStatus::Blocked
    } else if runtime_state.data.direct_chats.get(&sender_user_id.into()).is_some() {
        SenderStatus::Ok(sender_user_id)
    } else {
        SenderStatus::UnknownUser(runtime_state.data.user_index_canister_id, sender_user_id)
    }
}

async fn verify_user(user_index_canister_id: CanisterId, user_id: UserId) -> bool {
    let args = user_index_canister::user::Args {
        user_id: Some(user_id),
        username: None,
    };
    if let Ok(response) = user_index_canister_c2c_client::user(user_index_canister_id, &args).await {
        matches!(response, user_index_canister::user::Response::Success(_))
    } else {
        panic!("Failed to call user_index to verify user");
    }
}

fn c2c_send_message_impl(sender_user_id: UserId, args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sender: sender_user_id,
        content: args.content,
        replies_to: args.replies_to,
        now,
    };

    let (chat_id, _, message) =
        runtime_state
            .data
            .direct_chats
            .push_message(false, sender_user_id, Some(args.sender_message_index), push_message_args);

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        if let Some((users_to_mark_as_read, _)) = chat.message_ids_read_but_not_confirmed.remove(&args.message_id) {
            for is_me in users_to_mark_as_read.into_iter() {
                if is_me {
                    chat.read_by_me.insert(message.message_index.into());
                    chat.read_by_me_updated = now;
                } else {
                    chat.read_by_them.insert(message.message_index.into());
                    chat.read_by_them_updated = now;
                }
            }
        }
    }

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
