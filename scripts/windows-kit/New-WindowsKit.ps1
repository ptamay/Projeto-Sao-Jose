#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$NodeLicense,
    [string]$Node = (Get-Command node.exe -ErrorAction Stop).Source
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$output = Join-Path $root 'build\windows'
$Node = (Resolve-Path -LiteralPath $Node).Path
$NodeLicense = (Resolve-Path -LiteralPath $NodeLicense).Path
$nodeHash = '3602F2BB1A10F2CBAB4C36886218A33C1AB3DB87290E73B033C46C77147D0237'
if ((Get-FileHash -LiteralPath $Node).Hash -ne $nodeHash) {
    throw 'Use o node.exe oficial da versao 24.19.0 para Windows x64.'
}
$modules = Join-Path $root 'node_modules'
if (!(Test-Path -LiteralPath (Join-Path $modules 'next\dist\bin\next') -PathType Leaf)) {
    throw 'Prepare as dependencias bloqueadas do projeto na maquina de preparo.'
}

function Copy-Tree([string]$from, [string]$to) {
    $copy = & robocopy.exe $from $to /E /XJ /MT:16 /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -ge 8) { throw "Falha ao copiar $from (robocopy $LASTEXITCODE): $copy" }
}

$work = Join-Path ([IO.Path]::GetTempPath()) ('csj-kit-' + [guid]::NewGuid().ToString('N').Substring(0, 12))
$project = Join-Path $work 'project'
$payload = Join-Path $work 'kit'
$buildData = Join-Path $work 'build-data'
New-Item -ItemType Directory -Path $project, $payload, $buildData | Out-Null
$oldData = $env:CSJ_DATA_DIR
$oldTelemetry = $env:NEXT_TELEMETRY_DISABLED
try {
    Copy-Tree (Join-Path $root 'src') (Join-Path $project 'src')
    Copy-Tree (Join-Path $root 'public') (Join-Path $project 'public')
    Copy-Tree $modules (Join-Path $project 'node_modules')
    foreach ($filename in @('package.json', 'package-lock.json', 'next.config.ts', 'tsconfig.json')) {
        Copy-Item -LiteralPath (Join-Path $root $filename) -Destination $project
    }

    $env:CSJ_DATA_DIR = $buildData
    $env:NEXT_TELEMETRY_DISABLED = '1'
    Push-Location $project
    try {
        & $Node node_modules/next/dist/bin/next build
        if ($LASTEXITCODE -ne 0) { throw "Build de producao falhou ($LASTEXITCODE)." }
    } finally {
        Pop-Location
    }

    $app = Join-Path $payload 'app'
    $standalone = Join-Path $project '.next\standalone'
    Copy-Tree $standalone $app
    Copy-Tree (Join-Path $project '.next\static') (Join-Path $app '.next\static')
    Copy-Tree (Join-Path $project 'public') (Join-Path $app 'public')
    # Turbopack traces external packages as directory links. The ZIP needs real directories.
    $externalModules = '.next\node_modules'
    $links = @(
        Get-ChildItem -LiteralPath (Join-Path $standalone $externalModules) -Directory -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }
    )
    foreach ($link in $links) {
        Copy-Tree $link.FullName (Join-Path (Join-Path $app $externalModules) $link.Name)
    }
    # The Windows sharp addon loads libvips DLLs that Next.js does not trace.
    $sharpPackage = 'node_modules\@img\sharp-win32-x64'
    Copy-Tree (Join-Path $project $sharpPackage) (Join-Path $app $sharpPackage)
    foreach ($packageManifest in Get-ChildItem (Join-Path $app 'node_modules') -Filter 'package.json' -File -Recurse) {
        $original = Join-Path $project $packageManifest.DirectoryName.Substring($app.Length + 1)
        Get-ChildItem -LiteralPath $original -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE)([._-]|$)' } |
            Copy-Item -Destination $packageManifest.DirectoryName
    }
    $bootstrap = Join-Path $app 'scripts'
    $schema = Join-Path $app 'src\lib'
    $runtime = Join-Path $payload 'runtime'
    New-Item -ItemType Directory -Path $bootstrap, $schema, $runtime -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'scripts\init-db.js') -Destination $bootstrap
    foreach ($file in @('db-schema.js', 'data-directory.js')) {
        Copy-Item -LiteralPath (Join-Path $root "src\lib\$file") -Destination $schema
    }
    Copy-Item -LiteralPath $Node -Destination (Join-Path $runtime 'node.exe')
    Copy-Item -LiteralPath $NodeLicense -Destination (Join-Path $runtime 'LICENSE.txt')
    Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $payload
    foreach ($file in @('Start-Portaria.cjs', 'Install-Portaria.ps1')) {
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $payload
    }

    Push-Location $app
    try {
        & (Join-Path $runtime 'node.exe') -e "const d = require('better-sqlite3')(':memory:'); d.close(); require('bcrypt').hashSync('verificacao', 4); require('sharp').versions;"
        if ($LASTEXITCODE -ne 0) { throw 'Dependencias nativas ausentes ou incompativeis no standalone.' }
    } finally {
        Pop-Location
    }
    $files = @(Get-ChildItem -LiteralPath $payload -Recurse -Force -File | Sort-Object FullName)
    if ($files | Where-Object { $_.Name -match '^(\.env|\.keys-restore-)|\.(db|sqlite3?)(-(wal|shm|journal))?$' }) {
        throw 'O pacote contem dados de operacao ou arquivos de ambiente.'
    }
    $listing = foreach ($file in $files) {
        '{0}  {1}' -f (Get-FileHash -LiteralPath $file.FullName).Hash, $file.FullName.Substring($payload.Length + 1)
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $digest = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($listing -join "`n"))
        $fingerprint = [BitConverter]::ToString($digest).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
    $version = (Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
    $id = "CSJ-Portaria-$version-win-x64-$($fingerprint.Substring(0, 12))"
    [ordered]@{ kit = $id; versao = $version; plataforma = 'win-x64'; node = '24.19.0'; payloadSha256 = $fingerprint } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $payload 'KIT.json') -Encoding ASCII
    New-Item -ItemType Directory -Path $output -Force | Out-Null
    $archive = Join-Path $output "$id.zip"
    if (Test-Path -LiteralPath $archive) { throw "O kit ja existe: $archive" }
    $stagedArchive = Join-Path $work "$id.zip"
    & tar.exe -a -cf $stagedArchive -C $payload .
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao compactar o kit.' }
    [IO.File]::Move($stagedArchive, $archive)
    '{0}  {1}.zip' -f (Get-FileHash -LiteralPath $archive).Hash, $id |
        Set-Content -LiteralPath (Join-Path $output "$id.sha256") -Encoding ASCII
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Install-PortariaKit.ps1') -Destination (Join-Path $output "$id-Instalar.ps1")
    Write-Host $archive
} finally {
    $env:CSJ_DATA_DIR = $oldData
    $env:NEXT_TELEMETRY_DISABLED = $oldTelemetry
    $resolved = (Resolve-Path -LiteralPath $work).Path
    if ($resolved -eq $work -and (Split-Path -Leaf $resolved) -match '^csj-kit-[0-9a-f]{12}$') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
