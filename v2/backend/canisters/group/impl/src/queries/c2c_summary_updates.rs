use crate::{read_state, ParticipantInternal, RuntimeState, WASM_VERSION};
use chat_events::ChatEventInternal;
use group_canister::c2c_summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use types::{
    EventIndex, EventWrapper, Mention, Message, MessageIndex, OptionUpdate, TimestampMillis, UserId, MAX_RETURNED_MENTIONS,
};

#[query]
fn c2c_summary_updates(args: Args) -> Response {
    read_state(|state| c2c_summary_updates_impl(args, state))
}

fn c2c_summary_updates_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let participant = match runtime_state.data.participants.get(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };
    let updates_from_events = process_events(args.updates_since, participant, runtime_state);

    if let Some(last_updated) = updates_from_events.latest_update {
        let updates = SummaryUpdates {
            chat_id: runtime_state.env.canister_id().into(),
            last_updated,
            name: updates_from_events.name,
            description: updates_from_events.description,
            avatar_id: updates_from_events.avatar_id,
            latest_message: updates_from_events.latest_message,
            latest_event_index: updates_from_events.latest_event_index,
            participant_count: if updates_from_events.participants_changed {
                Some(runtime_state.data.participants.len())
            } else {
                None
            },
            role: if updates_from_events.role_changed { Some(participant.role) } else { None },
            mentions: updates_from_events.mentions,
            pinned_message: updates_from_events.pinned_message,
            wasm_version: WASM_VERSION.with(|v| v.borrow().if_set_after(args.updates_since).copied()),
            owner_id: updates_from_events.owner_id,
        };
        Success(Box::new(SuccessResult { updates }))
    } else {
        SuccessNoUpdates
    }
}

#[derive(Default)]
struct UpdatesFromEvents {
    latest_update: Option<TimestampMillis>,
    name: Option<String>,
    description: Option<String>,
    avatar_id: OptionUpdate<u128>,
    latest_message: Option<EventWrapper<Message>>,
    latest_event_index: Option<EventIndex>,
    participants_changed: bool,
    role_changed: bool,
    mentions: Vec<Mention>,
    pinned_message: OptionUpdate<MessageIndex>,
    owner_id: Option<UserId>,
}

fn process_events(
    since: TimestampMillis,
    participant: &ParticipantInternal,
    runtime_state: &RuntimeState,
) -> UpdatesFromEvents {
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
                if !updates.avatar_id.has_update() {
                    updates.avatar_id = OptionUpdate::from_update(a.new_avatar);
                }
            }
            ChatEventInternal::RoleChanged(r) => {
                if r.user_ids.contains(&participant.user_id) {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantsPromotedToAdmin(p) => {
                if p.user_ids.contains(&participant.user_id) {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantsDismissedAsAdmin(p) => {
                if p.user_ids.contains(&participant.user_id) {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => {
                if p.user_id == participant.user_id {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => {
                if p.user_id == participant.user_id {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => {
                if p.user_id == participant.user_id {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantsAdded(_)
            | ChatEventInternal::ParticipantsRemoved(_)
            | ChatEventInternal::ParticipantJoined(_)
            | ChatEventInternal::ParticipantLeft(_)
            | ChatEventInternal::UsersBlocked(_)
            | ChatEventInternal::UsersUnblocked(_) => {
                updates.participants_changed = true;
            }
            ChatEventInternal::PinnedMessageUpdated(p) => {
                if !updates.pinned_message.has_update() {
                    updates.pinned_message = OptionUpdate::from_update(p.new_value);
                }
            }
            ChatEventInternal::Message(message) => {
                lowest_message_index = message.message_index;
            }
            ChatEventInternal::OwnershipTransferred(ownership) => {
                let caller = runtime_state.env.caller().into();
                if ownership.new_owner == caller || ownership.old_owner == caller {
                    updates.role_changed = true;
                }
                if updates.owner_id == None {
                    updates.owner_id = Some(ownership.new_owner);
                }
            }
            _ => {}
        }
    }

    updates.mentions = participant
        .mentions
        .iter()
        .rev()
        .filter(|m| **m >= lowest_message_index)
        .filter_map(|message_index| runtime_state.data.events.hydrate_mention(message_index))
        .take(MAX_RETURNED_MENTIONS)
        .collect();

    updates.mentions.reverse();

    updates
}
