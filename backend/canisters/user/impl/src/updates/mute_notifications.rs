use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::c2c_toggle_mute_notifications;
use ic_cdk_macros::update;
use types::{CanisterId, ChatId, Timestamped};
use user_canister::mute_notifications::*;

#[update(guard = "caller_is_owner")]
#[trace]
fn mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| toggle_mute_notifications_impl(args.chat_id, true, state))
}

#[update(guard = "caller_is_owner")]
#[trace]
fn unmute_notifications(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| toggle_mute_notifications_impl(args.chat_id, false, state))
}

fn toggle_mute_notifications_impl(chat_id: ChatId, mute: bool, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    match runtime_state.data.group_chats.get_mut(&chat_id) {
        Some(group_chat) => {
            group_chat.changed_by_me = now;
            ic_cdk::spawn(toggle_mute_notifications_on_group_canister(group_chat.chat_id.into(), mute));
            Response::Success
        }
        None => match runtime_state.data.direct_chats.get_mut(&chat_id) {
            Some(direct_chat) => {
                direct_chat.notifications_muted = Timestamped::new(mute, now);
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
