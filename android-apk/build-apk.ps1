param([switch]$PrepareTools)
$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
if ($PrepareTools) { & (Join-Path $taskRoot 'prepare-tools.ps1') }
$jdkBin = Join-Path $taskRoot '.tools/jdk/jdk-17.0.20.1+1/bin'
$androidTools = Join-Path $taskRoot '.tools/build-tools/android-15'
$androidJar = Join-Path $taskRoot '.tools/platform/android-35/android.jar'
foreach ($file in @((Join-Path $jdkBin 'java.exe'), (Join-Path $androidTools 'aapt2.exe'), $androidJar)) {
    if (!(Test-Path -LiteralPath $file)) { throw 'Outils manquants. Lance .\build-apk.ps1 -PrepareTools.' }
}
function Run-Tool([string]$Executable, [string[]]$ToolArguments) {
    & $Executable @ToolArguments
    if ($LASTEXITCODE -ne 0) { throw "Compilation interrompue : $Executable (code $LASTEXITCODE)." }
}
$buildRoot = Join-Path $taskRoot 'build'
$releaseRoot = Join-Path $taskRoot 'release'
$privateRoot = Join-Path $taskRoot 'private'
$classes = Join-Path $buildRoot 'classes'
$testClasses = Join-Path $buildRoot 'tests'
$dex = Join-Path $buildRoot 'dex'
$javaTemp = Join-Path $buildRoot 'tmp'
foreach ($folder in @($buildRoot,$releaseRoot,$privateRoot,$classes,$testClasses,$dex,$javaTemp,(Join-Path $buildRoot 'generated'))) {
    New-Item -ItemType Directory -Force $folder | Out-Null
}
$src = Join-Path $taskRoot 'app/src/main'
$aapt = Join-Path $androidTools 'aapt2.exe'
Run-Tool $aapt @('compile','--dir',(Join-Path $src 'res'),'-o',(Join-Path $buildRoot 'resources.zip'))
Run-Tool $aapt @('link','-o',(Join-Path $buildRoot 'unsigned.apk'),'--manifest',(Join-Path $src 'AndroidManifest.xml'),'-I',$androidJar,'--java',(Join-Path $buildRoot 'generated'),'--min-sdk-version','26','--target-sdk-version','35',(Join-Path $buildRoot 'resources.zip'))
$sources = @(Get-ChildItem -LiteralPath (Join-Path $src 'java') -Recurse -Filter '*.java' | ForEach-Object FullName)
$sources += @(Get-ChildItem -LiteralPath (Join-Path $buildRoot 'generated') -Recurse -Filter '*.java' | ForEach-Object FullName)
Run-Tool (Join-Path $jdkBin 'javac.exe') (@('-encoding','UTF-8','-source','8','-target','8','-Xlint:-options','-classpath',$androidJar,'-d',$classes) + $sources)
Run-Tool (Join-Path $jdkBin 'javac.exe') @('-encoding','UTF-8','-classpath',$classes,'-d',$testClasses,(Join-Path $taskRoot 'tests/NavigationPolicyTest.java'))
Run-Tool (Join-Path $jdkBin 'java.exe') @('-cp',"$classes;$testClasses",'NavigationPolicyTest')
Run-Tool (Join-Path $jdkBin 'jar.exe') @("-J-Djava.io.tmpdir=$javaTemp",'--create','--file',(Join-Path $buildRoot 'classes.jar'),'-C',$classes,'.')
Run-Tool (Join-Path $jdkBin 'java.exe') @('-cp',(Join-Path $androidTools 'lib/d8.jar'),'com.android.tools.r8.D8','--release','--min-api','26','--lib',$androidJar,'--output',$dex,(Join-Path $buildRoot 'classes.jar'))
Run-Tool (Join-Path $jdkBin 'jar.exe') @("-J-Djava.io.tmpdir=$javaTemp",'--update','--no-manifest','--no-compress','--file',(Join-Path $buildRoot 'unsigned.apk'),'-C',$dex,'classes.dex')
Run-Tool (Join-Path $androidTools 'zipalign.exe') @('-f','-p','4',(Join-Path $buildRoot 'unsigned.apk'),(Join-Path $buildRoot 'aligned.apk'))

$passwordFile = Join-Path $privateRoot 'signing-password.txt'
$keyStore = Join-Path $privateRoot 'yamonfilm-release.jks'
if ((Test-Path -LiteralPath $keyStore) -and !(Test-Path -LiteralPath $passwordFile)) { throw 'Le mot de passe de signature manque. Restaure le dossier private depuis ta sauvegarde.' }
if (!(Test-Path -LiteralPath $passwordFile)) {
    $bytes = New-Object byte[] 32
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($bytes)
    $random.Dispose()
    [System.IO.File]::WriteAllText($passwordFile, [Convert]::ToBase64String($bytes))
}
$previousPassword = [Environment]::GetEnvironmentVariable('YAMONFILM_SIGN_PASSWORD','Process')
try {
    [Environment]::SetEnvironmentVariable('YAMONFILM_SIGN_PASSWORD',[System.IO.File]::ReadAllText($passwordFile).Trim(),'Process')
    if (!(Test-Path -LiteralPath $keyStore)) {
        Run-Tool (Join-Path $jdkBin 'keytool.exe') @('-genkeypair','-noprompt','-keystore',$keyStore,'-storetype','JKS','-alias','yamonfilm','-storepass:env','YAMONFILM_SIGN_PASSWORD','-keypass:env','YAMONFILM_SIGN_PASSWORD','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=YAMONFILM Android, O=YAMONFILM, C=FR')
    }
    $apk = Join-Path $releaseRoot 'YAMONFILM-1.0.0.apk'
    Run-Tool (Join-Path $jdkBin 'java.exe') @('-jar',(Join-Path $androidTools 'lib/apksigner.jar'),'sign','--ks',$keyStore,'--ks-key-alias','yamonfilm','--ks-pass','env:YAMONFILM_SIGN_PASSWORD','--key-pass','env:YAMONFILM_SIGN_PASSWORD','--v4-signing-enabled','false','--out',$apk,(Join-Path $buildRoot 'aligned.apk'))
    Run-Tool (Join-Path $jdkBin 'java.exe') @('-jar',(Join-Path $androidTools 'lib/apksigner.jar'),'verify','--verbose','--print-certs',$apk)
    Run-Tool (Join-Path $androidTools 'zipalign.exe') @('-c','-p','4',$apk)
    $hash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
    [System.IO.File]::WriteAllText((Join-Path $releaseRoot 'SHA256.txt'), "$hash  YAMONFILM-1.0.0.apk`n")
    Write-Host "APK créé et signature vérifiée : $apk"
} finally {
    [Environment]::SetEnvironmentVariable('YAMONFILM_SIGN_PASSWORD',$previousPassword,'Process')
}
