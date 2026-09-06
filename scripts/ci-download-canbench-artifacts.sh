#!/usr/bin/env bash
set -Eexuo pipefail

# Identifies the benchmarks provided in the artifacts and outputs them.

# No result artifacts means the benchmarks job was skipped (a frontend-only PR), so there is
# nothing to post. Leave pr_number empty; the post-comment job checks it and skips. Results
# without a PR number are a broken upload, and fall through to fail on the missing file below.
if ! compgen -G "canbench_result_*" > /dev/null; then
  echo "No benchmark result artifacts found, nothing to post"
  echo "matrix={\"benchmark\": []}" >> "$GITHUB_OUTPUT"
  echo "pr_number=" >> "$GITHUB_OUTPUT"
  exit 0
fi

json_array="["
# Loop through each file with prefix "canbench_result_" in the current directory
for file in canbench_result_*; do
if [ -e "$file" ]; then  # Check if the file exists.
  # Read the content of the file, escaping double quotes and adding escaped newlines
  content=$(<"$file/$file" sed 's/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed '$ s/\\n$//')

  # Construct a JSON object for the current file with "title" and "result" keys
  json_object="{\"title\":\"$file\",\"result\":\"$content\"},"

  # Append the JSON object to the array string
  json_array+="$json_object"
fi
done

# Remove the trailing comma from the JSON array string
json_array=${json_array%,}

# Close the JSON array string
json_array+="]"

if [ ! -e ./pr_number/pr_number ]; then
  echo "Benchmark results were uploaded but the pr_number artifact is missing" >&2
  exit 1
fi

# Output the benchmarks and PR number to be used by the next job.
echo "matrix={\"benchmark\": $json_array}" >> "$GITHUB_OUTPUT"
echo "pr_number=$(cat ./pr_number/pr_number)" >> "$GITHUB_OUTPUT"
