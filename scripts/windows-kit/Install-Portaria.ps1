#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Destino = (Join-Path $env:ProgramFiles 'CSJ-Portaria'),
    [string]$Dados = (Join-Path $env:ProgramData 'CSJ-Portaria'),
    [ValidateRange(1, 65535)][int]$Porta = 3000,
    [securestring]$SenhaInicial,
    [switch]$SemTarefa
)

$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (!$SemTarefa -and !$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Abra o PowerShell como administrador.'
}
$Destino = [IO.Path]::GetFullPath($Destino).TrimEnd('\')
$Dados = [IO.Path]::GetFullPath($Dados).TrimEnd('\')
$source = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
if (@($Destino, $Dados) | Where-Object { $_.Length -lt 4 -or $_.StartsWith('\') }) {
    throw 'Informe pastas em discos locais para os arquivos do programa e os dados.'
}
foreach ($pair in @(@($Destino, $Dados), @($Destino, $source), @($Dados, $source))) {
    if (($pair[0] + '\').StartsWith(($pair[1] + '\'), 'OrdinalIgnoreCase') -or
        ($pair[1] + '\').StartsWith(($pair[0] + '\'), 'OrdinalIgnoreCase')) {
        throw 'Mantenha a pasta extraida, o programa e os dados em caminhos separados.'
    }
}

$taskName = 'CSJ-Portaria'
$runtime = Join-Path $Destino 'runtime\node.exe'
$starter = Join-Path $Destino 'Start-Portaria.cjs'
$arguments = '"{0}" "{1}" {2}' -f $starter, $Dados, $Porta
$manifest = Join-Path $source 'KIT.json'
foreach ($file in @('KIT.json', 'runtime\node.exe', 'runtime\LICENSE.txt', 'app\server.js', 'app\scripts\init-db.js', 'Start-Portaria.cjs')) {
    if (!(Test-Path -LiteralPath (Join-Path $source $file) -PathType Leaf)) {
        throw "Kit incompleto. Arquivo ausente: $file"
    }
}
$dataMarker = Join-Path $Dados '.csj-portaria'
if ((Test-Path -LiteralPath $Dados) -and !(Test-Path -LiteralPath $dataMarker -PathType Leaf)) {
    throw "A pasta $Dados ja existe. Use uma pasta nova para instalar e importe o backup pela interface."
}
if (!$SemTarefa) {
    $task = Get-ScheduledTask -TaskPath '\' -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task -and ($task.Actions.Count -ne 1 -or
        $task.Actions[0].Execute -ne $runtime -or $task.Actions[0].Arguments -ne $arguments)) {
        throw "A tarefa $taskName ja existe com outra configuracao. Confira a instalacao antes de continuar."
    }
}

function Set-KitDirectoryAcl([string]$directory, [string]$serviceRights) {
    $acl = Get-Acl -LiteralPath $directory
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in $acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier])) {
        $acl.RemoveAccessRuleAll($rule)
    }
    foreach ($entry in @(@('S-1-5-18', 'FullControl'), @('S-1-5-32-544', 'FullControl'), @('S-1-5-19', $serviceRights))) {
        $sid = [Security.Principal.SecurityIdentifier]::new($entry[0])
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $sid, $entry[1], 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $directory -AclObject $acl
}

if (Test-Path -LiteralPath $Destino) {
    $installed = Join-Path $Destino 'KIT.json'
    if (!(Test-Path -LiteralPath $installed -PathType Leaf) -or
        (Get-FileHash -LiteralPath $installed).Hash -ne (Get-FileHash -LiteralPath $manifest).Hash) {
        throw "A pasta $Destino ja existe e pertence a outra instalacao."
    }
} else {
    $staging = "$Destino.instalando-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $staging | Out-Null
    if (!$SemTarefa) { Set-KitDirectoryAcl $staging 'ReadAndExecute' }
    foreach ($name in @('app', 'runtime', 'Start-Portaria.cjs', 'README.md', 'KIT.json')) {
        Copy-Item -LiteralPath (Join-Path $source $name) -Destination $staging -Recurse
    }
    if (!$SemTarefa) {
        $imageCache = Join-Path $staging 'app\.next\cache\images'
        New-Item -ItemType Directory -Path $imageCache -Force | Out-Null
        Set-KitDirectoryAcl $imageCache 'Modify'
    }
    [IO.Directory]::Move($staging, $Destino)
}

if (!(Test-Path -LiteralPath $Dados)) {
    $dataStaging = "$Dados.instalando-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $dataStaging | Out-Null
    if (!$SemTarefa) { Set-KitDirectoryAcl $dataStaging 'Modify' }
    New-Item -ItemType File -Path (Join-Path $dataStaging '.csj-portaria') | Out-Null
    [IO.Directory]::Move($dataStaging, $Dados)
}

$db = Join-Path $Dados 'keys.db'
if (!(Test-Path -LiteralPath $db -PathType Leaf)) {
    if (!$SenhaInicial) { $SenhaInicial = Read-Host 'Senha inicial de admin (12 caracteres ou mais)' -AsSecureString }
    $bootstrap = Join-Path $Dados ('.instalando-' + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $bootstrap | Out-Null
    $settings = [Diagnostics.ProcessStartInfo]::new()
    $settings.FileName = $runtime
    $settings.Arguments = 'scripts\init-db.js --fresh-install'
    $settings.WorkingDirectory = Join-Path $Destino 'app'
    $settings.UseShellExecute = $false
    $settings.RedirectStandardInput = $true
    $settings.EnvironmentVariables['CSJ_DATA_DIR'] = $bootstrap
    try {
        $init = [Diagnostics.Process]::Start($settings)
        $secret = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SenhaInicial)
        try {
            $encoded = [Text.Encoding]::UTF8.GetBytes([Runtime.InteropServices.Marshal]::PtrToStringBSTR($secret))
            $init.StandardInput.BaseStream.Write($encoded, 0, $encoded.Length)
        } finally {
            if ($encoded) { [Array]::Clear($encoded, 0, $encoded.Length) }
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secret)
            $init.StandardInput.Close()
        }
        $init.WaitForExit()
        if ($init.ExitCode -ne 0) { throw 'Falha ao preparar a base inicial.' }
        [IO.File]::Move((Join-Path $bootstrap 'keys.db'), $db)
    } finally {
        if ($init) { $init.Dispose() }
        foreach ($name in @('keys.db', 'keys.db-journal')) {
            $file = Join-Path $bootstrap $name
            if (Test-Path -LiteralPath $file -PathType Leaf) { [IO.File]::Delete($file) }
        }
        [IO.Directory]::Delete($bootstrap)
    }
}

if ($SemTarefa) {
    Write-Host "Instalado sem tarefa: & '$runtime' '$starter' '$Dados' $Porta"
    return
}
if (!$task) {
    $action = New-ScheduledTaskAction -Execute $runtime -Argument $arguments -WorkingDirectory $Destino
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $account = [Security.Principal.SecurityIdentifier]::new('S-1-5-19').Translate([Security.Principal.NTAccount]).Value
    $runAs = New-ScheduledTaskPrincipal -UserId $account -LogonType ServiceAccount
    $options = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
        -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $runAs -Settings $options | Out-Null
}
if (!$task -or $task.State -ne 'Running') { Start-ScheduledTask -TaskName $taskName }
Write-Host "Instalado. Abra http://localhost:$Porta"
