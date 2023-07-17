use crate::{mutate_state, RuntimeState};
use rand::RngCore;
use std::time::Duration;
use types::{Activity, Milliseconds, TimestampMillis};
use utils::time::{DAY_IN_MS, HOUR_IN_MS, MINUTE_IN_MS};

const INTERVAL: Milliseconds = 30 * MINUTE_IN_MS;

pub fn start_job() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(INTERVAL), run);
}

fn run() {
    mutate_state(calculate_community_and_group_hotness);
}

fn calculate_community_and_group_hotness(state: &mut RuntimeState) {
    let now = state.env.now();

    for community in state.data.public_communities.iter_mut() {
        let random = state.env.rng().next_u32();
        let activity = community.activity();
        let score = calculate_hotness(
            &activity.last_day,
            &activity.last_hour,
            activity.member_count,
            community.created(),
            community.marked_active_until(),
            now,
            random,
        );
        community.set_hotness_score(score);
    }

    for group in state.data.public_groups.iter_mut() {
        let random = state.env.rng().next_u32();
        let activity = group.activity();
        let score = calculate_hotness(
            &activity.last_day,
            &activity.last_hour,
            activity.member_count,
            group.created(),
            group.marked_active_until(),
            now,
            random,
        );
        group.set_hotness_score(score);
    }
}

// This algorithm is a combination of new, popular, hot and random
// newness: how recently the community/group was created
// popularity: based on total members
// hotness: based on counts of recent messages and reactions
// random: to avoid always showing the same communities/groups
// Each of these factors is scaled to a value roughly between 0 and 1 and then combined as a weighted sum.
pub fn calculate_hotness(
    activity_last_day: &Activity,
    activity_last_hour: &Activity,
    member_count: u32,
    created: TimestampMillis,
    marked_active_until: TimestampMillis,
    now: TimestampMillis,
    random: u32,
) -> u32 {
    // Linearly scale newness between 0 and 1 based on how long ago the community/group was created capped at 10 days
    const NEWNESS_THRESHOLD_DAYS: f64 = 10.0;
    let newness = 1.0 - f64::min(NEWNESS_THRESHOLD_DAYS, ((now - created) as f64) / DAY_IN_MS as f64) / NEWNESS_THRESHOLD_DAYS;

    // Logarithmically scale popularity (roughly) between 0 and 1 based on the number of members
    // Communities/groups with 100,000 members would have a score of 1.0 and with 1M a score of 1.2
    let popularity = f64::log10(member_count as f64) / 5.0;

    // Calculate the hotness score based on the messages and reactions in the given period.
    // Because the activity data is only updated if the community is active, we need to scale the
    // activity score based on how long ago the community/group was active
    fn calculate_activity_score(activity: &Activity, threshold: f64, period: f64, time_since_activity: f64) -> f64 {
        let recency_multiplier = 1.0 - (f64::min(time_since_activity, period) / period);

        if recency_multiplier == 0.0 {
            return 0.0;
        }

        recency_multiplier
            * f64::log10(f64::min(
                threshold,
                (activity.messages * activity.message_unique_users) as f64
                    + (activity.reactions * activity.reaction_unique_users) as f64,
            ))
            / f64::log10(threshold)
    }

    // The hotness is a weighted sum of the activity in the last hour and the last day between 0 and 1
    let time_since_activity = now.saturating_sub(marked_active_until) as f64;
    let hotness = 0.5 * calculate_activity_score(activity_last_day, 100_000.0, DAY_IN_MS as f64, time_since_activity)
        + 0.5 * calculate_activity_score(activity_last_hour, 10_000.0, HOUR_IN_MS as f64, time_since_activity);

    // A random number beteen 0 and 1
    let random = random as f64 / u32::MAX as f64;

    // Weighted sum of new, popular, hot and random
    ((0.5 * newness + popularity + hotness + random) * 1_000_000.0) as u32
}
