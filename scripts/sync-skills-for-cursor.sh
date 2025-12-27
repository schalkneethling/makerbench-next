#!/usr/bin/env bash

# sync-skills-for-cursor.sh
# Syncs Claude Code skills to Cursor rules format
#
# Usage: ./scripts/sync-skills-for-cursor.sh
#
# Reads from:  .claude/skills/*/SKILL.md and .claude/skills/*/references/*.md
# Writes to:   .cursor/rules/*.mdc
#
# Transforms Claude skill frontmatter to Cursor format for "Apply intelligently"

set -euo pipefail

# Determine script location and component library root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPONENT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SKILLS_DIR="${COMPONENT_ROOT}/.claude/skills"
CURSOR_RULES_DIR="${COMPONENT_ROOT}/.cursor/rules"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if skills directory exists
if [[ ! -d "${SKILLS_DIR}" ]]; then
	echo -e "${RED}Error: Skills directory not found at ${SKILLS_DIR}${NC}"
	exit 1
fi

# Create cursor rules directory if it doesn't exist
mkdir -p "${CURSOR_RULES_DIR}"

# Function to extract a field from YAML frontmatter
# Usage: extract_frontmatter_field "file" "field_name"
extract_frontmatter_field() {
	local file="$1"
	local field="$2"

	# Check if file starts with ---
	if head -n 1 "$file" | grep -q "^---$"; then
		awk -v field="$field" '
			BEGIN { in_frontmatter = 0 }
			/^---$/ {
				if (in_frontmatter == 0) {
					in_frontmatter = 1
					next
				} else {
					exit
				}
			}
			in_frontmatter == 1 {
				# Match field: value (handles both quoted and unquoted)
				if ($0 ~ "^" field ":") {
					sub("^" field ":[[:space:]]*", "")
					# Remove surrounding quotes if present
					gsub(/^["'"'"']|["'"'"']$/, "")
					print
					exit
				}
			}
		' "$file"
	fi
}

# Function to extract globs array from YAML frontmatter
# Usage: extract_globs "file"
extract_globs() {
	local file="$1"

	if head -n 1 "$file" | grep -q "^---$"; then
		awk '
			BEGIN { in_frontmatter = 0; in_globs = 0 }
			/^---$/ {
				if (in_frontmatter == 0) {
					in_frontmatter = 1
					next
				} else {
					exit
				}
			}
			in_frontmatter == 1 {
				if (/^globs:/) {
					in_globs = 1
					next
				}
				if (in_globs == 1) {
					if (/^[[:space:]]+-[[:space:]]+/) {
						# Extract glob pattern from "  - pattern" format
						sub(/^[[:space:]]+-[[:space:]]+/, "")
						gsub(/["'"'"']/, "")
						print
					} else if (/^[a-zA-Z]/) {
						# New field started, stop
						exit
					}
				}
			}
		' "$file"
	fi
}

# Function to get markdown body (after frontmatter)
get_body() {
	local file="$1"

	# Check if file starts with ---
	if head -n 1 "$file" | grep -q "^---$"; then
		awk '
			BEGIN { in_frontmatter = 0; found_end = 0 }
			/^---$/ {
				if (in_frontmatter == 0) {
					in_frontmatter = 1
					next
				} else if (found_end == 0) {
					found_end = 1
					next
				}
			}
			found_end == 1 { print }
		' "$file"
	else
		cat "$file"
	fi
}

# Function to escape double quotes for YAML
escape_yaml_string() {
	local str="$1"
	# Escape backslashes first, then double quotes
	str="${str//\\/\\\\}"
	str="${str//\"/\\\"}"
	echo "$str"
}

# Function to generate Cursor frontmatter
# Usage: generate_cursor_frontmatter "description" "globs_string"
# globs_string is newline-separated list of globs
generate_cursor_frontmatter() {
	local description="$1"
	local globs_string="$2"

	echo "---"
	if [[ -n "$description" ]]; then
		local escaped_desc
		escaped_desc=$(escape_yaml_string "$description")
		echo "description: \"$escaped_desc\""
	fi
	if [[ -n "$globs_string" ]]; then
		echo "globs:"
		echo "$globs_string" | while IFS= read -r glob; do
			[[ -n "$glob" ]] && echo "  - \"$glob\""
		done
	fi
	echo "---"
}

# Track counts
synced_count=0
skipped_count=0

# Helper to increment counts (avoids set -e issues with arithmetic returning 0)
increment_synced() { synced_count=$((synced_count + 1)); }
increment_skipped() { skipped_count=$((skipped_count + 1)); }

echo "Syncing Claude skills to Cursor rules..."
echo "Source: ${SKILLS_DIR}"
echo "Target: ${CURSOR_RULES_DIR}"
echo ""

# Process each skill directory
for skill_dir in "${SKILLS_DIR}"/*/; do
	# Skip if not a directory
	[[ ! -d "${skill_dir}" ]] && continue

	skill_name="$(basename "${skill_dir}")"
	skill_file="${skill_dir}SKILL.md"

	# Check if SKILL.md exists
	if [[ ! -f "${skill_file}" ]]; then
		echo -e "${YELLOW}Skipping ${skill_name}: No SKILL.md found${NC}"
		increment_skipped
		continue
	fi

	# Extract description from Claude skill frontmatter
	description=$(extract_frontmatter_field "${skill_file}" "description")

	# Extract globs if present (as newline-separated string)
	globs=$(extract_globs "${skill_file}")

	# Generate Cursor rule file
	output_file="${CURSOR_RULES_DIR}/${skill_name}.mdc"
	{
		generate_cursor_frontmatter "$description" "$globs"
		get_body "${skill_file}"
	} > "${output_file}"

	echo -e "${GREEN}✓${NC} ${skill_name}.mdc"
	increment_synced

	# Process reference files if they exist
	references_dir="${skill_dir}references"
	if [[ -d "${references_dir}" ]]; then
		for ref_file in "${references_dir}"/*.md; do
			[[ ! -f "${ref_file}" ]] && continue

			ref_name="$(basename "${ref_file}" .md)"
			ref_output="${CURSOR_RULES_DIR}/${ref_name}.mdc"

			# Check if reference file has its own frontmatter
			ref_description=$(extract_frontmatter_field "${ref_file}" "description")
			ref_globs=$(extract_globs "${ref_file}")

			# If no description in reference, create one based on filename
			if [[ -z "$ref_description" ]]; then
				# Convert kebab-case to sentence: "schema-and-mocks" -> "schema and mocks"
				ref_description=$(echo "$ref_name" | sed 's/-/ /g')
				# Capitalize first letter (portable way)
				first_char=$(echo "$ref_description" | cut -c1 | tr '[:lower:]' '[:upper:]')
				rest=$(echo "$ref_description" | cut -c2-)
				ref_description="${first_char}${rest} reference documentation"
			fi

			{
				generate_cursor_frontmatter "$ref_description" "$ref_globs"
				get_body "${ref_file}"
			} > "${ref_output}"

			echo -e "${GREEN}✓${NC} ${ref_name}.mdc (from ${skill_name}/references/)"
			increment_synced
		done
	fi
done

echo ""
echo "Done. Synced ${synced_count} file(s), skipped ${skipped_count}."
