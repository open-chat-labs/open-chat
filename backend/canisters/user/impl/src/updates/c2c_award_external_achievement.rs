use crate::guards::caller_is_user_index;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_award_external_achievement::{Response::*, *};

#[update(guard = "caller_is_user_index", msgpack = true)]
#[trace]
fn c2c_award_external_achievement(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_award_external_achievement_impl(args, state))
}

fn c2c_award_external_achievement_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    if !state.data.award_external_achievement(args.name, args.chit_reward, now) {
        return AlreadyAwarded;
    }

    Success(SuccessResult {
        chit_earned: args.chit_reward,
        chit_balance: state.data.chit_events.balance_for_month_by_timestamp(now),
    })
}
