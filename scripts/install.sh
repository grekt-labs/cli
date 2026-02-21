#!/bin/sh
set -eu

# Configuration
REPO="grekt-labs/cli"
INSTALL_DIR="${GREKT_INSTALL:-$HOME/.grekt/bin}"
BINARY_NAME="grekt"
CHANNEL="${GREKT_CHANNEL:-stable}"
GITHUB_API="https://api.github.com"
GITHUB_RELEASES="https://github.com/${REPO}/releases"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    CYAN='\033[0;36m'
    RESET='\033[0m'
else
    RED=''
    GREEN=''
    YELLOW=''
    CYAN=''
    RESET=''
fi

info() {
    printf "${CYAN}%s${RESET}\n" "$1"
}

success() {
    printf "${GREEN}%s${RESET}\n" "$1"
}

warn() {
    printf "${YELLOW}%s${RESET}\n" "$1"
}

error() {
    printf "${RED}error: %s${RESET}\n" "$1" >&2
    exit 1
}

# Check for required commands
check_command() {
    command -v "$1" >/dev/null 2>&1 || error "$1 is required but not installed"
}

# Detect OS
detect_os() {
    os="$(uname -s)"
    case "$os" in
        Linux*)  echo "linux" ;;
        Darwin*) echo "macos" ;;
        *)       error "Unsupported operating system: $os" ;;
    esac
}

# Detect architecture
detect_arch() {
    arch="$(uname -m)"
    case "$arch" in
        x86_64|amd64)  echo "x64" ;;
        arm64|aarch64) echo "arm64" ;;
        *)             error "Unsupported architecture: $arch" ;;
    esac
}

# Fetch JSON from GitHub API
fetch_github() {
    url="$1"

    if command -v curl >/dev/null 2>&1; then
        response=$(curl -fsSL "$url" 2>/dev/null) || error "Failed to fetch from GitHub API"
    elif command -v wget >/dev/null 2>&1; then
        response=$(wget -qO- "$url" 2>/dev/null) || error "Failed to fetch from GitHub API"
    else
        error "Either curl or wget is required"
    fi

    echo "$response"
}

# Get latest stable version from GitHub API
get_latest_stable_version() {
    response=$(fetch_github "${GITHUB_API}/repos/${REPO}/releases/latest")

    version=$(echo "$response" | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

    if [ -z "$version" ]; then
        error "Could not determine latest stable version"
    fi

    echo "$version" | sed 's/^v//'
}

# Get latest beta version from GitHub API
# /releases/latest only returns stable releases, so we list recent releases and find the first pre-release
get_latest_beta_version() {
    response=$(fetch_github "${GITHUB_API}/repos/${REPO}/releases?per_page=20")

    # Find the first release where prerelease is true and extract its tag_name
    # JSON structure: each release has "prerelease": true/false and "tag_name": "vX.Y.Z-beta.N"
    version=$(echo "$response" | grep -B5 '"prerelease"[[:space:]]*:[[:space:]]*true' | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

    if [ -z "$version" ]; then
        error "No beta releases found. Check available releases at ${GITHUB_RELEASES}"
    fi

    echo "$version" | sed 's/^v//'
}

# Get latest version based on channel
get_latest_version() {
    case "$CHANNEL" in
        stable) get_latest_stable_version ;;
        beta)   get_latest_beta_version ;;
        *)      error "Unknown channel: $CHANNEL. Use 'stable' or 'beta'" ;;
    esac
}

# Download file
download() {
    url="$1"
    output="$2"

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url" -o "$output" || return 1
    elif command -v wget >/dev/null 2>&1; then
        wget -q "$url" -O "$output" || return 1
    else
        error "Either curl or wget is required"
    fi
}

