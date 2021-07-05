use crate::model::runtime_state::RuntimeState;
use crate::model::user::CreatedUser;
use crate::model::user_summary::UserSummary;
use candid::CandidType;
use core::cmp::Ordering;
use serde::Deserialize;

pub fn query(request: Request, runtime_state: &RuntimeState) -> Response {
    let now = runtime_state.env.now();
    let caller = runtime_state.env.caller();
    let search_term = request.search_term;
    let users = &runtime_state.data.users;

    // Filter
    let search_term_lower = search_term.to_lowercase();
    let mut matches: Vec<&CreatedUser> = users
        .iter()
        .filter_map(|u| u.created_user())
        .filter(|u| username_matches(&search_term_lower, &u.username) && u.user_id != caller)
        .collect();

    // Sort
    matches.sort_unstable_by(|u1, u2| order_usernames(&search_term, &u1.username, &u2.username));

    // Page
    let users = matches
        .iter()
        .take(request.max_results as usize)
        .map(|u| UserSummary::new(u, Some(now)))
        .collect();

    Response::Success(Result { users })
}

fn username_matches(search_term_lower: &str, username: &str) -> bool {
    username.to_lowercase().starts_with(search_term_lower)
}

fn order_usernames(search_term: &str, u1: &str, u2: &str) -> Ordering {
    let u1_starts = u1.starts_with(&search_term);
    let u2_starts = u2.starts_with(&search_term);

    if u1_starts && u2_starts {
        if u1.len() < u2.len() {
            return Ordering::Less;
        } else if u1.len() > u2.len() {
            return Ordering::Greater;
        }
    } else if u1_starts {
        return Ordering::Less;
    } else if u2_starts {
        return Ordering::Greater;
    }

    if u1.len() < u2.len() {
        return Ordering::Less;
    } else if u1.len() > u2.len() {
        return Ordering::Greater;
    }

    u1.cmp(&u2)
}

#[derive(Deserialize)]
pub struct Request {
    search_term: String,
    max_results: u8,
}

#[derive(CandidType)]
pub enum Response {
    Success(Result),
}

#[derive(CandidType)]
pub struct Result {
    users: Vec<UserSummary>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::data::Data;
    use crate::model::user::{CreatedUser, User};
    use crate::test::env::TestEnv;
    use candid::Principal;
    use phonenumber::PhoneNumber;
    use std::str::FromStr;

    #[test]
    fn search_results_constrained_by_max_results() {
        let runtime_state = setup_runtime_state();

        let response = query(
            Request {
                max_results: 3,
                search_term: "ma".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;
        assert_eq!(3, results.users.len());
    }

    #[test]
    fn search_matches_both_cases() {
        let runtime_state = setup_runtime_state();

        let response = query(
            Request {
                max_results: 10,
                search_term: "mA".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;
        assert_eq!(5, results.users.len());
    }

    #[test]
    fn search_returns_shorter_matches_first() {
        let runtime_state = setup_runtime_state();

        let response = query(
            Request {
                max_results: 2,
                search_term: "ma".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;
        assert_eq!("matt", results.users[0].username());
        assert_eq!("marcus", results.users[1].username());
    }

    #[test]
    fn search_returns_case_sensitive_matches_first() {
        let runtime_state = setup_runtime_state();

        let response = query(
            Request {
                max_results: 2,
                search_term: "jU".to_string(),
            },
            &runtime_state,
        );

        let Response::Success(results) = response;
        assert_eq!("jUlian", results.users[0].username());
        assert_eq!("julian", results.users[1].username());
    }

    fn setup_runtime_state() -> RuntimeState {
        let env = TestEnv::default();
        let mut data = Data::default();

        let usernames = vec![
            "mArtin", "marcus", "matt", "julian", "hamish", "Matt", "jUlian", "hamisH", "Martin",
        ];

        for index in 0..usernames.len() {
            let bytes = vec![index as u8, 1];
            let p = Principal::from_slice(&bytes[..]);
            let phone_number = format!("+44 1111 111 11{}", index);

            data.users.add(User::Created(CreatedUser {
                principal: p,
                phone_number: PhoneNumber::from_str(&phone_number).unwrap(),
                user_id: p,
                username: usernames[index].to_string(),
                date_created: env.now,
                last_online: env.now,
            }));
        }

        RuntimeState::new(Box::new(env), data)
    }
}
