use crate::model::user::CreatedUser;
use crate::{RuntimeState, RUNTIME_STATE};
use core::cmp::Ordering;
use ic_cdk_macros::query;
use user_index_canister::search::{Response::*, *};

const MAX_SEARCH_TERM_LENGTH: usize = 25;

#[query]
fn search(args: Args) -> Response {
    RUNTIME_STATE.with(|state| search_impl(args, state.borrow().as_ref().unwrap()))
}

fn search_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    runtime_state.trap_if_caller_not_open_chat_user();

    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    let users = &runtime_state.data.users;
    let mut search_term = args.search_term;
    search_term.truncate(MAX_SEARCH_TERM_LENGTH);

    // Filter
    let mut matches: Vec<&CreatedUser> = users
        .search(&search_term)
        .filter_map(|u| u.created_user())
        .filter(|u| u.principal != caller)
        .collect();

    // Sort
    matches.sort_unstable_by(|u1, u2| order_usernames(&search_term, &u1.username, &u2.username));

    // Page
    let results = matches
        .iter()
        .take(args.max_results as usize)
        .map(|&u| u.to_summary(now))
        .collect();

    Success(Result {
        users: results,
        timestamp: now,
    })
}

fn order_usernames(search_term: &str, u1: &str, u2: &str) -> Ordering {
    match u1.len().cmp(&u2.len()) {
        Ordering::Less => Ordering::Less,
        Ordering::Greater => Ordering::Greater,
        Ordering::Equal => {
            let u1_starts = u1.starts_with(&search_term);
            let u2_starts = u2.starts_with(&search_term);

            if u1_starts != u2_starts {
                if u1_starts {
                    Ordering::Less
                } else {
                    Ordering::Greater
                }
            } else {
                u1.cmp(u2)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::User;
    use crate::Data;
    use candid::Principal;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn search_results_constrained_by_max_results() {
        let runtime_state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 2,
                search_term: "ma".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;
        assert_eq!(2, results.users.len());
    }

    #[test]
    fn case_insensitive_matches() {
        let runtime_state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "MA".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;
        assert_eq!(3, results.users.len());
    }

    #[test]
    fn results_ordered_by_length_then_case_sensitive_matches() {
        let runtime_state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 5,
                search_term: "Ma".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;
        assert_eq!("matt", results.users[0].username);
        assert_eq!("Martin", results.users[1].username);
        assert_eq!("marcus", results.users[2].username);
    }

    #[test]
    fn search_with_zero_length_term_matches_all_users() {
        let runtime_state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;
        assert_eq!(5, results.users.len());
    }

    #[test]
    fn all_fields_set_correctly() {
        let runtime_state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "hamish".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;

        let user = results.users.first().unwrap();
        assert_eq!(user.user_id, Principal::from_slice(&[4, 1]).into());
        assert_eq!(user.username, "hamish");
        assert_eq!(user.seconds_since_last_online, 1);
    }

    fn setup_runtime_state() -> RuntimeState {
        let mut env = TestEnv::default();
        let mut data = Data::default();

        let usernames = vec!["Martin", "marcus", "matt", "julian", "hamish"];

        for index in 0..usernames.len() {
            let bytes = vec![index as u8, 1];
            let p = Principal::from_slice(&bytes[..]);

            data.users.add_test_user(User::Created(CreatedUser {
                principal: p,
                phone_number: Some(PhoneNumber::new(44, format!("+44 1111 111 11{}", index))),
                user_id: p.into(),
                username: usernames[index].to_string(),
                date_created: env.now,
                date_updated: env.now,
                last_online: env.now,
                ..Default::default()
            }));
            env.now += 1000;
        }

        RuntimeState::new(Box::new(env), data)
    }
}
