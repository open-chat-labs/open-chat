use crate::model::channels::ChannelUpdates;
use crate::model::events::CommunityEvent;
use crate::model::members::CommunityMemberInternal;
use crate::RuntimeState;
use crate::{read_state, Data};
use canister_api_macros::query_msgpack;
use community_canister::summary_updates::{Response::*, *};
use ic_cdk_macros::query;
use types::{
    AccessGate, CommunityCanisterCommunitySummaryUpdates, CommunityMembershipUpdates, CommunityPermissions, EventIndex,
    FrozenGroupInfo, OptionUpdate, TimestampMillis,
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
    let member = state.data.members.get(caller);

    if member.is_none() && !state.data.is_public {
        return UserNotInCommunity;
    }

    let (channels_with_updates, channels_removed) = if let Some(m) = member {
        let channels_with_updates: Vec<_> = m
            .channels
            .iter()
            .filter_map(|c| state.data.channels.get(c))
            .filter(|c| c.chat.has_updates_since_by_user_id(&m.user_id, args.updates_since))
            .collect();

        let channels_removed = m.channels_removed_since(args.updates_since);

        (channels_with_updates, channels_removed)
    } else {
        let channels_with_updates: Vec<_> = state
            .data
            .channels
            .default_channels()
            .into_iter()
            .filter(|c| c.chat.is_public)
            .filter(|c| c.chat.has_updates_since(None, args.updates_since))
            .collect();

        (channels_with_updates, Vec::new())
    };

    if channels_with_updates.is_empty()
        && channels_removed.is_empty()
        && state.data.events.latest_event_timestamp() <= args.updates_since
        && member
            .map(|m| m.notifications_muted.timestamp <= args.updates_since)
            .unwrap_or_default()
    {
        return SuccessNoUpdates;
    }

    let updates_from_events = process_events(args.updates_since, member, &state.data);

    let now = state.env.now();

    let mut channels_added = Vec::new();
    let mut channels_updated = Vec::new();
    for channel in channels_with_updates {
        match channel.summary_updates(member.map(|m| &m.user_id), args.updates_since, now) {
            ChannelUpdates::Added(s) => channels_added.push(s),
            ChannelUpdates::Updated(s) => channels_updated.push(s),
        }
    }

    let membership = member.map(|m| CommunityMembershipUpdates {
        channels_removed,
        role: updates_from_events.role_changed.then_some(m.role),
    });

    Success(SuccessResult {
        updates: CommunityCanisterCommunitySummaryUpdates {
            community_id: state.env.canister_id().into(),
            last_updated: now,
            name: updates_from_events.name,
            description: updates_from_events.description,
            avatar_id: updates_from_events.avatar_id,
            banner_id: updates_from_events.banner_id,
            is_public: updates_from_events.is_public,
            member_count: updates_from_events.members_changed.then_some(state.data.members.len()),
            permissions: updates_from_events.permissions,
            frozen: updates_from_events.frozen,
            gate: updates_from_events.gate,
            latest_event_index: updates_from_events.latest_event_index,
            channels_added,
            channels_updated,
            membership,
        },
    })
}

#[derive(Default)]
struct UpdatesFromEvents {
    name: Option<String>,
    description: Option<String>,
    avatar_id: OptionUpdate<u128>,
    banner_id: OptionUpdate<u128>,
    latest_event_index: Option<EventIndex>,
    members_changed: bool,
    role_changed: bool,
    permissions: Option<CommunityPermissions>,
    is_public: Option<bool>,
    frozen: OptionUpdate<FrozenGroupInfo>,
    gate: OptionUpdate<AccessGate>,
}

fn process_events(since: TimestampMillis, member: Option<&CommunityMemberInternal>, data: &Data) -> UpdatesFromEvents {
    let mut updates = UpdatesFromEvents::default();

    if data.frozen.timestamp > since {
        updates.frozen = OptionUpdate::from_update(data.frozen.value.clone());
    }

    if data.gate.timestamp > since {
        updates.gate = OptionUpdate::from_update(data.gate.value.clone());
    }

    // Iterate through events starting from most recent
    for event_wrapper in data.events.iter(None, false).take_while(|e| e.timestamp > since) {
        if updates.latest_event_index.is_none() {
            updates.latest_event_index = Some(event_wrapper.index);
        }

        match &event_wrapper.event {
            CommunityEvent::NameChanged(n) => {
                if updates.name.is_none() {
                    updates.name = Some(n.new_name.clone());
                }
            }
            CommunityEvent::DescriptionChanged(n) => {
                if updates.description.is_none() {
                    updates.description = Some(n.new_description.clone());
                }
            }
            CommunityEvent::AvatarChanged(a) => {
                if !updates.avatar_id.has_update() {
                    updates.avatar_id = OptionUpdate::from_update(a.new_avatar);
                }
            }
            CommunityEvent::BannerChanged(a) => {
                if !updates.banner_id.has_update() {
                    updates.banner_id = OptionUpdate::from_update(a.new_banner);
                }
            }
            CommunityEvent::RoleChanged(r) => {
                if member.map(|m| r.user_ids.contains(&m.user_id)).unwrap_or_default() {
                    updates.role_changed = true;
                }
            }
            CommunityEvent::MemberJoined(_)
            | CommunityEvent::MembersRemoved(_)
            | CommunityEvent::MemberLeft(_)
            | CommunityEvent::UsersBlocked(_)
            | CommunityEvent::UsersUnblocked(_) => {
                updates.members_changed = true;
            }
            CommunityEvent::PermissionsChanged(p) => {
                if updates.permissions.is_none() {
                    updates.permissions = Some(p.new_permissions.clone());
                }
            }
            CommunityEvent::VisibilityChanged(v) => {
                updates.is_public = Some(v.now_public);
            }
            _ => {}
        }
    }

    updates
}
