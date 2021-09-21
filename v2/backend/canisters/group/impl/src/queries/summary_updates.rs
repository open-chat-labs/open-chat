use crate::model::events::GroupChatEventInternal;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use std::cmp::max;
use std::collections::HashSet;
use types::{EventIndex, EventWrapper, GroupChatSummaryUpdates, GroupMessage, Participant, TimestampMillis, UserId};
use utils::range_set::convert_to_message_index_ranges;

#[query]
fn summary_updates(args: Args) -> Response {
    RUNTIME_STATE.with(|state| summary_updates_impl(args, state.borrow().as_ref().unwrap()))
}

fn summary_updates_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let updates_from_events = process_events(args.updates_since, runtime_state);

        let read_by_me = if participant.read_by_me_updated > args.updates_since {
            Some(convert_to_message_index_ranges(participant.read_by_me.clone()))
        } else {
            None
        };

        if updates_from_events.latest_update.is_some() || read_by_me.is_some() {
            let updates = GroupChatSummaryUpdates {
                chat_id: runtime_state.env.canister_id().into(),
                last_updated: max(updates_from_events.latest_update.unwrap_or(0), participant.read_by_me_updated),
                name: updates_from_events.name,
                description: updates_from_events.description,
                avatar_id: runtime_state.data.avatar.as_ref().map(|a| a.id),
                participants_added_or_updated: updates_from_events.participants_added_or_updated,
                participants_removed: updates_from_events.participants_removed,
                latest_message: updates_from_events.latest_message,
                latest_event_index: updates_from_events.latest_event_index,
                read_by_me,
            };
            Success(SuccessResult { updates })
        } else {
            SuccessNoUpdates
        }
    } else {
        NotInGroup
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
    latest_message: Option<EventWrapper<GroupMessage>>,
    latest_event_index: Option<EventIndex>,
}

fn process_events(since: TimestampMillis, runtime_state: &RuntimeState) -> UpdatesFromEvents {
    let mut updates = UpdatesFromEvents::default();

    let mut participant_updates_handler = ParticipantUpdatesHandler {
        runtime_state,
        users_updated: HashSet::new(),
    };

    // Iterate through events starting from most recent
    for event_wrapper in runtime_state.data.events.iter().rev().take_while(|e| e.timestamp > since) {
        if updates.latest_event_index.is_none() {
            updates.latest_update = Some(event_wrapper.timestamp);
            updates.latest_event_index = Some(event_wrapper.index);
        }

        match &event_wrapper.event {
            GroupChatEventInternal::Message(m) => {
                if updates.latest_message.is_none() {
                    updates.latest_message = Some(EventWrapper {
                        index: event_wrapper.index,
                        timestamp: event_wrapper.timestamp,
                        event: runtime_state.data.events.hydrate_message(m),
                    })
                }
            }
            GroupChatEventInternal::GroupNameChanged(n) => {
                if updates.name.is_none() {
                    updates.name = Some(n.new_name.clone());
                }
            }
            GroupChatEventInternal::GroupDescriptionChanged(n) => {
                if updates.description.is_none() {
                    updates.description = Some(n.new_description.clone());
                }
            }
            GroupChatEventInternal::AvatarChanged(a) => {
                if updates.avatar_id.is_none() {
                    updates.avatar_id = Some(a.new_avatar);
                }
            }
            GroupChatEventInternal::ParticipantsAdded(p) => {
                for user_id in p.user_ids.iter() {
                    participant_updates_handler.mark_user_updated(&mut updates, *user_id, false);
                }
            }
            GroupChatEventInternal::ParticipantsRemoved(p) => {
                for user_id in p.user_ids.iter() {
                    participant_updates_handler.mark_user_updated(&mut updates, *user_id, true);
                }
            }
            GroupChatEventInternal::ParticipantJoined(p) => {
                participant_updates_handler.mark_user_updated(&mut updates, p.user_id, false);
            }
            GroupChatEventInternal::ParticipantLeft(p) => {
                participant_updates_handler.mark_user_updated(&mut updates, p.user_id, true);
            }
            GroupChatEventInternal::ParticipantsPromotedToAdmin(p) => {
                for user_id in p.user_ids.iter() {
                    participant_updates_handler.mark_user_updated(&mut updates, *user_id, false);
                }
            }
            GroupChatEventInternal::ParticipantsDismissedAsAdmin(p) => {
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
