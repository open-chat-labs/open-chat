use crate::{generate_msgpack_query_call, generate_msgpack_update_call, generate_update_call};
use registry_canister::*;

// Queries
generate_msgpack_query_call!(subnets);
generate_msgpack_query_call!(updates);

// Updates
generate_update_call!(add_token);
generate_update_call!(expand_onto_subnet);
generate_update_call!(update_token);
generate_msgpack_update_call!(set_token_enabled);

pub mod happy_path {
    use super::*;
    use crate::client::INIT_CYCLES_BALANCE;
    use candid::Principal;
    use pocket_ic::PocketIc;
    use registry_canister::subnets::Subnet;
    use std::time::Duration;
    use types::{CanisterId, Empty};

    pub fn expand_onto_subnet(
        env: &mut PocketIc,
        sender: Principal,
        registry_canister_id: CanisterId,
        subnet_id: Principal,
    ) -> Subnet {
        let response = super::expand_onto_subnet(env, sender, registry_canister_id, &expand_onto_subnet::Args { subnet_id });

        assert!(matches!(response, expand_onto_subnet::Response::Success));

        for i in 1..200 {
            env.advance_time(Duration::from_secs(1));
            env.tick();

            if i % 10 == 0 {
                let subnets::Response::Success(subnets) = super::subnets(env, sender, registry_canister_id, &Empty {});

                if let Some(subnet) = subnets.into_iter().find(|s| s.subnet_id == subnet_id) {
                    env.add_cycles(subnet.local_user_index, INIT_CYCLES_BALANCE);
                    env.add_cycles(subnet.local_group_index, INIT_CYCLES_BALANCE);
                    env.add_cycles(subnet.notifications_canister, INIT_CYCLES_BALANCE);

                    return subnet;
                }
            }
        }

        panic!("Failed to expand onto new subnet")
    }
}
