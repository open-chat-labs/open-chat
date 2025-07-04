use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::channels::Channel;
use crate::model::members::CommunityMembers;
use crate::updates::c2c_join_community::join_community;
use crate::{RuntimeState, activity_notifications::handle_activity_notification, mutate_state, read_state};
use crate::{execute_update_async, jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use community_canister::c2c_join_channel::{Response::*, *};
use gated_groups::{
    CheckGateArgs, CheckIfPassesGateResult, CheckVerifiedCredentialGateArgs, GatePayment, check_if_passes_gate,
    check_if_passes_gate_synchronously,
};
use group_chat_core::{AddMemberSuccess, AddResult};
use group_community_common::ExpiringMember;
use ic_principal::Principal;
use oc_error_codes::OCErrorCode;
use types::{
    AccessGateConfigInternal, ChannelId, MemberJoinedInternal, TimestampMillis, UniquePersonProof, UserId, UserType,
    VerifiedCredentialGateArgs,
};

#[update(guard = "caller_is_user_index_or_local_user_index", msgpack = true)]
#[trace]
async fn c2c_join_channel(args: Args) -> Response {
    execute_update_async(|| c2c_join_channel_impl(args)).await
}

async fn c2c_join_channel_impl(args: Args) -> Response {
    if read_state(|state| {
        state
            .data
            .members
            .get_by_user_id(&args.user_id)
            .is_some_and(|member| !member.lapsed().value)
    }) {
        check_gate_then_join_channel(&args).await
    } else {
        match join_community(community_canister::c2c_join_community::Args {
            user_id: args.user_id,
            principal: args.principal,
            channel_id: Some(args.channel_id),
            invite_code: args.invite_code,
            referred_by: args.referred_by,
            is_platform_moderator: args.is_platform_moderator,
            user_type: args.user_type,
            diamond_membership_expires_at: args.diamond_membership_expires_at,
            verified_credential_args: args.verified_credential_args.clone(),
            unique_person_proof: args.unique_person_proof.clone(),
        })
        .await
        {
            community_canister::c2c_join_community::Response::Success(_) => {
                let response = check_gate_then_join_channel(&args).await;
                if matches!(response, Success(_) | AlreadyInChannel(_)) {
                    let summary = read_state(|state| {
                        let member = state.data.members.get_by_user_id(&args.user_id);
                        state.summary(member.as_ref(), None)
                    });
                    SuccessJoinedCommunity(Box::new(summary))
                } else {
                    response
                }
            }
            community_canister::c2c_join_community::Response::AlreadyInCommunity(_) => {
                check_gate_then_join_channel(&args).await
            }
            community_canister::c2c_join_community::Response::GateCheckFailed(reason) => GateCheckFailed(reason),
            community_canister::c2c_join_community::Response::Error(error) => Error(error),
        }
    }
}

pub(crate) fn join_channel_synchronously(
    channel_id: ChannelId,
    user_principal: Principal,
    diamond_membership_expires_at: Option<TimestampMillis>,
    unique_person_proof: Option<UniquePersonProof>,
    explicit_join: bool,
) {
    let is_unique_person = unique_person_proof.is_some();

    match read_state(|state| {
        is_permitted_to_join(
            channel_id,
            user_principal,
            diamond_membership_expires_at,
            unique_person_proof,
            None,
            state,
        )
    }) {
        Ok(None) => {}
        Ok(Some((gate_config, args))) => {
            if !check_if_passes_gate_synchronously(gate_config.gate, args)
                .map(|r| r.success())
                .unwrap_or_default()
            {
                return;
            }
        }
        _ => return,
    };

    mutate_state(|state| {
        commit(
            channel_id,
            user_principal,
            diamond_membership_expires_at,
            is_unique_person,
            Vec::new(),
            explicit_join,
            state,
        )
    });
}

async fn check_gate_then_join_channel(args: &Args) -> Response {
    let payments = match read_state(|state| {
        is_permitted_to_join(
            args.channel_id,
            args.principal,
            args.diamond_membership_expires_at,
            args.unique_person_proof.clone(),
            args.verified_credential_args.clone(),
            state,
        )
    }) {
        Ok(Some((gate_config, check_gate_args))) => match check_if_passes_gate(gate_config.gate, check_gate_args).await {
            CheckIfPassesGateResult::Success(payments) => payments,
            CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
            CheckIfPassesGateResult::Error(error) => return Error(error),
        },
        Ok(None) => Vec::new(),
        Err(response) => return response,
    };

    mutate_state(|state| {
        commit(
            args.channel_id,
            args.principal,
            args.diamond_membership_expires_at,
            args.unique_person_proof.is_some(),
            payments,
            true,
            state,
        )
    })
}

fn is_permitted_to_join(
    channel_id: ChannelId,
    user_principal: Principal,
    diamond_membership_expires_at: Option<TimestampMillis>,
    unique_person_proof: Option<UniquePersonProof>,
    verified_credential_args: Option<VerifiedCredentialGateArgs>,
    state: &RuntimeState,
) -> Result<Option<(AccessGateConfigInternal, CheckGateArgs)>, Response> {
    if state.data.is_frozen() {
        return Err(Error(OCErrorCode::CommunityFrozen.into()));
    }

    if let Some(member) = state.data.members.get(user_principal) {
        if member.suspended().value {
            return Err(Error(OCErrorCode::InitiatorSuspended.into()));
        }

        if let Some(channel) = state.data.channels.get(&channel_id) {
            if let Some(channel_member) = channel.chat.members.get(&member.user_id) {
                if !member.lapsed().value && !channel_member.lapsed().value {
                    return Err(AlreadyInChannel(Box::new(
                        channel
                            .summary(
                                Some(channel_member.user_id()),
                                state.data.is_public.value,
                                &state.data.members,
                            )
                            .unwrap(),
                    )));
                }
            } else if let Some(limit) = channel.chat.members.user_limit_reached() {
                return Err(Error(OCErrorCode::UserLimitReached.with_message(limit)));
            } else if channel.chat.members.is_blocked(&member.user_id) {
                return Err(Error(OCErrorCode::InitiatorBlocked.into()));
            } else if channel.chat.invited_users.get(&member.user_id).is_some() {
                return Ok(None);
            } else if !channel.chat.is_public.value {
                return Err(Error(OCErrorCode::NotInvited.into()));
            }

            Ok(channel.chat.gate_config.as_ref().map(|g| {
                (
                    g.clone(),
                    CheckGateArgs {
                        user_id: member.user_id,
                        diamond_membership_expires_at,
                        this_canister: state.env.canister_id(),
                        is_unique_person: unique_person_proof.is_some(),
                        verified_credential_args: verified_credential_args.map(|vc| CheckVerifiedCredentialGateArgs {
                            user_ii_principal: vc.user_ii_principal,
                            credential_jwts: vc.credential_jwts(),
                            ic_root_key: state.data.ic_root_key.clone(),
                            ii_canister_id: state.data.internet_identity_canister_id,
                            ii_origin: vc.ii_origin,
                        }),
                        referred_by_member: false,
                        now: state.env.now(),
                    },
                )
            }))
        } else {
            Err(Error(OCErrorCode::ChatNotFound.into()))
        }
    } else {
        Err(Error(OCErrorCode::InitiatorNotFound.into()))
    }
}

fn commit(
    channel_id: ChannelId,
    user_principal: Principal,
    diamond_membership_expires_at: Option<TimestampMillis>,
    is_unique_person: bool,
    payments: Vec<GatePayment>,
    explicit_join: bool,
    state: &mut RuntimeState,
) -> Response {
    let Some(member) = state.data.members.get(user_principal) else {
        return Error(OCErrorCode::InitiatorNotInCommunity.into());
    };

    let user_id = member.user_id;
    let Some(channel) = state.data.channels.get_mut(&channel_id) else {
        return Error(OCErrorCode::ChatNotFound.into());
    };

    let now = state.env.now();
    match join_channel_unchecked(
        member.user_id,
        member.user_type,
        channel,
        &mut state.data.members,
        state.data.is_public.value && channel.chat.is_public.value,
        true,
        explicit_join,
        now,
    ) {
        AddResult::Success(result) => {
            let summary = channel
                .summary(Some(user_id), state.data.is_public.value, &state.data.members)
                .unwrap();

            if let Some(gate_expiry) = channel.chat.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
                state.data.expiring_members.push(ExpiringMember {
                    expires: now + gate_expiry,
                    channel_id: Some(channel_id),
                    user_id,
                });
            }

            // If there is a payment gate on this channel then queue payments to *community* owner(s) and treasury
            for payment in payments {
                state.queue_access_gate_payments(payment);
            }

            if result.unlapse {
                state.data.update_lapsed(user_id, Some(channel_id), false, now);
            }

            state
                .data
                .user_cache
                .insert(user_id, diamond_membership_expires_at, is_unique_person);

            jobs::expire_members::start_job_if_required(state);

            state.push_bot_notification(result.bot_notification);
            handle_activity_notification(state);

            Success(Box::new(summary))
        }
        AddResult::AlreadyInGroup => {
            channel.chat.members.update_lapsed(user_id, false, now);

            let summary = channel
                .summary(Some(user_id), state.data.is_public.value, &state.data.members)
                .unwrap();
            AlreadyInChannel(Box::new(summary))
        }
        AddResult::Blocked => Error(OCErrorCode::InitiatorBlocked.into()),
        AddResult::MemberLimitReached(limit) => Error(OCErrorCode::UserLimitReached.with_message(limit)),
    }
}

