param([switch]$PrepareTools)
# Compile, teste, signe et vérifie l'APK YAMONFILM pour Android TV.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$version = '2.4.1'
if ($PrepareTools) { & (Join-Path $root 'prepare-tools.ps1') }

# Outils : ceux de ce dossier, sinon ceux déjà téléchargés pour le site (lecture seule).
$toolsRoot = Join-Path $root '.tools'
$shared = 'C:\Users\Admin\yamonfim\android-apk\.tools'
if (!(Test-Path -LiteralPath (Join-Path $toolsRoot 'jdk/jdk-17.0.20.1+1/bin/java.exe')) -and (Test-Path -LiteralPath (Join-Path $shared 'jdk/jdk-17.0.20.1+1/bin/java.exe'))) { $toolsRoot = $shared }
$jdk = Join-Path $toolsRoot 'jdk/jdk-17.0.20.1+1/bin'
$bt = Join-Path $toolsRoot 'build-tools/android-15'
$androidJar = Join-Path $toolsRoot 'platform/android-35/android.jar'
foreach ($f in @((Join-Path $jdk 'java.exe'), (Join-Path $bt 'aapt2.exe'), $androidJar)) {
    if (!(Test-Path -LiteralPath $f)) { throw 'Outils Android manquants. Lance .\build-apk.ps1 -PrepareTools' }
}
function Run([string]$exe, [string[]]$arguments) {
    # Les outils écrivent aussi leurs notes sur stderr : seul le code de sortie compte.
    $saved = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $exe @arguments 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $saved }
    if ($LASTEXITCODE -ne 0) { throw "Étape interrompue : $exe (code $LASTEXITCODE)" }
}

$build = Join-Path $root 'build'
$classes = Join-Path $build 'classes'
$testClasses = Join-Path $build 'tests'
$dex = Join-Path $build 'dex'
$gen = Join-Path $build 'generated'
$tmp = Join-Path $build 'tmp'
$release = Join-Path $root 'release'
$private = 'C:\Users\Admin\yamonfilm-tv\private'
if (!(Test-Path -LiteralPath (Join-Path $private 'yamonfilm-tv-native.jks')) -or !(Test-Path -LiteralPath (Join-Path $private 'signing-password.txt'))) { throw 'La clé native existante est obligatoire pour préserver la mise à jour de cette APK.' }
foreach ($d in @($classes, $testClasses, $dex, $gen)) {
    $resolved = [System.IO.Path]::GetFullPath($d)
    if (!$resolved.StartsWith([System.IO.Path]::GetFullPath($build) + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Chemin de compilation inattendu' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
foreach ($d in @($build, $classes, $testClasses, $dex, $gen, $tmp, $release)) { New-Item -ItemType Directory -Force $d | Out-Null }

$src = Join-Path $root 'app/src/main'
$aapt = Join-Path $bt 'aapt2.exe'
Write-Host '1/6 Ressources'
Run $aapt @('compile', '--dir', (Join-Path $src 'res'), '-o', (Join-Path $build 'resources.zip'))
Run $aapt @('link', '-o', (Join-Path $build 'unsigned.apk'), '--manifest', (Join-Path $src 'AndroidManifest.xml'), '-I', $androidJar, '--java', $gen, '--min-sdk-version', '26', '--target-sdk-version', '35', '--version-code', '13', '--version-name', $version, (Join-Path $build 'resources.zip'))

Write-Host '2/6 Compilation Java'
$sources = @(Get-ChildItem -LiteralPath (Join-Path $src 'java') -Recurse -Filter '*.java' | ForEach-Object FullName)
$sources += @(Get-ChildItem -LiteralPath $gen -Recurse -Filter '*.java' | ForEach-Object FullName)
Run (Join-Path $jdk 'javac.exe') (@('-encoding', 'UTF-8', '-source', '8', '-target', '8', '-Xlint:-options', '-nowarn', '-classpath', $androidJar, '-d', $classes) + $sources)

Write-Host '3/6 Tests'
Run (Join-Path $jdk 'javac.exe') @('-encoding', 'UTF-8', '-classpath', $classes, '-d', $testClasses, (Join-Path $root 'tests/LogicTest.java'))
Run (Join-Path $jdk 'java.exe') @('-Dfile.encoding=UTF-8', '-cp', "$classes;$testClasses", 'LogicTest')

Write-Host '4/6 Conversion DEX'
Run (Join-Path $jdk 'jar.exe') @("-J-Djava.io.tmpdir=$tmp", '--create', '--file', (Join-Path $build 'classes.jar'), '-C', $classes, '.')
Run (Join-Path $jdk 'java.exe') @('-cp', (Join-Path $bt 'lib/d8.jar'), 'com.android.tools.r8.D8', '--release', '--min-api', '26', '--lib', $androidJar, '--output', $dex, (Join-Path $build 'classes.jar'))
Run (Join-Path $jdk 'jar.exe') @("-J-Djava.io.tmpdir=$tmp", '--update', '--no-manifest', '--no-compress', '--file', (Join-Path $build 'unsigned.apk'), '-C', $dex, 'classes.dex')
Run (Join-Path $bt 'zipalign.exe') @('-f', '-p', '4', (Join-Path $build 'unsigned.apk'), (Join-Path $build 'aligned.apk'))

Write-Host '5/6 Signature'
$passFile = Join-Path $private 'signing-password.txt'
$keystore = Join-Path $private 'yamonfilm-tv-native.jks'
if ((Test-Path -LiteralPath $keystore) -and !(Test-Path -LiteralPath $passFile)) { throw 'Mot de passe de signature manquant : restaure le dossier private depuis ta sauvegarde.' }
if (!(Test-Path -LiteralPath $passFile)) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes); $rng.Dispose()
    [System.IO.File]::WriteAllText($passFile, [Convert]::ToBase64String($bytes))
}
$previous = [Environment]::GetEnvironmentVariable('YF_SIGN', 'Process')
try {
    [Environment]::SetEnvironmentVariable('YF_SIGN', [System.IO.File]::ReadAllText($passFile).Trim(), 'Process')
    if (!(Test-Path -LiteralPath $keystore)) {
        Run (Join-Path $jdk 'keytool.exe') @('-genkeypair', '-noprompt', '-keystore', $keystore, '-storetype', 'JKS', '-alias', 'yamonfilm', '-storepass:env', 'YF_SIGN', '-keypass:env', 'YF_SIGN', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=YAMONFILM Android TV, O=YAMONFILM, C=FR')
    }
    $apk = Join-Path $release "YAMONFILM-TV-$version.apk"
    Run (Join-Path $jdk 'java.exe') @('-jar', (Join-Path $bt 'lib/apksigner.jar'), 'sign', '--ks', $keystore, '--ks-key-alias', 'yamonfilm', '--ks-pass', 'env:YF_SIGN', '--key-pass', 'env:YF_SIGN', '--v4-signing-enabled', 'false', '--out', $apk, (Join-Path $build 'aligned.apk'))
} finally {
    [Environment]::SetEnvironmentVariable('YF_SIGN', $previous, 'Process')
}

Write-Host '6/6 Vérification'
Run (Join-Path $jdk 'java.exe') @('-jar', (Join-Path $bt 'lib/apksigner.jar'), 'verify', '--verbose', $apk)
Run (Join-Path $bt 'zipalign.exe') @('-c', '-p', '4', $apk)
$hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText((Join-Path $release 'SHA256.txt'), "$hash  YAMONFILM-TV-$version.apk`n")
Write-Host "APK prêt : $apk"
