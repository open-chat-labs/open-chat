use crate::read_state;
use std::time::Duration;
use tracing::{error, info};
use types::CanisterId;

// One-off: hands each old LocalGroupIndex over to the LocalUserIndex on its subnet, which reclaims
// the canisters the old LocalGroupIndex alone still controls, refunds their cycles and deletes them,
// then does the same with the old LocalGroupIndex itself. They were in the old LocalGroupIndex's
// canister pool, which was moved into the LocalUserIndex's without their controllers changing, so
// the LocalUserIndex could neither use them nor refund their cycles. The lists are from the IC
// dashboard, each canister checked against the certified state on 5 Oct 2026 to be controlled by the
// old LocalGroupIndex alone and to have no code. `lrqxq` has none, but is still handed over so that
// its own cycles are refunded. Release this after the LocalUserIndexes, which must already have
// `c2c_reclaim_old_local_group_index`.
// TODO remove after the release containing this has been deployed
const OLD_LOCAL_GROUP_INDEXES: [(&str, &str, &str); 3] = [
    (
        "suaf3-hqaaa-aaaaf-bfyoa-cai",
        "nq4qv-wqaaa-aaaaf-bhdgq-cai",
        include_str!("old_local_group_indexes/suaf3-hqaaa-aaaaf-bfyoa-cai.txt"),
    ),
    (
        "ainth-qaaaa-aaaar-aaaba-cai",
        "aboy3-giaaa-aaaar-aaaaq-cai",
        include_str!("old_local_group_indexes/ainth-qaaaa-aaaar-aaaba-cai.txt"),
    ),
    ("lrqxq-2qaaa-aaaac-aadla-cai", "lyt4m-myaaa-aaaac-aadkq-cai", ""),
];

struct OldLocalGroupIndex {
    canister_id: CanisterId,
    local_user_index: CanisterId,
    canister_ids: Vec<CanisterId>,
}

fn old_local_group_indexes() -> Vec<OldLocalGroupIndex> {
    OLD_LOCAL_GROUP_INDEXES
        .iter()
        .map(|(canister_id, local_user_index, canister_ids)| OldLocalGroupIndex {
            canister_id: CanisterId::from_text(canister_id).unwrap(),
            local_user_index: CanisterId::from_text(local_user_index).unwrap(),
            canister_ids: canister_ids.lines().map(|c| CanisterId::from_text(c).unwrap()).collect(),
        })
        .collect()
}

// Run from a timer because it makes c2c calls, which can't be made from post_upgrade
pub(crate) fn start() {
    if read_state(|state| state.data.test_mode) {
        return;
    }
    ic_cdk_timers::set_timer(Duration::ZERO, async {
        for old in old_local_group_indexes() {
            hand_over(old).await;
        }
    });
}

// Makes the LocalUserIndex a controller of the old LocalGroupIndex, keeping this GroupIndex as one
// too, then asks it to reclaim the canisters
async fn hand_over(old: OldLocalGroupIndex) {
    let canister_id = old.canister_id;
    let local_user_index = old.local_user_index;
    if !read_state(|state| state.data.local_index_map.contains_key(&local_user_index)) {
        error!(%canister_id, %local_user_index, "LocalUserIndex not found, old LocalGroupIndex not handed over");
        return;
    }

    let this_canister_id = ic_cdk::api::canister_self();
    if let Err(error) = utils::canister::set_controllers(canister_id, vec![this_canister_id, local_user_index]).await {
        error!(%canister_id, ?error, "Failed to hand the old LocalGroupIndex over to its LocalUserIndex");
        return;
    }

    let count = old.canister_ids.len();
    read_state(|state| {
        state.data.fire_and_forget_handler.send(
            local_user_index,
            "c2c_reclaim_old_local_group_index_msgpack",
            msgpack::serialize_then_unwrap(local_user_index_canister::c2c_reclaim_old_local_group_index::Args {
                local_group_index_canister_id: canister_id,
                canister_ids: old.canister_ids,
            }),
        )
    });
    info!(%canister_id, %local_user_index, count, "Handed the old LocalGroupIndex over to its LocalUserIndex");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn lists_parse_and_hold_the_canisters_checked_on_chain() {
        let old = old_local_group_indexes();

        assert_eq!(
            old.iter().map(|o| o.canister_ids.len()).collect::<Vec<_>>(),
            vec![881, 538, 0]
        );

        let mut all = HashSet::new();
        for o in &old {
            for canister_id in &o.canister_ids {
                assert!(all.insert(*canister_id), "{canister_id} is listed twice");
            }
        }
        for o in &old {
            assert!(!all.contains(&o.canister_id));
            assert!(!all.contains(&o.local_user_index));
        }
    }
}
