#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime_directory="$project_root/ruffle-runtime"
temporary_directory=$(mktemp -d)

cleanup() {
    rm -rf "$temporary_directory"
}
trap cleanup EXIT INT TERM

echo "Fetching the latest Ruffle nightly package..."
npm pack --silent --ignore-scripts --pack-destination "$temporary_directory" "@ruffle-rs/ruffle@nightly" >/dev/null
archive=$(find "$temporary_directory" -maxdepth 1 -type f -name '*.tgz' -print -quit)

if [ -z "$archive" ]; then
    echo "Could not download the Ruffle package." >&2
    exit 1
fi

mkdir "$temporary_directory/package"
tar -xzf "$archive" -C "$temporary_directory/package" --strip-components=1
mkdir "$temporary_directory/runtime"
find "$temporary_directory/package" -maxdepth 1 -type f \( -name '*.js' -o -name '*.wasm' \) -exec cp {} "$temporary_directory/runtime/" \;

runtime_count=$(find "$temporary_directory/runtime" -maxdepth 1 -type f | wc -l | tr -d ' ')
if [ "$runtime_count" -lt 3 ]; then
    echo "The downloaded Ruffle package did not contain a complete runtime." >&2
    exit 1
fi

mkdir -p "$runtime_directory"
find "$runtime_directory" -maxdepth 1 -type f \( -name '*.js' -o -name '*.wasm' \) -delete
cp "$temporary_directory/runtime"/* "$runtime_directory/"
echo "Updated $runtime_count Ruffle runtime files in ruffle-runtime/."
