use crate::updates::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::block_user::{Response::*, *};
use ic_cdk_macros::update;
use types::{UserId, UsersBlocked};
use user_canister::c2c_remove_from_group;

#[update]
#[trace]
async fn block_user(args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_remove_from_group_args = c2c_remove_from_group::Args {
        removed_by: prepare_result.blocked_by,
        blocked: true,
    };
    let response = user_canister_c2c_client::c2c_remove_from_group(args.user_id.into(), &c2c_remove_from_group_args).await;
    if let Err(error) = response {
        return InternalError(format!("{:?}", error));
    }

    mutate_state(|state| commit(prepare_result.blocked_by, args.user_id, state));

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
                Some(participant_to_remove) => {
                    if participant_to_remove.role.can_be_removed() {
                        Ok(PrepareResult {
                            blocked_by: participant.user_id,
                        })
                    } else {
                        Err(CannotBlockUser)
                    }
                }
            }
        } else {
            Err(NotAuthorized)
        }
    } else {
        Err(CallerNotInGroup)
    }
}

fn commit(blocked_by: UserId, user_id: UserId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();

    runtime_state.data.participants.block(user_id);
    runtime_state.data.participants.remove(user_id);

    let event = UsersBlocked {
        user_ids: vec![user_id],
        blocked_by,
    };

    runtime_state
        .data
        .events
        .push_event(ChatEventInternal::UsersBlocked(Box::new(event)), now);

    handle_activity_notification(runtime_state);
}
