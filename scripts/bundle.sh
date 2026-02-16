#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "Building dist..."
yarn build

echo "Packing tarball..."
cd dist
npm pack

TARBALL=$(ls -t *.tgz | head -1)
mv "$TARBALL" "$ROOT_DIR/$TARBALL"

echo "Done: $ROOT_DIR/$TARBALL"
echo ""
echo "Install in laurel-mobile:"
echo "  npm install ../watermelon-db/$TARBALL"
