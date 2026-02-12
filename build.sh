#!/usr/bin/env bash
# Render build script
set -o errexit   # exit on error

echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Installing dependencies..."
pip install -r requirements.txt

echo "==> Creating uploads directory..."
mkdir -p uploads

echo "==> Build complete!"
