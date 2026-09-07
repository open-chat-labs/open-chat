[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$JavaHome,
    [Parameter(Mandatory = $true)][string]$KotlinCompilerClasspath,
    [Parameter(Mandatory = $true)][string]$KotlinRuntimeClasspath,
    [Parameter(Mandatory = $true)][string]$JUnitClasspath,
    [Parameter(Mandatory = $true)][string]$AndroidJar,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$java = Join-Path $JavaHome 'bin/java.exe'
if (-not (Test-Path -LiteralPath $java -PathType Leaf)) {
    $java = Join-Path $JavaHome 'bin/java'
}
$separator = [IO.Path]::PathSeparator
foreach ($file in @($java, $AndroidJar) + (($KotlinCompilerClasspath, $KotlinRuntimeClasspath, $JUnitClasspath) -join $separator -split [regex]::Escape($separator))) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required cached tool/dependency is missing: $file" }
}

$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw "Use a new output directory so old classes cannot pass this test: $output" }
New-Item -ItemType Directory -Path $output | Out-Null
$hostOutput = Join-Path $output 'host-classes'
$sdkOutput = Join-Path $output 'sdk-classes'
$pluginSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../src/main/java/IntentsManager.kt'))
$appSource = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../src-tauri/gen/android/app/src/main/java/com/oclabs/openchat/MyApplication.kt'))
$supportRoot = Join-Path $PSScriptRoot 'src'
$support = @(Get-ChildItem -LiteralPath $supportRoot -Recurse -Filter '*.kt' | Sort-Object FullName | ForEach-Object FullName)
$sdkSupport = @($support | Where-Object {
    $_ -notmatch '[\\/]src[\\/]android[\\/]' -and [IO.Path]::GetFileName($_) -ne 'ComponentIdentityTest.kt'
})

Write-Output 'Compiling current production sources; no downloads or Gradle dependency resolution.'
Get-FileHash -Algorithm SHA256 -LiteralPath $pluginSource, $appSource | Format-List Path, Hash
& $java -Xmx512m -cp $KotlinCompilerClasspath org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -version
if ($LASTEXITCODE -ne 0) { throw 'Cached Kotlin compiler is not runnable.' }

& $java -Xmx512m -cp $KotlinCompilerClasspath org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -jvm-target 17 -classpath "$KotlinRuntimeClasspath$separator$JUnitClasspath" -d $hostOutput $pluginSource $appSource @support
if ($LASTEXITCODE -ne 0) { throw 'Host contract compilation failed.' }
& $java -Xmx256m -cp "$hostOutput$separator$KotlinRuntimeClasspath$separator$JUnitClasspath" org.junit.runner.JUnitCore fixtures.ComponentIdentityTest
if ($LASTEXITCODE -ne 0) { throw 'Host component identity contracts failed.' }

# The Android API doubles and host-only JUnit test are excluded here. External
# Firebase/lifecycle/database collaborators remain explicit compilation fixtures.
& $java -Xmx512m -cp $KotlinCompilerClasspath org.jetbrains.kotlin.cli.jvm.K2JVMCompiler -no-stdlib -no-reflect -jvm-target 17 -classpath "$KotlinRuntimeClasspath$separator$AndroidJar" -d $sdkOutput $pluginSource $appSource @sdkSupport
if ($LASTEXITCODE -ne 0) { throw 'Real Android SDK source compilation failed.' }
& $java -Xmx256m -cp "$sdkOutput$separator$KotlinRuntimeClasspath" fixtures.AndroidConstantCheck
if ($LASTEXITCODE -ne 0) { throw 'Real Android SDK constants differ from host contract doubles.' }
Write-Output 'PASS: host contracts and real Android SDK compilation. This is not Android runtime/device evidence.'
