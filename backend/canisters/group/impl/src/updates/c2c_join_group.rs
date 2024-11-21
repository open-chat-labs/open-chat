use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::{jobs, mutate_state, read_state, run_regular_jobs, AddMemberArgs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use gated_groups::{
    check_if_passes_gate, CheckGateArgs, CheckIfPassesGateResult, CheckVerifiedCredentialGateArgs, GatePayment,
};
use group_canister::c2c_join_group::{Response::*, *};
use group_chat_core::AddResult;
use group_community_common::ExpiringMember;
use types::{AccessGateConfigInternal, MemberJoined, UsersUnblocked};

#[update(guard = "caller_is_user_index_or_local_user_index", msgpack = true)]
#[trace]
async fn c2c_join_group(args: Args) -> Response {
    run_regular_jobs();

    let payments = match read_state(|state| is_permitted_to_join(&args, state)) {
        Ok(Some((gate_config, check_gate_args))) => match check_if_passes_gate(gate_config.gate, check_gate_args).await {
            CheckIfPassesGateResult::Success(payments) => payments,
            CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
            CheckIfPassesGateResult::InternalError(error) => return InternalError(error),
        },
        Ok(None) => Vec::new(),
        Err(response) => return response,
    };

    mutate_state(|state| c2c_join_group_impl(args, payments, state))
}

fn is_permitted_to_join(
    args: &Args,
    state: &RuntimeState,
) -> Result<Option<(AccessGateConfigInternal, CheckGateArgs)>, Response> {
    let caller = state.env.caller();

    if state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    if let Some(member) = state.data.chat.members.get(&args.user_id) {
        if !member.lapsed().value {
            let summary = state.summary(member);
            return Err(AlreadyInGroupV2(Box::new(summary)));
        }
    } else if state.data.chat.members.is_blocked(&args.user_id) {
        return Err(Blocked);
    } else if let Some(limit) = state.data.chat.members.user_limit_reached() {
        return Err(ParticipantLimitReached(limit));
    } else if caller == state.data.user_index_canister_id || state.data.get_invitation(args.principal).is_some() {
        return Ok(None);
    } else if !state.data.chat.is_public.value && !state.data.is_invite_code_valid(args.invite_code) {
        return Err(NotInvited);
    }

    Ok(state.data.chat.gate_config.as_ref().map(|gc| {
        (
            gc.clone(),
            CheckGateArgs {
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
            },
        )
    }))
}

fn c2c_join_group_impl(args: Args, payments: Vec<GatePayment>, state: &mut RuntimeState) -> Response {
    let now = state.env.now();
    let min_visible_event_index;
    let min_visible_message_index;

    if let Some(invitation) = state.data.get_invitation(args.principal) {
        min_visible_event_index = invitation.min_visible_event_index;
        min_visible_message_index = invitation.min_visible_message_index;
    } else if state.data.chat.history_visible_to_new_joiners {
        let (e, m) = state.data.chat.min_visible_indexes_for_new_members.unwrap_or_default();

        min_visible_event_index = e;
        min_visible_message_index = m;
    } else {
        let events_reader = state.data.chat.events.main_events_list();
        min_visible_event_index = events_reader.next_event_index();
        min_visible_message_index = events_reader.next_message_index();
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
            .push_main_event(ChatEventInternal::UsersUnblocked(Box::new(event)), args.correlation_id, now);

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
        AddResult::Success(result) => {
            let invitation = state.data.chat.invited_users.remove(&args.user_id, now);

            let event = MemberJoined {
                user_id: args.user_id,
                invited_by: invitation.map(|i| i.invited_by),
            };
            state.data.chat.events.push_main_event(
                ChatEventInternal::ParticipantJoined(Box::new(event)),
                args.correlation_id,
                now,
            );

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
            let summary = state.summary(member);
            Success(Box::new(summary))
        }
        AddResult::Blocked => Blocked,
        AddResult::MemberLimitReached(limit) => ParticipantLimitReached(limit),
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
