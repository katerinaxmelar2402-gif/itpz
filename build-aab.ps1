param([switch]$Apk)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'my-upload-key.keystore'))) {
    throw 'Не найден my-upload-key.keystore в корне проекта.'
}

. (Join-Path $PSScriptRoot 'dev-env.ps1')
$previousJavaOptions = $env:JAVA_TOOL_OPTIONS
$temporaryDirectory = (Join-Path $PSScriptRoot '.build-cache/temp').Replace('\', '/')
$env:JAVA_TOOL_OPTIONS = "$previousJavaOptions -Djava.io.tmpdir=$temporaryDirectory".Trim()

try {
    $securePassword = Read-Host 'Введите пароль созданного keystore (ввод скрыт)' -AsSecureString
    $credential = [PSCredential]::new('itopiz', $securePassword)
    $env:ITOPIZ_STORE_PASSWORD = $credential.GetNetworkCredential().Password
    $env:ITOPIZ_KEY_PASSWORD = $env:ITOPIZ_STORE_PASSWORD

    Push-Location (Join-Path $PSScriptRoot 'mobile/android')
    try {
        $buildTask = if ($Apk) { 'assembleRelease' } else { 'bundleRelease' }
        & .\gradlew.bat $buildTask --no-daemon --console=plain
        if ($LASTEXITCODE -ne 0) {
            throw 'Сборка не завершена. Посмотрите сообщение об ошибке выше.'
        }
        if ($Apk) { Write-Host "Готовый APK: $PSScriptRoot\mobile\android\app\build\outputs\apk\release\app-release.apk" } else { Write-Host "Готовый AAB: $PSScriptRoot\mobile\android\app\build\outputs\bundle\release\app-release.aab" }
    } finally {
        Pop-Location
    }
} finally {
    Remove-Item Env:ITOPIZ_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:ITOPIZ_KEY_PASSWORD -ErrorAction SilentlyContinue
    $env:JAVA_TOOL_OPTIONS = $previousJavaOptions
    $credential = $null
    if ($securePassword) { $securePassword.Dispose() }
}
