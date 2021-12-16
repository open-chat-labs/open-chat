use crate::{run_regular_jobs, Data, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use chat_events::PushMessageArgs;
use ic_cdk_macros::update;
use types::{
    CanisterId, CompletedCyclesTransfer, CryptocurrencyTransfer, Cycles, CyclesTransfer, DirectMessageNotification,
    MessageContent, Notification, TimestampMillis, UserId,
};
use user_canister::c2c_send_message::{Response::*, *};

#[update]
#[trace]
async fn c2c_send_message(args: Args) -> Response {
    run_regular_jobs();

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
    let sender = runtime_state.env.caller().into();

    if runtime_state.data.blocked_users.contains(&sender) {
        SenderStatus::Blocked
    } else if runtime_state.data.direct_chats.get(&sender.into()).is_some() {
        SenderStatus::Ok(sender)
    } else {
        SenderStatus::UnknownUser(runtime_state.data.user_index_canister_id, sender)
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

fn c2c_send_message_impl(sender: UserId, args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    if let MessageContent::Cryptocurrency(c) = &args.content {
        if let CryptocurrencyTransfer::Cycles(CyclesTransfer::Completed(cycles_transfer)) = &c.transfer {
            accept_cycles(cycles_transfer, now, &mut runtime_state.data);
        }
        runtime_state.data.transactions.add(c.transfer.clone(), now);
    }

    let push_message_args = PushMessageArgs {
        message_id: args.message_id,
        sender,
        content: args.content,
        replies_to: args.replies_to,
        now,
    };

    let (chat_id, _, message) =
        runtime_state
            .data
            .direct_chats
            .push_message(false, sender, Some(args.sender_message_index), push_message_args);

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        if !chat.notifications_muted.value {
            let notification = Notification::DirectMessageNotification(DirectMessageNotification {
                sender,
                sender_name: args.sender_name,
                message,
            });

            let recipient = runtime_state.env.canister_id().into();

            runtime_state.push_notification(vec![recipient], notification);
        }
    }

    Success
}

fn accept_cycles(transfer: &CompletedCyclesTransfer, now: TimestampMillis, data: &mut Data) {
    let cycles_available: Cycles = ic_cdk::api::call::msg_cycles_available().into();
    if cycles_available < transfer.cycles {
        // This should never happen...
        panic!("Message does not contain the stated number of cycles");
    }
    let cycles_accepted: Cycles = ic_cdk::api::call::msg_cycles_accept(transfer.cycles as u64).into();
    if cycles_accepted != transfer.cycles {
        // This can only happen if accepting the cycles results in the canister exceeding the
        // max cycles limit which in reality should never happen.
        panic!("Unable to accept cycles")
    }
    data.user_cycles_balance.add(cycles_accepted, now);
}
