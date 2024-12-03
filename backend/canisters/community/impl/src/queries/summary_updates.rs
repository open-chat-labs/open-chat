use std::cmp::max;

use crate::model::channels::ChannelUpdates;
use crate::model::events::CommunityEventInternal;
use crate::model::members::CommunityMemberInternal;
use crate::RuntimeState;
use crate::{read_state, Data};
use candid::Principal;
use canister_api_macros::query;
use community_canister::summary_updates::{Response::*, *};
use types::{
    AccessGateConfig, CommunityCanisterCommunitySummaryUpdates, CommunityMembershipUpdates, CommunityPermissions, EventIndex,
    FrozenGroupInfo, OptionUpdate, TimestampMillis,
};

#[query(candid = true, msgpack = true)]
fn summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args.updates_since, args.invite_code, args.on_behalf_of, state))
}

#[query(msgpack = true)]
fn c2c_summary_updates(args: Args) -> Response {
    read_state(|state| summary_updates_impl(args.updates_since, args.invite_code, args.on_behalf_of, state))
}

fn summary_updates_impl(
    updates_since: TimestampMillis,
    invite_code: Option<u64>,
    on_behalf_of: Option<Principal>,
    state: &RuntimeState,
) -> Response {
    let caller = if let Some(principal) = on_behalf_of {
        assert!(state.is_caller_local_user_index());
        principal
    } else {
        state.env.caller()
    };

    if !state.data.is_accessible(caller, invite_code) {
        return PrivateCommunity;
    }

    let member = state.data.members.get(caller);
    let mut last_updated = max(
        state.data.details_last_updated(),
        member.as_ref().map(|m| m.last_updated()).unwrap_or_default(),
    );

    let (channels_with_updates, channels_removed) = if let Some(m) = member {
        let channels_with_updates: Vec<_> = state
            .data
            .members
            .channels_for_member(m.user_id)
            .filter_map(|c| state.data.channels.get(&c))
            .filter(|c| c.last_updated(Some(m.user_id)) > updates_since)
            .collect();

        let mut channels_removed = Vec::new();
        for (channel_id, timestamp) in state
            .data
            .members
            .channels_removed_for_member(m.user_id)
            .filter(|(_, ts)| *ts > updates_since)
        {
            last_updated = max(last_updated, timestamp);
            channels_removed.push(channel_id);
        }

        (channels_with_updates, channels_removed)
    } else {
        let channels_with_updates: Vec<_> = state
            .data
            .channels
            .public_channels()
            .into_iter()
            .filter(|c| c.last_updated(None) > updates_since)
            .collect();

        (channels_with_updates, Vec::new())
    };

    if channels_with_updates.is_empty() && channels_removed.is_empty() && last_updated <= updates_since {
        return SuccessNoUpdates;
    }

    let updates_from_events = process_events(updates_since, member, &state.data);

    let mut channels_added = Vec::new();
    let mut channels_updated = Vec::new();

    let user_id = member.map(|m| m.user_id);
    let is_community_member = member.is_some();

    for channel in channels_with_updates {
        if channel.date_imported.map_or(false, |ts| ts > updates_since) {
            if let Some(summary) = channel.summary(user_id, is_community_member, state.data.is_public, &state.data.members) {
                last_updated = max(last_updated, summary.last_updated);
                channels_added.push(summary);
            }
        } else {
            match channel.summary_updates(
                user_id,
                updates_since,
                is_community_member,
                state.data.is_public,
                &state.data.members,
            ) {
                ChannelUpdates::Added(s) => {
                    last_updated = max(last_updated, s.last_updated);
                    channels_added.push(s)
                }
                ChannelUpdates::Updated(s) => {
                    last_updated = max(last_updated, s.last_updated);
                    channels_updated.push(s)
                }
            }
        }
    }

    let membership = member.map(|m| CommunityMembershipUpdates {
        role: updates_from_events.role_changed.then_some(m.role()),
        rules_accepted: m
            .rules_accepted
            .as_ref()
            .filter(|accepted| updates_from_events.rules_changed || accepted.timestamp > updates_since)
            .map(|accepted| accepted.value >= state.data.rules.text.version),
        display_name: m
            .display_name()
            .if_set_after(updates_since)
            .map_or(OptionUpdate::NoChange, |display_name| match display_name {
                Some(display_name) => OptionUpdate::SetToSome(display_name.clone()),
                None => OptionUpdate::SetToNone,
            }),
        lapsed: m.lapsed().if_set_after(updates_since).copied(),
    });

    Success(CommunityCanisterCommunitySummaryUpdates {
        community_id: state.env.canister_id().into(),
        last_updated,
        name: updates_from_events.name,
        description: updates_from_events.description,
        avatar_id: updates_from_events.avatar_id,
        banner_id: updates_from_events.banner_id,
        is_public: updates_from_events.is_public,
        member_count: updates_from_events.members_changed.then_some(state.data.members.len()),
        permissions: updates_from_events.permissions,
        frozen: updates_from_events.frozen,
        gate: updates_from_events.gate_config.as_ref().map(|gc| gc.gate.clone()),
        gate_config: updates_from_events.gate_config,
        primary_language: updates_from_events.primary_language,
        latest_event_index: updates_from_events.latest_event_index,
        channels_added,
        channels_updated,
        channels_removed,
        membership,
        user_groups: state
            .data
            .members
            .iter_user_groups()
            .filter(|u| u.last_updated() > updates_since)
            .map(|u| u.into())
            .collect(),
        user_groups_deleted: state.data.members.user_groups_deleted_since(updates_since),
        metrics: state.data.cached_chat_metrics.if_set_after(updates_since).cloned(),
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
    gate_config: OptionUpdate<AccessGateConfig>,
    primary_language: Option<String>,
    rules_changed: bool,
}

fn process_events(since: TimestampMillis, member: Option<&CommunityMemberInternal>, data: &Data) -> UpdatesFromEvents {
    let mut updates = UpdatesFromEvents::default();

    if data.frozen.timestamp > since {
        updates.frozen = OptionUpdate::from_update(data.frozen.value.clone());
    }

    if data.gate_config.timestamp > since {
        updates.gate_config = OptionUpdate::from_update(data.gate_config.value.clone().map(|gc| gc.into()));
    }

    // Iterate through events starting from most recent
    for event_wrapper in data.events.iter(None, false).take_while(|e| e.timestamp > since) {
        if updates.latest_event_index.is_none() {
            updates.latest_event_index = Some(event_wrapper.index);
        }

        match &event_wrapper.event {
            CommunityEventInternal::NameChanged(n) => {
                if updates.name.is_none() {
                    updates.name = Some(n.new_name.clone());
                }
            }
            CommunityEventInternal::DescriptionChanged(n) => {
                if updates.description.is_none() {
                    updates.description = Some(n.new_description.clone());
                }
            }
            CommunityEventInternal::AvatarChanged(a) => {
                if !updates.avatar_id.has_update() {
                    updates.avatar_id = OptionUpdate::from_update(a.new_avatar);
                }
            }
            CommunityEventInternal::BannerChanged(a) => {
                if !updates.banner_id.has_update() {
                    updates.banner_id = OptionUpdate::from_update(a.new_banner);
                }
            }
            CommunityEventInternal::RoleChanged(r) => {
                if member.map(|m| r.user_ids.contains(&m.user_id)).unwrap_or_default() {
                    updates.role_changed = true;
                }
            }
            CommunityEventInternal::MemberJoined(_)
            | CommunityEventInternal::MembersRemoved(_)
            | CommunityEventInternal::MemberLeft(_)
            | CommunityEventInternal::UsersBlocked(_)
            | CommunityEventInternal::UsersUnblocked(_)
            | CommunityEventInternal::GroupImported(_) => {
                updates.members_changed = true;
            }
            CommunityEventInternal::PermissionsChanged(p) => {
                if updates.permissions.is_none() {
                    updates.permissions = Some(p.new_permissions.clone());
                }
            }
            CommunityEventInternal::VisibilityChanged(v) => {
                updates.is_public = Some(v.now_public);
            }
            CommunityEventInternal::PrimaryLanguageChanged(l) => {
                if updates.primary_language.is_none() {
                    updates.primary_language = Some(l.new.clone());
                }
            }
            CommunityEventInternal::RulesChanged(_) => {
                updates.rules_changed = true;
            }
            _ => {}
        }
    }

    updates
}
