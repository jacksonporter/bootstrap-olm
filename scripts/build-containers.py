#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional

ImageType = Literal['debug', 'production']


@dataclass
class ImageConfig:
    """Configuration for container images."""
    type: ImageType
    tag: str
    target: Optional[str] = None
    containerfile: Path = Path('Containerfile')


IMAGE_CONFIGURATION: dict[ImageType, ImageConfig] = {
    'debug': ImageConfig(
        type='debug',
        tag='local/bootstrap-olm:debug',
        target='debug',
    ),
    'production': ImageConfig(
        type='production',
        tag='local/bootstrap-olm:prod',
    ),
}


def read_go_version() -> str:
    """Read Go version from .go-version file."""
    with open('.go-version', 'r') as f:
        return f.read().strip()


def generate_build_command(
    config: ImageConfig,
    go_version: str,
) -> str:
    """Generate podman build command for given image type."""
    target_arg = f"--target {config.target} " if config.target else ''
    return (
        f"podman build --build-arg GO_VERSION={go_version} "
        f"{target_arg}"
        f"-t {config.tag} "
        f"-f {config.containerfile} ."
    )


def run_command(cmd: str) -> None:
    """Execute a shell command and handle errors."""
    try:
        subprocess.run(cmd, check=True, shell=True)
    except subprocess.CalledProcessError as e:
        print(
            f"Error running command: {cmd}",
            file=sys.stderr,
        )
        sys.exit(e.returncode)


def build_image(
    config: ImageConfig,
    go_version: str,
) -> None:
    """Build a single container image."""
    if not config.containerfile.exists():
        print(
            f"Error: Containerfile not found at {config.containerfile}",
            file=sys.stderr,
        )
        sys.exit(1)

    cmd = generate_build_command(config, go_version)
    print(f"Building {config.type} image...")
    run_command(cmd)
    print(f"Successfully built {config.type} image")


def main() -> None:
    """Main entry point."""
    go_version = read_go_version()
    print(f"Building images with Go version: {go_version}")

    for config in IMAGE_CONFIGURATION.values():
        build_image(config, go_version)


if __name__ == '__main__':
    main()
