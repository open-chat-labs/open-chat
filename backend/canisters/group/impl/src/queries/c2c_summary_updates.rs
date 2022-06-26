use crate::{read_state, ParticipantInternal, RuntimeState, WASM_VERSION};
use canister_api_macros::query_msgpack;
use chat_events::ChatEventInternal;
use group_canister::c2c_summary_updates::{Response::*, *};
use std::collections::HashSet;
use types::{
    EventIndex, EventWrapper, GroupChatSummaryUpdatesInternal, GroupPermissions, Mention, Message, MessageIndex, OptionUpdate,
    TimestampMillis, UserId, MAX_RETURNED_MENTIONS,
};

#[query_msgpack]
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
        let updates = GroupChatSummaryUpdatesInternal {
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
            pinned_message: OptionUpdate::NoChange,
            wasm_version: WASM_VERSION.with(|v| v.borrow().if_set_after(args.updates_since).copied()),
            owner_id: updates_from_events.owner_id,
            permissions: updates_from_events.permissions,
            affected_events: updates_from_events.affected_events.into_iter().collect(),
            metrics: Some(runtime_state.data.events.main.metrics().clone()),
            my_metrics: runtime_state
                .data
                .events
                .main
                .user_metrics(&participant.user_id, Some(args.updates_since))
                .cloned(),
            is_public: updates_from_events.is_public,
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
    owner_id: Option<UserId>,
    permissions: Option<GroupPermissions>,
    affected_events: HashSet<EventIndex>,
    is_public: Option<bool>,
}

fn process_events(
    since: TimestampMillis,
    participant: &ParticipantInternal,
    runtime_state: &RuntimeState,
) -> UpdatesFromEvents {
    let chat_events = &runtime_state.data.events;

    let mut updates = UpdatesFromEvents {
        // We need to handle this separately because the message may have been sent before 'since' but
        // then subsequently updated after 'since', in this scenario the message would not be picked up
        // during the iteration below.
        latest_message: chat_events.main.latest_message_if_updated(since, Some(participant.user_id)),
        ..Default::default()
    };

    // Iterate through events starting from most recent
    let mut lowest_message_index: MessageIndex = u32::MIN.into();
    for event_wrapper in chat_events.main.iter().rev().take_while(|e| e.timestamp > since) {
        if updates.latest_event_index.is_none() {
            updates.latest_update = Some(event_wrapper.timestamp);
            updates.latest_event_index = Some(event_wrapper.index);
        }

        if let Some(index) = chat_events.main.affected_event_index(&event_wrapper.event) {
            if updates.affected_events.len() < 100 {
                updates.affected_events.insert(index);
            }
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
            ChatEventInternal::PermissionsChanged(p) => {
                if updates.permissions.is_none() {
                    updates.permissions = Some(p.new_permissions.clone());
                }
            }
            ChatEventInternal::GroupVisibilityChanged(v) => {
                updates.is_public = Some(v.now_public);
            }
            _ => {}
        }
    }

    updates.mentions = participant
        .mentions
        .iter()
        .rev()
        .filter(|m| m.message_index >= lowest_message_index)
        .filter_map(|message_index| runtime_state.data.events.main.hydrate_mention(message_index))
        .take(MAX_RETURNED_MENTIONS)
        .collect();

    updates.mentions.reverse();

    updates
}
