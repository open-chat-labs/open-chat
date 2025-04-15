use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::update_bot::*;

#[update(msgpack = true)]
#[trace]
fn update_bot(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| update_bot_impl(args, state)).into()
}

fn update_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_suspended()?;

    if state.data.bots.update(args.bot_id, args.granted_permissions, state.env.now()) {
        Ok(())
    } else {
        Err(OCErrorCode::BotNotFound.into())
    }
}
