use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use group_index_canister::search::{Response::*, *};

const MIN_TERM_LENGTH: u8 = 2;
const MAX_TERM_LENGTH: u8 = 20;

#[query(candid = true, msgpack = true)]
fn search(args: Args) -> Response {
    read_state(|state| search_impl(args, state))
}

fn search_impl(args: Args, state: &RuntimeState) -> Response {
    let term_length = args.search_term.len() as u8;

    if term_length < MIN_TERM_LENGTH {
        return TermTooShort(MIN_TERM_LENGTH);
    }

    if term_length > MAX_TERM_LENGTH {
        return TermTooLong(MAX_TERM_LENGTH);
    }

    let (matches, total) = state.data.public_groups.search(Some(args.search_term), 0, args.max_results);

    Success(SuccessResult { matches, total })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use candid::Principal;
    use utils::env::test::TestEnv;

    #[test]
    fn term_too_short() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "".to_string(),
            },
            &state,
        );

        assert!(matches!(response, Response::TermTooShort(_)));
    }

    #[test]
    fn term_too_long() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "sausages, chips, beans, eggs, bacon, hash browns".to_string(),
            },
            &state,
        );

        assert!(matches!(response, Response::TermTooLong(_)));
    }

    #[test]
    fn max_results_respected() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 2,
                search_term: "Sausages".to_string(),
            },
            &state,
        );

        if let Response::Success(result) = response {
            assert_eq!(2, result.matches.len());
        } else {
            panic!();
        }
    }

    #[test]
    fn results_in_expected_order() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "Sausages".to_string(),
            },
            &state,
        );

        if let Response::Success(result) = response {
            assert_eq!(6, result.matches.len());
            let expected_groups = vec![1u8, 3, 4, 7, 2, 5];
            for (i, expected_group) in expected_groups.into_iter().enumerate() {
                let chat_id = Principal::from_slice(&[expected_group]).into();
                assert_eq!(result.matches[i].id, chat_id);
            }
        } else {
            panic!();
        }
    }

    fn setup_runtime_state() -> RuntimeState {
        let env = TestEnv::default();
        let mut data = Data::default();

        let groups_raw = vec![
            (1, "Sausages", "Sausages, chips, and beans"),
            (2, "Fry-up", "Sausages, chips, and beans"),
            (3, "sAusAges?", "sausages, chips, and beans"),
            (
                4,
                "sausages!!",
                "sausages, chips, beans, eggs, bacon, hash browns, black-pudding, haggis, mushrooms, buttered toast, fried tomatoes",
            ),
            (5, "Small fry", "Chips, sausages, and beans"),
            (6, "Buffet", "Croissant, yoghurt, cheese slices, baguette"),
            (7, "Small sausages", "Weeners"),
        ];

        for (id, name, description) in groups_raw {
            let chat_id = Principal::from_slice(&[id]).into();
            data.public_group_and_community_names.reserve_name(name, env.now);
            data.public_groups
                .add(chat_id, name.to_string(), description.to_string(), None, None, None, env.now);
        }

        RuntimeState::new(Box::new(env), data)
    }
}
