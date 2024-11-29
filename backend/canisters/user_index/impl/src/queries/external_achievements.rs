use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use itertools::max;
use types::TimestampMillis;
use user_index_canister::external_achievements::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn external_achievements(args: Args) -> Response {
    read_state(|state| external_achievements_impl(args, state))
}

fn external_achievements_impl(args: Args, state: &RuntimeState) -> Response {
    let mut added_or_updated = Vec::new();
    let mut last_updated: TimestampMillis = 0;

    for (id, achievement) in state.data.external_achievements.iter() {
        let add = achievement.registered > args.updates_since;
        let updated = achievement.budget_exhausted.map_or(false, |ts| ts > args.updates_since);

        last_updated = max([
            last_updated,
            achievement.registered,
            achievement.budget_exhausted.unwrap_or_default(),
        ])
        .unwrap();

        if add || updated {
            let a = ExternalAchievement {
                id: *id,
                name: achievement.name.clone(),
                url: achievement.url.clone(),
                chit_reward: achievement.chit_reward,
                expires: achievement.expires,
                budget_exhausted: achievement.budget_exhausted.is_some(),
            };

            added_or_updated.push(a);
        }
    }

    if added_or_updated.is_empty() {
        SuccessNoUpdates
    } else {
        Success(SuccessResult {
            last_updated,
            added_or_updated,
        })
    }
}
