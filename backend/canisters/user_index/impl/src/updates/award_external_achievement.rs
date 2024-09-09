use crate::model::external_achievements::ExternalAchievementInternal;
use crate::{mutate_state, read_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use user_canister::c2c_award_external_achievement;
use user_index_canister::award_external_achievement::{Response::*, *};

#[update(candid = true, msgpack = true)]
#[trace]
async fn award_external_achievement(args: Args) -> Response {
    let achievement = match read_state(|state| prepare(&args, state)) {
        Ok(a) => a,
        Err(response) => return response,
    };

    let c2c_args = c2c_award_external_achievement::Args {
        name: args.name.clone(),
        chit_reward: achievement.chit_reward,
    };

    match user_canister_c2c_client::c2c_award_external_achievement(args.user_id.into(), &c2c_args).await {
        Ok(c2c_award_external_achievement::Response::Success(res)) => {
            mutate_state(|state| commit(args, state));
            Success(SuccessResult {
                chit_earned: res.chit_earned,
                chit_balance: res.chit_balance,
            })
        }
        Ok(c2c_award_external_achievement::Response::AlreadyAwarded) => AlreadyAwarded,
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<ExternalAchievementInternal, Response> {
    if let Some(achievement) = state.data.external_achievements.get(&args.name) {
        let caller = state.env.caller();
        if achievement.canister_id != caller {
            Err(InvalidCaller)
        } else if achievement.expires >= state.env.now() {
            Err(Expired)
        } else if achievement.remaining_chit_budget < achievement.chit_reward {
            Err(InsufficientBudget)
        } else {
            Ok(achievement.clone())
        }
    } else {
        Err(NotFound)
    }
}

fn commit(args: Args, state: &mut RuntimeState) {
    state.data.external_achievements.award(&args.name, state.env.now());
}
