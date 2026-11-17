# 打包行为包：产物名始终带版本号（InventorySorter-v<version>.mcaddon）
#
# 版本号从 InventorySorterBP/manifest.json 的 header.version 读取，
# 避免清单版本与文件名不一致。
#
# 用法（仓库根目录）：
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
[CmdletBinding()]
param(
    [string]$OutputDirectory = ""
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $OutputDirectory) { $OutputDirectory = $root }

$packDir = Join-Path $root "InventorySorterBP"
$manifestPath = Join-Path $packDir "manifest.json"

if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found: $manifestPath"
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = ($manifest.header.version -join ".")
$outputName = "InventorySorter-v$version.mcaddon"
$outputPath = Join-Path $OutputDirectory $outputName
$tempZip = Join-Path $root ".packtmp.zip"

if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
if (Test-Path $outputPath) { Remove-Item $outputPath -Force }

Compress-Archive -Path $packDir -DestinationPath $tempZip -CompressionLevel Optimal -Force
Move-Item $tempZip $outputPath -Force

# 迁移清理：早期不带版本号的产物已不再生成
$legacy = Join-Path $root "InventorySorter.mcaddon"
if (Test-Path $legacy) { Remove-Item $legacy -Force }

Write-Host "Built $outputName"
