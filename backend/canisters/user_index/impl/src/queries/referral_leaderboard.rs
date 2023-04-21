use crate::model::user_referral_leaderboards::MonthKey;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::referral_leaderboard::{Response::*, *};

#[query]
fn referral_leaderboard(args: Args) -> Response {
    read_state(|state| referral_leaderboard_impl(args, state))
}

fn referral_leaderboard_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let count = args.count as usize;

    let month = args.filter.map(|f| match f {
        LeaderboardFilter::Month(m) => MonthKey::new(m.year, m.month),
        LeaderboardFilter::CurrentMonth => MonthKey::from_timestamp(runtime_state.env.now()),
    });

    let top = if let Some(m) = month {
        runtime_state.data.user_referral_leaderboards.top_for_month(m, count)
    } else {
        runtime_state.data.user_referral_leaderboards.top_all_time(count)
    };

    let results = top
        .into_iter()
        .filter_map(|rs| {
            runtime_state
                .data
                .users
                .get_by_user_id(&rs.user_id)
                .map(|u| u.username.clone())
                .map(|u| ReferralStats {
                    user_id: rs.user_id,
                    username: u,
                    total_rewards_e8s: rs.total_rewards_e8s,
                    diamond_members: rs.diamond_members,
                    total_users: rs.total_users,
                })
        })
        .collect();

    if let Some(m) = month {
        Month(MonthSuccessResult {
            year: m.year(),
            month: m.month(),
            results,
        })
    } else {
        AllTime(results)
    }
}
