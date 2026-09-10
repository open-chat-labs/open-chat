use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

fn main() {
    generate_candid_method!(daily_puzzle, candidates, query);
    generate_candid_method!(daily_puzzle, config, query);
    generate_candid_method!(daily_puzzle, current_puzzles, query);
    generate_candid_method!(daily_puzzle, game_configs, query);
    generate_candid_method!(daily_puzzle, results, query);

    generate_candid_method!(daily_puzzle, push_now, update);
    generate_candid_method!(daily_puzzle, regenerate_today, update);
    generate_candid_method!(daily_puzzle, set_config, update);
    generate_candid_method!(daily_puzzle, set_game_config, update);
    generate_candid_method!(daily_puzzle, set_schedule, update);
    generate_candid_method!(daily_puzzle, veto_candidate, update);

    candid::export_service!();
    std::print!("{}", __export_service());

    let directory = env::current_dir().unwrap().join("tsBindings/dailyPuzzle");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(daily_puzzle, config);
    generate_ts_method!(daily_puzzle, current_puzzles);
    generate_ts_method!(daily_puzzle, game_configs);
    generate_ts_method!(daily_puzzle, results);
}
