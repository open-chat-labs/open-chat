use crate::guards::caller_is_owner;
use crate::{read_state, mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::c2c_toggle_mute_notifications;
use ic_cdk_macros::update;
use types::{CanisterId, ChatId, Timestamped};
use user_canister::mute_notifications::*;

#[update(guard = "caller_is_owner")]
#[trace]
async fn mute_notifications(args: Args) -> Response {
    run_regular_jobs();

    toggle_mute_notifications_impl(args.chat_id, true)
}

#[update(guard = "caller_is_owner")]
#[trace]
async fn unmute_notifications(args: Args) -> Response {
    run_regular_jobs();

    toggle_mute_notifications_impl(args.chat_id, false)
}

async fn toggle_mute_notifications_impl(chat_id: ChatId, mute: bool) -> Response {
    match read_state(|state| is_group(&chat_id, state)) {
        Some(true) => {
            let args = c2c_toggle_mute_notifications::Args { mute };
            match group_canister_c2c_client::c2c_toggle_mute_notifications(canister_id, &args).await {
                Ok(response) => match response {
                    c2c_toggle_mute_notifications::Response::Success => {
                        if mutate_state(|state| commit(&chat_id, mute, state)) {
                            return Response::Success;
                        }
                    }
                    c2c_toggle_mute_notifications::Response::CallerNotInGroup => {
                        let message = "INCONSISTENT: Caller has reference to group in user canister but group does not contain caller";
                        error!(message);
                        return InternalError(message.to_owned());
                    }
                },
                Err(error) => return InternalError(format!("{error:?}")),
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
        Ok(true)
    } else if runtime_state.data.direct_chats.has(chat_id) {
        Ok(false)
    } else {
        None
    }
}

fn commit(chat_id: &ChatId, mute: bool, runtime_state: &mut RuntimeState) -> bool {
    if let Some(group_chat) = state.data.group_chats.get_mut(&chat_id) {
        group_chat.last_changed_for_my_data = state.env.now();
        true
    } else if let Some(direct_chat) = state.data.direct_chats.get_mut(&chat_id) {
        direct_chat.notifications_muted = Timestamped::new(mute, state.env.now());
        true
    } else {
        false
    }
}
