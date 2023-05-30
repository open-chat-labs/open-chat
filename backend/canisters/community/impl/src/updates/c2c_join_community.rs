use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::events::CommunityEvent;
use crate::model::members::AddResult;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_join_community::{Response::*, *};
use gated_groups::{check_if_passes_gate, CheckIfPassesGateResult};
use types::{CanisterId, GroupGate, MemberJoined, UsersUnblocked};

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
async fn c2c_join_community(args: Args) -> Response {
    match read_state(|state| is_permitted_to_join(args.invite_code, args.principal, state)) {
        Ok(Some((gate, user_index_canister_id))) => {
            match check_if_passes_gate(&gate, args.user_id, user_index_canister_id).await {
                CheckIfPassesGateResult::Success => {}
                CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
                CheckIfPassesGateResult::InternalError(error) => return InternalError(error),
            }
        }
        Ok(None) => {}
        Err(response) => return response,
    };

    mutate_state(|state| c2c_join_community_impl(args, state))
}

fn is_permitted_to_join(
    invite_code: Option<u64>,
    user_principal: Principal,
    state: &RuntimeState,
) -> Result<Option<(GroupGate, CanisterId)>, Response> {
    let caller = state.env.caller();

    // If the call is from the user index then we skip the checks
    if caller == state.data.user_index_canister_id {
        Ok(None)
    } else if state.data.is_frozen() {
        Err(CommunityFrozen)
    } else if !state.data.is_accessible(user_principal, invite_code) {
        Err(NotInvited)
    } else if let Some(limit) = state.data.members.user_limit_reached() {
        Err(MemberLimitReached(limit))
    } else {
        Ok(state
            .data
            .gate
            .as_ref()
            .map(|g| (g.clone(), state.data.user_index_canister_id)))
    }
}

fn c2c_join_community_impl(args: Args, state: &mut RuntimeState) -> Response {
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
            .push_event(CommunityEvent::UsersUnblocked(Box::new(event)), now);
    }

    match state
        .data
        .members
        .add(args.user_id, args.principal, now, state.data.is_public)
    {
        AddResult::Success(member) => {
            let invitation = state.data.invited_users.remove(&args.principal, now);

            state.data.events.push_event(
                CommunityEvent::MemberJoined(Box::new(MemberJoined {
                    user_id: args.user_id,
                    invited_by: invitation.map(|i| i.invited_by),
                })),
                now,
            );

            // TODO: Optionally join the user to the channel in the invitation
            // TODO: Join the user to all default channels for the community

            let summary = state.summary(&member, now);
            Success(Box::new(summary))
        }
        AddResult::AlreadyInCommunity => {
            let member = state.data.members.get(args.principal).unwrap();
            let summary = state.summary(member, now);
            AlreadyInCommunity(Box::new(summary))
        }
        AddResult::Blocked => Blocked,
    }
}
