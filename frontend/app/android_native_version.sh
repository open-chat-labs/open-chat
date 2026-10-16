#!/usr/bin/env bash
# Prints the version of the oldest Android release whose native code is
# identical to HEAD's, or the given version if the previous release differs.
# The release workflow writes the result into the GitHub release body, and the
# app announces a new APK only when its own shell is older than that: a release
# that only refreshed the web bundle changes nothing for a user taking OTA
# updates.
#
# Usage: android_native_version.sh <version being released, e.g. 2.0.2125>
#
# Needs the android tags, so the checkout must not be shallow.
#
# The root Cargo.lock is deliberately not watched: backend crates change it on
# almost every release, which would make every release native. A release whose
# only native change is a dependency bump is therefore not announced.
set -euo pipefail

VERSION=$1

NATIVE_PATHS=(
    ':(top)frontend/src-tauri'
    ':(top,exclude)frontend/src-tauri/gen/apple'
    ':(top,exclude)frontend/src-tauri/icons/ios'
    ':(top,exclude)frontend/src-tauri/tauri.ios.conf.json'
    ':(top,exclude)frontend/src-tauri/tests'
    ':(top,exclude,glob)frontend/src-tauri/**/*.md'
    ':(top)frontend/tauri-plugin-oc/src'
    ':(top)frontend/tauri-plugin-oc/android'
    ':(top)frontend/tauri-plugin-oc/build.rs'
    ':(top)frontend/tauri-plugin-oc/Cargo.toml'
    ':(top)frontend/tauri-plugin-oc/permissions'
)

older_than_release() {
    [ "$1" != "$VERSION" ] && [ "$(printf '%s\n%s\n' "$1" "$VERSION" | sort -V | head -n1)" = "$1" ]
}

NATIVE_VERSION=$VERSION
for tag in $(git tag -l 'v*-android' --sort=-v:refname); do
    v=${tag#v}
    v=${v%%-*}
    older_than_release "$v" || continue
    # Stops at the first release whose native code differs. A git failure stops
    # it too, which errs towards announcing.
    git diff --quiet "$tag" HEAD -- "${NATIVE_PATHS[@]}" || break
    NATIVE_VERSION=$v
done

echo "$NATIVE_VERSION"
