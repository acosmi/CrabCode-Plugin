#!/usr/bin/env bash

if [[ -n "${CRABACCOUNT_COMMON_SH_LOADED:-}" ]]; then
  return 0
fi
CRABACCOUNT_COMMON_SH_LOADED=1

ca_now_utc() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
}

ca_json_escape_fallback() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/[[:cntrl:]]/ /g'
}

ca_error_json() {
  local code="$1"
  local message="$2"
  if command -v jq >/dev/null 2>&1; then
    jq -cn --arg code "$code" --arg message "$message" \
      '{ok:false,error:{code:$code,message:$message}}'
  else
    printf '{"ok":false,"error":{"code":"%s","message":"%s"}}\n' \
      "$(ca_json_escape_fallback "$code")" "$(ca_json_escape_fallback "$message")"
  fi
}

ca_die() {
  local code="$1"
  local message="$2"
  local exit_code="${3:-1}"
  ca_error_json "$code" "$message"
  exit "$exit_code"
}

ca_warn() {
  printf 'CrabAccount: %s\n' "$*" >&2
}

ca_is_symlink() {
  [[ -L "$1" ]]
}

ca_file_mode() {
  local file="$1"
  if stat -f '%Lp' "$file" >/dev/null 2>&1; then
    stat -f '%Lp' "$file"
  else
    stat -c '%a' "$file"
  fi
}

ca_init() {
  local data_dir="$1"
  local protected_dir
  umask 077
  [[ -n "$data_dir" ]] || ca_die "DATA_DIR_REQUIRED" "--data-dir is required"
  [[ "$data_dir" == /* ]] || ca_die "VALIDATION_ERROR" "--data-dir must be an absolute path"
  if [[ -e "$data_dir" ]] && ca_is_symlink "$data_dir"; then
    ca_die "UNSAFE_DATA_DIR" "data directory must not be a symbolic link"
  fi
  mkdir -p "$data_dir" || ca_die "LOCAL_IO_ERROR" "cannot create data directory"
  chmod 700 "$data_dir" || ca_die "LOCAL_IO_ERROR" "cannot protect data directory"

  CA_DATA_DIR="$data_dir"
  CA_CONFIG_FILE="$CA_DATA_DIR/config.json"
  CA_TOKEN_FILE="$CA_DATA_DIR/token.json"
  CA_COMPAT_FILE="$CA_DATA_DIR/compatibility.json"
  CA_PENDING_DIR="$CA_DATA_DIR/pending"
  CA_JOURNAL_DIR="$CA_DATA_DIR/journal"
  CA_TMP_DIR="$CA_DATA_DIR/tmp"
  for protected_dir in "$CA_PENDING_DIR" "$CA_JOURNAL_DIR" "$CA_TMP_DIR"; do
    [[ ! -L "$protected_dir" ]] || ca_die "UNSAFE_PATH" "plugin data subdirectories must not be symbolic links"
  done
  mkdir -p "$CA_PENDING_DIR" "$CA_JOURNAL_DIR" "$CA_TMP_DIR" \
    || ca_die "LOCAL_IO_ERROR" "cannot create protected data subdirectories"
  chmod 700 "$CA_PENDING_DIR" "$CA_JOURNAL_DIR" "$CA_TMP_DIR" \
    || ca_die "LOCAL_IO_ERROR" "cannot protect data subdirectories"
}

ca_require_core_deps() {
  command -v curl >/dev/null 2>&1 || ca_die "DEPENDENCY_MISSING" "curl is required"
  command -v jq >/dev/null 2>&1 || ca_die "DEPENDENCY_MISSING" "jq is required"
  ca_sha256_available || ca_die "DEPENDENCY_MISSING" "shasum, sha256sum, or openssl is required for SHA-256"
}

ca_sha256_available() {
  command -v shasum >/dev/null 2>&1 || command -v sha256sum >/dev/null 2>&1 || command -v openssl >/dev/null 2>&1
}

ca_sha256_text() {
  local value="$1"
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$value" | shasum -a 256 | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$value" | sha256sum | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    printf '%s' "$value" | openssl dgst -sha256 | awk '{print $NF}'
  else
    return 1
  fi
}

ca_sha256_file() {
  local file="$1"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$file" | awk '{print $NF}'
  else
    return 1
  fi
}

ca_atomic_write() {
  local target="$1"
  local mode="${2:-600}"
  local dir
  local tmp
  dir=$(dirname "$target")
  mkdir -p "$dir" || ca_die "LOCAL_IO_ERROR" "cannot create protected parent directory"
  [[ ! -L "$target" ]] || ca_die "UNSAFE_PATH" "refusing to replace a symbolic link"
  tmp=$(mktemp "$dir/.crabaccount.XXXXXX") || ca_die "LOCAL_IO_ERROR" "cannot create protected temporary file"
  chmod "$mode" "$tmp" || { rm -f "$tmp"; ca_die "LOCAL_IO_ERROR" "cannot protect temporary file"; }
  if ! cat > "$tmp"; then
    rm -f "$tmp"
    ca_die "LOCAL_IO_ERROR" "cannot write protected temporary file"
  fi
  mv -f "$tmp" "$target" || { rm -f "$tmp"; ca_die "LOCAL_IO_ERROR" "cannot install protected file"; }
  chmod "$mode" "$target" || ca_die "LOCAL_IO_ERROR" "cannot protect installed file"
}

ca_is_valid_port() {
  local port="$1"
  [[ "$port" =~ ^[0-9]{1,5}$ ]] || return 1
  (( 10#$port >= 1 && 10#$port <= 65535 ))
}

ca_is_ipv4_loopback() {
  local host="$1"
  local index octet
  [[ "$host" =~ ^127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$ ]] || return 1
  for index in 1 2 3; do
    octet="${BASH_REMATCH[$index]}"
    (( 10#$octet <= 255 )) || return 1
  done
}

ca_validate_base_url() {
  local input="$1"
  local rest authority host scheme suffix port=""
  [[ -n "$input" ]] || return 1
  if printf '%s' "$input" | LC_ALL=C grep -q '[[:space:][:cntrl:]]'; then
    return 1
  fi
  case "$input" in
    *\?*|*\#*) return 1 ;;
  esac
  if [[ "$input" != http://* && "$input" != https://* ]]; then
    return 1
  fi
  scheme="${input%%://*}"
  rest="${input#*://}"
  authority="${rest%%/*}"
  [[ -n "$authority" ]] || return 1
  case "$authority" in
    *@*) return 1 ;;
  esac
  input="${input%/}"
  [[ -n "$input" ]] || return 1
  case "$input" in
    */api|*/api/) return 1 ;;
  esac

  if [[ "$scheme" == "http" ]]; then
    host="$authority"
    if [[ "$authority" == \[* ]]; then
      [[ "$authority" == *']'* ]] || return 1
      host="${authority%%]*}"
      host="${host}]"
      suffix="${authority#"$host"}"
      if [[ -n "$suffix" ]]; then
        [[ "$suffix" == :* ]] || return 1
        port="${suffix#:}"
        ca_is_valid_port "$port" || return 1
      fi
    else
      case "$authority" in
        *:*:*) return 1 ;;
        *:*)
          host="${authority%:*}"
          port="${authority##*:}"
          ca_is_valid_port "$port" || return 1
          ;;
      esac
    fi
    if [[ "$host" != "localhost" && "$host" != "[::1]" ]] && ! ca_is_ipv4_loopback "$host"; then
      [[ "${CRABACCOUNT_ALLOW_INSECURE_HTTP:-0}" == "1" ]] || return 2
    fi
  fi

  CA_BASE_URL_NORMALIZED="$input"
  CA_API_BASE_NORMALIZED="${input}/api"
  return 0
}

