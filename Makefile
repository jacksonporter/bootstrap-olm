# Variables
BINARY_NAME=bootstrap-olm
PKG=./...
GO_FILES=$(shell find . -name '*.go' -type f)

# Default target
all: build

# Build the binary
build:
	go build -o $(BINARY_NAME) main.go

build_container:
	podman build -t localhost/bootstrap-olm:latest --build-arg GOLANG_VERSION=$$(cat .go-version) .

build_debug_container:
	podman build -t localhost/bootstrap-olm:debug-latest --build-arg GOLANG_VERSION=$$(cat .go-version) --target debug .

# Run tests
test:
	go test $(PKG) -v

# Run the application
run: build
	./$(BINARY_NAME)

run_container: build_container
	podman run --rm -it localhost/bootstrap-olm:latest

# Clean up binaries and other generated files
clean:
	go clean
	rm -f $(BINARY_NAME)

# Format the code
fmt:
	go fmt $(PKG)

# Install dependencies
deps:
	go mod tidy

.PHONY: all build test run clean fmt deps lint generate
