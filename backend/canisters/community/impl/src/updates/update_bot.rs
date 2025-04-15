use crate::{activity_notifications::handle_activity_notification, mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::update_bot::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{BotGroupConfig, OCResult};

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    run_regular_jobs();

    if let Err(error) = mutate_state(|state| update_bot_impl(args, state)) {
        Error(error)
    } else {
        Success
    }
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    if state.data.update_bot(
        member.user_id,
        args.bot_id,
        BotGroupConfig {
            permissions: args.granted_permissions,
        },
        state.env.now(),
    ) {
        handle_activity_notification(state);
        Ok(())
    } else {
        Err(OCErrorCode::BotNotFound.into())
    }
}
