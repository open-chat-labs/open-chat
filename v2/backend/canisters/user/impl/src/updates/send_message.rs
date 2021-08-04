use crate::model::events::PushMessageArgs;
use crate::{RuntimeState, RUNTIME_STATE};
use ic_cdk_macros::update;
use shared::types::CanisterId;
use user_canister::updates::handle_message_received;
use user_canister::updates::send_message::{Response::*, *};

#[update]
fn send_message(args: Args) -> Response {
    RUNTIME_STATE.with(|state| send_message_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn send_message_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.is_caller_owner() {
        let now = runtime_state.env.now();
        let push_message_args = PushMessageArgs {
            message_id: args.message_id,
            sent_by_me: true,
            content: args.content.clone(),
            replies_to: args.replies_to.clone(),
            now,
        };

        let my_user_id = runtime_state.env.canister_id().into();
        let (direct_chat_id, event_index, message) =
            runtime_state
                .data
                .direct_chats
                .push_message(my_user_id, args.recipient, push_message_args);

        let (canister_id, c2c_args) = build_c2c_args(args);
        ic_cdk::block_on(send_to_recipients_canister(canister_id, c2c_args));

        Success(SuccessResult {
            direct_chat_id,
            event_index,
            message_index: message.message_index,
            timestamp: now,
        })
    } else {
        NotAuthorised
    }
}

fn build_c2c_args(args: Args) -> (CanisterId, handle_message_received::Args) {
    let c2c_args = handle_message_received::Args {
        message_id: args.message_id,
        sender_name: args.sender_name,
        content: args.content,
        replies_to: args.replies_to,
    };

    (args.recipient.into(), c2c_args)
}

async fn send_to_recipients_canister(canister_id: CanisterId, args: handle_message_received::Args) {
    let _ = user_canister_client::handle_message_received(canister_id, &args).await;
}
