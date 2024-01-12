use crate::updates::c2c_delete_messages::c2c_delete_messages_impl;
use crate::updates::c2c_edit_message::c2c_edit_message_impl;
use crate::updates::c2c_mark_read_v2::c2c_mark_read_impl;
use crate::updates::c2c_tip_message::c2c_tip_message_impl;
use crate::updates::c2c_toggle_reaction::c2c_toggle_reaction_impl;
use crate::updates::c2c_undelete_messages::c2c_undelete_messages_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use user_canister::c2c_notify_user_canister_events::{Response::*, *};
use user_canister::UserCanisterEvent;

#[update_msgpack]
#[trace]
fn c2c_notify_user_canister_events(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_notify_user_canister_events_impl(args, state))
}

fn c2c_notify_user_canister_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        process_event(event, state);
    }
    Success
}

fn process_event(event: UserCanisterEvent, state: &mut RuntimeState) {
    match event {
        UserCanisterEvent::EditMessage(args) => {
            c2c_edit_message_impl(*args, state);
        }
        UserCanisterEvent::DeleteMessages(args) => {
            c2c_delete_messages_impl(*args, state);
        }
        UserCanisterEvent::UndeleteMessages(args) => {
            c2c_undelete_messages_impl(*args, state);
        }
        UserCanisterEvent::ToggleReaction(args) => {
            c2c_toggle_reaction_impl(*args, state);
        }
        UserCanisterEvent::TipMessage(args) => {
            c2c_tip_message_impl(*args, state);
        }
        UserCanisterEvent::MarkMessagesRead(args) => {
            c2c_mark_read_impl(args, state);
        }
        UserCanisterEvent::P2POfferStatusChange(_c) => {
            // TODO
        }
    }
}
