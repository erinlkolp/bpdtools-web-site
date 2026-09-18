#!/usr/bin/env bash
# Capture the three bpdtools app screens off a connected device, once per
# colour scheme, for the website's phone mockups.
#
# READ-ONLY with respect to your entries. The only taps that reach the app
# are navigation and filling the Log form; the Save button is never touched,
# and no History row is ever opened (tapping one opens it for edit, with a
# delete affordance alongside). scripts/verify-no-writes.sh checks this
# after the fact rather than trusting it.
#
# The status bar is put into SysUI demo mode first: a fixed clock, a full
# battery and NO notification icons. Without that, whatever happened to be
# in your status bar rides along into a public image.
#
# Both the demo mode and the device's night-mode setting are restored on
# exit, including on interrupt.
set -euo pipefail

PKG=com.bpdtools.app
OUT="$(cd "$(dirname "$0")/.." && pwd)/art/screens"
mkdir -p "$OUT"

# Bounds read from `uiautomator dump` on a 1080x2424 @420dpi Pixel 11.
# Re-derive these if you capture on another device.
NAV_LOG="172 2266"
NAV_HISTORY="539 2266"
NAV_TRENDS="907 2266"
CHIP_ANGER="144 530"
SLIDER_Y=1385
SLIDER_X0=27
SLIDER_X1=1053
NOTE_FIELD="179 1668"

ORIG_NIGHT="$(adb shell cmd uimode night | tr -d '\r' | awk '{print $3}')"

cleanup() {
  echo "restoring device state..."
  adb shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null 2>&1 || true
  adb shell settings put global sysui_demo_allowed 0 >/dev/null 2>&1 || true
  adb shell cmd uimode night "$ORIG_NIGHT" >/dev/null 2>&1 || true
  adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

tap() { adb shell input tap $1 >/dev/null; sleep 0.6; }
shot() { sleep 1.2; adb exec-out screencap -p > "$OUT/$1.png"; printf '  %-22s %s bytes\n' "$1.png" "$(stat -c%s "$OUT/$1.png")"; }

demo_mode_on() {
  adb shell settings put global sysui_demo_allowed 1 >/dev/null
  local b="adb shell am broadcast -a com.android.systemui.demo"
  $b -e command enter >/dev/null
  $b -e command clock -e hhmm 0941 >/dev/null
  $b -e command battery -e level 100 -e plugged false >/dev/null
  $b -e command network -e wifi show -e level 4 >/dev/null
  $b -e command network -e mobile show -e level 4 -e datatype none >/dev/null
  $b -e command notifications -e visible false >/dev/null
  sleep 1
}

fill_log_form() {
  # Form state only. This becomes an entry ONLY on Save, which we never tap.
  tap "$CHIP_ANGER"
  local x=$(( SLIDER_X0 + (SLIDER_X1 - SLIDER_X0) * 7 / 10 ))
  tap "$x $SLIDER_Y"
  tap "$NOTE_FIELD"
  adb shell input text 'Left%son%sread%sagain.' >/dev/null
  sleep 0.5
  adb shell input keyevent KEYCODE_BACK >/dev/null   # dismiss keyboard only
  sleep 0.8
}

capture_theme() {
  local theme="$1" night="$2"
  echo "== $theme =="
  adb shell cmd uimode night "$night" >/dev/null
  sleep 2
  demo_mode_on
  adb shell am force-stop "$PKG" >/dev/null
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 3.5
  fill_log_form
  shot "log-$theme"
  tap "$NAV_HISTORY";  shot "history-$theme"
  tap "$NAV_TRENDS";   shot "trends-$theme"
}

capture_theme light no
capture_theme dark yes
echo "captures in $OUT"
