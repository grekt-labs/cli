import { execSync } from "child_process"
import { join } from "path"
import { homedir } from "os"
import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync, unlinkSync } from "fs"
import type { BinaryMetadata } from "./aguara.types"

const AGUARA_MIN_VERSION = "0.8.0"
const AGUARA_MAJOR = 0
const RECHECK_INTERVAL_DAYS = 7
const DOWNLOAD_TIMEOUT = 30_000

const BINARY_DIR = join(homedir(), ".grekt", "bin")
const BINARY_PATH = join(BINARY_DIR, process.platform === "win32" ? "aguara.exe" : "aguara")
const METADATA_PATH = join(BINARY_DIR, "aguara.json")

const GITHUB_RELEASES_API = "https://api.github.com/repos/garagon/aguara/releases"

const PLATFORM_MAP: Record<string, string> = {
  darwin: "darwin",
  linux: "linux",
  win32: "windows",
}

const ARCH_MAP: Record<string, string> = {
  x64: "amd64",
  arm64: "arm64",
}

/**
 * Resolve the aguara binary path.
 * Downloads or updates it if necessary.
 * Returns null if the binary cannot be obtained.
 */
export async function resolveBinary(): Promise<string | null> {
  const cached = readMetadata()

  if (cached && existsSync(BINARY_PATH)) {
    if (!isVersionCompatible(cached.version)) {
      return await tryUpdate(cached)
    }

    if (shouldRecheck(cached.lastCheck)) {
      return await tryUpdate(cached)
    }

    return BINARY_PATH
  }

  return await tryDownloadLatest()
}

function readMetadata(): BinaryMetadata | null {
  if (!existsSync(METADATA_PATH)) return null

  try {
    const content = readFileSync(METADATA_PATH, "utf-8")
    return JSON.parse(content) as BinaryMetadata
  } catch {
    return null
  }
}

function writeMetadata(metadata: BinaryMetadata): void {
  mkdirSync(BINARY_DIR, { recursive: true })
  writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2))
}

function isVersionCompatible(version: string): boolean {
  const parts = version.replace(/^v/, "").split(".").map(Number)
  const minParts = AGUARA_MIN_VERSION.split(".").map(Number)

  if (parts[0] !== AGUARA_MAJOR) return false

  for (let i = 0; i < minParts.length; i++) {
    if ((parts[i] ?? 0) < minParts[i]) return false
    if ((parts[i] ?? 0) > minParts[i]) return true
  }

  return true
}

function shouldRecheck(lastCheck: string): boolean {
  const last = new Date(lastCheck)
  const now = new Date()
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays >= RECHECK_INTERVAL_DAYS
}

function getAssetName(version: string): string {
  const os = PLATFORM_MAP[process.platform]
  const arch = ARCH_MAP[process.arch]

  if (!os || !arch) {
    throw new Error(`Unsupported platform: ${process.platform}/${process.arch}`)
  }

  const extension = process.platform === "win32" ? "zip" : "tar.gz"
  return `aguara_${version}_${os}_${arch}.${extension}`
}

async function fetchLatestCompatibleVersion(): Promise<{ version: string; downloadUrl: string } | null> {
  try {
    const response = await fetch(GITHUB_RELEASES_API, {
      headers: { "Accept": "application/vnd.github.v3+json" },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT),
    })

    if (!response.ok) return null

    const releases = await response.json() as Array<{
      tag_name: string
      assets: Array<{ name: string; browser_download_url: string }>
    }>

    for (const release of releases) {
      const version = release.tag_name.replace(/^v/, "")
      if (!isVersionCompatible(version)) continue

      const parts = version.split(".").map(Number)
      if (parts[0] !== AGUARA_MAJOR) continue

      const assetName = getAssetName(version)
      const asset = release.assets.find((a) => a.name === assetName)

      if (asset) {
        return { version, downloadUrl: asset.browser_download_url }
      }
    }

    return null
  } catch {
    return null
  }
}

async function downloadAndExtract(downloadUrl: string): Promise<boolean> {
  try {
    mkdirSync(BINARY_DIR, { recursive: true })

    const response = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT),
    })

    if (!response.ok) return false

    const buffer = Buffer.from(await response.arrayBuffer())
    const tempFile = join(BINARY_DIR, "aguara-download.tmp")

    writeFileSync(tempFile, buffer)

    try {
      if (process.platform === "win32") {
        execSync(`powershell -Command "Expand-Archive -Force '${tempFile}' '${BINARY_DIR}'"`, { stdio: "ignore" })
      } else {
        execSync(`tar -xzf "${tempFile}" -C "${BINARY_DIR}" aguara`, { stdio: "ignore" })
        chmodSync(BINARY_PATH, 0o755)
      }

      return existsSync(BINARY_PATH)
    } finally {
      if (existsSync(tempFile)) unlinkSync(tempFile)
    }
  } catch {
    return false
  }
}

async function tryDownloadLatest(): Promise<string | null> {
  const latest = await fetchLatestCompatibleVersion()
  if (!latest) return null

  const success = await downloadAndExtract(latest.downloadUrl)
  if (!success) return null

  writeMetadata({
    version: latest.version,
    downloadedAt: new Date().toISOString(),
    lastCheck: new Date().toISOString(),
  })

  return BINARY_PATH
}

async function tryUpdate(cached: BinaryMetadata): Promise<string | null> {
  const latest = await fetchLatestCompatibleVersion()

  if (!latest) {
    // Can't reach GitHub — use cached if version is still compatible
    if (isVersionCompatible(cached.version)) {
      writeMetadata({ ...cached, lastCheck: new Date().toISOString() })
      return BINARY_PATH
    }
    return null
  }

  if (latest.version === cached.version) {
    writeMetadata({ ...cached, lastCheck: new Date().toISOString() })
    return BINARY_PATH
  }

  const success = await downloadAndExtract(latest.downloadUrl)
  if (!success) {
    // Download failed — use cached if still compatible
    if (isVersionCompatible(cached.version)) return BINARY_PATH
    return null
  }

  writeMetadata({
    version: latest.version,
    downloadedAt: new Date().toISOString(),
    lastCheck: new Date().toISOString(),
  })

  return BINARY_PATH
}
