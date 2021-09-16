use crate::model::events::PushMessageArgs;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use types::{CanisterId, MessageIndex};
use user_canister::c2c_send_message;
use user_canister::send_message::{Response::*, *};

#[update]
fn send_message(args: Args) -> Response {
    RUNTIME_STATE.with(|state| send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let my_user_id = runtime_state.env.canister_id().into();

    if runtime_state.data.blocked_users.contains(&my_user_id) {
        return RecipientBlocked;
    }

    let now = runtime_state.env.now();
    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sent_by_me: true,
        content: args.content.clone(),
        replies_to: args.replies_to.clone(),
        now,
    };

    let (chat_id, event_index, message) = runtime_state
        .data
        .direct_chats
        .push_message(args.recipient, None, push_message_args);

    let (canister_id, c2c_args) = build_c2c_args(args, message.message_index);
    ic_cdk::block_on(send_to_recipients_canister(canister_id, c2c_args));

    Success(SuccessResult {
        chat_id,
        event_index,
        message_index: message.message_index,
        timestamp: now,
    })
}

fn build_c2c_args(args: Args, message_index: MessageIndex) -> (CanisterId, c2c_send_message::Args) {
    let c2c_args = c2c_send_message::Args {
        message_id: args.message_id,
        sender_name: args.sender_name,
        sender_message_index: message_index,
        content: args.content,
        replies_to: args.replies_to,
    };

    (args.recipient.into(), c2c_args)
}

async fn send_to_recipients_canister(canister_id: CanisterId, args: c2c_send_message::Args) {
    // Note: We ignore any Block response - it means the sender won't know they're blocked
    // but maybe that is not so bad. Otherwise we would have to wait for the call to the
    // recipient canister which would double the latency of every message.
    let _ = user_canister_c2c_client::c2c_send_message(canister_id, &args).await;
}
