use fondue::*;
use ic_fondue::ic_manager::IcManager;
use ic_fondue::internet_computer::InternetComputer;
use ic_registry_subnet_type::SubnetType;

mod canisters;
mod register_user_test;
mod send_message_test;
mod setup;
mod types;
mod utils;

fn main() {
    let fondue_config = fondue::pot::execution::Config::default().random_pot_rng_seed();
    let pots = vec![tests_pot()];

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

fn tests_pot() -> pot::Pot<IcManager> {
    composable_setup!(
        configure(),
        setup(),
        steps! {
            register_user_test::register_user_test,
            register_user_test::register_existing_user_test,
            send_message_test::send_message_test
        }
    )
}

fn print_rng_seed<ManCfg>(fondue_config: &fondue::pot::execution::Config<ManCfg>) {
    println!(
        "(To reproduce this exact run, make sure to use '--seed {}')",
        fondue_config.pot_config.rng_seed
    );
}

pub fn configure() -> InternetComputer {
    InternetComputer::new().add_fast_single_node_subnet(SubnetType::System)
}

pub fn setup() -> pot::Setup<IcManager> {
    Box::new(|_man, _ctx| {})
}
