use crate::updates::c2c_delete_messages::c2c_delete_messages_impl;
use crate::updates::c2c_edit_message::c2c_edit_message_impl;
use crate::updates::c2c_mark_read_v2::c2c_mark_read_impl;
use crate::updates::c2c_send_messages::{c2c_send_messages_impl, get_sender_status, verify_user};
use crate::updates::c2c_tip_message::c2c_tip_message_impl;
use crate::updates::c2c_toggle_reaction::c2c_toggle_reaction_impl;
use crate::updates::c2c_undelete_messages::c2c_undelete_messages_impl;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use types::{EventIndex, UserId};
use user_canister::c2c_notify_user_canister_events::{Response::*, *};
use user_canister::UserCanisterEvent;

#[update_msgpack]
#[trace]
async fn c2c_notify_user_canister_events(args: Args) -> Response {
    run_regular_jobs();

    let caller_user_id = match read_state(get_sender_status) {
        crate::updates::c2c_send_messages::SenderStatus::Ok(user_id) => user_id,
        crate::updates::c2c_send_messages::SenderStatus::Blocked => return Blocked,
        crate::updates::c2c_send_messages::SenderStatus::UnknownUser(local_user_index_canister_id, user_id) => {
            if !verify_user(local_user_index_canister_id, user_id, false).await {
                panic!("This request is not from an OpenChat user");
            }
            user_id
        }
    };

    mutate_state(|state| c2c_notify_user_canister_events_impl(args, caller_user_id, state))
}

fn c2c_notify_user_canister_events_impl(args: Args, caller_user_id: UserId, state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, caller_user_id, state);
    }
    Success
}

fn process_event(event: UserCanisterEvent, caller_user_id: UserId, state: &mut RuntimeState) {
    match event {
        UserCanisterEvent::SendMessages(args) => {
            c2c_send_messages_impl(*args, caller_user_id, state);
        }
        UserCanisterEvent::EditMessage(args) => {
            c2c_edit_message_impl(*args, caller_user_id, state);
        }
        UserCanisterEvent::DeleteMessages(args) => {
            c2c_delete_messages_impl(*args, caller_user_id, state);
        }
        UserCanisterEvent::UndeleteMessages(args) => {
            c2c_undelete_messages_impl(*args, caller_user_id, state);
        }
        UserCanisterEvent::ToggleReaction(args) => {
            c2c_toggle_reaction_impl(*args, caller_user_id, state);
        }
        UserCanisterEvent::TipMessage(args) => {
            c2c_tip_message_impl(*args, caller_user_id, state);
        }
        UserCanisterEvent::MarkMessagesRead(args) => {
            c2c_mark_read_impl(args, caller_user_id, state);
        }
        UserCanisterEvent::P2PSwapStatusChange(c) => {
            if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
                chat.events.set_p2p_swap_status(None, c.message_id, c.status, state.env.now());
            }
        }
        UserCanisterEvent::JoinVideoCall(c) => {
            if let Some(chat) = state.data.direct_chats.get_mut(&caller_user_id.into()) {
                chat.events
                    .join_video_call(caller_user_id, c.message_index, EventIndex::default(), state.env.now());
            }
        }
    }
}
