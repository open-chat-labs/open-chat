use crate::{model::events::CommunityEvent, mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use community_canister::make_private::{Response::*, *};
use group_index_canister::c2c_make_community_private;
use ic_cdk_macros::update;
use tracing::error;
use types::{CanisterId, CommunityId, GroupVisibilityChanged, UserId};

#[update]
#[trace]
async fn make_private(_args: Args) -> Response {
    let PrepareResult {
        group_index_canister_id,
        community_id,
        user_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_make_community_private_args = c2c_make_community_private::Args {};

    match group_index_canister_c2c_client::c2c_make_community_private(group_index_canister_id, &c2c_make_community_private_args)
        .await
    {
        Ok(response) => match response {
            c2c_make_community_private::Response::CommunityNotFound => {
                error!(%community_id, "Community not found in index");
                InternalError
            }
            c2c_make_community_private::Response::Success => {
                mutate_state(|state| commit(user_id, state));
                Success
            }
        },
        Err(_) => InternalError,
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    community_id: CommunityId,
    user_id: UserId,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            Err(UserSuspended)
        } else if !member.role.can_change_community_visibility() {
            Err(NotAuthorized)
        } else if !state.data.is_public {
            Err(AlreadyPrivate)
        } else {
            Ok(PrepareResult {
                group_index_canister_id: state.data.group_index_canister_id,
                community_id: state.env.canister_id().into(),
                user_id: member.user_id,
            })
        }
    } else {
        Err(UserNotInCommunity)
    }
}

fn commit(user_id: UserId, state: &mut RuntimeState) {
    state.data.is_public = false;

    let now = state.env.now();
    let event = GroupVisibilityChanged {
        now_public: false,
        changed_by: user_id,
    };

    state
        .data
        .events
        .push_event(CommunityEvent::VisibilityChanged(Box::new(event)), now);
}
