use crate::{RuntimeState, RUNTIME_STATE, WASM_VERSION};
use chat_events::ChatEventInternal;
use group_canister::summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use types::{Avatar, EventIndex, EventWrapper, Mention, Message, MessageIndex, TimestampMillis, MAX_RETURNED_MENTIONS};

#[query]
fn summary_updates(args: Args) -> Response {
    RUNTIME_STATE.with(|state| summary_updates_impl(args, state.borrow().as_ref().unwrap()))
}

fn summary_updates_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let participant = match runtime_state.data.participants.get(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };
    let updates_from_events = process_events(args.updates_since, runtime_state, &participant.mentions);

    if let Some(last_updated) = updates_from_events.latest_update {
        let updates = SummaryUpdates {
            chat_id: runtime_state.env.canister_id().into(),
            last_updated,
            name: updates_from_events.name,
            description: updates_from_events.description,
            avatar_id: Avatar::id(&runtime_state.data.avatar),
            latest_message: updates_from_events.latest_message,
            latest_event_index: updates_from_events.latest_event_index,
            participant_count: if updates_from_events.participants_changed {
                Some(runtime_state.data.participants.len())
            } else {
                None
            },
            role: if updates_from_events.role_changed { Some(participant.role) } else { None },
            mentions: updates_from_events.mentions,
            wasm_version: WASM_VERSION.with(|v| v.borrow().if_set_after(args.updates_since).copied()),
        };
        Success(SuccessResult { updates })
    } else {
        SuccessNoUpdates
    }
}

#[derive(Default)]
struct UpdatesFromEvents {
    latest_update: Option<TimestampMillis>,
    name: Option<String>,
    description: Option<String>,
    avatar_id: Option<u128>,
    latest_message: Option<EventWrapper<Message>>,
    latest_event_index: Option<EventIndex>,
    participants_changed: bool,
    role_changed: bool,
    mentions: Vec<Mention>,
}

fn process_events(since: TimestampMillis, runtime_state: &RuntimeState, all_mentions: &[MessageIndex]) -> UpdatesFromEvents {
    let mut updates = UpdatesFromEvents {
        // We need to handle this separately because the message may have been sent before 'since' but
        // then subsequently updated after 'since', in this scenario the message would not be picked up
        // during the iteration below.
        latest_message: runtime_state.data.events.latest_message_if_updated(since),
        ..Default::default()
    };

    // Iterate through events starting from most recent
    let mut lowest_message_index: MessageIndex = u32::MIN.into();
    for event_wrapper in runtime_state.data.events.iter().rev().take_while(|e| e.timestamp > since) {
        if updates.latest_event_index.is_none() {
            updates.latest_update = Some(event_wrapper.timestamp);
            updates.latest_event_index = Some(event_wrapper.index);
        }

        match &event_wrapper.event {
            ChatEventInternal::GroupNameChanged(n) => {
                if updates.name.is_none() {
                    updates.name = Some(n.new_name.clone());
                }
            }
            ChatEventInternal::GroupDescriptionChanged(n) => {
                if updates.description.is_none() {
                    updates.description = Some(n.new_description.clone());
                }
            }
            ChatEventInternal::AvatarChanged(a) => {
                if updates.avatar_id.is_none() {
                    updates.avatar_id = Some(a.new_avatar);
                }
            }
            ChatEventInternal::ParticipantsPromotedToAdmin(_)
            | ChatEventInternal::ParticipantsDismissedAsAdmin(_)
            | ChatEventInternal::OwnershipTransferred(_)
            | ChatEventInternal::ParticipantAssumesSuperAdmin(_)
            | ChatEventInternal::ParticipantDismissedAsSuperAdmin(_)
            | ChatEventInternal::ParticipantRelinquishesSuperAdmin(_) => {
                updates.role_changed = true;
            }
            ChatEventInternal::ParticipantsAdded(_)
            | ChatEventInternal::ParticipantsRemoved(_)
            | ChatEventInternal::ParticipantJoined(_)
            | ChatEventInternal::ParticipantLeft(_)
            | ChatEventInternal::UsersBlocked(_)
            | ChatEventInternal::UsersUnblocked(_) => {
                updates.participants_changed = true;
            }
            ChatEventInternal::Message(message) => {
                lowest_message_index = message.message_index;
            }
            _ => {}
        }
    }

    updates.mentions = all_mentions
        .iter()
        .rev()
        .filter(|m| **m >= lowest_message_index)
        .take(MAX_RETURNED_MENTIONS)
        .map(|m| Mention { message_index: *m })
        .collect();

    updates.mentions.reverse();

    updates
}
