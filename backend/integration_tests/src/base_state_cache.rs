use crate::CanisterIds;
use crate::utils::local_bin;
use pocket_ic::PocketIcState;
use sha256::{sha256, sha256_of_parts};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use std::{env, fs, process};
use types::TimestampMillis;

// A base state is reused for this long after it was built. Its clock starts at the time it was
// built, so a test using it sees a clock which is this far behind the real time at most. The
// tests which compare against the real time set the clock forward themselves.
const MAX_AGE: Duration = Duration::from_secs(4 * 60 * 60);

// A base state is removed once it is this old. This is longer than `MAX_AGE` so that a state isn't
// removed while a run which started using it just before it expired is still going.
const REMOVE_AFTER: Duration = Duration::from_secs(8 * 60 * 60);

// The code which builds the base state, relative to this crate
const SETUP_CODE: [&str; 5] = [
    "src/base_state_cache.rs",
    "src/client",
    "src/setup.rs",
    "src/utils.rs",
    "src/wasms.rs",
];

const CANISTER_IDS_FILE: &str = "canister_ids.json";
const STATE_DIR: &str = "state";
// The name of a state which is still being built, in place of its key
const PENDING: &str = ".pending";

// Building the base state (creating the subnets and installing every canister) takes longer than
// most tests do, so locally it is kept in a cache shared by every worktree on this machine. Each
// state is stored under a key which is a hash of what goes into building it: the wasms, the
// PocketIC binary and the code which sets it up. So a run whose inputs match those of an earlier
// run, in any worktree, goes straight to its tests.
//
// Each state is in its own directory, named `<key>-<when it was built>-<process id>`, and is never
// modified once it's there, since the runs using it read from it for as long as they last.
pub struct BaseStateCache {
    dir: PathBuf,
    key: String,
}

impl BaseStateCache {
    // None on CI, where there are no earlier runs to share a cache with
    pub fn open(pocket_ic_bin: &Path) -> Option<BaseStateCache> {
        if env::var_os("CI").is_some() {
            return None;
        }

        let dir = cache_dir()?;
        fs::create_dir_all(&dir).ok()?;

        let cache = BaseStateCache {
            dir,
            key: key(pocket_ic_bin)?,
        };
        cache.remove_old_states();
        Some(cache)
    }

    // The newest state with this key, if it is recent enough to use
    pub fn get(&self) -> Option<(PocketIcState, CanisterIds)> {
        let prefix = format!("{}-", self.key);

        let (created, path) = fs::read_dir(&self.dir)
            .ok()?
            .flatten()
            .filter_map(|entry| {
                let name = entry.file_name().into_string().ok()?;
                if !name.starts_with(&prefix) {
                    return None;
                }
                Some((created(&name)?, entry.path()))
            })
            .max_by_key(|(created, _)| *created)?;

        let age = age(created);
        if age > MAX_AGE {
            return None;
        }

        let canister_ids = serde_json::from_slice(&fs::read(path.join(CANISTER_IDS_FILE)).ok()?).ok()?;

        println!(
            "Using the base state built {}s ago, cached at {}",
            age.as_secs(),
            path.display()
        );

        Some((PocketIcState::new_from_path(path.join(STATE_DIR)), canister_ids))
    }

    // Where to build a new state, so that `insert` can move it into place once it's built
    pub fn new_state(&self) -> PocketIcState {
        let state_dir = self
            .dir
            .join(format!("{PENDING}-{}-{}", now_millis(), process::id()))
            .join(STATE_DIR);
        fs::create_dir_all(&state_dir).unwrap();
        PocketIcState::new_from_path(state_dir)
    }

    // Adds a state built in the directory given by `new_state`, returning it at its new path.
    // `created` is the time its clock started from.
    pub fn insert(&self, state: PocketIcState, canister_ids: &CanisterIds, created: SystemTime) -> PocketIcState {
        let state_dir = state.into_path();
        let pending = state_dir.parent().unwrap();
        let created = created.duration_since(UNIX_EPOCH).unwrap().as_millis();
        let path = self.dir.join(format!("{}-{created}-{}", self.key, process::id()));

        // The canister ids are written before the directory is renamed, so that a state in the
        // cache is always complete
        let inserted = fs::write(pending.join(CANISTER_IDS_FILE), serde_json::to_vec(canister_ids).unwrap())
            .and_then(|_| fs::rename(pending, &path));

        match inserted {
            Ok(_) => PocketIcState::new_from_path(path.join(STATE_DIR)),
            Err(error) => {
                println!("Failed to cache the base state: {error}");
                PocketIcState::new_from_path(state_dir)
            }
        }
    }

    // Including any left part built by a run which was stopped
    fn remove_old_states(&self) {
        let Ok(entries) = fs::read_dir(&self.dir) else {
            return;
        };

        for entry in entries.flatten() {
            if let Some(created) = entry.file_name().to_str().and_then(created)
                && age(created) > REMOVE_AFTER
            {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }
}

fn cache_dir() -> Option<PathBuf> {
    if let Some(dir) = env::var_os("OC_TEST_BASE_STATE_CACHE_DIR") {
        return Some(dir.into());
    }

    let home = PathBuf::from(env::var_os("HOME")?);
    let caches = if cfg!(target_os = "macos") {
        home.join("Library/Caches")
    } else {
        env::var_os("XDG_CACHE_HOME").map_or_else(|| home.join(".cache"), PathBuf::from)
    };
    Some(caches.join("openchat/test-base-states"))
}

fn key(pocket_ic_bin: &Path) -> Option<String> {
    // Which build of PocketIC it is
    let mut parts = vec![
        Command::new(pocket_ic_bin).arg("--version").output().ok()?.stdout,
        fs::metadata(pocket_ic_bin).ok()?.len().to_be_bytes().to_vec(),
    ];

    let crate_dir = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR")?);
    let mut files = Vec::new();
    for path in SETUP_CODE {
        collect_files(&crate_dir.join(path), &mut files)?;
    }
    collect_files(&local_bin(), &mut files)?;
    files.sort();

    for file in files {
        parts.push(file.strip_prefix(&crate_dir).ok()?.to_str()?.as_bytes().to_vec());
        parts.push(sha256(&fs::read(&file).ok()?).to_vec());
    }

    let hash = sha256_of_parts(parts.iter().map(|p| p.as_slice()));
    Some(hash.iter().take(16).map(|b| format!("{b:02x}")).collect())
}

fn collect_files(path: &Path, files: &mut Vec<PathBuf>) -> Option<()> {
    if path.is_dir() {
        for entry in fs::read_dir(path).ok()? {
            collect_files(&entry.ok()?.path(), files)?;
        }
    } else {
        files.push(path.to_path_buf());
    }
    Some(())
}

// From a state's name, `<key or PENDING>-<created>-<process id>`
fn created(name: &str) -> Option<TimestampMillis> {
    name.split('-').nth(1)?.parse().ok()
}

fn age(created: TimestampMillis) -> Duration {
    Duration::from_millis(now_millis().saturating_sub(created))
}

fn now_millis() -> TimestampMillis {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64
}
