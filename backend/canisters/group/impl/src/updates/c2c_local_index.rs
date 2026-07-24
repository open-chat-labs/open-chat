use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use constants::OPENCHAT_BOT_USER_ID;
use group_canister::LocalIndexEvent;
use group_canister::c2c_local_index::*;
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
            state.data.chat.events.push_main_event(
                ChatEventInternal::GroupNameChanged(Box::new(GroupNameChanged {
                    new_name: ev.name.clone(),
                    previous_name: state.data.chat.name.value.clone(),
                    changed_by: OPENCHAT_BOT_USER_ID,
                })),
                **now,
            );

            state.data.chat.name = Timestamped::new(ev.name, **now);
        }
        LocalIndexEvent::VerifiedChanged(ev) => {
            state.data.verified = Timestamped::new(ev.verified, **now);
        }
        LocalIndexEvent::MessageClassified(ev) => {
            // An empty result still calls flag_message so that stale flags are cleared if a
            // previously flagged message has been edited to something clean
            if let Some(categories) = ModerationCategories::from_bits(ev.flags)
                && state
                    .data
                    .chat
                    .events
                    .flag_message(ev.thread_root_message_index, ev.message_id, categories, **now)
                    .is_ok()
            {
                let is_csam = categories.contains(ModerationCategories::SEXUAL_MINORS);
                let moderation_referral = ModerationCategories::from_bits(ev.moderation_referral_flags).unwrap_or_default();
                if (is_csam || !moderation_referral.is_empty())
                    && let Some((message, _)) = state.data.chat.events.message_internal(
                        EventIndex::default(),
                        ev.thread_root_message_index,
                        ev.message_id.into(),
                    )
                {
                    if is_csam {
                        // Notify the user_index (via the group_index) which applies the CSAM
                        // auto-sanction: delete the message, suspend the sender, and post an
                        // alert to the internal moderation channel
                        let args = group_index_canister::c2c_csam_detected::Args {
                            channel_id: None,
                            thread_root_message_index: ev.thread_root_message_index,
                            message_index: message.message_index,
                            message_id: ev.message_id,
                            sender: message.sender,
                            flags: categories.bits(),
                            content_excerpt: message.content.moderation_input().text,
                            blob_references: message.content.blob_references(),
                        };
                        state.data.fire_and_forget_handler.send(
                            state.data.group_index_canister_id,
                            "c2c_csam_detected_msgpack".to_string(),
                            serialize_then_unwrap(&args),
                        );
                    } else {
                        // Refer for human review as a suspected ToS violation: the user_index
                        // creates a resolvable report and a moderator decides; no automatic
                        // action is taken against the message or the sender
                        let args = group_index_canister::c2c_moderation_referral::Args {
                            channel_id: None,
                            thread_root_message_index: ev.thread_root_message_index,
                            message_index: message.message_index,
                            message_id: ev.message_id,
                            sender: message.sender,
                            flags: moderation_referral.bits(),
                            content_excerpt: message.content.moderation_input().text,
                            blob_references: message.content.blob_references(),
                        };
                        state.data.fire_and_forget_handler.send(
                            state.data.group_index_canister_id,
                            "c2c_moderation_referral_msgpack".to_string(),
                            serialize_then_unwrap(&args),
                        );
                    }
                }
            }
        }
        LocalIndexEvent::ModerationFlagsChanged(ev) => {
            state.data.moderation_flags = Timestamped::new(ev.flags, **now);
        }
        LocalIndexEvent::UserDeleted(user_id) => {
            state.data.chat.members.remove(user_id, **now);
            state.data.remove_user(user_id, None);
        }
        LocalIndexEvent::BotRemoved(bot_id) => {
            state.data.uninstall_bot(OPENCHAT_BOT_USER_ID, bot_id, **now);
        }
        LocalIndexEvent::BotUpdated(ev) => {
            state.data.handle_bot_definition_updated(ev, **now);
        }
    }

    handle_activity_notification(state);
}
