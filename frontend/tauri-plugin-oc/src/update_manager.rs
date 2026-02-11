use futures_util::StreamExt;
use reqwest::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Runtime};

const VERSION_ENDPOINT: &str = "https://webtest.oc.app/version";
// TODO: This needs to be the actual URL where the bundle can be downloaded
#[cfg(feature = "store")]
const BUNDLE_URL_TEMPLATE: &str = "https://webtest.oc.app/downloads/store-{}.zip";
#[cfg(not(feature = "store"))]
const BUNDLE_URL_TEMPLATE: &str = "https://webtest.oc.app/downloads/full-{}.zip";

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

        if version_file.exists() {
            if let Ok(file) = fs::File::open(version_file) {
                if let Ok(info) = serde_json::from_reader::<_, CachedVersion>(file) {
                    return Version::parse(&info.version).ok();
                }
            }
        }
        None
    }

    pub fn get_bundled_version(&self) -> Option<Version> {
        // This relies on the package version in tauri.conf.json being in sync with the PWA version
        self.app_handle
            .package_info()
            .version
            .to_string()
            .parse()
            .ok()
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

        let bundled_version = self
            .get_bundled_version()
            .unwrap_or_else(|| Version::parse("0.0.0").unwrap());
        let cached_version = self
            .get_cached_version()
            .unwrap_or_else(|| Version::parse("0.0.0").unwrap());

        let current_version = if cached_version > bundled_version {
            cached_version
        } else {
            bundled_version
        };

        if server_version > current_version {
            println!("New version available: {}", server_version);
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
        let total_size = content_length.unwrap_or(50 * 1024 * 1024);
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

        // Extract to a temp dir first then move? Or just extract.
        // We'll extract to the cache directory.
        // Important: We need to handle clearing old versions or overwriting.

        // For simplicity, we extract all.
        archive.extract(&cache_dir)?;

        // Write version file
        let version_info = CachedVersion {
            version: version.to_string(),
        };
        let version_file = cache_dir.join("version.json");
        let file = fs::File::create(version_file)?;
        serde_json::to_writer(file, &version_info)?;

        println!("Update installed to {:?}", cache_dir);

        Ok(())
    }
}
