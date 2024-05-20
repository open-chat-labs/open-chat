use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::model::members::AddResult;
use crate::updates::c2c_join_channel::join_channel_synchronously;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_join_community::{Response::*, *};
use gated_groups::{check_if_passes_gate, CheckGateArgs, CheckIfPassesGateResult, CheckVerifiedCredentialGateArgs};
use types::{AccessGate, ChannelId, MemberJoined, UsersUnblocked};

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
async fn c2c_join_community(args: Args) -> Response {
    run_regular_jobs();

    join_community(args).await
}

pub(crate) async fn join_community(args: Args) -> Response {
    match read_state(|state| is_permitted_to_join(&args, state)) {
        Ok(Some(check_gate_args)) => match check_if_passes_gate(check_gate_args).await {
            CheckIfPassesGateResult::Success => {}
            CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
            CheckIfPassesGateResult::InternalError(error) => return InternalError(error),
        },
        Ok(None) => {}
        Err(response) => return response,
    };

    match mutate_state(|state| join_community_impl(&args, state)) {
        Ok(public_channel_ids) => {
            for c in public_channel_ids {
                join_channel_synchronously(c, args.principal, args.diamond_membership_expires_at);
            }
            read_state(|state| {
                if let Some(member) = state.data.members.get_by_user_id(&args.user_id) {
                    Success(Box::new(state.summary(Some(member))))
                } else {
                    InternalError("User not found in community".to_string())
                }
            })
        }
        Err(response) => response,
    }
}

fn is_permitted_to_join(args: &Args, state: &RuntimeState) -> Result<Option<CheckGateArgs>, Response> {
    let caller = state.env.caller();

    // If the call is from the user index then we skip the checks
    if caller == state.data.user_index_canister_id {
        Ok(None)
    } else if let Some(member) = state.data.members.get_by_user_id(&args.user_id) {
        Err(AlreadyInCommunity(Box::new(state.summary(Some(member)))))
    } else if state.data.members.is_blocked(&args.user_id) {
        Err(UserBlocked)
    } else if state.data.is_frozen() {
        Err(CommunityFrozen)
    } else if !state.data.is_accessible(args.principal, args.invite_code) {
        Err(NotInvited)
    } else if let Some(limit) = state.data.members.user_limit_reached() {
        Err(MemberLimitReached(limit))
    } else {
        Ok(state.data.gate.as_ref().map(|g| CheckGateArgs {
            gate: g.clone(),
            user_id: args.user_id,
            diamond_membership_expires_at: args.diamond_membership_expires_at,
            this_canister: state.env.canister_id(),
            verified_credential_args: args
                .verified_credential_args
                .as_ref()
                .map(|vc| CheckVerifiedCredentialGateArgs {
                    user_ii_principal: vc.user_ii_principal,
                    credential_jwt: vc.credential_jwt.clone(),
                    ic_root_key: state.data.ic_root_key.clone(),
                    ii_canister_id: state.data.internet_identity_canister_id,
                    ii_origin: vc.ii_origin.clone(),
                }),
            now: state.env.now(),
        }))
    }
}

pub(crate) fn join_community_impl(args: &Args, state: &mut RuntimeState) -> Result<Vec<ChannelId>, Response> {
    let now = state.env.now();

    // Unblock "platform moderator" if necessary
    if args.is_platform_moderator && state.data.members.is_blocked(&args.user_id) {
        state.data.members.unblock(&args.user_id);

        let event = UsersUnblocked {
            user_ids: vec![args.user_id],
            unblocked_by: args.user_id,
        };

        state
            .data
            .events
            .push_event(CommunityEventInternal::UsersUnblocked(Box::new(event)), now);
    }

    match state.data.members.add(args.user_id, args.principal, args.is_bot, now) {
        AddResult::Success(_) => {
            let invitation = state.data.invited_users.remove(&args.user_id, now);

            state.data.events.push_event(
                CommunityEventInternal::MemberJoined(Box::new(MemberJoined {
                    user_id: args.user_id,
                    invited_by: invitation.map(|i| i.invited_by),
                })),
                now,
            );

            // If there is a payment gate on this community then queue payments to owner(s) and treasury
            if let Some(AccessGate::Payment(gate)) = state.data.gate.value.as_ref() {
                state.queue_access_gate_payments(gate.clone());
            }

            handle_activity_notification(state);

            Ok(state.data.channels.public_channel_ids())
        }
        AddResult::AlreadyInCommunity => {
            let member = state.data.members.get_by_user_id(&args.user_id).unwrap();
            let summary = state.summary(Some(member));
            Err(AlreadyInCommunity(Box::new(summary)))
        }
        AddResult::Blocked => Err(UserBlocked),
    }
}
