use crate::model::channels::ChannelUpdates;
use crate::read_state;
use crate::RuntimeState;
use candid::Principal;
use canister_api_macros::query;
use community_canister::summary_updates::{Response::*, *};
use std::cmp::max;
use types::{
    AccessGateConfig, CommunityCanisterCommunitySummaryUpdates, CommunityMembershipUpdates, OptionUpdate, TimestampMillis,
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
    let mut last_updated = [
        state.data.details_last_updated(),
        member.as_ref().map(|m| m.last_updated()).unwrap_or_default(),
        state.data.verified.timestamp,
    ]
    .into_iter()
    .max()
    .unwrap();

    let mut channels_with_updates = Vec::new();
    let mut channels_removed = Vec::new();

    if let Some(m) = &member {
        channels_with_updates.extend(
            state
                .data
                .members
                .channels_for_member(m.user_id)
                .iter()
                .filter_map(|c| state.data.channels.get(c))
                .filter(|c| c.last_updated(Some(m.user_id)) > updates_since),
        );

        for (channel_id, timestamp) in state
            .data
            .members
            .channels_removed_for_member(m.user_id)
            .filter(|(_, ts)| *ts > updates_since)
        {
            last_updated = max(last_updated, timestamp);
            channels_removed.push(channel_id);
        }
    } else {
        channels_with_updates.extend(
            state
                .data
                .channels
                .public_channels()
                .into_iter()
                .filter(|c| c.last_updated(None) > updates_since),
        );
    };

    for (channel_id, timestamp) in state.data.channels.channels_deleted_since(updates_since) {
        channels_removed.push(channel_id);
        last_updated = max(last_updated, timestamp);
    }

    if channels_with_updates.is_empty() && channels_removed.is_empty() && last_updated <= updates_since {
        return SuccessNoUpdates;
    }

    let mut channels_added = Vec::new();
    let mut channels_updated = Vec::new();

    let user_id = member.as_ref().map(|m| m.user_id);
    let is_community_member = member.is_some();

    for channel in channels_with_updates {
        if channel.date_imported.is_some_and(|ts| ts > updates_since) {
            if let Some(summary) =
                channel.summary(user_id, is_community_member, state.data.is_public.value, &state.data.members)
            {
                last_updated = max(last_updated, summary.last_updated);
                channels_added.push(summary);
            }
        } else {
            match channel.summary_updates(
                user_id,
                updates_since,
                is_community_member,
                state.data.is_public.value,
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

    let name = state.data.name.if_set_after(updates_since).cloned();
    let description = state.data.description.if_set_after(updates_since).cloned();
    let is_public = state.data.is_public.if_set_after(updates_since).cloned();
    let permissions = state.data.permissions.if_set_after(updates_since).cloned();
    let primary_language = state.data.primary_language.if_set_after(updates_since).cloned();
    let latest_event_index =
        (state.data.events.latest_event_timestamp() > updates_since).then_some(state.data.events.latest_event_index());
    let member_count = (state.data.members.last_updated() > updates_since).then_some(state.data.members.len() as u32);
    let avatar_id = state
        .data
        .avatar
        .if_set_after(updates_since)
        .map_or(OptionUpdate::NoChange, |a| {
            OptionUpdate::from_update(a.as_ref().map(|d| d.id))
        });
    let banner_id = state
        .data
        .banner
        .if_set_after(updates_since)
        .map_or(OptionUpdate::NoChange, |a| {
            OptionUpdate::from_update(a.as_ref().map(|d| d.id))
        });
    let frozen = state
        .data
        .frozen
        .if_set_after(updates_since)
        .cloned()
        .map_or(OptionUpdate::NoChange, OptionUpdate::from_update);
    let gate_config = state
        .data
        .gate_config
        .if_set_after(updates_since)
        .map_or(OptionUpdate::NoChange, |gc| {
            OptionUpdate::from_update(gc.clone().map(AccessGateConfig::from))
        });

    let membership = member.map(|m| CommunityMembershipUpdates {
        role: Some(m.role()),
        rules_accepted: m
            .rules_accepted
            .as_ref()
            .filter(|accepted| state.data.rules.timestamp > updates_since || accepted.timestamp > updates_since)
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
        name,
        description,
        avatar_id,
        banner_id,
        is_public,
        member_count,
        permissions,
        frozen,
        gate: gate_config.as_ref().map(|gc| gc.gate.clone()),
        gate_config,
        primary_language,
        latest_event_index,
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
        verified: state.data.verified.if_set_after(updates_since).copied(),
    })
}
