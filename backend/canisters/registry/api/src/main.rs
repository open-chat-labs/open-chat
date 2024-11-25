use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

fn main() {
    generate_candid_method!(registry, updates, query);

    candid::export_service!();
    std::print!("{}", __export_service());

    let directory = env::current_dir().unwrap().join("tsBindings/registry");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(registry, add_message_filter);
    generate_ts_method!(registry, add_remove_swap_provider);
    generate_ts_method!(registry, remove_message_filter);
    generate_ts_method!(registry, set_airdrop_config);
    generate_ts_method!(registry, set_token_enabled);
    generate_ts_method!(registry, updates);
}
