use crate::canister::RUNTIME_STATE;
use crate::queries::*;
use crate::updates::*;
use ic_cdk_macros::{query, update};

#[update]
async fn send_message(args: send_message::Args) -> send_message::Response {
    let response = RUNTIME_STATE.with(|state| send_message::update(&args, state.borrow_mut().as_mut().unwrap()));

    if let send_message::Response::Success(_) = &response {
        let handle_message_received_args = handle_message_received::Args {
            client_message_id: args.client_message_id,
            content: args.content,
            replies_to: args.replies_to,
        };
        if let Err(e) = handle_message_received::call_c2c(args.recipient.into(), handle_message_received_args).await {
            panic!("{}", e);
        }
    }

    response
}

#[update]
fn handle_message_received(args: handle_message_received::Args) -> handle_message_received::Response {
    RUNTIME_STATE.with(|state| handle_message_received::update(args, state.borrow_mut().as_mut().unwrap()))
}

#[query]
fn chats(args: chats::Args) -> chats::Response {
    RUNTIME_STATE.with(|state| chats::query(args, state.borrow().as_ref().unwrap()))
}
