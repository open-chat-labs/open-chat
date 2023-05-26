use crate::model::user::User;
use crate::{read_state, RuntimeState};
use core::cmp::Ordering;
use ic_cdk_macros::query;
use user_index_canister::search::{Response::*, *};

const MAX_SEARCH_TERM_LENGTH: usize = 25;

#[query]
fn search(args: Args) -> Response {
    read_state(|state| search_impl(args, state))
}

fn search_impl(args: Args, state: &RuntimeState) -> Response {
    state.trap_if_caller_not_openchat_user();

    let caller = state.env.caller();
    let now = state.env.now();
    let users = &state.data.users;

    // Remove spaces since usernames can't have spaces
    let mut search_term = args.search_term.replace(' ', "");
    search_term.truncate(MAX_SEARCH_TERM_LENGTH);

    // Filter
    let mut matches: Vec<(&User, bool)> = users.search(&search_term).filter(|(u, _)| u.principal != caller).collect();

    // Sort
    matches.sort_unstable_by(|(u1, u1_starts_ci), (u2, u2_starts_ci)| {
        order_usernames(&search_term, &u1.username, *u1_starts_ci, &u2.username, *u2_starts_ci)
    });

    // Page
    let results = matches
        .iter()
        .take(args.max_results as usize)
        .map(|(u, _)| u.to_summary(now))
        .collect();

    Success(Result {
        users: results,
        timestamp: now,
    })
}

fn order_usernames(search_term: &str, u1: &str, u1_starts_ci: bool, u2: &str, u2_starts_ci: bool) -> Ordering {
    // First check case insensitive match
    if u1_starts_ci && !u2_starts_ci {
        Ordering::Less
    } else if !u1_starts_ci && u2_starts_ci {
        Ordering::Greater
    } else {
        // Now order by shortest username first
        match u1.len().cmp(&u2.len()) {
            Ordering::Less => Ordering::Less,
            Ordering::Greater => Ordering::Greater,
            Ordering::Equal => {
                if u1_starts_ci {
                    // Now prioritise case sensitive prefix match
                    let u1_starts = u1.starts_with(search_term);
                    let u2_starts = u2.starts_with(search_term);
                    if u1_starts != u2_starts {
                        if u1_starts {
                            return Ordering::Less;
                        } else {
                            return Ordering::Greater;
                        }
                    }
                } else {
                    // Now prioritise case sensitive contains match
                    let u1_contains = u1.contains(search_term);
                    let u2_contains = u2.contains(search_term);
                    if u1_contains != u2_contains {
                        if u1_contains {
                            return Ordering::Less;
                        } else {
                            return Ordering::Greater;
                        }
                    }
                }

                // Finally order the matches alphabetically
                u1.cmp(u2)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{PhoneStatus, User};
    use crate::Data;
    use candid::Principal;
    use types::PhoneNumber;
    use utils::env::test::TestEnv;

    #[test]
    fn search_results_constrained_by_max_results() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 2,
                search_term: "ma".to_string(),
            },
            &state,
        );

        let Response::Success(results) = response;
        assert_eq!(2, results.users.len());
    }

    #[test]
    fn case_insensitive_matches() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "MA".to_string(),
            },
            &state,
        );

        let Response::Success(results) = response;
        assert_eq!(7, results.users.len());
    }

    #[test]
    fn results_ordered_by_all_criteria() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "Ma".to_string(),
            },
            &state,
        );

        let Response::Success(results) = response;
        assert_eq!("matty", results.users[0].username);
        assert_eq!("Martin", results.users[1].username);
        assert_eq!("marcus", results.users[2].username);
        assert_eq!("amar", results.users[3].username);
        assert_eq!("muhamMad", results.users[4].username);
        assert_eq!("amabcdef", results.users[5].username);
        assert_eq!("mohammad", results.users[6].username);
    }

    #[test]
    fn search_with_zero_length_term_matches_all_users() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "".to_string(),
            },
            &state,
        );

        let Response::Success(results) = response;
        assert_eq!(9, results.users.len());
    }

    #[test]
    fn all_fields_set_correctly() {
        let state = setup_runtime_state();

        let response = search_impl(
            Args {
                max_results: 10,
                search_term: "hamish".to_string(),
            },
            &state,
        );

        let Response::Success(results) = response;

        let user = results.users.first().unwrap();
        assert_eq!(user.user_id, Principal::from_slice(&[4, 1]).into());
        assert_eq!(user.username, "hamish");
    }

    fn setup_runtime_state() -> RuntimeState {
        let mut env = TestEnv::default();
        let mut data = Data::default();

        let usernames = vec![
            "Martin", "marcus", "matty", "julian", "hamish", "mohammad", "amar", "muhamMad", "amabcdef",
        ];

        for (index, username) in usernames.iter().enumerate() {
            let bytes = vec![index as u8, 1];
            let p = Principal::from_slice(&bytes[..]);

            data.users.add_test_user(User {
                principal: p,
                user_id: p.into(),
                username: username.to_string(),
                date_created: env.now,
                date_updated: env.now,
                phone_status: PhoneStatus::Confirmed(PhoneNumber::new(44, format!("+44 1111 111 11{index}"))),
                ..Default::default()
            });
            env.now += 1000;
        }

        RuntimeState::new(Box::new(env), data)
    }
}
