use constants::{min_cycles_balance, MINUTE_IN_MS};
use types::CanisterId;

pub fn init_cycles_dispenser_client(cycles_dispenser_canister_id: CanisterId, test_mode: bool) {
    let config = cycles_dispenser_client::Config::new(cycles_dispenser_canister_id)
        .with_interval(5 * MINUTE_IN_MS)
        .with_min_cycles_balance(2 * min_cycles_balance(test_mode));

    cycles_dispenser_client::start(config);
}
