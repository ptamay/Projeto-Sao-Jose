#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Kit,
    [string]$Destino,
    [string]$Dados,
    [ValidateRange(1, 65535)][int]$Porta,
    [securestring]$SenhaInicial,
    [switch]$SemTarefa
)

$ErrorActionPreference = 'Stop'
if (!$Kit) {
    $name = [IO.Path]::GetFileNameWithoutExtension($PSCommandPath)
    if ($name -notlike 'CSJ-Portaria-*-Instalar') {
        throw 'Informe o ZIP com -Kit ou use o script de instalacao gerado para a versao do pacote.'
    }
    $Kit = Join-Path $PSScriptRoot ($name.Substring(0, $name.Length - '-Instalar'.Length) + '.zip')
}
$archive = Get-Item -LiteralPath $Kit
if ($archive.PSIsContainer -or $archive.Extension -ne '.zip') {
    throw 'Selecione o arquivo ZIP do kit.'
}
$checksum = [IO.Path]::ChangeExtension($archive.FullName, '.sha256')
if (!(Test-Path -LiteralPath $checksum -PathType Leaf)) {
    throw 'Coloque o arquivo .sha256 da mesma versao ao lado do ZIP.'
}
$expected = (Get-Content -LiteralPath $checksum -TotalCount 1) -split '\s+', 2
if ($expected[0] -notmatch '^[0-9a-fA-F]{64}$' -or
    (Get-FileHash -LiteralPath $archive.FullName -Algorithm SHA256).Hash -ne $expected[0]) {
    throw 'O SHA-256 do ZIP diverge do arquivo de verificacao.'
}

$options = @{}
foreach ($parameter in @('Destino', 'Dados', 'Porta', 'SenhaInicial', 'SemTarefa')) {
    if ($PSBoundParameters.ContainsKey($parameter)) {
        $options[$parameter] = $PSBoundParameters[$parameter]
    }
}

$temp = (Resolve-Path -LiteralPath ([IO.Path]::GetTempPath())).Path.TrimEnd('\')
$extract = Join-Path $temp ('csj-extracao-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $extract | Out-Null
try {
    Write-Host 'Kit verificado. Extraindo os arquivos de instalacao...'
    $tar = Get-Command tar.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($tar) {
        & $tar.Source -xf $archive.FullName -C $extract
        if ($LASTEXITCODE) { throw 'Falha ao extrair os arquivos do kit.' }
    } else {
        Expand-Archive -LiteralPath $archive.FullName -DestinationPath $extract
    }
    & (Join-Path $extract 'Install-Portaria.ps1') @options
} finally {
    $resolved = (Resolve-Path -LiteralPath $extract).Path
    if ((Split-Path -Parent $resolved) -eq $temp -and (Split-Path -Leaf $resolved) -match '^csj-extracao-[0-9a-f]{32}$') {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
