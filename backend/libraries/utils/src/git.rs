pub fn git_commit_id() -> &'static str {
    option_env!("GIT_COMMIT_ID").unwrap_or("'GIT_COMMIT_ID' environment variable not defined")
}
