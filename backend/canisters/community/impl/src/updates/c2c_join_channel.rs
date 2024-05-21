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
use gated_groups::{
    check_if_passes_gate, check_if_passes_gate_synchronously, CheckGateArgs, CheckIfPassesGateResult,
    CheckVerifiedCredentialGateArgs,
};
use group_chat_core::AddResult;
use types::{AccessGate, ChannelId, MemberJoined, TimestampMillis, VerifiedCredentialGateArgs};

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
async fn c2c_join_channel(args: Args) -> Response {
    run_regular_jobs();

    if read_state(|state| state.data.members.get_by_user_id(&args.user_id).is_some()) {
        check_gate_then_join_channel(&args).await
    } else {
        match join_community(community_canister::c2c_join_community::Args {
            user_id: args.user_id,
            principal: args.principal,
            invite_code: args.invite_code,
            is_platform_moderator: args.is_platform_moderator,
            is_bot: args.is_bot,
            diamond_membership_expires_at: args.diamond_membership_expires_at,
            verified_credential_args: args.verified_credential_args.clone(),
        })
        .await
        {
            community_canister::c2c_join_community::Response::Success(_) => {
                let response = check_gate_then_join_channel(&args).await;
                if matches!(response, Success(_) | AlreadyInChannel(_)) {
                    let summary = read_state(|state| {
                        let member = state.data.members.get_by_user_id(&args.user_id);
                        state.summary(member)
                    });
                    SuccessJoinedCommunity(Box::new(summary))
                } else {
                    response
                }
            }
            community_canister::c2c_join_community::Response::AlreadyInCommunity(_) => {
                check_gate_then_join_channel(&args).await
            }
            community_canister::c2c_join_community::Response::GateCheckFailed(r) => GateCheckFailed(r),
            community_canister::c2c_join_community::Response::NotInvited => NotInvited,
            community_canister::c2c_join_community::Response::UserBlocked => UserBlocked,
            community_canister::c2c_join_community::Response::MemberLimitReached(l) => MemberLimitReached(l),
            community_canister::c2c_join_community::Response::CommunityFrozen => CommunityFrozen,
            community_canister::c2c_join_community::Response::InternalError(error) => InternalError(error),
        }
    }
}

pub(crate) fn join_channel_synchronously(
    channel_id: ChannelId,
    user_principal: Principal,
    diamond_membership_expires_at: Option<TimestampMillis>,
) {
    match read_state(|state| is_permitted_to_join(channel_id, user_principal, diamond_membership_expires_at, None, state)) {
        Ok(None) => {}
        Ok(Some(args)) if args.gate.synchronous() => {
            if !matches!(check_if_passes_gate_synchronously(args), CheckIfPassesGateResult::Success) {
                return;
            }
        }
        _ => return,
    };

    mutate_state(|state| commit(channel_id, user_principal, state));
}

async fn check_gate_then_join_channel(args: &Args) -> Response {
    match read_state(|state| {
        is_permitted_to_join(
            args.channel_id,
            args.principal,
            args.diamond_membership_expires_at,
            args.verified_credential_args.clone(),
            state,
        )
    }) {
        Ok(Some(check_gate_args)) => match check_if_passes_gate(check_gate_args).await {
            CheckIfPassesGateResult::Success => {}
            CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
            CheckIfPassesGateResult::InternalError(error) => return InternalError(error),
        },
        Ok(None) => {}
        Err(response) => return response,
    };

    mutate_state(|state| commit(args.channel_id, args.principal, state))
}

fn is_permitted_to_join(
    channel_id: ChannelId,
    user_principal: Principal,
    diamond_membership_expires_at: Option<TimestampMillis>,
    verified_credential_args: Option<VerifiedCredentialGateArgs>,
    state: &RuntimeState,
) -> Result<Option<CheckGateArgs>, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    if let Some(member) = state.data.members.get(user_principal) {
        if member.suspended.value {
            return Err(UserSuspended);
        }

        if let Some(channel) = state.data.channels.get(&channel_id) {
            if let Some(channel_member) = channel.chat.members.get(&member.user_id) {
                Err(AlreadyInChannel(Box::new(
                    channel
                        .summary(Some(channel_member.user_id), true, state.data.is_public, &state.data.members)
                        .unwrap(),
                )))
            } else if !channel.chat.is_public.value && channel.chat.invited_users.get(&member.user_id).is_none() {
                Err(NotInvited)
            } else if let Some(limit) = channel.chat.members.user_limit_reached() {
                Err(MemberLimitReached(limit))
            } else if channel.chat.members.is_blocked(&member.user_id) {
                Err(UserBlocked)
            } else {
                Ok(channel.chat.gate.as_ref().map(|g| CheckGateArgs {
                    gate: g.clone(),
                    user_id: member.user_id,
                    diamond_membership_expires_at,
                    this_canister: state.env.canister_id(),
                    verified_credential_args: verified_credential_args.map(|vc| CheckVerifiedCredentialGateArgs {
                        user_ii_principal: vc.user_ii_principal,
                        credential_jwt: vc.credential_jwt,
                        ic_root_key: state.data.ic_root_key.clone(),
                        ii_canister_id: state.data.internet_identity_canister_id,
                        ii_origin: vc.ii_origin,
                    }),
                    now: state.env.now(),
                }))
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
                    let summary = channel
                        .summary(Some(member.user_id), true, state.data.is_public, &state.data.members)
                        .unwrap();

                    // If there is a payment gate on this channel then queue payments to *community* owner(s) and treasury
                    if let Some(AccessGate::Payment(gate)) = channel.chat.gate.value.as_ref().cloned() {
                        state.queue_access_gate_payments(gate);
                    }

                    handle_activity_notification(state);

                    Success(Box::new(summary))
                }
                AddResult::AlreadyInGroup => {
                    let summary = channel
                        .summary(Some(member.user_id), true, state.data.is_public, &state.data.members)
                        .unwrap();
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
        let (e, m) = channel.chat.min_visible_indexes_for_new_members.unwrap_or_default();

        min_visible_event_index = e;
        min_visible_message_index = m;
    } else {
        let events_reader = channel.chat.events.main_events_reader();
        min_visible_event_index = events_reader.next_event_index();
        min_visible_message_index = events_reader.next_message_index();
    };

    let result = channel.chat.members.add(
        member.user_id,
        now,
        min_visible_event_index,
        min_visible_message_index,
        notifications_muted,
        member.is_bot,
    );

    match &result {
        AddResult::Success(_) => {
            let invitation = channel.chat.invited_users.remove(&member.user_id, now);

            if channel.chat.is_public.value {
                channel.chat.events.mark_member_added_to_public_channel(member.user_id, now);
            } else {
                channel.chat.events.push_main_event(
                    ChatEventInternal::ParticipantJoined(Box::new(MemberJoined {
                        user_id: member.user_id,
                        invited_by: invitation.map(|i| i.invited_by),
                    })),
                    0,
                    now,
                );
            }

            member.channels.insert(channel.id);
        }
        AddResult::AlreadyInGroup => {
            member.channels.insert(channel.id);
        }
        AddResult::Blocked | AddResult::MemberLimitReached(_) => {}
    }

    result
}
