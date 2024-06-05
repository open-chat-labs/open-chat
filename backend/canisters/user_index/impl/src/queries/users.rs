use crate::{read_state, RuntimeState};
use ic_cdk::query;
use std::collections::HashSet;
use types::{CurrentUserSummary, UserSummaryV2};
use user_index_canister::users::{Response::*, *};
use utils::time::{today, tomorrow};

#[query]
fn users(args: Args) -> Response {
    read_state(|state| users_impl(args, state))
}

fn users_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();

    let mut user_ids = HashSet::new();
    let mut users = Vec::new();
    let mut current_user: Option<CurrentUserSummary> = None;

    for group in args.user_groups {
        let updated_since = group.updated_since;
        users.extend(
            group
                .users
                .into_iter()
                .filter_map(|u| state.data.users.get_by_user_id(&u))
                .filter(move |u| u.date_updated > updated_since || u.date_updated_volatile > updated_since)
                .filter(|u| user_ids.insert(u.user_id))
                .map(|u| UserSummaryV2 {
                    user_id: u.user_id,
                    stable: (u.date_updated > updated_since).then(|| u.to_summary_stable(now)),
                    volatile: (u.date_updated_volatile > updated_since).then(|| u.to_summary_volatile(now)),
                }),
        );
    }

    if let Some(ts) = args.users_suspended_since {
        users.extend(
            state
                .data
                .users
                .iter_suspended_or_unsuspended_users(ts)
                .rev()
                .take(100)
                .filter(|u| user_ids.insert(*u))
                .filter_map(|u| state.data.users.get_by_user_id(&u))
                .map(|u| u.to_summary_v2(now)),
        );
    }

    if let Some(ts) = args.current_user_updated_since {
        let caller = state.env.caller();
        if let Some(u) = state.data.users.get_by_principal(&caller) {
            if u.date_updated > ts || u.date_updated_volatile > ts {
                let suspension_details = u.suspension_details.as_ref().map(|d| d.into());

                current_user = Some(CurrentUserSummary {
                    user_id: u.user_id,
                    username: u.username.clone(),
                    display_name: u.display_name.clone(),
                    avatar_id: u.avatar_id,
                    is_bot: u.is_bot,
                    is_platform_moderator: state.data.platform_moderators.contains(&u.user_id),
                    is_platform_operator: state.data.platform_operators.contains(&u.user_id),
                    suspension_details,
                    is_suspected_bot: state.data.users.is_suspected_bot(&u.user_id),
                    diamond_membership_details: u.diamond_membership_details.hydrate(now),
                    diamond_membership_status: u.diamond_membership_details.status_full(now),
                    moderation_flags_enabled: u.moderation_flags_enabled,
                    chit_balance: u.chit_balance,
                    streak: u.streak.days(now),
                    next_daily_claim: if u.streak.can_claim(now) { today(now) } else { tomorrow(now) },
                });
            }
        }
    }

    Success(Result {
        users,
        current_user,
        timestamp: now,
    })
}
