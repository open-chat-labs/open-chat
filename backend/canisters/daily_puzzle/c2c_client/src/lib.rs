use canister_client::generate_c2c_call;
use daily_puzzle_canister::*;

// Queries
generate_c2c_call!(current_puzzles);
generate_c2c_call!(results);

// Updates
generate_c2c_call!(c2c_pull_puzzles);
generate_c2c_call!(c2c_report_results);
