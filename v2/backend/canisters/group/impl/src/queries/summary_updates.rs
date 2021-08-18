use crate::model::events::GroupChatEventInternal;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::{GroupChatSummaryUpdates, Participant, TimestampMillis, UserId};

#[query]
fn summary_updates(args: Args) -> Response {
    RUNTIME_STATE.with(|state| summary_updates_impl(args, state.borrow().as_ref().unwrap()))
}

fn summary_updates_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get(caller) {
        let now = runtime_state.env.now();
        let mut has_updates = false;

        let name = if runtime_state.data.name.updated() > args.updates_since {
            has_updates = true;
            Some(runtime_state.data.name.value().clone())
        } else {
            None
        };

        let description = if runtime_state.data.description.updated() > args.updates_since {
            has_updates = true;
            Some(runtime_state.data.description.value().clone())
        } else {
            None
        };

        let (participants_added_or_updated, participants_removed) =
            get_participants_with_updates(args.updates_since, runtime_state);

        if !participants_added_or_updated.is_empty() || !participants_removed.is_empty() {
            has_updates = true;
        }

        let mut latest_message = None;
        if let Some(m) = runtime_state.data.events.latest_message() {
            if m.timestamp > args.updates_since {
                has_updates = true;
                latest_message = Some(m);
            }
        }

        let latest_event = runtime_state.data.events.last();
        let latest_event_index = if latest_event.timestamp > args.updates_since {
            has_updates = true;
            Some(latest_event.index)
        } else {
            None
        };

        let latest_read_by_me = if participant.read_up_to.updated() > args.updates_since {
            has_updates = true;
            Some(*participant.read_up_to.value())
        } else {
            None
        };

        if has_updates {
            let updates = GroupChatSummaryUpdates {
                chat_id: runtime_state.env.canister_id().into(),
                timestamp: now,
                name,
                description,
                participants_added_or_updated,
                participants_removed,
                latest_message,
                latest_event_index,
                latest_read_by_me,
            };
            Success(SuccessResult { updates })
        } else {
            SuccessNoUpdates
        }
    } else {
        NotInGroup
    }
}

fn get_participants_with_updates(since: TimestampMillis, runtime_state: &RuntimeState) -> (Vec<Participant>, Vec<UserId>) {
    fn mark_participant_changed(map: &mut HashMap<UserId, bool>, user_id: UserId, removed: bool) {
        if let Vacant(e) = map.entry(user_id) {
            e.insert(removed);
        }
    }

    let mut participants_changed = HashMap::new();
    for event in runtime_state
        .data
        .events
        .iter()
        .rev()
        .take_while(|e| e.timestamp > since)
        .map(|e| &e.event)
    {
        match event {
            GroupChatEventInternal::ParticipantsAdded(p) => {
                for user_id in p.user_ids.iter() {
                    mark_participant_changed(&mut participants_changed, *user_id, false);
                }
            }
            GroupChatEventInternal::ParticipantsRemoved(p) => {
                for user_id in p.user_ids.iter() {
                    mark_participant_changed(&mut participants_changed, *user_id, true);
                }
            }
            GroupChatEventInternal::ParticipantJoined(p) => {
                mark_participant_changed(&mut participants_changed, p.user_id, false);
            }
            GroupChatEventInternal::ParticipantLeft(p) => {
                mark_participant_changed(&mut participants_changed, p.user_id, true);
            }
            GroupChatEventInternal::ParticipantsPromotedToAdmin(p) => {
                for user_id in p.user_ids.iter() {
                    mark_participant_changed(&mut participants_changed, *user_id, false);
                }
            }
            GroupChatEventInternal::ParticipantsDismissedAsAdmin(p) => {
                for user_id in p.user_ids.iter() {
                    mark_participant_changed(&mut participants_changed, *user_id, false);
                }
            }
            _ => {}
        }
    }

    let mut participants_added_or_updated = Vec::new();
    let mut participants_removed = Vec::new();
    for (user_id, removed) in participants_changed.into_iter() {
        if removed {
            participants_removed.push(user_id);
        } else if let Some(p) = runtime_state.data.participants.get_by_user_id(&user_id) {
            participants_added_or_updated.push(p.into());
        }
    }

    (participants_added_or_updated, participants_removed)
}
