use crate::{read_state, Data, RuntimeState};
use canister_api_macros::query_msgpack;
use chat_events::{ChatEventInternal, Reader};
use group_canister::summary_updates::{Response::*, *};
use group_members::GroupMemberInternal;
use ic_cdk_macros::query;
use std::cmp::max;
use types::{
    AccessGate, EventIndex, EventWrapper, FrozenGroupInfo, GroupCanisterGroupChatSummaryUpdates, GroupPermissions,
    GroupSubtype, Mention, Message, MessageIndex, Milliseconds, OptionUpdate, TimestampMillis, MAX_THREADS_IN_SUMMARY,
};

#[query]
fn summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args, state))
}

#[query_msgpack]
fn c2c_summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args, state))
}

fn summary_updates_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();
    let member = match state.data.get_member(caller) {
        None => return CallerNotInGroup,
        Some(p) => p,
    };
    let updates_since = max(args.updates_since, member.date_added);

    // Short circuit prior to calling `ic0.time()` so that query caching works effectively.
    // This doesn't account for expired events, but they aren't used yet and should probably just be
    // handled by the FE anyway.
    if !state.data.chat.events.has_updates_since(updates_since)
        && state.data.invited_users.last_updated() <= updates_since
        && member.notifications_muted.timestamp <= updates_since
    {
        return SuccessNoUpdates;
    }

    let now = state.env.now();
    let updates_from_events = process_events(updates_since, member, now, &state.data);
    let newly_expired_messages = state.data.chat.events.expired_messages_since(updates_since, now);

    let updates = GroupCanisterGroupChatSummaryUpdates {
        chat_id: state.env.canister_id().into(),
        last_updated: now,
        name: updates_from_events.name,
        description: updates_from_events.description,
        subtype: updates_from_events.subtype,
        avatar_id: updates_from_events.avatar_id,
        latest_message: updates_from_events.latest_message,
        latest_event_index: updates_from_events.latest_event_index,
        participant_count: if updates_from_events.participants_changed { Some(state.data.chat.members.len()) } else { None },
        role: if updates_from_events.role_changed { Some(member.role) } else { None },
        mentions: updates_from_events.mentions,
        permissions: updates_from_events.permissions,
        updated_events: updates_from_events.updated_events,
        metrics: Some(state.data.chat.events.metrics().clone()),
        my_metrics: state
            .data
            .chat
            .events
            .user_metrics(&member.user_id, Some(args.updates_since))
            .cloned(),
        is_public: updates_from_events.is_public,
        latest_threads: state.data.chat.events.latest_threads(
            member.min_visible_event_index(),
            member.threads.iter(),
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
        next_message_expiry: OptionUpdate::from_update(state.data.chat.events.next_message_expiry(now)),
        gate: updates_from_events.gate,
    };
    Success(SuccessResult { updates })
}

#[derive(Default)]
struct UpdatesFromEvents {
    name: Option<String>,
    description: Option<String>,
    subtype: OptionUpdate<GroupSubtype>,
    avatar_id: OptionUpdate<u128>,
    latest_message: Option<EventWrapper<Message>>,
    latest_event_index: Option<EventIndex>,
    participants_changed: bool,
    role_changed: bool,
    mentions: Vec<Mention>,
    permissions: Option<GroupPermissions>,
    updated_events: Vec<(Option<MessageIndex>, EventIndex, TimestampMillis)>,
    is_public: Option<bool>,
    notifications_muted: Option<bool>,
    frozen: OptionUpdate<FrozenGroupInfo>,
    date_last_pinned: Option<TimestampMillis>,
    events_ttl: OptionUpdate<Milliseconds>,
    gate: OptionUpdate<AccessGate>,
}

fn process_events(
    since: TimestampMillis,
    member: &GroupMemberInternal,
    now: TimestampMillis,
    data: &Data,
) -> UpdatesFromEvents {
    let events_reader = data
        .chat
        .events
        .visible_main_events_reader(member.min_visible_event_index(), now);

    let mut updates = UpdatesFromEvents {
        // We need to handle this separately because the message may have been sent before 'since' but
        // then subsequently updated after 'since', in this scenario the message would not be picked up
        // during the iteration below.
        latest_message: events_reader.latest_message_event_if_updated(since, Some(member.user_id)),
        updated_events: data
            .chat
            .events
            .iter_recently_updated_events()
            .take_while(|(_, _, ts)| *ts > since)
            .take(1000)
            .collect(),
        mentions: member.most_recent_mentions(Some(since), &data.chat.events, now),
        ..Default::default()
    };

    if data.chat.subtype.timestamp > since {
        updates.subtype = OptionUpdate::from_update(data.chat.subtype.value.clone());
    }

    if member.notifications_muted.timestamp > since {
        updates.notifications_muted = Some(member.notifications_muted.value);
    }

    if data.frozen.timestamp > since {
        updates.frozen = OptionUpdate::from_update(data.frozen.value.clone());
    }

    if data
        .chat
        .date_last_pinned
        .map_or(false, |date_last_pinned| date_last_pinned > since)
    {
        updates.date_last_pinned = data.chat.date_last_pinned;
    }

    if data.chat.gate.timestamp > since {
        updates.gate = OptionUpdate::from_update(data.chat.gate.value.clone());
    }

    let new_proposal_votes =
        member
            .proposal_votes
            .iter()
            .rev()
            .take_while(|(&t, _)| t > since)
            .flat_map(|(&t, message_indexes)| {
                message_indexes
                    .iter()
                    .filter_map(|&m| events_reader.event_index(m.into()))
                    .map(move |e| (None, e, t))
            });

    updates.updated_events.extend(new_proposal_votes);

    // Iterate through events starting from most recent
    for event_wrapper in events_reader.iter(None, false).take_while(|e| e.timestamp > since) {
        if updates.latest_event_index.is_none() {
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
                if r.user_ids.contains(&member.user_id) {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => {
                if p.user_id == member.user_id {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => {
                if p.user_id == member.user_id {
                    updates.role_changed = true;
                }
            }
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => {
                if p.user_id == member.user_id {
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
                if ownership.new_owner == member.user_id || ownership.old_owner == member.user_id {
                    updates.role_changed = true;
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
