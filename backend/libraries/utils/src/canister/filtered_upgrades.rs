use std::collections::HashMap;
use types::CanisterId;

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

    let include_all = filter.include.is_empty();

    if include_all {
        for canister_id in index_canisters {
            map.insert(canister_id, UpgradesFilter::default());
        }
    } else {
        for canister_id in filter.include {
            if index_canisters.contains(&canister_id) {
                map.entry(canister_id).or_default();
            } else if let Some(index) = get_index_canister(canister_id) {
                map.entry(index).or_default().include.push(canister_id);
            }
        }
    }

    for canister_id in filter.exclude {
        // If the index canister is in the map, remove it
        if map.remove(&canister_id).is_none() {
            // Else, find the relevant index canister and add to its exclusion list
            if let Some(index) = get_index_canister(canister_id) {
                map.entry(index).and_modify(|e| e.exclude.push(canister_id));
            }
        }
    }

    map.into_iter().collect()
}

#[derive(Default)]
pub struct UpgradesFilter {
    pub include: Vec<CanisterId>,
    pub exclude: Vec<CanisterId>,
}
