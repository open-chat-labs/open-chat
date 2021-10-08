use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::ChatEventInternal;
use group_canister::summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use std::collections::HashSet;
use types::{Avatar, EventIndex, EventWrapper, Message, Participant, TimestampMillis, UserId};

#[query]
fn summary_updates(args: Args) -> Response {
    RUNTIME_STATE.with(|state| summary_updates_impl(args, state.borrow().as_ref().unwrap()))
}

fn summary_updates_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if !runtime_state.is_caller_participant() {
        return CallerNotInGroup;
    }

    let updates_from_events = process_events(args.updates_since, runtime_state);

    if let Some(last_updated) = updates_from_events.latest_update {
        let updates = SummaryUpdates {
            chat_id: runtime_state.env.canister_id().into(),
            last_updated,
            name: updates_from_events.name,
            description: updates_from_events.description,
            avatar_id: Avatar::id(&runtime_state.data.avatar),
            participants_added_or_updated: updates_from_events.participants_added_or_updated,
            participants_removed: updates_from_events.participants_removed,
            latest_message: updates_from_events.latest_message,
            latest_event_index: updates_from_events.latest_event_index,
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
    participants_added_or_updated: Vec<Participant>,
    participants_removed: Vec<UserId>,
    latest_message: Option<EventWrapper<Message>>,
    latest_event_index: Option<EventIndex>,
}

fn process_events(since: TimestampMillis, runtime_state: &RuntimeState) -> UpdatesFromEvents {
    let mut updates = UpdatesFromEvents::default();

    let mut participant_updates_handler = ParticipantUpdatesHandler {
        runtime_state,
        users_updated: HashSet::new(),
    };

    // We need to handle this separately because the message may have been sent before 'since' but
    // then subsequently updated after 'since', in this scenario the message would not be picked up
    // during the iteration below.
    updates.latest_message = runtime_state.data.events.latest_message_if_updated(since);

    // Iterate through events starting from most recent
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
            ChatEventInternal::ParticipantsAdded(p) => {
                for user_id in p.user_ids.iter() {
                    participant_updates_handler.mark_user_updated(&mut updates, *user_id, false);
                }
            }
            ChatEventInternal::ParticipantsRemoved(p) => {
                for user_id in p.user_ids.iter() {
                    participant_updates_handler.mark_user_updated(&mut updates, *user_id, true);
                }
            }
            ChatEventInternal::ParticipantJoined(p) => {
                participant_updates_handler.mark_user_updated(&mut updates, p.user_id, false);
            }
            ChatEventInternal::ParticipantLeft(p) => {
                participant_updates_handler.mark_user_updated(&mut updates, p.user_id, true);
            }
            ChatEventInternal::ParticipantsPromotedToAdmin(p) => {
                for user_id in p.user_ids.iter() {
                    participant_updates_handler.mark_user_updated(&mut updates, *user_id, false);
                }
            }
            ChatEventInternal::ParticipantsDismissedAsAdmin(p) => {
                for user_id in p.user_ids.iter() {
                    participant_updates_handler.mark_user_updated(&mut updates, *user_id, false);
                }
            }
            _ => {}
        }
    }

    updates
}

struct ParticipantUpdatesHandler<'a> {
    runtime_state: &'a RuntimeState,
    users_updated: HashSet<UserId>,
}

impl<'a> ParticipantUpdatesHandler<'a> {
    pub fn mark_user_updated(&mut self, updates: &mut UpdatesFromEvents, user_id: UserId, removed: bool) {
        if self.users_updated.insert(user_id) {
            if removed {
                updates.participants_removed.push(user_id);
            } else if let Some(participant) = self.runtime_state.data.participants.get_by_user_id(&user_id) {
                updates.participants_added_or_updated.push(participant.into());
            }
        }
    }
}
