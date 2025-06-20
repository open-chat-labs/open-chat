use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::{AddMemberArgs, RuntimeState, execute_update_async, jobs, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use gated_groups::{
    CheckGateArgs, CheckIfPassesGateResult, CheckVerifiedCredentialGateArgs, GatePayment, check_if_passes_gate,
};
use group_canister::c2c_join_group::{Response::*, *};
use group_chat_core::AddResult;
use group_community_common::ExpiringMember;
use oc_error_codes::OCErrorCode;
use types::{AccessGate, GroupCanisterGroupChatSummary, MemberJoinedInternal, OCResult, UsersUnblocked};

#[update(guard = "caller_is_user_index_or_local_user_index", msgpack = true)]
#[trace]
async fn c2c_join_group(args: Args) -> Response {
    execute_update_async(|| c2c_join_group_impl(args)).await
}

async fn c2c_join_group_impl(args: Args) -> Response {
    let payments = match read_state(|state| is_permitted_to_join(&args, state)) {
        Ok(IsPermittedToJoinSuccess::NoGate) => Vec::new(),
        Ok(IsPermittedToJoinSuccess::RequiresGate(gate, check_gate_args)) => {
            match check_if_passes_gate(gate, *check_gate_args).await {
                CheckIfPassesGateResult::Success(payments) => payments,
                CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
                CheckIfPassesGateResult::Error(error) => return Error(error),
            }
        }
        Ok(IsPermittedToJoinSuccess::AlreadyInGroup(summary)) => return AlreadyInGroupV2(summary),
        Err(error) => return Error(error),
    };

    mutate_state(|state| commit(args, payments, state))
}

enum IsPermittedToJoinSuccess {
    NoGate,
    RequiresGate(AccessGate, Box<CheckGateArgs>),
    AlreadyInGroup(Box<GroupCanisterGroupChatSummary>),
}

fn is_permitted_to_join(args: &Args, state: &RuntimeState) -> OCResult<IsPermittedToJoinSuccess> {
    state.data.verify_not_frozen()?;

    if let Some(member) = state.data.chat.members.get(&args.user_id) {
        if !member.lapsed().value {
            let summary = state.summary(&member);
            return Ok(IsPermittedToJoinSuccess::AlreadyInGroup(Box::new(summary)));
        }
    } else if state.data.chat.members.is_blocked(&args.user_id) {
        return Err(OCErrorCode::InitiatorBlocked.into());
    } else if let Some(limit) = state.data.chat.members.user_limit_reached() {
        return Err(OCErrorCode::UserLimitReached.with_message(limit));
    } else if state.env.caller() == state.data.user_index_canister_id || state.data.get_invitation(args.principal).is_some() {
        return Ok(IsPermittedToJoinSuccess::NoGate);
    } else if !state.data.chat.is_public.value && !state.data.is_invite_code_valid(args.invite_code) {
        return Err(OCErrorCode::NotInvited.into());
    }

    Ok(if let Some(gate_config) = state.data.chat.gate_config.as_ref() {
        IsPermittedToJoinSuccess::RequiresGate(
            gate_config.gate.clone(),
            Box::new(CheckGateArgs {
                user_id: args.user_id,
                diamond_membership_expires_at: args.diamond_membership_expires_at,
                this_canister: state.env.canister_id(),
                is_unique_person: args.unique_person_proof.is_some(),
                verified_credential_args: args
                    .verified_credential_args
                    .as_ref()
                    .map(|vc| CheckVerifiedCredentialGateArgs {
                        user_ii_principal: vc.user_ii_principal,
                        credential_jwts: vc.credential_jwts(),
                        ic_root_key: state.data.ic_root_key.clone(),
                        ii_canister_id: state.data.internet_identity_canister_id,
                        ii_origin: vc.ii_origin.clone(),
                    }),
                referred_by_member: false,
                now: state.env.now(),
            }),
        )
    } else {
        IsPermittedToJoinSuccess::NoGate
    })
}

fn commit(args: Args, payments: Vec<GatePayment>, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    let (min_visible_event_index, min_visible_message_index) =
        if let Some(invitation) = state.data.get_invitation(args.principal) {
            (invitation.min_visible_event_index, invitation.min_visible_message_index)
        } else {
            state.data.chat.min_visible_indexes_for_new_members()
        };

    // Unblock "platform moderator" if necessary
    let mut new_event = false;
    if args.is_platform_moderator && state.data.chat.members.is_blocked(&args.user_id) {
        state.data.chat.members.unblock(args.user_id, now);

        let event = UsersUnblocked {
            user_ids: vec![args.user_id],
            unblocked_by: args.user_id,
        };

        state
            .data
            .chat
            .events
            .push_main_event(ChatEventInternal::UsersUnblocked(Box::new(event)), now);

        new_event = true;
    }

    let response = match state.add_member(AddMemberArgs {
        user_id: args.user_id,
        principal: args.principal,
        now,
        min_visible_event_index,
        min_visible_message_index,
        mute_notifications: state.data.chat.is_public.value,
        user_type: args.user_type,
    }) {
        AddResult::Success(mut result) => {
            let invitation = state.data.chat.invited_users.remove(&args.user_id, now);

            let event = MemberJoinedInternal {
                user_id: args.user_id,
                invited_by: invitation.map(|i| i.invited_by),
            };
            let push_result = state
                .data
                .chat
                .events
                .push_main_event(ChatEventInternal::ParticipantJoined(Box::new(event)), now);

            result.bot_notification = push_result.bot_notification;

            new_event = true;

            let summary = state.summary(&result.member);

            // If there is a payment gate on this group then queue payments to owner(s) and treasury
            for payment in payments {
                state.queue_access_gate_payments(payment);
            }

            Success(Box::new(summary))
        }
        AddResult::AlreadyInGroup => {
            state.data.chat.members.update_lapsed(args.user_id, false, now);

            let member = state.data.chat.members.get(&args.user_id).unwrap();
            let summary = state.summary(&member);
            Success(Box::new(summary))
        }
        AddResult::Blocked => Error(OCErrorCode::InitiatorBlocked.into()),
        AddResult::MemberLimitReached(limit) => Error(OCErrorCode::UserLimitReached.with_message(limit)),
    };

    if let Some(gate_expiry) = state.data.chat.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
        state.data.expiring_members.push(ExpiringMember {
            expires: now + gate_expiry,
            channel_id: None,
            user_id: args.user_id,
        });
    }

    state.data.user_cache.insert(
        args.user_id,
        args.diamond_membership_expires_at,
        args.unique_person_proof.is_some(),
    );

    jobs::expire_members::start_job_if_required(state);

    if new_event {
        handle_activity_notification(state);
    }

    response
}