# Verify SHA256 checksum
verify_checksum() {
    file="$1"
    expected="$2"

    if command -v sha256sum >/dev/null 2>&1; then
        actual=$(sha256sum "$file" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        actual=$(shasum -a 256 "$file" | awk '{print $1}')
    else
        warn "Warning: Could not verify checksum (sha256sum/shasum not found)"
        return 0
    fi

    if [ "$actual" != "$expected" ]; then
        error "Checksum verification failed.\nExpected: $expected\nActual:   $actual"
    fi
}

# Detect shell profile file
detect_shell_profile() {
    shell_name="$(basename "${SHELL:-/bin/sh}")"

    case "$shell_name" in
        zsh)
            if [ -f "$HOME/.zshrc" ]; then
                echo "$HOME/.zshrc"
            else
                echo "$HOME/.zprofile"
            fi
            ;;
        bash)
            if [ -f "$HOME/.bashrc" ]; then
                echo "$HOME/.bashrc"
            elif [ -f "$HOME/.bash_profile" ]; then
                echo "$HOME/.bash_profile"
            else
                echo "$HOME/.profile"
            fi
            ;;
        *)
            echo "$HOME/.profile"
            ;;
    esac
}

# Add to PATH in shell profile
add_to_path() {
    profile="$1"
    path_line="export PATH=\"${INSTALL_DIR}:\$PATH\""

    # Check if already in profile
    if [ -f "$profile" ] && grep -q "$INSTALL_DIR" "$profile" 2>/dev/null; then
        return 0
    fi

    # Append to profile
    printf '\n# grekt CLI\n%s\n' "$path_line" >> "$profile"
    return 1
}

main() {
    if [ "$CHANNEL" = "beta" ]; then
        info "Installing grekt CLI (beta channel)..."
    else
        info "Installing grekt CLI..."
    fi
    echo

    # Detect platform
    os=$(detect_os)
    arch=$(detect_arch)
    platform="${os}-${arch}"

    # Validate platform combinations
    case "$platform" in
        linux-x64|macos-x64|macos-arm64) ;;
        linux-arm64) error "Linux ARM64 is not currently supported" ;;
        *) error "Unsupported platform: $platform" ;;
    esac

    info "Detecting platform... ${platform}"

    # Determine version
    if [ -n "${GREKT_VERSION:-}" ]; then
        version="$GREKT_VERSION"
    else
        version=$(get_latest_version)
    fi

    info "Downloading grekt v${version}..."

    # Build download URLs
    tarball_name="${BINARY_NAME}-${platform}.tar.gz"
    checksum_name="${tarball_name}.sha256"
    download_url="${GITHUB_RELEASES}/download/v${version}/${tarball_name}"
    checksum_url="${GITHUB_RELEASES}/download/v${version}/${checksum_name}"

    # Create temp directory
    tmp_dir=$(mktemp -d)
    trap 'rm -rf "$tmp_dir"' EXIT

    tarball_path="${tmp_dir}/${tarball_name}"
    checksum_path="${tmp_dir}/${checksum_name}"

    # Download tarball
    download "$download_url" "$tarball_path" || error "Failed to download ${tarball_name}"

    # Download and verify checksum
    if download "$checksum_url" "$checksum_path" 2>/dev/null; then
        expected_checksum=$(cat "$checksum_path" | awk '{print $1}')
        info "Verifying checksum..."
        verify_checksum "$tarball_path" "$expected_checksum"
        success "Checksum verified"
    else
        warn "Warning: Checksum file not found, skipping verification"
    fi

    # Create install directory
    mkdir -p "$INSTALL_DIR"

    # Extract binary
    info "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
    tar -xzf "$tarball_path" -C "$tmp_dir"

    # Binary in archive is named grekt-{platform} (e.g., grekt-linux-x64)
    archive_binary_name="${BINARY_NAME}-${platform}"

    # Find and move binary
    if [ -f "${tmp_dir}/${archive_binary_name}" ]; then
        mv "${tmp_dir}/${archive_binary_name}" "${INSTALL_DIR}/${BINARY_NAME}"
    elif [ -f "${tmp_dir}/${BINARY_NAME}" ]; then
        mv "${tmp_dir}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
    else
        error "Binary not found in archive"
    fi

    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

    echo
    success "grekt v${version} was installed successfully!"
    echo

    # Check if already in PATH
    case ":${PATH}:" in
        *":${INSTALL_DIR}:"*)
            info "Run 'grekt --help' to get started"
            ;;
        *)
            profile=$(detect_shell_profile)

            if add_to_path "$profile"; then
                info "PATH already configured in ${profile}"
            else
                success "Added to PATH in ${profile}"
            fi

            echo
            info "To start using grekt, run:"
            echo
            echo "  source ${profile}"
            echo
            info "Or open a new terminal, then run:"
            echo
            echo "  grekt --help"
            ;;
    esac
}

main "$@"
