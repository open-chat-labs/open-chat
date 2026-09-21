use constants::DAY_IN_MS;
use local_user_index_canister::ChildCanisterType;
use serde::{Serialize, Serializer};
use std::cmp::Reverse;
use types::{CanisterId, Cycles, CyclesHumanReadable, CyclesTopUp, Milliseconds, TimestampMillis};

const MAX_ENTRIES: usize = 100;
const WINDOWS: [Milliseconds; 4] = [7 * DAY_IN_MS, 30 * DAY_IN_MS, 90 * DAY_IN_MS, 365 * DAY_IN_MS];

// The child canisters which have received the most cycles over each window, rebuilt periodically
#[derive(Serialize, Default)]
pub struct TopUpLeaderboards {
    pub timestamp: TimestampMillis,
    pub last_7_days: Vec<TopUpLeaderboardEntry>,
    pub last_30_days: Vec<TopUpLeaderboardEntry>,
    pub last_90_days: Vec<TopUpLeaderboardEntry>,
    pub last_year: Vec<TopUpLeaderboardEntry>,
}

#[derive(Serialize)]
pub struct TopUpLeaderboardEntry {
    pub canister_id: CanisterId,
    pub canister_type: ChildCanisterType,
    #[serde(serialize_with = "serialize_human_readable")]
    pub total: Cycles,
    pub count: u32,
}

impl TopUpLeaderboards {
    pub fn build<'a>(
        canisters: impl Iterator<Item = (CanisterId, ChildCanisterType, &'a [CyclesTopUp])>,
        now: TimestampMillis,
    ) -> TopUpLeaderboards {
        let mut windows: [Vec<(CanisterId, ChildCanisterType, Cycles, u32)>; 4] = Default::default();

        for (canister_id, canister_type, top_ups) in canisters {
            let mut totals = [(0, 0); 4];

            // Top ups are appended in date order, so walk backwards and stop at the widest window
            for top_up in top_ups.iter().rev() {
                let age = now.saturating_sub(top_up.date);
                if age > WINDOWS[3] {
                    break;
                }
                for (window, (total, count)) in WINDOWS.iter().zip(totals.iter_mut()) {
                    if age <= *window {
                        *total += top_up.amount;
                        *count += 1;
                    }
                }
            }

            for ((total, count), entries) in totals.into_iter().zip(windows.iter_mut()) {
                if count > 0 {
                    entries.push((canister_id, canister_type, total, count));
                }
            }
        }

        let [last_7_days, last_30_days, last_90_days, last_year] = windows.map(top_entries);

        TopUpLeaderboards {
            timestamp: now,
            last_7_days,
            last_30_days,
            last_90_days,
            last_year,
        }
    }
}

fn top_entries(mut entries: Vec<(CanisterId, ChildCanisterType, Cycles, u32)>) -> Vec<TopUpLeaderboardEntry> {
    entries.sort_unstable_by_key(|(_, _, total, _)| Reverse(*total));
    entries.truncate(MAX_ENTRIES);
    entries
        .into_iter()
        .map(|(canister_id, canister_type, total, count)| TopUpLeaderboardEntry {
            canister_id,
            canister_type,
            total,
            count,
        })
        .collect()
}

fn serialize_human_readable<S: Serializer>(cycles: &Cycles, serializer: S) -> Result<S::Ok, S::Error> {
    CyclesHumanReadable::from(*cycles).serialize(serializer)
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn totals_are_split_by_window_and_ranked() {
        let now = 1000 * DAY_IN_MS;
        let top_up = |days_ago: u64, amount: Cycles| CyclesTopUp {
            date: now - days_ago * DAY_IN_MS,
            amount,
        };
        let a = Principal::from_slice(&[1]);
        let b = Principal::from_slice(&[2]);
        let a_top_ups = vec![top_up(400, 1000), top_up(100, 50), top_up(20, 10), top_up(1, 5)];
        let b_top_ups = vec![top_up(60, 100), top_up(2, 1)];

        let leaderboards = TopUpLeaderboards::build(
            [
                (a, ChildCanisterType::User, a_top_ups.as_slice()),
                (b, ChildCanisterType::Group, b_top_ups.as_slice()),
            ]
            .into_iter(),
            now,
        );

        let summary = |entries: &[TopUpLeaderboardEntry]| -> Vec<(CanisterId, Cycles, u32)> {
            entries.iter().map(|e| (e.canister_id, e.total, e.count)).collect()
        };

        assert_eq!(summary(&leaderboards.last_7_days), vec![(a, 5, 1), (b, 1, 1)]);
        assert_eq!(summary(&leaderboards.last_30_days), vec![(a, 15, 2), (b, 1, 1)]);
        assert_eq!(summary(&leaderboards.last_90_days), vec![(b, 101, 2), (a, 15, 2)]);
        assert_eq!(summary(&leaderboards.last_year), vec![(b, 101, 2), (a, 65, 3)]);
    }

    #[test]
    fn window_boundaries_are_inclusive() {
        let now = 1000 * DAY_IN_MS;
        let a = Principal::from_slice(&[1]);
        let top_ups = vec![
            CyclesTopUp {
                date: now - 365 * DAY_IN_MS - 1,
                amount: 1000,
            },
            CyclesTopUp {
                date: now - 7 * DAY_IN_MS,
                amount: 1,
            },
        ];

        let leaderboards = TopUpLeaderboards::build([(a, ChildCanisterType::User, top_ups.as_slice())].into_iter(), now);

        assert_eq!(leaderboards.last_7_days[0].total, 1);
        assert_eq!(leaderboards.last_year[0].total, 1);
    }

    #[test]
    fn only_the_top_entries_are_kept() {
        let now = 1000 * DAY_IN_MS;
        let top_ups: Vec<_> = (1..=150u8)
            .map(|i| {
                (
                    Principal::from_slice(&[i]),
                    vec![CyclesTopUp {
                        date: now,
                        amount: i as Cycles,
                    }],
                )
            })
            .collect();

        let leaderboards =
            TopUpLeaderboards::build(top_ups.iter().map(|(c, t)| (*c, ChildCanisterType::User, t.as_slice())), now);

        assert_eq!(leaderboards.last_7_days.len(), MAX_ENTRIES);
        assert_eq!(leaderboards.last_7_days.first().unwrap().total, 150);
        assert_eq!(leaderboards.last_7_days.last().unwrap().total, 51);
    }
}
