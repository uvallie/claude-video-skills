#!/usr/bin/env bash
# Перевірка: що вже стоїть, чого бракує. Нічого не встановлює — лише друкує звіт.
# Запуск: bash check.sh [папка-проєкту]
PROJECT="${1:-$PWD}"
ok()   { printf '  ✅ %s\n' "$1"; }
miss() { printf '  ❌ %s — %s\n' "$1" "$2"; MISSING=1; }
opt()  { printf '  ➖ %s — %s\n' "$1" "$2"; }

OS="$(uname -s)"
echo "Система: $OS $(uname -m)"
case "$OS" in
  Darwin) HINT_PM="brew install" ; command -v brew >/dev/null && ok "Homebrew" || miss "Homebrew" "встановити з https://brew.sh (менеджер програм для Mac)";;
  Linux)  HINT_PM="sudo apt install";;
  *)      HINT_PM="winget install";;
esac

echo "Обов'язкове:"
if command -v node >/dev/null; then
  V=$(node -v | tr -d v | cut -d. -f1)
  [ "$V" -ge 18 ] && ok "Node.js $(node -v)" || miss "Node.js $(node -v)" "потрібна версія 18+"
else miss "Node.js" "$HINT_PM node"; fi
command -v npm >/dev/null && ok "npm" || miss "npm" "ставиться разом з Node.js"
command -v ffmpeg >/dev/null && ok "FFmpeg ($(ffmpeg -version | head -1 | cut -d' ' -f3))" || miss "FFmpeg" "$HINT_PM ffmpeg"

echo "Проєкт ($PROJECT):"
[ -f "$PROJECT/animation.config.json" ] && ok "animation.config.json (налаштування вже є)" || opt "animation.config.json" "ще не створено — пройдемо знайомство"
[ -d "$PROJECT/engine/node_modules/@resvg" ] && ok "рушій engine/ встановлено" || opt "рушій engine/" "ще не скопійовано або не виконано npm install"
for d in "Сценарії" "Референси" "Готове"; do [ -d "$PROJECT/$d" ] && ok "папка «$d»" || opt "папка «$d»" "створимо"; done

echo "Ключі (необов'язково, лише для голосу):"
ENV="$PROJECT/.env"
for k in GEMINI_API_KEY ELEVENLABS_API_KEY OPENAI_API_KEY; do
  if [ -n "${!k}" ] || { [ -f "$ENV" ] && grep -Eq "^\s*$k\s*=\s*\S+" "$ENV"; }; then ok "$k є (значення не показуємо)"; else opt "$k" "немає"; fi
done
if [ -f "$ENV" ] && [ -d "$PROJECT/.git" ] && ! grep -qx '.env' "$PROJECT/.gitignore" 2>/dev/null; then
  miss ".gitignore" "додайте рядок .env, щоб ключ не потрапив у git"
fi

[ -z "$MISSING" ] && echo "Готово: усе потрібне стоїть." || echo "Чогось бракує (❌) — Claude запропонує встановити."
