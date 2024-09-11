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
    let mut achievements_added = Vec::new();
    let mut achievements_removed = Vec::new();
    let mut latest_update: TimestampMillis = 0;
    let now = state.env.now();

    for (id, achievement) in state.data.external_achievements.iter() {
        let add = achievement.registered > args.updates_since;
        let remove = (achievement.expires <= now && achievement.expires > args.updates_since)
            || achievement.budget_exhausted.map_or(false, |ts| ts > args.updates_since);

        latest_update = max([
            latest_update,
            achievement.registered,
            achievement.expires,
            achievement.budget_exhausted.unwrap_or_default(),
        ])
        .unwrap();

        if add ^ remove {
            let a = ExternalAchievement {
                id: *id,
                name: achievement.name.clone(),
                url: achievement.url.clone(),
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
            last_updated: latest_update,
            achievements_added,
            achievements_removed,
        })
    }
}
