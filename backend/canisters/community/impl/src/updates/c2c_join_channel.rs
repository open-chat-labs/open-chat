use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::channels::Channel;
use crate::model::members::CommunityMemberInternal;
use crate::run_regular_jobs;
use crate::updates::c2c_join_community::join_community;
use crate::{activity_notifications::handle_activity_notification, mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use community_canister::c2c_join_channel::{Response::*, *};
use gated_groups::{check_if_passes_gate, CheckIfPassesGateResult};
use group_chat_core::AddResult;
use types::{AccessGate, CanisterId, ChannelId, EventIndex, MemberJoined, MessageIndex, TimestampMillis, UserId};

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
async fn c2c_join_channel(args: Args) -> Response {
    run_regular_jobs();

    match join_community(community_canister::c2c_join_community::Args {
        user_id: args.user_id,
        principal: args.principal,
        invite_code: args.invite_code,
        is_platform_moderator: args.is_platform_moderator,
    })
    .await
    {
        community_canister::c2c_join_community::Response::Success(_) => {
            let response = join_channel_impl(args.channel_id, args.principal).await;
            if matches!(response, Success(_)) {
                let summary = read_state(|state| {
                    let member = state.data.members.get_by_user_id(&args.user_id);
                    state.summary(member, state.env.now())
                });
                SuccessJoinedCommunity(Box::new(summary))
            } else {
                response
            }
        }
        community_canister::c2c_join_community::Response::AlreadyInCommunity(_) => {
            join_channel_impl(args.channel_id, args.principal).await
        }
        community_canister::c2c_join_community::Response::GateCheckFailed(r) => GateCheckFailed(r),
        community_canister::c2c_join_community::Response::NotInvited => NotInvited,
        community_canister::c2c_join_community::Response::UserBlocked => UserBlocked,
        community_canister::c2c_join_community::Response::MemberLimitReached(l) => MemberLimitReached(l),
        community_canister::c2c_join_community::Response::CommunityFrozen => CommunityFrozen,
        community_canister::c2c_join_community::Response::InternalError(error) => InternalError(error),
    }
}

pub(crate) async fn join_channel_impl(channel_id: ChannelId, user_principal: Principal) -> Response {
    match read_state(|state| is_permitted_to_join(channel_id, user_principal, state)) {
        Ok(Some((gate, user_index_canister_id, user_id))) => {
            match check_if_passes_gate(&gate, user_id, user_index_canister_id).await {
                CheckIfPassesGateResult::Success => {}
                CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
                CheckIfPassesGateResult::InternalError(error) => return InternalError(error),
            }
        }
        Ok(None) => {}
        Err(response) => return response,
    };

    mutate_state(|state| commit(channel_id, user_principal, state))
}

fn is_permitted_to_join(
    channel_id: ChannelId,
    user_principal: Principal,
    state: &RuntimeState,
) -> Result<Option<(AccessGate, CanisterId, UserId)>, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    if let Some(member) = state.data.members.get(user_principal) {
        if member.suspended.value {
            return Err(UserSuspended);
        }

        if let Some(channel) = state.data.channels.get(&channel_id) {
            if !channel.chat.is_public && channel.chat.invited_users.get(&member.user_id).is_none() {
                return Err(NotInvited);
            }

            if let Some(limit) = channel.chat.members.user_limit_reached() {
                return Err(MemberLimitReached(limit));
            }

            if let Some(channel_member) = channel.chat.members.get(&member.user_id) {
                Err(AlreadyInChannel(Box::new(
                    channel
                        .summary(Some(channel_member.user_id), state.data.is_public, state.env.now())
                        .unwrap(),
                )))
            } else {
                Ok(channel
                    .chat
                    .gate
                    .as_ref()
                    .map(|g| (g.clone(), state.data.user_index_canister_id, member.user_id)))
            }
        } else {
            Err(ChannelNotFound)
        }
    } else {
        Err(UserNotInCommunity)
    }
}

fn commit(channel_id: ChannelId, user_principal: Principal, state: &mut RuntimeState) -> Response {
    if let Some(member) = state.data.members.get_mut(user_principal) {
        if let Some(channel) = state.data.channels.get_mut(&channel_id) {
            let now = state.env.now();
            match join_channel_unchecked(channel, member, state.data.is_public, now) {
                AddResult::Success(_) => {
                    let summary = channel.summary(Some(member.user_id), state.data.is_public, now).unwrap();
                    handle_activity_notification(state);
                    Success(Box::new(summary))
                }
                AddResult::AlreadyInGroup => {
                    let summary = channel.summary(Some(member.user_id), state.data.is_public, now).unwrap();
                    AlreadyInChannel(Box::new(summary))
                }
                AddResult::Blocked => UserBlocked,
                AddResult::MemberLimitReached(limit) => MemberLimitReached(limit),
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}

pub(crate) fn join_channel_unchecked(
    channel: &mut Channel,
    member: &mut CommunityMemberInternal,
    notifications_muted: bool,
    now: TimestampMillis,
) -> AddResult {
    let min_visible_event_index;
    let min_visible_message_index;

    if let Some(invitation) = channel.chat.invited_users.get(&member.user_id) {
        min_visible_event_index = invitation.min_visible_event_index;
        min_visible_message_index = invitation.min_visible_message_index;
    } else if channel.chat.history_visible_to_new_joiners {
        min_visible_event_index = EventIndex::default();
        min_visible_message_index = MessageIndex::default();
    } else {
        let events_reader = channel.chat.events.main_events_reader(now);
        min_visible_event_index = events_reader.next_event_index();
        min_visible_message_index = events_reader.next_message_index();
    };

    let result = channel.chat.members.add(
        member.user_id,
        now,
        min_visible_event_index,
        min_visible_message_index,
        notifications_muted,
    );

    match &result {
        AddResult::Success(_) => {
            let invitation = channel.chat.invited_users.remove(&member.user_id, now);

            channel.chat.events.push_main_event(
                ChatEventInternal::ParticipantJoined(Box::new(MemberJoined {
                    user_id: member.user_id,
                    invited_by: invitation.map(|i| i.invited_by),
                })),
                0,
                now,
            );

            member.channels.insert(channel.id);
        }
        AddResult::AlreadyInGroup => {
            member.channels.insert(channel.id);
        }
        AddResult::Blocked | AddResult::MemberLimitReached(_) => {}
    }

    result
}
