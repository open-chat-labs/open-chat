use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::c2c_assume_super_admin;
use ic_cdk_macros::update;
use tracing::error;
use types::ChatId;
use user_canister::assume_group_super_admin::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn assume_group_super_admin(args: Args) -> Response {
    run_regular_jobs();

    if let Err(response) = read_state(|state| prepare(&args.chat_id, state)) {
        return response;
    }

    let c2c_args = c2c_assume_super_admin::Args {
        correlation_id: args.correlation_id,
    };
    match group_canister_c2c_client::c2c_assume_super_admin(args.chat_id.into(), &c2c_args).await {
        Ok(response) => match response {
            c2c_assume_super_admin::Response::Success => {
                mutate_state(|state| commit(&args.chat_id, state));
                Success
            }
            c2c_assume_super_admin::Response::CallerNotInGroup => {
                let message = "INCONSISTENT: Caller has reference to group in user canister but group does not contain caller";
                error!(message);
                InternalError(message.to_owned())
            }
            c2c_assume_super_admin::Response::AlreadyOwner => AlreadyOwner,
            c2c_assume_super_admin::Response::NotSuperAdmin => {
                let message = "INCONSISTENT: User canister thinks user is_super_admin but group does not";
                error!(message);
                InternalError(message.to_owned())
            }
            c2c_assume_super_admin::Response::InternalError(error) => {
                InternalError(format!("Failed to call 'group::c2c_assume_super_admin': {error:?}"))
            }
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn prepare(group_id: &ChatId, runtime_state: &RuntimeState) -> Result<(), Response> {
    if !runtime_state.data.is_super_admin {
        return Err(NotSuperAdmin);
    }

    match runtime_state.data.group_chats.get(group_id) {
        Some(group) => {
            if group.is_super_admin {
                Err(AlreadySuperAdmin)
            } else {
                Ok(())
            }
        }
        None => Err(CallerNotInGroup),
    }
}

fn commit(group_id: &ChatId, runtime_state: &mut RuntimeState) {
    if let Some(group) = runtime_state.data.group_chats.get_mut(group_id) {
        group.is_super_admin = true;
    }
}
