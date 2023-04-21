use crate::model::user_referral_leaderboards::MonthKey;
use crate::{read_state, RuntimeState};
use ic_cdk_macros::query;
use user_index_canister::user_referral_leaderboard::{Response::*, *};

#[query]
fn user_referral_leaderboard(args: Args) -> Response {
    read_state(|state| user_referral_leaderboard_impl(args, state))
}

fn user_referral_leaderboard_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    let count = args.count as usize;

    let top = if args.all_time {
        runtime_state.data.user_referral_leaderboards.top_all_time(count)
    } else if let Some((y, m)) = args.year.and_then(|y| args.month.map(|m| (y, m))) {
        runtime_state
            .data
            .user_referral_leaderboards
            .top_for_month(MonthKey::new(y, m), count)
    } else {
        let now = runtime_state.env.now();
        runtime_state
            .data
            .user_referral_leaderboards
            .top_for_month(MonthKey::from_timestamp(now), count)
    };

    let result = top
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

    Success(result)
}
