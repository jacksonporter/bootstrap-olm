# syntax=docker/dockerfile:1

# =============================================================================
# Build stage
# =============================================================================
ARG GO_VERSION
FROM golang:${GO_VERSION}-alpine AS builder
ARG GO_VERSION

# hadolint ignore=DL3018
RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build -o bootstrap-olm .

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

COPY --from=builder /app/bootstrap-olm /usr/local/bin/bootstrap-olm
ENTRYPOINT ["/usr/local/bin/bootstrap-olm"]

# =============================================================================
# Production stage
# =============================================================================
FROM gcr.io/distroless/static:nonroot
COPY --from=builder /app/bootstrap-olm /
ENTRYPOINT ["/bootstrap-olm"]
