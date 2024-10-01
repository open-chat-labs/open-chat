use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use std::collections::HashSet;
use types::{CurrentUserSummary, UserSummaryV2};
use user_index_canister::users::{Response::*, *};
use utils::time::MonthKey;

#[query(candid = true, msgpack = true)]
fn users(args: Args) -> Response {
    read_state(|state| users_impl(args, state))
}

fn users_impl(args: Args, state: &RuntimeState) -> Response {
    let now = state.env.now();
    let caller = state.env.caller();

    let mut user_ids = HashSet::new();
    let mut users = Vec::new();
    let mut deleted = Vec::new();
    let mut current_user: Option<CurrentUserSummary> = None;

    if let Some(u) = state.data.users.get_by_principal(&caller) {
        if let Some(updated_since) = args
            .user_groups
            .iter()
            .find(|g| g.users.contains(&u.user_id))
            .map(|g| g.updated_since)
        {
            if u.date_updated > updated_since || u.chit_updated > updated_since {
                let suspension_details = u.suspension_details.as_ref().map(|d| d.into());

                current_user = Some(CurrentUserSummary {
                    user_id: u.user_id,
                    username: u.username.clone(),
                    display_name: u.display_name.clone(),
                    avatar_id: u.avatar_id,
                    is_bot: u.user_type.is_bot(),
                    is_platform_moderator: state.data.platform_moderators.contains(&u.user_id),
                    is_platform_operator: state.data.platform_operators.contains(&u.user_id),
                    suspension_details,
                    is_suspected_bot: state.data.users.is_suspected_bot(&u.user_id),
                    diamond_membership_details: u.diamond_membership_details.hydrate(now),
                    diamond_membership_status: u.diamond_membership_details.status_full(now),
                    moderation_flags_enabled: u.moderation_flags_enabled,
                    is_unique_person: u.unique_person_proof.is_some(),
                });
            }
        }
    }

    let now_month = MonthKey::from_timestamp(now);
    for group in args.user_groups {
        let updated_since = group.updated_since;

        for user_id in group.users {
            if !user_ids.insert(user_id) {
                continue;
            }
            if let Some(user) = state.data.users.get_by_user_id(&user_id).filter(|u| {
                (u.date_updated > updated_since
                    || u.chit_updated > updated_since
                    || (now > u.streak_ends && u.streak_ends > updated_since))
                    && u.principal != caller
            }) {
                users.push(UserSummaryV2 {
                    user_id,
                    stable: (user.date_updated > updated_since).then(|| user.to_summary_stable(now)),
                    volatile: Some(user.to_summary_volatile(now, now_month)),
                });
                // TODO maybe convert `deleted_users` to a HashMap?
            } else if state.data.users.is_deleted(&user_id) {
                deleted.push(user_id)
            }
        }
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
                .map(|u| u.to_summary_v2(now, now_month)),
        );
    }

    Success(Result {
        users,
        current_user,
        deleted,
        timestamp: now,
    })
}
