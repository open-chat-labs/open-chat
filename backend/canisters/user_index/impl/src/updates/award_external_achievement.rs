use crate::{RuntimeState, model::external_achievements::AwardResult, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::{ExternalAchievementAwarded, UserIndexEvent};
use oc_error_codes::OCErrorCode;
use user_index_canister::award_external_achievement::{Response::*, *};

#[update(candid = true)]
#[trace]
fn award_external_achievement(args: Args) -> Response {
    mutate_state(|state| award_external_achievement_impl(args, state))
}

fn award_external_achievement_impl(args: Args, state: &mut RuntimeState) -> Response {
    // Only users are awarded achievements, and every user has an indexed id now that all have been
    // migrated to MultiUser canisters, so any other id, eg. a User canister's which a user had
    // before, is refused before it uses up any of the budget
    if !args.user_id.is_indexed() || state.data.users.get_by_user_id(&args.user_id).is_none() {
        return Error(OCErrorCode::TargetUserNotFound.into());
    }

    let result = match state.data.external_achievements.award(
        args.achievement_id,
        args.user_id,
        state.env.caller(),
        state.env.now(),
        state.data.test_mode && state.is_caller_governance_principal(),
    ) {
        AwardResult::Success(r) => r,
        AwardResult::NotFound => return NotFound,
        AwardResult::AlreadyAwarded => return AlreadyAwarded,
        AwardResult::InsufficientBudget => return InsufficientBudget,
        AwardResult::InvalidCaller => return InvalidCaller,
        AwardResult::Expired => return Expired,
    };

    state.push_event_to_local_user_index(
        args.user_id,
        UserIndexEvent::ExternalAchievementAwarded(ExternalAchievementAwarded {
            id: args.achievement_id,
            user_id: args.user_id,
            name: result.name,
            chit_reward: result.chit_reward,
        }),
    );

    Success(SuccessResult {
        remaining_chit_budget: result.remaining_chit_budget,
    })
}
