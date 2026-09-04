use futures_util::StreamExt;
use reqwest::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Runtime};

const VERSION_ENDPOINT: &str = "https://oc.app/version";
// TODO: This needs to be the actual URL where the bundle can be downloaded
#[cfg(feature = "store")]
const BUNDLE_URL_TEMPLATE: &str = "https://oc.app/downloads/store-{}.zip";
#[cfg(not(feature = "store"))]
const BUNDLE_URL_TEMPLATE: &str = "https://oc.app/downloads/full-{}.zip";

#[derive(Serialize, Deserialize, Debug)]
struct ServerVersion {
    version: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct CachedVersion {
    version: String,
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    progress: f64,
    downloaded: u64,
    total: u64,
}

pub struct UpdateManager<R: Runtime> {
    app_handle: AppHandle<R>,
}

impl<R: Runtime> UpdateManager<R> {
    pub fn new(app_handle: AppHandle<R>) -> Self {
        Self { app_handle }
    }

    pub fn get_cache_dir(&self) -> Option<PathBuf> {
        self.app_handle
            .path()
            .app_data_dir()
            .ok()
            .map(|p| p.join("updates"))
    }

    pub fn get_cached_version(&self) -> Option<Version> {
        let cache_dir = self.get_cache_dir()?;
        let version_file = cache_dir.join("version.json");

        if version_file.exists()
            && let Ok(file) = fs::File::open(&version_file)
            && let Ok(info) = serde_json::from_reader::<_, CachedVersion>(file)
        {
            return Version::parse(&info.version).ok();
        }
        None
    }

    /// Delete the OTA cache when it is no longer newer than the shell.
    ///
    /// A Play or APK update replaces the binary but Android keeps app data, so
    /// a cache written before the update survives it and can be OLDER than the
    /// assets the new shell ships with. The scheme handler serves the cache
    /// whenever version.json exists, without comparing, which pins the webview
    /// to the stale bundle permanently:
    ///
    ///   shell 2.1.0 installed -> OTA to 2.1.1 -> website goes to 2.2.0 -> user
    ///   updates from Play to shell 2.2.0 -> webview still serves 2.1.1.
    ///
    /// check_for_updates compares max(shell, cached) against the server and
    /// sees nothing to do, while the running JS reports 2.1.1 and asks the user
    /// to update again, forever. Across a major bump it is worse: the shell is
    /// new enough but the JS believes it is not, so the blocking "update
    /// required" sheet appears on a device that has already done everything
    /// asked of it, and only clearing app data recovers.
    ///
    /// Equal counts as stale: the shell's own copy is authoritative, and
    /// keeping a redundant cache only risks this again later.
    pub fn discard_cache_if_stale(&self) {
        // No shell version means no basis for comparison - keep the cache
        // rather than discard something that might be the newer of the two.
        let (Some(cached), Some(shell)) = (self.get_cached_version(), self.get_shell_version())
        else {
            return;
        };

        if cached > shell {
            return;
        }

        if let Some(dir) = self.get_cache_dir()
            && dir.exists()
        {
            match fs::remove_dir_all(&dir) {
                Ok(()) => println!("Discarded OTA cache {cached} superseded by shell {shell}"),
                // Failing to delete is survivable: the next launch tries again,
                // and load_cache_into_memory is only reached through this call.
                Err(e) => eprintln!("Failed to discard stale OTA cache: {e}"),
            }
        }
    }

    /// The version of the web assets compiled into the installed binary, which
    /// is what identifies the shell itself. It never changes without a
    /// reinstall. Distinct from `get_cached_version`, which is the most recent
    /// bundle downloaded over the air.
    pub fn get_shell_version(&self) -> Option<Version> {
        if let Some(asset) = self.app_handle.asset_resolver().get("version".to_string())
            && let Ok(info) = serde_json::from_slice::<ServerVersion>(&asset.bytes)
        {
            return Version::parse(info.version.trim_start_matches('v')).ok();
        }
        // No fallback to package_info(): that reads tauri.conf.json's version,
        // a stale "0.1.0" placeholder unrelated to the shipped web assets. This
        // value exists to tell a crash report which shell is running, and a
        // confident wrong answer is worse than none.
        None
    }

    pub async fn get_server_version(&self) -> Result<Version, Box<dyn std::error::Error>> {
        let client = Client::new();
        let resp = client.get(VERSION_ENDPOINT).send().await?;
        let server_info: ServerVersion = resp.json().await?;
        let server_version = Version::parse(&server_info.version)?;
        Ok(server_version)
    }

    pub async fn check_for_updates(&self) -> Result<bool, Box<dyn std::error::Error>> {
        let server_version = self.get_server_version().await?;

        let shell_version = self
            .get_shell_version()
            .unwrap_or_else(|| Version::parse("0.0.0").unwrap());
        let cached_version = self
            .get_cached_version()
            .unwrap_or_else(|| Version::parse("0.0.0").unwrap());

        let current_version = if cached_version > shell_version {
            cached_version.clone()
        } else {
            shell_version.clone()
        };

        if server_version > current_version {
            println!(
                "New version available: {} (current={})",
                server_version, current_version
            );
            self.download_and_install(&server_version).await?;
            return Ok(true);
        }

        Ok(false)
    }

    async fn download_and_install(
        &self,
        version: &Version,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let url = BUNDLE_URL_TEMPLATE.replace("{}", &version.to_string());
        println!("Downloading update from {}", url);

        let client = Client::new();
        let resp = client
            .get(&url)
            .header("Accept-Encoding", "identity")
            .send()
            .await?;

        if !resp.status().is_success() {
            // TODO what do we do here? Retry?
            return Err(format!("Failed to download bundle: {}", resp.status()).into());
        }

        let content_length = resp.content_length();
        let total_size = content_length.unwrap_or(15 * 1024 * 1024);
        let is_estimated = content_length.is_none();

        println!(
            "Starting download. Total size: {} (estimated: {})",
            total_size, is_estimated
        );

        let mut downloaded: u64 = 0;
        let mut stream = resp.bytes_stream();
        let mut bytes = Vec::with_capacity(total_size as usize);

        while let Some(item) = stream.next().await {
            let chunk = item?;
            bytes.extend_from_slice(&chunk);
            downloaded += chunk.len() as u64;

            let mut progress = (downloaded as f64 / total_size as f64) * 100.0;
            if is_estimated && progress > 99.0 {
                progress = 99.0;
            }

            self.app_handle.emit(
                "update-progress",
                ProgressPayload {
                    progress,
                    downloaded,
                    total: if is_estimated { 0 } else { total_size },
                },
            )?;
        }
        let reader = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(reader)?;

        let cache_dir = self.get_cache_dir().ok_or("Could not get cache dir")?;
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir)?;
        }

        archive.extract(&cache_dir)?;

        // Write version file
        let version_info = CachedVersion {
            version: version.to_string(),
        };
        let version_file = cache_dir.join("version.json");
        let file = fs::File::create(&version_file)?;
        serde_json::to_writer(file, &version_info)?;

        println!("Update installed to {:?}", cache_dir);

        Ok(())
    }
}
