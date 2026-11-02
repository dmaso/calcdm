#!/bin/sh
# Copies the files the app needs into dist/, ready to upload to any static web host.
set -e
cd "$(dirname "$0")"
rm -rf dist
mkdir dist
cp index.html style.css app.js sw.js manifest.webmanifest calc-icon.png dist/
echo "Built dist/:"
ls -A dist
