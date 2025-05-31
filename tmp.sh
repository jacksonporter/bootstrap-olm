#!/usr/bin/env bash

set -euo pipefail

# Get Go version from mise
GO_VERSION=$(mise current go)
ARCHS=("amd64" "arm64" "ppc64le" "s390x")

# Build for each architecture
for arch in "${ARCHS[@]}"; do
  podman build --platform linux/${arch} --build-arg GO_VERSION=${GO_VERSION} --target debug -t ghcr.io/jacksonporter/bootstrap-olm:debug-linux-${arch} .
done

# Create manifest
podman manifest create ghcr.io/jacksonporter/bootstrap-olm:debug \
  ghcr.io/jacksonporter/bootstrap-olm:debug-linux-amd64 \
  ghcr.io/jacksonporter/bootstrap-olm:debug-linux-arm64 \
  ghcr.io/jacksonporter/bootstrap-olm:debug-linux-ppc64le \
  ghcr.io/jacksonporter/bootstrap-olm:debug-linux-s390x
