use crate::canister::RUNTIME_STATE;
use crate::queries::*;
use crate::updates::*;
use ic_cdk_macros::{query, update};

#[update]
async fn send_message(args: send_message::Args) -> send_message::Response {
    let response = RUNTIME_STATE.with(|state| send_message::update(&args, state.borrow_mut().as_mut().unwrap()));

    if matches!(response, send_message::Response::Success(_)) {
        let (canister_id, send_message_c2c_args) = args.into();
        if let Err(e) = send_message::c2c::call(canister_id, send_message_c2c_args).await {
            panic!("{}", e);
        }
    }

    response
}

#[update]
fn handle_message_received(args: send_message::c2c::Args) -> send_message::c2c::Response {
    RUNTIME_STATE.with(|state| send_message::c2c::update(args, state.borrow_mut().as_mut().unwrap()))
}

#[update]
async fn mark_read(args: mark_read::Args) -> mark_read::Response {
    let response = RUNTIME_STATE.with(|state| mark_read::update(&args, state.borrow_mut().as_mut().unwrap()));

    if matches!(response, mark_read::Response::Success) {
        let (canister_id, mark_read_c2c_args) = args.into();
        if let Err(e) = mark_read::c2c::call(canister_id, mark_read_c2c_args).await {
            panic!("{}", e);
        }
    }

    response
}

#[update]
fn handle_mark_read(args: mark_read::c2c::Args) -> mark_read::c2c::Response {
    RUNTIME_STATE.with(|state| mark_read::c2c::update(args, state.borrow_mut().as_mut().unwrap()))
}

#[query]
fn chats(args: chats::Args) -> chats::Response {
    RUNTIME_STATE.with(|state| chats::query(args, state.borrow().as_ref().unwrap()))
}

#[query]
fn messages(args: messages::Args) -> messages::Response {
    RUNTIME_STATE.with(|state| messages::query(args, state.borrow().as_ref().unwrap()))
}
