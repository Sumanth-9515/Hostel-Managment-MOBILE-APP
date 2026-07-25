param(
    [string]$KeystorePath = "app\upload-keystore.jks",
    [string]$KeyAlias = "hostel_upload"
)

$ErrorActionPreference = "Stop"

function ConvertTo-PlainText {
    param([Security.SecureString]$SecureString)

    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

$androidDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedKeystorePath = [System.IO.Path]::GetFullPath((Join-Path $androidDir $KeystorePath))
$localPropertiesPath = Join-Path $androidDir "local.properties"

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
    throw "keytool was not found. Install/use a JDK and make sure keytool is available in PATH."
}

Write-Host "Release keystore: $resolvedKeystorePath"
Write-Host "Key alias: $KeyAlias"

$storePasswordSecure = Read-Host "Enter keystore password" -AsSecureString
$keyPasswordSecure = Read-Host "Enter key password" -AsSecureString
$storePassword = ConvertTo-PlainText $storePasswordSecure
$keyPassword = ConvertTo-PlainText $keyPasswordSecure

if ([string]::IsNullOrWhiteSpace($storePassword) -or [string]::IsNullOrWhiteSpace($keyPassword)) {
    throw "Keystore password and key password are required."
}

if (-not (Test-Path $resolvedKeystorePath)) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resolvedKeystorePath) | Out-Null
    & keytool -genkeypair -v `
        -storetype JKS `
        -keystore $resolvedKeystorePath `
        -storepass $storePassword `
        -keypass $keyPassword `
        -alias $KeyAlias `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000

    if ($LASTEXITCODE -ne 0) {
        throw "keytool failed to create the upload keystore."
    }
}
else {
    Write-Host "Keystore already exists. Keeping existing file."
}

$gradleKeystorePath = $resolvedKeystorePath.Replace("\", "/")
$localProperties = @"
HOSTEL_UPLOAD_STORE_FILE=$gradleKeystorePath
HOSTEL_UPLOAD_STORE_PASSWORD=$storePassword
HOSTEL_UPLOAD_KEY_ALIAS=$KeyAlias
HOSTEL_UPLOAD_KEY_PASSWORD=$keyPassword
"@

Set-Content -Path $localPropertiesPath -Value $localProperties -Encoding ASCII
Write-Host "Wrote signing values to ignored file: $localPropertiesPath"
Write-Host "Now run: .\gradlew.bat :app:assembleRelease"
