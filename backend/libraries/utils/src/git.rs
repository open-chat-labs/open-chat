pub fn git_commit_id() -> String {
    compile_time_run::run_command_str!("git", "rev-parse", "HEAD").into()
}
