use crate::{RuntimeState, RUNTIME_STATE};
use chat_events::ChatEventInternal;
use group_canister::summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use types::{Avatar, EventIndex, EventWrapper, Message, TimestampMillis};

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
    latest_message: Option<EventWrapper<Message>>,
    latest_event_index: Option<EventIndex>,
}

fn process_events(since: TimestampMillis, runtime_state: &RuntimeState) -> UpdatesFromEvents {
    let mut updates = UpdatesFromEvents {
        // We need to handle this separately because the message may have been sent before 'since' but
        // then subsequently updated after 'since', in this scenario the message would not be picked up
        // during the iteration below.
        latest_message: runtime_state.data.events.latest_message_if_updated(since),
        ..Default::default()
    };

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
            _ => {}
        }
    }

    updates
}
