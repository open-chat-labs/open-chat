use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use community_canister::LocalIndexEvent;
use community_canister::c2c_local_index::*;
use constants::OPENCHAT_BOT_USER_ID;
use msgpack::serialize_then_unwrap;
use std::cell::LazyCell;
use types::{EventIndex, GroupNameChanged, ModerationCategories, TimestampMillis, Timestamped};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_local_index(args: Args) -> Response {
    execute_update(|state| c2c_local_index_impl(args, state))
}

fn c2c_local_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state.data.idempotency_checker.check(
            state.data.local_user_index_canister_id,
            event.created_at,
            event.idempotency_id,
        ) {
            process_event(event.value, &now, state);
        }
    }
    Response::Success
}

fn process_event<F: FnOnce() -> TimestampMillis>(
    event: LocalIndexEvent,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        LocalIndexEvent::NameChanged(ev) => {
            state.push_community_event(CommunityEventInternal::NameChanged(Box::new(GroupNameChanged {
                new_name: ev.name.clone(),
                previous_name: state.data.name.value.clone(),
                changed_by: OPENCHAT_BOT_USER_ID,
            })));

            state.data.name = Timestamped::new(ev.name, **now);
        }
        LocalIndexEvent::VerifiedChanged(ev) => {
            state.data.verified = Timestamped::new(ev.verified, **now);
        }
        LocalIndexEvent::MessageClassified(ev) => {
            // An empty result still calls flag_message so that stale flags are cleared if a
            // previously flagged message has been edited to something clean
            if let Some(channel_id) = ev.channel_id
                && let Some(categories) = ModerationCategories::from_bits(ev.flags)
                && let Some(channel) = state.data.channels.get_mut(&channel_id)
                && channel
                    .chat
                    .events
                    .flag_message(ev.thread_root_message_index, ev.message_id, categories, **now)
                    .is_ok()
                && categories.contains(ModerationCategories::SEXUAL_MINORS)
                && let Some((message, _)) = channel.chat.events.message_internal(
                    EventIndex::default(),
                    ev.thread_root_message_index,
                    ev.message_id.into(),
                )
            {
                // Notify the user_index (via the group_index) which applies the CSAM
                // auto-sanction: delete the message, suspend the sender, and post an alert
                // to the internal moderation channel
                let args = group_index_canister::c2c_csam_detected::Args {
                    channel_id: Some(channel_id),
                    thread_root_message_index: ev.thread_root_message_index,
                    message_index: message.message_index,
                    message_id: ev.message_id,
                    sender: message.sender,
                    flags: categories.bits(),
                    content_excerpt: message.content.moderation_input().text,
                };
                state.data.fire_and_forget_handler.send(
                    state.data.group_index_canister_id,
                    "c2c_csam_detected_msgpack".to_string(),
                    serialize_then_unwrap(&args),
                );
            }
        }
        LocalIndexEvent::ModerationFlagsChanged(ev) => {
            state.data.moderation_flags = Timestamped::new(ev.flags, **now);
        }
        LocalIndexEvent::UserDeleted(user_id) => {
            for channel in state.data.channels.iter_mut() {
                channel.chat.members.remove(user_id, **now);
            }
            state.data.members.remove(user_id, None, **now);
        }
        LocalIndexEvent::BotRemoved(bot_id) => {
            state.data.uninstall_bot(bot_id, **now);
        }
        LocalIndexEvent::BotUpdated(ev) => {
            state.data.handle_bot_definition_updated(ev, **now);
        }
    }

    handle_activity_notification(state);
}
