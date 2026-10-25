$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$toolsRoot = Join-Path $taskRoot '.tools'
$downloads = Join-Path $toolsRoot 'downloads'
New-Item -ItemType Directory -Force $downloads | Out-Null

function Download-Checked([string]$Url, [string]$File, [string]$Hash, [string]$Algorithm) {
    if (!(Test-Path -LiteralPath $File)) {
        & curl.exe --fail --location --silent --show-error --retry 2 $Url --output $File
        if ($LASTEXITCODE -ne 0) { throw "Téléchargement impossible : $Url" }
    }
    if ((Get-FileHash -LiteralPath $File -Algorithm $Algorithm).Hash.ToLowerInvariant() -ne $Hash) {
        throw "Le téléchargement ne correspond pas à l’empreinte officielle : $File"
    }
}

$jdk = Join-Path $toolsRoot 'jdk/jdk-17.0.20.1+1/bin/java.exe'
if (!(Test-Path -LiteralPath $jdk)) {
    Download-Checked 'https://aka.ms/download-jdk/microsoft-jdk-17.0.20.1-windows-x64.zip' (Join-Path $downloads 'jdk.zip') '3d9006956fc8af5601cd24ffc4f468bef48279c7ebd8171b9bdf90d0aabfbf1f' 'SHA256'
    Expand-Archive -LiteralPath (Join-Path $downloads 'jdk.zip') -DestinationPath (Join-Path $toolsRoot 'jdk') -Force
}
if (!(Test-Path -LiteralPath (Join-Path $toolsRoot 'platform/android-35/android.jar'))) {
    Download-Checked 'https://dl.google.com/android/repository/platform-35_r02.zip' (Join-Path $downloads 'platform.zip') '0bb560a90a7a2cbd0dd8348224d518b638fe7949' 'SHA1'
    Expand-Archive -LiteralPath (Join-Path $downloads 'platform.zip') -DestinationPath (Join-Path $toolsRoot 'platform') -Force
}
if (!(Test-Path -LiteralPath (Join-Path $toolsRoot 'build-tools/android-15/aapt2.exe'))) {
    Download-Checked 'https://dl.google.com/android/repository/build-tools_r35_windows.zip' (Join-Path $downloads 'build-tools.zip') 'af059bb67cf7786f45ee0db85e2d24985df1b4b6' 'SHA1'
    Expand-Archive -LiteralPath (Join-Path $downloads 'build-tools.zip') -DestinationPath (Join-Path $toolsRoot 'build-tools') -Force
}
Write-Host 'Les outils Android sont prêts dans le dossier de l’application.'
