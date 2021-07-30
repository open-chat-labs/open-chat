use fondue::*;
use ic_fondue::ic_manager::IcManager;

mod canisters;
mod register_user_test;
mod utils;

fn main() {
    let fondue_config = fondue::pot::execution::Config::default().random_pot_rng_seed();
    let pots = all_pots();

    if let Some(res) = fondue::pot::execution::execute(&fondue_config, pots) {
        res.print_summary();
        print_rng_seed(&fondue_config);

        if !res.was_successful() {
            // propagate error in case of any failures
            std::process::exit(1);
        }
    } else {
        print_rng_seed(&fondue_config);
        std::process::exit(1);
    }
}

/// Defines the test suite of system tests. If you want to add more tests in
/// here, just add another entry to the vector with the corresponding pot.
/// The [node_restart_pot] and [basic_health_pot] have a tutorial nature to them
/// and are good places to look for simple test examples.
fn all_pots() -> Vec<fondue::pot::Pot<IcManager>> {
    // HAVE YOU READ THE README AT THE TOP?
    vec![register_user_pot()]
}

fn register_user_pot() -> pot::Pot<IcManager> {
    composable_setup!(
        register_user_test::config(),
        register_user_test::setup(),
        steps! {
            register_user_test::register_user_test
        }
    )
}

fn print_rng_seed<ManCfg>(fondue_config: &fondue::pot::execution::Config<ManCfg>) {
    println!(
        "(To reproduce this exact run, make sure to use '--seed {}')",
        fondue_config.pot_config.rng_seed
    );
}
