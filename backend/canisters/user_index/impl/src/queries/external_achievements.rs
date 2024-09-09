use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use user_index_canister::external_achievements::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn external_achievements(args: Args) -> Response {
    read_state(|state| external_achievements_impl(args, state))
}

fn external_achievements_impl(args: Args, state: &RuntimeState) -> Response {
    let mut achievements_added = Vec::new();
    let mut achievements_removed = Vec::new();

    for achievement in state.data.external_achievements.iter() {
        let add = achievement.registered > args.updates_since;
        let remove = achievement.expires > args.updates_since
            || achievement.budget_exhausted.map_or(false, |ts| ts > args.updates_since);

        if add ^ remove {
            let a = ExternalAchievement {
                name: achievement.name.clone(),
                logo_id: achievement.logo.id,
                chit_reward: achievement.chit_reward,
            };

            if add {
                achievements_added.push(a);
            } else {
                achievements_removed.push(a);
            }
        }
    }

    if achievements_added.is_empty() && achievements_removed.is_empty() {
        SuccessNoUpdates
    } else {
        Success(SuccessResult {
            timestamp: state.env.now(),
            achievements_added,
            achievements_removed,
        })
    }
}
