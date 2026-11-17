#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

FILE="$HOME/.config/lovecraft/production-secrets.txt"

if [ ! -f "$FILE" ]; then
  echo "Secrets file not found."
  exit 1
fi

get_value() {
  sed -n "s/^$1=//p" "$FILE" | head -n 1
}

add_var() {
  local project="$1"
  local key="$2"
  local mode="$3"
  local value

  value="$(get_value "$key")"

  if [ -z "$value" ]; then
    echo "Missing: $key"
    exit 1
  fi

  if [ "$mode" = "secret" ]; then
    printf '%s' "$value" | vercel env add "$key" \
      --environment production --sensitive \
      --project "$project" --yes
  else
    printf '%s' "$value" | vercel env add "$key" \
      --environment production --no-sensitive \
      --project "$project" --yes
  fi

  echo "Added: $project / $key"
}

echo "===== WEBSITE ENVIRONMENT ====="

add_var lovecraft BOT_API_SECRET secret
add_var lovecraft QR_SIGNING_SECRET secret
add_var lovecraft CRON_SECRET secret
add_var lovecraft NEXT_PUBLIC_APP_URL config
add_var lovecraft TELEGRAM_BOT_USERNAME config

echo ""
echo "===== BOT ENVIRONMENT ====="

add_var bot BOT_API_SECRET secret
add_var bot TELEGRAM_WEBHOOK_SECRET secret
add_var bot BACKEND_API_URL config

echo ""
echo "Environment setup completed."