ca_load_config() {
  [[ -f "$CA_CONFIG_FILE" ]] || ca_die "CONFIG_REQUIRED" "run config set before contacting the ledger" 2
  [[ ! -L "$CA_CONFIG_FILE" ]] || ca_die "UNSAFE_PATH" "config file must not be a symbolic link"
  chmod 600 "$CA_CONFIG_FILE" || ca_die "LOCAL_IO_ERROR" "cannot protect config file"
  jq -e '.schemaVersion == 1 and (.baseUrl|type=="string") and (.apiBase|type=="string")' \
    "$CA_CONFIG_FILE" >/dev/null 2>&1 || ca_die "CONFIG_INVALID" "config file is invalid"
  CA_BASE_URL=$(jq -r '.baseUrl' "$CA_CONFIG_FILE")
  CA_API_BASE=$(jq -r '.apiBase' "$CA_CONFIG_FILE")
  CA_USERNAME=$(jq -r '.username // ""' "$CA_CONFIG_FILE")
  ca_validate_base_url "$CA_BASE_URL"
  local rc=$?
  [[ "$rc" == "0" ]] || ca_die "CONFIG_INVALID" "configured base URL no longer passes the transport policy"
  [[ "$CA_API_BASE" == "$CA_API_BASE_NORMALIZED" ]] || ca_die "CONFIG_INVALID" "configured API base is inconsistent"
}

