use crate::guards::caller_is_owner;
use crate::{read_state, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::c2c_toggle_mute_notifications;
use ic_cdk_macros::update;
use types::{ChatId, Timestamped};
use user_canister::mute_notifications::*;
use tracing::error;

#[update(guard = "caller_is_owner")]
#[trace]
async fn mute_notifications(args: Args) -> Response {
    toggle_mute_notifications_impl(args.chat_id, true).await
}

#[update(guard = "caller_is_owner")]
#[trace]
async fn unmute_notifications(args: Args) -> Response {
    toggle_mute_notifications_impl(args.chat_id, false).await
}

async fn toggle_mute_notifications_impl(chat_id: ChatId, mute: bool) -> Response {
    run_regular_jobs();

    match read_state(|state| is_group(&chat_id, state)) {
        Some(true) => {
            let args = c2c_toggle_mute_notifications::Args { mute };
            match group_canister_c2c_client::c2c_toggle_mute_notifications(chat_id.into(), &args).await {
                Ok(response) => match response {
                    c2c_toggle_mute_notifications::Response::Success => {
                        if mutate_state(|state| commit(&chat_id, mute, state)) {
                            return Response::Success;
                        }
                    }
                    c2c_toggle_mute_notifications::Response::CallerNotInGroup => {
                        let message = "INCONSISTENT: Caller has reference to group in user canister but group does not contain caller";
                        error!(message);
                        return Response::InternalError(message.to_owned());
                    }
                },
                Err(error) => return Response::InternalError(format!("{error:?}")),
            }
        }
        Some(false) => {
            mutate_state(|state| commit(&chat_id, mute, state));
            return Response::Success;
        }
        None => {}
    }

    Response::ChatNotFound
}

fn is_group(chat_id: &ChatId, runtime_state: &RuntimeState) -> Option<bool> {
    if runtime_state.data.group_chats.has(chat_id) {
        Some(true)
    } else if runtime_state.data.direct_chats.has(chat_id) {
        Some(false)
    } else {
        None
    }
}

fn commit(chat_id: &ChatId, mute: bool, runtime_state: &mut RuntimeState) -> bool {
    if let Some(group_chat) = runtime_state.data.group_chats.get_mut(&chat_id) {
        group_chat.last_changed_for_my_data = runtime_state.env.now();
        true
    } else if let Some(direct_chat) = runtime_state.data.direct_chats.get_mut(&chat_id) {
        direct_chat.notifications_muted = Timestamped::new(mute, runtime_state.env.now());
        true
    } else {
        false
    }
}
