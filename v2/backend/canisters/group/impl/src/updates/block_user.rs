use crate::model::events::GroupChatEventInternal;
use crate::updates::handle_activity_notification;
use crate::{RuntimeState, RUNTIME_STATE};
use group_canister::block_user::{Response::*, *};
use ic_cdk_macros::update;
use log::error;
use types::{ParticipantsRemoved, UserId};
use user_canister::c2c_remove_from_group;

#[update]
async fn block_user(args: Args) -> Response {
    let prepare_result = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let response = user_canister_client::c2c_remove_from_group(args.user_id.into(), &c2c_remove_from_group::Args {}).await;
    if let Err(error) = response {
        error!("{:?}", error);
        return InternalError(format!("{:?}", error));
    }

    RUNTIME_STATE.with(|state| commit(prepare_result.blocked_by, args.user_id, state.borrow_mut().as_mut().unwrap()));

    handle_activity_notification();

    Success
}

struct PrepareResult {
    blocked_by: UserId,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if !runtime_state.data.is_public {
        Err(GroupNotPublic)
    } else if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.user_id == args.user_id {
            Err(CannotBlockSelf)
        } else if participant.role.can_block_user() {
            match runtime_state.data.participants.get_by_user_id(&args.user_id) {
                None => Err(UserNotInGroup),
                Some(_) => Ok(PrepareResult {
                    blocked_by: participant.user_id,
                }),
            }
        } else {
            Err(NotAuthorized)
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(removed_by: UserId, user_id: UserId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();

    runtime_state.data.participants.block(user_id);
    runtime_state.data.participants.remove(user_id);

    let event = ParticipantsRemoved {
        user_ids: vec![user_id],
        removed_by,
    };

    runtime_state
        .data
        .events
        .push_event(GroupChatEventInternal::ParticipantsRemoved(event), now);
}
