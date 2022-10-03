use std::env;

pub fn git_commit_id() -> String {
    env::var("GIT_COMMIT_ID").unwrap()
}
