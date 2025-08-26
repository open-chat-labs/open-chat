use std::env;
use ts_export::generate_ts_method;

fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/proposalsBot");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(proposals_bot, stake_neuron_for_submitting_proposals);
    generate_ts_method!(proposals_bot, submit_proposal);
    generate_ts_method!(proposals_bot, top_up_neuron);
}
