# syntax=docker/dockerfile:1.4

# =============================================================================
# Build stage
# =============================================================================
ARG GO_VERSION
FROM --platform=$BUILDPLATFORM public.ecr.aws/docker/library/golang:${GO_VERSION}-alpine AS builder
ARG GO_VERSION

# Install build dependencies
RUN apk add --no-cache git make tzdata

# Set working directory
WORKDIR /build

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o bootstrap-olm .

# =============================================================================
# Debug stage
# =============================================================================
FROM public.ecr.aws/docker/library/alpine:3 AS debug

# hadolint ignore=DL3018
RUN apk update && apk upgrade && apk add --no-cache \
    bash \
    curl \
    ca-certificates \
    jq \
    coreutils

# Install kubectl
RUN KUBECTL_VERSION=$(curl -Ls https://dl.k8s.io/release/stable.txt) && \
    KUBECTL_ARCH=amd64 && \
    if [ "$TARGETARCH" = "arm64" ]; then KUBECTL_ARCH=arm64; fi && \
    curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/${TARGETOS}/${KUBECTL_ARCH}/kubectl" && \
    install -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl

COPY --from=builder /build/bootstrap-olm /usr/local/bin/bootstrap-olm
ENTRYPOINT ["/usr/local/bin/bootstrap-olm"]

# =============================================================================
# Production stage
# =============================================================================
FROM scratch

# Copy SSL certificates from alpine
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Copy timezone data from alpine
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

# Copy the binary from builder
COPY --from=builder /build/bootstrap-olm /bootstrap-olm

# Set the entrypoint
ENTRYPOINT ["/bootstrap-olm"]
