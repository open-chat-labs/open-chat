use crate::env::ENV;
use crate::utils::{metrics, tick_many};
use crate::{TestEnv, client, wasms};
use pocket_ic::PocketIc;
use std::collections::BTreeMap;
use std::ops::Deref;
use testing::rng::random_string;
use types::{BuildVersion, CanisterId, CanisterWasm, ChatEvent};

const STABLE_MEMORY_MAP: u8 = 3;
const STABLE_MEMORY_MAP_SMALL_ENTRIES: u8 = 4;

#[test]
fn stable_memory_maps_survive_upgrades() {
    let mut wrapper = ENV.deref().get();
    let TestEnv {
        env,
        canister_ids,
        controller,
    } = wrapper.env();

    let user1 = client::register_diamond_user(env, canister_ids, *controller);
    let user2 = client::register_user(env, canister_ids);
    let group_id = client::user::happy_path::create_group(env, &user1, &random_string(), false, true);
    let community_id = client::user::happy_path::create_community(env, &user1, &random_string(), false, vec![random_string()]);
    let channel_id = client::community::happy_path::create_channel(env, user1.principal, community_id, false, random_string());

    let direct_event = client::user::happy_path::send_text_message(env, &user1, user2.user_id, "direct", None).event_index;
    let group_event = client::group::happy_path::send_text_message(env, &user1, group_id, None, "group", None).event_index;
    let channel_event =
        client::community::happy_path::send_text_message(env, &user1, community_id, channel_id, None, "channel", None)
            .event_index;
    tick_many(env, 3);

    let canisters: [CanisterId; 3] = [user1.canister(), group_id.into(), community_id.into()];
    for canister_id in canisters {
        assert_stable_memory_maps_initialised(env, canister_id);
    }

    let version = BuildVersion::new(0, 0, 1);
    let wasm = |module: &CanisterWasm| CanisterWasm {
        version,
        module: module.module.clone(),
    };
    client::user_index::happy_path::upgrade_user_canister_wasm(env, *controller, canister_ids.user_index, wasm(&wasms::USER));
    client::group_index::happy_path::upgrade_group_canister_wasm(
        env,
        *controller,
        canister_ids.group_index,
        wasm(&wasms::GROUP),
    );
    client::group_index::happy_path::upgrade_community_canister_wasm(
        env,
        *controller,
        canister_ids.group_index,
        wasm(&wasms::COMMUNITY),
    );
    tick_many(env, 30);

    for canister_id in canisters {
        assert_eq!(wasm_version(env, canister_id), version, "{canister_id} not upgraded");
        assert_stable_memory_maps_initialised(env, canister_id);
    }

    let direct = client::user::happy_path::events_by_index(env, &user1, user2.user_id, vec![direct_event]);
    let group = client::group::happy_path::events_by_index(env, &user1, group_id, vec![group_event]);
    let channel = client::community::happy_path::events_by_index(env, &user1, community_id, channel_id, vec![channel_event]);
    for response in [direct, group, channel] {
        assert_eq!(response.events.len(), 1);
        assert!(matches!(response.events[0].event, ChatEvent::Message(_)));
    }

    // Upgrading every canister to a new version would break later tests which draw this env
    wrapper.discard();
}

// Creating a map writes its header, so each map's memory is non-empty once it has been initialised
fn assert_stable_memory_maps_initialised(env: &PocketIc, canister_id: CanisterId) {
    let sizes: BTreeMap<u8, u64> = serde_json::from_value(metrics(env, canister_id)["stable_memory_sizes"].clone()).unwrap();

    for memory_id in [STABLE_MEMORY_MAP, STABLE_MEMORY_MAP_SMALL_ENTRIES] {
        assert!(
            sizes.get(&memory_id).is_some_and(|size| *size > 0),
            "{canister_id}: stable memory map {memory_id} not initialised: {sizes:?}"
        );
    }
}

fn wasm_version(env: &PocketIc, canister_id: CanisterId) -> BuildVersion {
    serde_json::from_value(metrics(env, canister_id)["wasm_version"].clone()).unwrap()
}
