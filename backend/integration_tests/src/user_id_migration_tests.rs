use crate::env::ENV;
use crate::utils::{metrics, tick_until};
use crate::{TestEnv, client};
use pocket_ic::PocketIc;
use std::collections::HashMap;
use std::ops::Deref;
use testing::rng::random_string;
use types::CanisterId;

// A new canister holds no old user ids, so the jobs which replace them complete straight away, and
// the canister tells its LocalUserIndex, which counts it among those which have finished
#[test]
fn local_user_index_counts_canisters_which_have_finished_replacing_old_user_ids() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
        platform_operator,
    } = wrapper.env();

    let user = client::register_diamond_user(env, canister_ids, *controller);

    // Other tests share the environment, so their canisters are already counted
    let kinds = ["groups", "communities", "multi_user_canisters"];
    let before: HashMap<(CanisterId, &str), u64> = canister_ids
        .subnets
        .iter()
        .flat_map(|s| kinds.map(|kind| (s.local_user_index, kind)))
        .map(|(local_user_index, kind)| ((local_user_index, kind), complete_count(env, local_user_index, kind)))
        .collect();

    let group_id = client::user::happy_path::create_group(env, &user, &random_string(), false, false);
    let community_id = client::user::happy_path::create_community(env, &user, &random_string(), false, vec![random_string()]);
    let other_user = client::register_user_in_new_multi_user_canister(env, canister_ids, *platform_operator);

    for (canister_id, kind) in [
        (CanisterId::from(group_id), "groups"),
        (CanisterId::from(community_id), "communities"),
        (other_user.canister(), "multi_user_canisters"),
    ] {
        // The canister has finished and its report has been sent
        let queue_length_key = if kind == "multi_user_canisters" {
            "queued_local_user_index_events"
        } else {
            "queued_local_index_events"
        };
        tick_until(env, |env| {
            let canister_metrics = metrics(env, canister_id);
            canister_metrics["user_id_migration_complete_reported"] == true && canister_metrics[queue_length_key] == 0
        });

        let canister_metrics = metrics(env, canister_id);
        let state_migration = if kind == "multi_user_canisters" {
            "their_user_ids_migration"
        } else {
            "user_ids_in_state_migration"
        };
        assert_eq!(canister_metrics[state_migration]["complete"], true, "{kind}");
        assert_eq!(canister_metrics["user_ids_in_events_migration"]["complete"], true, "{kind}");

        // And its LocalUserIndex counts it, the canister not having existed before. The report may
        // still be on its way, since the queue is empty as soon as it is sent.
        let local_user_index = canister_ids.local_user_index(env, canister_id);
        let before = before[&(local_user_index, kind)];
        tick_until(env, |env| complete_count(env, local_user_index, kind) > before);
    }
}

fn complete_count(env: &PocketIc, local_user_index: CanisterId, kind: &str) -> u64 {
    metrics(env, local_user_index)["user_id_migrations_complete"][kind]
        .as_u64()
        .unwrap()
}
