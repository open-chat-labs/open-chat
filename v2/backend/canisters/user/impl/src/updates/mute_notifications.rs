use crate::{run_regular_jobs, RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use group_canister::c2c_toggle_mute_notifications;
use ic_cdk_macros::update;
use types::{CanisterId, ChatId, Timestamped};
use user_canister::mute_notifications::*;

#[update]
#[trace]
fn mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| toggle_mute_notifications_impl(args.chat_id, true, state.borrow_mut().as_mut().unwrap()))
}

#[update]
#[trace]
fn unmute_notifications(args: Args) -> Response {
    run_regular_jobs();

    RUNTIME_STATE.with(|state| toggle_mute_notifications_impl(args.chat_id, false, state.borrow_mut().as_mut().unwrap()))
}

fn toggle_mute_notifications_impl(chat_id: ChatId, mute: bool, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let now = runtime_state.env.now();
    let notifications_muted = Timestamped::new(mute, now);

    match runtime_state.data.group_chats.get_mut(&chat_id) {
        Some(group_chat) => {
            group_chat.notifications_muted = notifications_muted;
            ic_cdk::block_on(toggle_mute_notifications_on_group_canister(group_chat.chat_id.into(), mute));
            Response::Success
        }
        None => match runtime_state.data.direct_chats.get_mut(&chat_id) {
            Some(direct_chat) => {
                direct_chat.notifications_muted = notifications_muted;
                Response::Success
            }
            None => Response::ChatNotFound,
        },
    }
}

async fn toggle_mute_notifications_on_group_canister(canister_id: CanisterId, mute: bool) {
    let args = c2c_toggle_mute_notifications::Args { mute };
    let _ = group_canister_c2c_client::c2c_toggle_mute_notifications(canister_id, &args).await;
}