#[expect(clippy::too_many_arguments)]
pub(crate) fn join_channel_unchecked(
    user_id: UserId,
    user_type: UserType,
    channel: &mut Channel,
    community_members: &mut CommunityMembers,
    notifications_muted: bool,
    push_event: bool,
    explicit_join: bool,
    now: TimestampMillis,
) -> AddResult {
    let min_visible_event_index;
    let min_visible_message_index;

    if let Some(invitation) = channel.chat.invited_users.get(&user_id) {
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

    let mut result = channel.chat.members.add(
        user_id,
        now,
        min_visible_event_index,
        min_visible_message_index,
        notifications_muted,
        user_type,
    );

    if matches!(result, AddResult::AlreadyInGroup) {
        let member = channel.chat.members.get(&user_id).unwrap();
        if member.lapsed().value {
            return AddResult::Success(Box::new(AddMemberSuccess {
                member: member.clone(),
                unlapse: true,
                bot_notification: None,
            }));
        }
    }

    if let AddResult::Success(success) = &mut result {
        let invitation = channel.chat.invited_users.remove(&user_id, now);
        community_members.mark_member_joined_channel(user_id, channel.id);

        if push_event {
            if channel.chat.is_public.value && !explicit_join {
                success.bot_notification = channel.chat.events.mark_members_added_to_public_channel(vec![user_id], now);
            } else {
                let push_result = channel.chat.events.push_main_event(
                    ChatEventInternal::ParticipantJoined(Box::new(MemberJoinedInternal {
                        user_id,
                        invited_by: invitation.map(|i| i.invited_by),
                    })),
                    now,
                );
                success.bot_notification = push_result.bot_notification;
            }
        }
    }

    result
}
