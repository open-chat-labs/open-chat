use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use daily_puzzle_canister::*;

// Queries
generate_msgpack_query_call!(candidates);
generate_msgpack_query_call!(config);
generate_msgpack_query_call!(current_puzzles);
generate_msgpack_query_call!(game_configs);
generate_msgpack_query_call!(results);

// Updates
generate_msgpack_update_call!(c2c_pull_puzzles);
generate_msgpack_update_call!(c2c_report_results);
generate_msgpack_update_call!(push_now);
generate_msgpack_update_call!(regenerate_today);
generate_msgpack_update_call!(set_config);
generate_msgpack_update_call!(set_game_config);
generate_msgpack_update_call!(set_schedule);
generate_msgpack_update_call!(veto_candidate);

pub mod happy_path {
    use candid::Principal;
    use pocket_ic::PocketIc;
    use types::{
        CanisterId, DailyPuzzleConfig, DailyPuzzleResult, Empty, GameConfig, GameId, PublicDailyPuzzle, PuzzleNumber, UserId,
    };

    pub fn current_puzzles(env: &PocketIc, sender: Principal, daily_puzzle_canister_id: CanisterId) -> Vec<PublicDailyPuzzle> {
        let response = super::current_puzzles(env, sender, daily_puzzle_canister_id, &Empty {});

        match response {
            daily_puzzle_canister::current_puzzles::Response::Success(puzzles) => puzzles,
            response => panic!("'current_puzzles' error: {response:?}"),
        }
    }

    pub fn game_configs(env: &PocketIc, sender: Principal, daily_puzzle_canister_id: CanisterId) -> Vec<(GameId, GameConfig)> {
        let response = super::game_configs(env, sender, daily_puzzle_canister_id, &Empty {});

        match response {
            daily_puzzle_canister::game_configs::Response::Success(configs) => configs,
            response => panic!("'game_configs' error: {response:?}"),
        }
    }

    pub fn config(env: &PocketIc, sender: Principal, daily_puzzle_canister_id: CanisterId) -> DailyPuzzleConfig {
        let response = super::config(env, sender, daily_puzzle_canister_id, &Empty {});

        match response {
            daily_puzzle_canister::config::Response::Success(config) => config,
            response => panic!("'config' error: {response:?}"),
        }
    }

    pub fn results(
        env: &PocketIc,
        sender: Principal,
        daily_puzzle_canister_id: CanisterId,
        game_id: GameId,
        number: PuzzleNumber,
        user_ids: Vec<UserId>,
    ) -> Vec<DailyPuzzleResult> {
        let response = super::results(
            env,
            sender,
            daily_puzzle_canister_id,
            &daily_puzzle_canister::results::Args {
                game_id,
                number,
                user_ids,
            },
        );

        match response {
            daily_puzzle_canister::results::Response::Success(results) => results,
            response => panic!("'results' error: {response:?}"),
        }
    }

    pub fn candidates(
        env: &PocketIc,
        sender: Principal,
        daily_puzzle_canister_id: CanisterId,
        number: PuzzleNumber,
    ) -> Vec<daily_puzzle_canister::CandidateView> {
        let response = super::candidates(
            env,
            sender,
            daily_puzzle_canister_id,
            &daily_puzzle_canister::candidates::Args { number },
        );

        match response {
            daily_puzzle_canister::candidates::Response::Success(candidates) => candidates,
            response => panic!("'candidates' error: {response:?}"),
        }
    }

    pub fn push_now(env: &mut PocketIc, sender: Principal, daily_puzzle_canister_id: CanisterId) {
        let response = super::push_now(env, sender, daily_puzzle_canister_id, &Empty {});

        match response {
            types::UnitResult::Success => {}
            response => panic!("'push_now' error: {response:?}"),
        }
    }

    pub fn regenerate_today(
        env: &mut PocketIc,
        sender: Principal,
        daily_puzzle_canister_id: CanisterId,
        game_id: Option<GameId>,
    ) {
        let response = super::regenerate_today(
            env,
            sender,
            daily_puzzle_canister_id,
            &daily_puzzle_canister::regenerate_today::Args { game_id },
        );

        match response {
            types::UnitResult::Success => {}
            response => panic!("'regenerate_today' error: {response:?}"),
        }
    }

    pub fn set_config(env: &mut PocketIc, sender: Principal, daily_puzzle_canister_id: CanisterId, config: DailyPuzzleConfig) {
        let response = super::set_config(
            env,
            sender,
            daily_puzzle_canister_id,
            &daily_puzzle_canister::set_config::Args { config },
        );

        match response {
            types::UnitResult::Success => {}
            response => panic!("'set_config' error: {response:?}"),
        }
    }

    pub fn set_game_config(
        env: &mut PocketIc,
        sender: Principal,
        daily_puzzle_canister_id: CanisterId,
        game_id: GameId,
        config: GameConfig,
    ) {
        let response = super::set_game_config(
            env,
            sender,
            daily_puzzle_canister_id,
            &daily_puzzle_canister::set_game_config::Args { game_id, config },
        );

        match response {
            types::UnitResult::Success => {}
            response => panic!("'set_game_config' error: {response:?}"),
        }
    }

    pub fn veto_candidate(
        env: &mut PocketIc,
        sender: Principal,
        daily_puzzle_canister_id: CanisterId,
        number: PuzzleNumber,
        game_id: GameId,
        index: u8,
    ) {
        let response = super::veto_candidate(
            env,
            sender,
            daily_puzzle_canister_id,
            &daily_puzzle_canister::veto_candidate::Args { number, game_id, index },
        );

        match response {
            types::UnitResult::Success => {}
            response => panic!("'veto_candidate' error: {response:?}"),
        }
    }

    pub fn set_schedule(
        env: &mut PocketIc,
        sender: Principal,
        daily_puzzle_canister_id: CanisterId,
        schedule: Vec<daily_puzzle_canister::PuzzleParams>,
    ) {
        let response = super::set_schedule(
            env,
            sender,
            daily_puzzle_canister_id,
            &daily_puzzle_canister::set_schedule::Args { schedule },
        );

        match response {
            types::UnitResult::Success => {}
            response => panic!("'set_schedule' error: {response:?}"),
        }
    }
}
