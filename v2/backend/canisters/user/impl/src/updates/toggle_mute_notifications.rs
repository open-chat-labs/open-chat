use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use group_canister::c2c_toggle_mute_notifications;
use ic_cdk_macros::update;
use tracing::instrument;
use types::{CanisterId, Timestamped};
use user_canister::toggle_mute_notifications::*;

#[update]
#[instrument(level = "trace")]
fn toggle_mute_notifications(args: Args) -> Response {
    check_cycles_balance();

    RUNTIME_STATE.with(|state| toggle_mute_notifications_impl(args, state.borrow_mut().as_mut().unwrap()))
}

fn toggle_mute_notifications_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_owner();

    let now = runtime_state.env.now();
    let notifications_muted = Timestamped::new(args.mute, now);

    match runtime_state.data.group_chats.get_mut(&args.chat_id) {
        Some(group_chat) => {
            group_chat.notifications_muted = notifications_muted;

            ic_cdk::block_on(toggle_mute_notifications_on_group_canister(
                group_chat.chat_id.into(),
                args.mute,
            ));

            Response::Success
        }
        None => match runtime_state.data.direct_chats.get_mut(&args.chat_id) {
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
