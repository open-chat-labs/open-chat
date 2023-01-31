use crate::{read_state, Data, ParticipantInternal, RuntimeState};
use canister_api_macros::query_msgpack;
use chat_events::{ChatEventInternal, Reader};
use group_canister::summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use std::collections::HashMap;
use types::{
    EventIndex, EventWrapper, FrozenGroupInfo, GroupCanisterGroupChatSummaryUpdates, GroupPermissions, GroupSubtype, Mention,
    Message, Milliseconds, OptionUpdate, TimestampMillis, UserId, MAX_THREADS_IN_SUMMARY,
};

#[query]
fn summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args, state))
}

#[query_msgpack]
fn c2c_summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args, state))
}

fn summary_updates_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let participant = match runtime_state.data.participants.get(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };
    let now = runtime_state.env.now();
    let updates_from_events = process_events(args.updates_since, participant, now, &runtime_state.data);
    let newly_expired_messages = runtime_state.data.events.expired_messages_since(args.updates_since, now);

    if updates_from_events.has_updates || !newly_expired_messages.is_empty() {
        let updates = GroupCanisterGroupChatSummaryUpdates {
            chat_id: runtime_state.env.canister_id().into(),
            last_updated: now,
            name: updates_from_events.name,
            description: updates_from_events.description,
            subtype: updates_from_events.subtype,
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
            owner_id: updates_from_events.owner_id,
            permissions: updates_from_events.permissions,
            affected_events: updates_from_events.affected_events.keys().copied().collect(),
            affected_events_v2: updates_from_events.affected_events.into_iter().collect(),
            metrics: Some(runtime_state.data.events.metrics().clone()),
            my_metrics: runtime_state
                .data
                .events
                .user_metrics(&participant.user_id, Some(args.updates_since))
                .cloned(),
            is_public: updates_from_events.is_public,
            latest_threads: runtime_state.data.events.latest_threads(
                participant.min_visible_event_index(),
                participant.threads.iter(),
                Some(args.updates_since),
                MAX_THREADS_IN_SUMMARY,
                now,
            ),
            notifications_muted: updates_from_events.notifications_muted,
            frozen: updates_from_events.frozen,
            wasm_version: None,
            date_last_pinned: updates_from_events.date_last_pinned,
            events_ttl: updates_from_events.events_ttl,
            newly_expired_messages,
            next_message_expiry: OptionUpdate::from_update(runtime_state.data.events.next_message_expiry(now)),
        };
        Success(SuccessResult { updates })
    } else {
        SuccessNoUpdates
    }
}

#[derive(Default)]
struct UpdatesFromEvents {
    has_updates: bool,
    name: Option<String>,
    description: Option<String>,
    subtype: OptionUpdate<GroupSubtype>,
    avatar_id: OptionUpdate<u128>,
    latest_message: Option<EventWrapper<Message>>,
    latest_event_index: Option<EventIndex>,
    participants_changed: bool,
    role_changed: bool,
    mentions: Vec<Mention>,
    owner_id: Option<UserId>,
    permissions: Option<GroupPermissions>,
    affected_events: HashMap<EventIndex, TimestampMillis>,
    is_public: Option<bool>,
    notifications_muted: Option<bool>,
    frozen: OptionUpdate<FrozenGroupInfo>,
    date_last_pinned: Option<TimestampMillis>,
    events_ttl: OptionUpdate<Milliseconds>,
}

fn process_events(
    since: TimestampMillis,
    participant: &ParticipantInternal,
    now: TimestampMillis,
    data: &Data,
) -> UpdatesFromEvents {
    let events_reader = data
        .events
        .visible_main_events_reader(participant.min_visible_event_index(), now);

    let mut updates = UpdatesFromEvents {
        // We need to handle this separately because the message may have been sent before 'since' but
        // then subsequently updated after 'since', in this scenario the message would not be picked up
        // during the iteration below.
        latest_message: events_reader.latest_message_event_if_updated(since, Some(participant.user_id)),
        mentions: participant.most_recent_mentions(Some(since), &data.events, now),
        ..Default::default()
    };

    if data.subtype.timestamp > since {
        updates.has_updates = true;
        updates.subtype = OptionUpdate::from_update(data.subtype.value.clone());
    }

    if participant.notifications_muted.timestamp > since {
        updates.has_updates = true;
        updates.notifications_muted = Some(participant.notifications_muted.value);
    }

    if data.frozen.timestamp > since {
        updates.has_updates = true;
        updates.frozen = OptionUpdate::from_update(data.frozen.value.clone());
    }

    if data
        .date_last_pinned
        .map_or(false, |date_last_pinned| date_last_pinned > since)
    {
        updates.has_updates = true;
        updates.date_last_pinned = data.date_last_pinned;
    }

    let new_proposal_votes = participant
        .proposal_votes
        .iter()
        .rev()
        .take_while(|(&t, _)| t > since)
        .inspect(|_| updates.has_updates = true)
        .flat_map(|(&t, message_indexes)| {
            message_indexes
                .iter()
                .filter_map(|&m| events_reader.event_index(m.into()))
                .map(move |e| (e, t))
        });

    updates.affected_events.extend(new_proposal_votes);

    // Iterate through events starting from most recent
    for event_wrapper in events_reader.iter(None, false).take_while(|e| e.timestamp > since) {
        if updates.latest_event_index.is_none() {
            updates.has_updates = true;
            updates.latest_event_index = Some(event_wrapper.index);
        }

        for index in events_reader.affected_event_indexes(&event_wrapper.event) {
            if updates.affected_events.len() < 100 {
                updates.affected_events.entry(index).or_insert(event_wrapper.timestamp);
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
            ChatEventInternal::OwnershipTransferred(ownership) => {
                if ownership.new_owner == participant.user_id || ownership.old_owner == participant.user_id {
                    updates.role_changed = true;
                }
                if updates.owner_id.is_none() {
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
            ChatEventInternal::EventsTimeToLiveUpdated(u) => {
                if !updates.events_ttl.has_update() {
                    updates.events_ttl = OptionUpdate::from_update(u.new_ttl);
                }
            }
            _ => {}
        }
    }

    updates
}
