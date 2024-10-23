#!/bin/sh

echo ">> Building contract"

rustup target add wasm32-unknown-unknown
cargo build --workspace --target wasm32-unknown-unknown --release