ca_save_config() {
  local username="$1"
  local old_api="" config_json
  if [[ -f "$CA_CONFIG_FILE" && ! -L "$CA_CONFIG_FILE" ]]; then
    old_api=$(jq -r '.apiBase // ""' "$CA_CONFIG_FILE" 2>/dev/null || true)
  fi
  config_json=$(jq -cn \
    --arg baseUrl "$CA_BASE_URL_NORMALIZED" \
    --arg apiBase "$CA_API_BASE_NORMALIZED" \
    --arg username "$username" \
    '{schemaVersion:1,baseUrl:$baseUrl,apiBase:$apiBase,username:$username}') \
    || ca_die "LOCAL_IO_ERROR" "cannot serialize configuration"
  ca_atomic_write "$CA_CONFIG_FILE" 600 <<<"$config_json"
  if [[ -n "$old_api" && "$old_api" != "$CA_API_BASE_NORMALIZED" ]]; then
    [[ ! -L "$CA_TOKEN_FILE" ]] || ca_die "UNSAFE_PATH" "token file must not be a symbolic link"
    [[ ! -L "$CA_COMPAT_FILE" ]] || ca_die "UNSAFE_PATH" "compatibility file must not be a symbolic link"
    rm -f "$CA_TOKEN_FILE" "$CA_COMPAT_FILE" || ca_die "LOCAL_IO_ERROR" "cannot invalidate origin-bound credentials"
  fi
  CA_BASE_URL="$CA_BASE_URL_NORMALIZED"
  CA_API_BASE="$CA_API_BASE_NORMALIZED"
  CA_USERNAME="$username"
}

ca_load_token() {
  CA_TOKEN=""
  [[ -f "$CA_TOKEN_FILE" ]] || return 0
  [[ ! -L "$CA_TOKEN_FILE" ]] || ca_die "UNSAFE_PATH" "token file must not be a symbolic link"
  chmod 600 "$CA_TOKEN_FILE" || ca_die "LOCAL_IO_ERROR" "cannot protect token file"
  jq -e --arg api "$CA_API_BASE" '.schemaVersion == 1 and .apiBase == $api and (.token|type=="string")' \
    "$CA_TOKEN_FILE" >/dev/null 2>&1 || return 0
  CA_TOKEN=$(jq -r '.token' "$CA_TOKEN_FILE")
  case "$CA_TOKEN" in
    *\"*|*\\*|*$'\n'*|*$'\r'*)
      CA_TOKEN=""
      ca_die "TOKEN_INVALID" "stored token contains unsafe characters"
      ;;
  esac
}

ca_save_token() {
  local token="$1"
  local token_json
  [[ -n "$token" ]] || ca_die "AUTH_RESPONSE_INVALID" "login response did not include a token"
  case "$token" in
    *\"*|*\\*|*$'\n'*|*$'\r'*) ca_die "AUTH_RESPONSE_INVALID" "login token contains unsafe characters" ;;
  esac
  token_json=$(jq -cn --arg apiBase "$CA_API_BASE" --arg token "$token" --arg savedAt "$(ca_now_utc)" \
    '{schemaVersion:1,apiBase:$apiBase,token:$token,savedAt:$savedAt}') \
    || ca_die "LOCAL_IO_ERROR" "cannot serialize token record"
  ca_atomic_write "$CA_TOKEN_FILE" 600 <<<"$token_json"
}

ca_clear_token() {
  if [[ -L "$CA_TOKEN_FILE" ]]; then
    ca_die "UNSAFE_PATH" "token file must not be a symbolic link"
  fi
  rm -f "$CA_TOKEN_FILE" || ca_die "LOCAL_IO_ERROR" "cannot remove token file"
  CA_TOKEN=""
}

ca_lock_acquire() {
  CA_LOCK_DIR="$CA_DATA_DIR/write.lock"
  if ! mkdir "$CA_LOCK_DIR" 2>/dev/null; then
    ca_die "WRITE_LOCKED" "another CrabAccount write is already running" 3
  fi
  chmod 700 "$CA_LOCK_DIR" || { rmdir "$CA_LOCK_DIR" 2>/dev/null || true; ca_die "LOCAL_IO_ERROR" "cannot protect write lock"; }
  trap 'rmdir "$CA_LOCK_DIR" 2>/dev/null || true' EXIT HUP INT TERM
}

ca_lock_release() {
  if [[ -n "${CA_LOCK_DIR:-}" ]]; then
    rmdir "$CA_LOCK_DIR" 2>/dev/null || true
    CA_LOCK_DIR=""
    trap - EXIT HUP INT TERM
  fi
}
