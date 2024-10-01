use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use user_index_canister::ExternalAchievementInitial;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    mutate_state(|state| {
        if !state.data.test_mode {
            state.data.external_achievements.register(ExternalAchievementInitial { 
                id: 2531583761, 
                name: "Konecta pre-registration".to_string(), 
                logo: "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAyOC4xLjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iS29uZWN0YSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiDQoJIHZpZXdCb3g9IjAgMCAyNDkuNiAyODguMiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMjQ5LjYgMjg4LjI7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiMzMzdGRjU7fQ0KPC9zdHlsZT4NCjxnPg0KCTxnPg0KCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMjM4LDE0Ny42YzguNiwzLjEsOC44LDMuNCw5LDExLjljMCwzLDAsNS45LDAsOC45YzAuMSw0LjQsMC4zLDguNy00LDExLjljLTEuNiwxLjItMi4yLDQuMS0yLjgsNi4zDQoJCQljLTUuNiwyMC43LTI3LDQwLjctNTQuMiw0MC41Yy00MC43LTAuMy04MS41LDAuMS0xMjIuMi0wLjFjLTI1LjMtMC4xLTQ2LjEtMTUuNy01My44LTM5LjhjLTEuMS0zLjQtMi4xLTYuNS00LjgtOS4yDQoJCQljLTEuNi0xLjYtMi00LjgtMi4zLTcuM2MtMC40LTMuNS0wLjItNy4xLTAuMS0xMC42YzAuMi04LjksMC43LTkuNSw5LjQtMTIuN2M3LjUtMTUuNCwxOS4yLTI2LjYsMzYuMi0zMS4yDQoJCQljNi41LTEuNywxMy4zLTIuNiwyMC4xLTIuNmMzNy41LTAuMiw3NSwwLDExMi41LTAuMkMyMDYuNSwxMTMuMywyMjUuNywxMjMuOSwyMzgsMTQ3LjZMMjM4LDE0Ny42eiBNMTI2LjUsMTk0LjZMMTI2LjUsMTk0LjYNCgkJCWM2LjIsMCwxMi40LDAsMTguNiwwYzguNiwwLDE3LjEsMC4yLDI1LjctMC4xYzEwLTAuMywxOC4zLTYuNywyMS4yLTE1LjljMy4yLTkuOCwwLjEtMTkuOC04LTI2LjFjLTQuOS0zLjgtMTAuNi01LjEtMTYuNi01LjENCgkJCWMtOS4xLTAuMS0xOC4zLDAtMjcuNSwwYy0xOC4zLDAtMzYuNiwwLTU0LjksMGMtOC4zLDAtMTUuOSwyLjItMjEuMiw5Yy02LjEsNy42LTYuOCwxNi4zLTIuOSwyNWMzLjgsOC41LDExLjEsMTMsMjAuNCwxMy4yDQoJCQlDOTYuNCwxOTQuOCwxMTEuNCwxOTQuNiwxMjYuNSwxOTQuNkwxMjYuNSwxOTQuNnoiLz4NCgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTcyLjQsOTYuN0g1NS4xYy0xLjMtMTAuNiwzLjItMTguNiw5LjktMjUuNWM1LjktNi4xLDEzLjQtOS44LDIyLjEtOS45YzI1LjEtMC4yLDUwLjItMC4zLDc1LjMsMA0KCQkJYzE3LjMsMC4yLDMzLjUsMTcuMSwzMi4yLDM1LjNjLTIuNywwLjEtNS41LDAuMy04LjQsMC40cy01LjksMC04LjYsMGMtMC43LTAuOC0xLjMtMS4yLTEuNS0xLjdjLTQuMy0xMi4zLTguMi0xNS4yLTIxLjQtMTUuMw0KCQkJYy02LjQsMC0xMi44LDAtMTkuOCwwYy0wLjIsMy42LTAuMyw2LjItMC41LDguN2MtMC4yLDIuMy0wLjQsNC42LTAuNiw3LjZoLTE4LjJjLTAuMy01LjItMC42LTEwLjQtMC45LTE2LjINCgkJCWMtOC45LDAtMTcuNS0wLjQtMjUuOSwwLjFjLTYuNiwwLjQtMTEuNSw0LjItMTQuMiwxMC41QzczLjksOTIuOCw3My4yLDk0LjcsNzIuNCw5Ni43TDcyLjQsOTYuN3oiLz4NCgk8L2c+DQo8L2c+DQo8L3N2Zz4NCg==".to_string(), 
                url: "https://pre.konecta.one".to_string(), 
                canister_id: Principal::from_text("onpqf-diaaa-aaaag-qkeda-cai").unwrap(), 
                chit_reward: 5000, 
                expires: 1729123199000, 
                chit_budget: 40000000,                         
            }, state.env.now());
        }
    });

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
