use crate::updates::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::remove_participant::{Response::*, *};
use ic_cdk_macros::update;
use types::{ParticipantsRemoved, UserId};
use user_canister::c2c_remove_from_group;

#[update]
#[trace]
async fn remove_participant(args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    let c2c_remove_from_group_args = c2c_remove_from_group::Args {
        removed_by: prepare_result.removed_by,
        blocked: false,
        group_name: prepare_result.group_name,
    };
    let response = user_canister_c2c_client::c2c_remove_from_group(args.user_id.into(), &c2c_remove_from_group_args).await;
    if let Err(error) = response {
        return InternalError(format!("{error:?}"));
    }

    mutate_state(|state| commit(prepare_result.removed_by, args.user_id, state));

    Success
}

struct PrepareResult {
    removed_by: UserId,
    group_name: String,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.user_id == args.user_id {
            Err(CannotRemoveSelf)
        } else if participant.role.can_remove_members(&runtime_state.data.permissions) {
            match runtime_state.data.participants.get_by_user_id(&args.user_id) {
                None => Err(UserNotInGroup),
                Some(participant_to_remove) => {
                    if participant_to_remove.role.can_be_removed() {
                        Ok(PrepareResult {
                            removed_by: participant.user_id,
                            group_name: runtime_state.data.name.clone(),
                        })
                    } else {
                        Err(CannotRemoveUser)
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

fn commit(removed_by: UserId, user_id: UserId, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();

    runtime_state.data.participants.remove(user_id);

    let event = ParticipantsRemoved {
        user_ids: vec![user_id],
        removed_by,
    };

    runtime_state
        .data
        .events
        .push_event(ChatEventInternal::ParticipantsRemoved(Box::new(event)), now);

    handle_activity_notification(runtime_state);
}
