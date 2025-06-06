use std::collections::HashMap;
use types::{CanisterId, UpgradesFilter};

// Used when upgrading canisters which are 2 levels below in the hierarchy
// Essentially, user canisters (UserIndex -> LocalUserIndex -> User) and group canisters.
// The return value is the list of child canisters to forward the upgrade request onto along with
// the corresponding filter for each canister.
pub fn build_filter_map<F: Fn(CanisterId) -> Option<CanisterId>>(
    index_canisters: Vec<CanisterId>,
    filter: UpgradesFilter,
    get_index_canister: F,
) -> Vec<(CanisterId, UpgradesFilter)> {
    let mut map: HashMap<CanisterId, UpgradesFilter> = HashMap::new();

    let default = UpgradesFilter {
        versions: filter.versions.clone(),
        active_since: filter.active_since,
        ..Default::default()
    };

    if filter.include.is_empty() || !filter.versions.is_empty() {
        for canister_id in index_canisters.iter() {
            map.insert(*canister_id, default.clone());
        }
    }

    for canister_id in filter.include {
        if index_canisters.contains(&canister_id) {
            map.entry(canister_id).or_insert(default.clone());
        } else if let Some(index) = get_index_canister(canister_id) {
            map.entry(index).or_insert(default.clone()).include.insert(canister_id);
        }
    }

    for canister_id in filter.exclude {
        // If the index canister is in the map, remove it
        if map.remove(&canister_id).is_none() {
            // Else, find the relevant index canister and add to its exclusion list
            if let Some(index) = get_index_canister(canister_id) {
                map.entry(index).and_modify(|e| {
                    e.exclude.insert(canister_id);
                });
            }
        }
    }

    map.into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use itertools::Itertools;

    #[test]
    fn include() {
        let filter1 = UpgradesFilter {
            include: [index_canister_id(1)].into_iter().collect(),
            ..Default::default()
        };
        let expected1 = vec![(index_canister_id(1), UpgradesFilter::default())];

        let filter2 = UpgradesFilter {
            include: [child_canister_id(1, 2)].into_iter().collect(),
            ..Default::default()
        };
        let expected2 = vec![(
            index_canister_id(1),
            UpgradesFilter {
                include: [child_canister_id(1, 2)].into_iter().collect(),
                ..Default::default()
            },
        )];

        let filter3 = UpgradesFilter {
            include: [index_canister_id(1), child_canister_id(2, 1)].into_iter().collect(),
            ..Default::default()
        };
        let expected3 = vec![
            (index_canister_id(1), UpgradesFilter::default()),
            (
                index_canister_id(2),
                UpgradesFilter {
                    include: [child_canister_id(2, 1)].into_iter().collect(),
                    ..Default::default()
                },
            ),
        ];

        run_test(filter1, expected1);
        run_test(filter2, expected2);
        run_test(filter3, expected3);
    }

    #[test]
    fn exclude() {
        let filter1 = UpgradesFilter {
            exclude: [index_canister_id(1)].into_iter().collect(),
            ..Default::default()
        };
        let expected1 = vec![
            (index_canister_id(0), UpgradesFilter::default()),
            (index_canister_id(2), UpgradesFilter::default()),
        ];

        let filter2 = UpgradesFilter {
            exclude: [child_canister_id(0, 2)].into_iter().collect(),
            ..Default::default()
        };
        let expected2 = vec![
            (
                index_canister_id(0),
                UpgradesFilter {
                    exclude: [child_canister_id(0, 2)].into_iter().collect(),
                    ..Default::default()
                },
            ),
            (index_canister_id(1), UpgradesFilter::default()),
            (index_canister_id(2), UpgradesFilter::default()),
        ];

        run_test(filter1, expected1);
        run_test(filter2, expected2);
    }

    #[test]
    fn include_and_exclude() {
        let filter1 = UpgradesFilter {
            include: [index_canister_id(2)].into_iter().collect(),
            exclude: [child_canister_id(2, 0)].into_iter().collect(),
            ..Default::default()
        };
        let expected1 = vec![(
            index_canister_id(2),
            UpgradesFilter {
                exclude: [child_canister_id(2, 0)].into_iter().collect(),
                ..Default::default()
            },
        )];

        run_test(filter1, expected1);
    }

    fn run_test(filter: UpgradesFilter, expected: Vec<(CanisterId, UpgradesFilter)>) {
        let map = setup_map();
        let index_canister_ids: Vec<_> = map.values().unique().copied().collect();

        let mut result = build_filter_map(index_canister_ids, filter, |c| map.get(&c).copied());
        result.sort_unstable_by_key(|(c, _)| *c);

        assert_eq!(result, expected);
    }

    fn setup_map() -> HashMap<CanisterId, CanisterId> {
        let mut map = HashMap::new();
        for i in 0..3 {
            for j in 0..3 {
                map.insert(child_canister_id(i, j), index_canister_id(i));
            }
        }
        map
    }

    fn index_canister_id(i: u8) -> CanisterId {
        CanisterId::from_slice(&[i])
    }

    fn child_canister_id(i: u8, j: u8) -> CanisterId {
        CanisterId::from_slice(&[i, j])
    }
}
