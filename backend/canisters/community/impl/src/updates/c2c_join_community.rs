use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::model::members::AddResult;
use crate::updates::c2c_join_channel::join_channel_synchronously;
use crate::{RuntimeState, jobs, mutate_state, read_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::c2c_join_community::{Response::*, *};
use gated_groups::{
    CheckGateArgs, CheckIfPassesGateResult, CheckVerifiedCredentialGateArgs, GatePayment, check_if_passes_gate,
};
use group_community_common::ExpiringMember;
use oc_error_codes::OCErrorCode;
use types::{AccessGate, ChannelId, CommunityCanisterCommunitySummary, OCResult, UsersUnblocked};

#[update(guard = "caller_is_user_index_or_local_user_index", msgpack = true)]
#[trace]
async fn c2c_join_community(args: Args) -> Response {
    run_regular_jobs();

    join_community(args).await
}

pub(crate) async fn join_community(args: Args) -> Response {
    let payments = match read_state(|state| is_permitted_to_join(&args, state)) {
        Ok(IsPermittedToJoinSuccess::NoGate) => Vec::new(),
        Ok(IsPermittedToJoinSuccess::RequiresGate(gate, check_gate_args)) => {
            match check_if_passes_gate(gate, *check_gate_args).await {
                CheckIfPassesGateResult::Success(payments) => payments,
                CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
                CheckIfPassesGateResult::Error(error) => return Error(error),
            }
        }
        Ok(IsPermittedToJoinSuccess::AlreadyInCommunity(summary)) => return AlreadyInCommunity(summary),
        Err(error) => return Error(error),
    };

    match mutate_state(|state| join_community_impl(&args, payments, state)) {
        Ok(public_channel_ids) => {
            for c in public_channel_ids {
                join_channel_synchronously(
                    c,
                    args.principal,
                    args.diamond_membership_expires_at,
                    args.unique_person_proof.clone(),
                );
            }
            read_state(|state| {
                if let Some(member) = state.data.members.get_by_user_id(&args.user_id) {
                    Success(Box::new(state.summary(Some(&member), None)))
                } else {
                    Error(OCErrorCode::InitiatorNotInCommunity.into())
                }
            })
        }
        Err(response) => response,
    }
}

enum IsPermittedToJoinSuccess {
    NoGate,
    RequiresGate(AccessGate, Box<CheckGateArgs>),
    AlreadyInCommunity(Box<CommunityCanisterCommunitySummary>),
}

fn is_permitted_to_join(args: &Args, state: &RuntimeState) -> OCResult<IsPermittedToJoinSuccess> {
    let caller = state.env.caller();

    state.data.verify_not_frozen()?;

    if let Some(member) = state.data.members.get_by_user_id(&args.user_id) {
        if !member.lapsed().value {
            return Ok(IsPermittedToJoinSuccess::AlreadyInCommunity(Box::new(
                state.summary(Some(&member), None),
            )));
        }
    } else if state.data.members.is_blocked(&args.user_id) {
        return Err(OCErrorCode::InitiatorBlocked.into());
    } else if let Some(limit) = state.data.members.user_limit_reached() {
        return Err(OCErrorCode::UserLimitReached.with_message(limit));
    } else if caller == state.data.user_index_canister_id || state.data.is_invited(args.principal) {
        return Ok(IsPermittedToJoinSuccess::NoGate);
    } else if !state.data.is_public.value && !state.data.is_invite_code_valid(args.invite_code) {
        return Err(OCErrorCode::NotInvited.into());
    }

    Ok(if let Some(gate_config) = state.data.gate_config.as_ref() {
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
                referred_by_member: args
                    .referred_by
                    .is_some_and(|user_id| state.data.members.get_by_user_id(&user_id).is_some()),
                now: state.env.now(),
            }),
        )
    } else {
        IsPermittedToJoinSuccess::NoGate
    })
}

pub(crate) fn join_community_impl(
    args: &Args,
    payments: Vec<GatePayment>,
    state: &mut RuntimeState,
) -> Result<Vec<ChannelId>, Response> {
    let now = state.env.now();

    // Unblock "platform moderator" if necessary
    if args.is_platform_moderator && state.data.members.is_blocked(&args.user_id) {
        state.data.members.unblock(args.user_id, now);

        let event = UsersUnblocked {
            user_ids: vec![args.user_id],
            unblocked_by: args.user_id,
        };

        state
            .data
            .events
            .push_event(CommunityEventInternal::UsersUnblocked(Box::new(event)), now);
    }

    let referred_by = state
        .data
        .invited_users
        .get(&args.user_id)
        .map(|i| i.invited_by)
        .or(args.referred_by);

    let result = state
        .data
        .members
        .add(args.user_id, args.principal, args.user_type, referred_by, now);

    match result {
        AddResult::Success(_) => {}
        AddResult::AlreadyInCommunity => {
            let member = state.data.members.get_by_user_id(&args.user_id).unwrap();
            if !member.lapsed().value {
                let summary = state.summary(Some(&member), None);
                return Err(AlreadyInCommunity(Box::new(summary)));
            }
        }
        AddResult::Blocked => return Err(Error(OCErrorCode::InitiatorBlocked.into())),
    }

    state.data.invited_users.remove(&args.user_id, now);

    if matches!(result, AddResult::AlreadyInCommunity) {
        state.data.update_lapsed(args.user_id, None, false, now);
    }

    // If there is a payment gate on this community then queue payments to owner(s) and treasury
    for payment in payments {
        state.queue_access_gate_payments(payment);
    }

    if let Some(gate_expiry) = state.data.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
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

    handle_activity_notification(state);

    Ok(state.data.channels.public_channel_ids())
}
