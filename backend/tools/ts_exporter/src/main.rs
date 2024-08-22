use std::collections::{HashSet, VecDeque};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::str::FromStr;

const EXPORT_PREFIX: &str = "export type ";

fn main() {
    let current_dir = std::env::current_dir().unwrap();
    let ts_bindings_dir = current_dir.join("tsBindings");

    let output_file = ts_bindings_dir.join("types.d.ts");
    if output_file.exists() {
        fs::remove_file(&output_file).unwrap();
    }

    let input_files = recurse_files(&ts_bindings_dir, ".ts");
    let all_exports: Vec<_> = input_files.into_iter().flat_map(extract_exports).collect();

    let mut types_available: HashSet<_> = ["string", "number", "boolean", "bigint", "Uint8Array"]
        .into_iter()
        .map(|s| s.to_string())
        .collect();

    let mut output = Vec::new();
    let mut remaining = VecDeque::from(all_exports);
    while !remaining.is_empty() {
        let mut next = remaining.pop_front().unwrap();

        if next.dependencies.iter().all(|d| types_available.contains(d)) {
            types_available.insert(next.name);
            writeln!(output, "{}", next.line).unwrap();
        } else if next.iterations < 50 {
            next.iterations += 1;
            remaining.push_back(next);
        } else {
            panic!("Loop detected: {next:?}");
        }
    }

    fs::write(output_file, output).unwrap();
}

fn recurse_files(path: impl AsRef<Path>, suffix: &str) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let entries = fs::read_dir(path).unwrap();

    for entry in entries.into_iter().map(|e| e.unwrap()) {
        let meta = entry.metadata().unwrap();

        if meta.is_dir() {
            let subdir = recurse_files(entry.path(), suffix);
            files.extend(subdir);
        }

        if meta.is_file() && entry.file_name().to_str().unwrap().ends_with(suffix) {
            files.push(entry.path());
        }
    }

    files
}

fn extract_exports(file: impl AsRef<Path>) -> Vec<ParsedExport> {
    fs::read_to_string(&file)
        .unwrap_or_else(|e| panic!("{e}. Path: {}", file.as_ref().display()))
        .lines()
        .filter_map(|l| ParsedExport::from_str(l).ok())
        .collect()
}

#[derive(Debug)]
struct ParsedExport {
    line: String,
    name: String,
    dependencies: Vec<String>,
    iterations: usize,
}

impl FromStr for ParsedExport {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim();

        if !s.starts_with(EXPORT_PREFIX) {
            return Err(());
        }

        let line = s.to_string();

        let (left, right) = s[EXPORT_PREFIX.len()..].split_once('=').unwrap();

        let name = left.trim().to_string();
        let cleaned = right
            .replace(' ', "")
            .replace("{[key:number]:", "")
            .replace("{[key:string]:", "");

        let mut dependencies = Vec::new();
        for segment in cleaned.split(':').skip(1).map(|s| s.trim()) {
            let end = segment.find(&[';', ',', '}']).unwrap_or(segment.len());

            let mut dependency = segment[..end].to_string();
            dependency = dependency.replace("Array<", "").replace(['>', '['], "");

            if !dependencies.contains(&dependency) {
                dependencies.push(dependency);
            }
        }

        Ok(ParsedExport {
            line,
            name,
            dependencies,
            iterations: 0,
        })
    }
}
