use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use user_index_canister::register_external_achievement::{Response::*, *};
use user_index_canister::ExternalAchievementInitial;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
fn register_external_achievement(args: Args) -> Response {
    mutate_state(|state| register_external_achievement_impl(args, state))
}

fn register_external_achievement_impl(args: Args, state: &mut RuntimeState) -> Response {
    state.data.external_achievements.register(
        ExternalAchievementInitial {
            id: args.id,
            name: args.name,
            logo: args.logo,
            url: args.url,
            canister_id: args.canister_id,
            chit_reward: args.chit_reward,
            expires: args.expires,
            chit_budget: args.chit_budget,
        },
        state.env.now(),
    );

    Success
}
