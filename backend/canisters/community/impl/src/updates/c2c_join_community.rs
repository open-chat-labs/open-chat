use crate::activity_notifications::handle_activity_notification;
use crate::guards::caller_is_user_index_or_local_user_index;
use crate::model::events::CommunityEventInternal;
use crate::model::members::AddResult;
use crate::updates::c2c_join_channel::join_channel_impl;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use community_canister::c2c_join_community::{Response::*, *};
use gated_groups::{check_if_passes_gate, CheckIfPassesGateResult};
use types::{AccessGate, CanisterId, ChannelId, MemberJoined, UsersUnblocked};

#[update_msgpack(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
async fn c2c_join_community(args: Args) -> Response {
    run_regular_jobs();

    join_community(args).await
}

pub(crate) async fn join_community(args: Args) -> Response {
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

    match mutate_state(|state| join_community_impl(&args, state)) {
        Ok(default_channel_ids) => {
            futures::future::join_all(default_channel_ids.into_iter().map(|c| join_channel_impl(c, args.principal))).await;
            read_state(|state| {
                if let Some(member) = state.data.members.get_by_user_id(&args.user_id) {
                    let now = state.env.now();
                    Success(Box::new(state.summary(Some(member), now)))
                } else {
                    InternalError("User not found in community".to_string())
                }
            })
        }
        Err(response) => response,
    }
}

fn is_permitted_to_join(
    invite_code: Option<u64>,
    user_principal: Principal,
    state: &RuntimeState,
) -> Result<Option<(AccessGate, CanisterId)>, Response> {
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

    match state.data.members.add(args.user_id, args.principal, now) {
        AddResult::Success(_) => {
            let invitation = state.data.invited_users.remove(&args.user_id, now);

            state.data.events.push_event(
                CommunityEventInternal::MemberJoined(Box::new(MemberJoined {
                    user_id: args.user_id,
                    invited_by: invitation.map(|i| i.invited_by),
                })),
                now,
            );

            handle_activity_notification(state);

            Ok(state.data.channels.default_channel_ids())
        }
        AddResult::AlreadyInCommunity => {
            let member = state.data.members.get_by_user_id(&args.user_id).unwrap();
            let summary = state.summary(Some(member), now);
            Err(AlreadyInCommunity(Box::new(summary)))
        }
        AddResult::Blocked => Err(UserBlocked),
    }
}
