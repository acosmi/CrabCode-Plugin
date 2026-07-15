#!/usr/bin/env bash
set -uo pipefail

state="${FAKE_CURL_STATE_DIR:?}"
log="${FAKE_CURL_LOG:?}"
mkdir -p "$state"
printf '%s' "${CRABACCOUNT_PASSWORD-}" > "$state/password-env"
{
  printf 'ARGV'
  for argument in "$@"; do
    printf ' <%s>' "$argument"
  done
  printf '\n'
} >> "$log"

output=""
method="GET"
body_file=""
url=""
config_from_stdin=false
while (( $# > 0 )); do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    --request) method="$2"; shift 2 ;;
    --data-binary) body_file="${2#@}"; shift 2 ;;
    --config) [[ "$2" == "-" ]] && config_from_stdin=true; shift 2 ;;
    --write-out|--header|--connect-timeout|--max-time|--proto) shift 2 ;;
    --silent|--show-error) shift ;;
    *) url="$1"; shift ;;
  esac
done

if [[ "$config_from_stdin" == "true" ]]; then
  cat >> "$state/auth-config"
fi
if [[ -n "$body_file" ]]; then
  {
    printf '%s ' "$method"
    cat "$body_file"
    printf '\n'
  } >> "$state/request-bodies"
fi

response='{"code":0,"data":{}}'
case "$url" in
  */api/auth/login)
    response='{"code":0,"data":{"token":"fake-login-token"}}'
    ;;
  */api/home/getVersion)
    response='{"code":0,"data":{"versions":{"release":"2.7.9"}}}'
    ;;
  */api/account/getAccount)
    response='{"code":0,"data":[{"id":1,"name":"现金"},{"id":2,"name":"银行卡"}]}'
    ;;
  */api/type/getType)
    response='{"code":0,"data":[{"id":10,"tname":"餐饮","childrenTypes":[]}]}'
    ;;
  */api/action/getAction)
    response='{"code":0,"data":[{"id":100,"hname":"支出","handle":1},{"id":101,"hname":"收入","handle":0},{"id":102,"hname":"转账","handle":2}]}'
    ;;
  */api/flow/addFlow)
    count_file="$state/write-count"
    count=0
    [[ ! -f "$count_file" ]] || count=$(<"$count_file")
    count=$((count + 1))
    printf '%s' "$count" > "$count_file"
    if [[ "${FAKE_CURL_FAIL_WRITE:-0}" == "1" ]]; then
      exit 28
    fi
    cp "$body_file" "$state/flow-payload"
    response='{"code":0,"data":{"id":900}}'
    ;;
  */api/flow/updateFlow/900)
    cp "$body_file" "$state/flow-payload"
    response='{"code":0,"data":{"id":900}}'
    ;;
  */api/flow/getFlow/900)
    if [[ -f "$state/flow-payload" ]]; then
      payload=$(<"$state/flow-payload")
      response=$(jq -cn --argjson payload "$payload" '
        {
          code:0,
          data:({
            id:900,
            account:{id:$payload.accountId},
            type:{id:$payload.typeId},
            action:{id:$payload.actionId},
            money:$payload.money,
            fdate:$payload.fDate,
            note:($payload.note // ""),
            collect:($payload.collect // false),
            createDate:$payload.createDate
          } + (if $payload.accountToId then {accountTo:{id:$payload.accountToId}} else {} end))
        }')
    else
      response='{"code":0,"data":{"id":900,"account":{"id":1},"type":{"id":10},"action":{"id":100},"money":"5.00","fdate":"2026-07-01","note":"旧备注","collect":false,"createDate":"2026-07-01 09:00:00"}}'
    fi
    ;;
esac

printf '%s' "$response" > "$output"
printf '200'
