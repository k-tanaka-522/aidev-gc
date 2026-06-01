#!/bin/bash
# Claude Code statusLine — プロジェクトのフェーズ/QA状況をステータス行に表示
# 標準入力で Claude Code から JSON が渡される（model 情報等）

input=$(cat 2>/dev/null)
model=$(echo "$input" | grep -o '"display_name" *: *"[^"]*"' | head -1 | sed 's/.*: *"//;s/"$//')
[ -z "$model" ] && model="Claude"

STATE_FILE="outputs/80_PM/01_スケジュール/project_state.yaml"
phase="Phase 0"
qa=0
if [ -f "$STATE_FILE" ]; then
  phase=$(grep -m1 'current_phase:' "$STATE_FILE" | sed 's/.*current_phase: *//;s/"//g' | tr -d '\r')
  qa=$(grep -m1 'open_qa_count:' "$STATE_FILE" | sed 's/.*open_qa_count: *//;s/"//g' | tr -d '\r')
  [ -z "$phase" ] && phase="Phase 0"
  [ -z "$qa" ] && qa=0
fi

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "-")

printf '🛰️  %s | 📋 %s | ❓QA:%s | 🌿 %s' "$model" "$phase" "$qa" "$branch"
