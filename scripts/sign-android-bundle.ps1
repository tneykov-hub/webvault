param(
    [Parameter(Mandatory = $true)][string]$ReleaseDirectory,
    [string]$JdkDirectory = "",
    [string]$KeystorePath = "",
    [string]$KeyAlias = "",
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2
$pendingBundle = $null
$expectedCertificate = "7EB1457890F22448462D40E6368094D4181587D5278A46714AD44A0165FFA4E0"

function Get-JdkBin {
    $candidates = @($JdkDirectory, $env:JAVA_HOME)
    if ($env:ProgramFiles) {
        $candidates += Join-Path $env:ProgramFiles "Android\Android Studio\jbr"
    }
    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        $bin = Join-Path $candidate "bin"
        if ((Test-Path (Join-Path $bin "jarsigner.exe")) -and
            (Test-Path (Join-Path $bin "keytool.exe"))) { return $bin }
        if ((Test-Path (Join-Path $bin "jarsigner")) -and
            (Test-Path (Join-Path $bin "keytool"))) { return $bin }
    }
    $command = Get-Command "jarsigner" -ErrorAction SilentlyContinue
    if ($command) { return Split-Path $command.Source }
    throw "JDK tools not found. Install Android Studio or pass -JdkDirectory with its jbr folder."
}

function Get-PayloadHashes([string]$Path) {
    $zip = [IO.Compression.ZipFile]::OpenRead($Path)
    $hashes = @{}
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName.EndsWith("/")) { continue }
            if ($entry.FullName -match "^META-INF/(MANIFEST\.MF|[^/]+\.(SF|RSA|DSA|EC))$") { continue }
            if ($hashes.ContainsKey($entry.FullName)) { throw "Duplicate bundle entry: $($entry.FullName)" }
            $stream = $entry.Open()
            $sha = [Security.Cryptography.SHA256]::Create()
            try {
                $hashes[$entry.FullName] = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "")
            } finally {
                $sha.Dispose()
                $stream.Dispose()
            }
        }
    } finally { $zip.Dispose() }
    return $hashes
}

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $release = (Get-Item -LiteralPath $ReleaseDirectory).FullName
    $metadata = Get-Content -LiteralPath (Join-Path $release "VERIFICATION.json") -Raw | ConvertFrom-Json
    if ($metadata.application_id -ne "site.webvault.app" -or
        $metadata.version_name -ne "1.0.5" -or $metadata.version_code -ne 6) {
        throw "This package is not the expected WebVault 1.0.5 / code 6 release."
    }
    if ($metadata.expected_upload_certificate_sha256 -ne $expectedCertificate) {
        throw "The expected upload certificate does not match the verified 1.0.4 release."
    }
    $unsignedBundle = Join-Path $release "WebVault-1.0.5-code-6-unsigned.aab"
    if ((Get-FileHash -LiteralPath $unsignedBundle -Algorithm SHA256).Hash -ne $metadata.unsigned_aab_sha256) {
        throw "The unsigned AAB checksum does not match VERIFICATION.json."
    }
    $bin = Get-JdkBin
    $jarsigner = Join-Path $bin "jarsigner"
    $keytool = Join-Path $bin "keytool"
    if (Test-Path ($jarsigner + ".exe")) { $jarsigner += ".exe"; $keytool += ".exe" }
    Write-Host "WebVault 1.0.5 / code 6: unsigned bundle checksum verified."
    Write-Host "JDK tools: $bin"
    if ($CheckOnly) { exit 0 }

    if (-not $KeystorePath) {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title = "Select the existing WebVault Google Play upload keystore"
        $dialog.Filter = "Keystore files (*.jks;*.keystore;*.p12;*.pfx)|*.jks;*.keystore;*.p12;*.pfx|All files (*.*)|*.*"
        try {
            if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
                throw "Signing cancelled. No signed file was created."
            }
            $KeystorePath = $dialog.FileName
        } finally { $dialog.Dispose() }
    }
    if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) { throw "Keystore file not found." }
    if (-not $KeyAlias) {
        Write-Host "The next prompt lists aliases from your existing keystore."
        & $keytool "-J-Duser.language=en" "-list" "-keystore" $KeystorePath
        if ($LASTEXITCODE -ne 0) { throw "Could not read the keystore." }
        $KeyAlias = Read-Host "Enter the upload key alias used for WebVault 1.0.4"
    }
    if ([string]::IsNullOrWhiteSpace($KeyAlias)) { throw "An upload key alias is required." }
    $signedBundle = Join-Path $release "WebVault-1.0.5-code-6-signed.aab"
    if (Test-Path -LiteralPath $signedBundle) {
        throw "A signed AAB already exists. Move it elsewhere before signing again."
    }
    $pendingBundle = Join-Path $release "WebVault-1.0.5-code-6-signing-$PID.aab"
    Write-Host "Enter your existing keystore/key password in the Java prompt. It is not saved by this script."
    & $jarsigner "-J-Duser.language=en" "-keystore" $KeystorePath "-signedjar" $pendingBundle $unsignedBundle $KeyAlias
    if ($LASTEXITCODE -ne 0) { throw "Signing failed. No upload-ready AAB was created." }

    $verification = & $jarsigner "-J-Duser.language=en" "-verify" "-verbose" $pendingBundle
    $verificationText = $verification -join "`n"
    if ($LASTEXITCODE -ne 0 -or $verificationText -notmatch "jar verified\." -or
        $verificationText -match "contains unsigned entries") { throw "AAB signature verification failed." }
    $certificateText = (& $keytool "-J-Duser.language=en" "-printcert" "-rfc" "-jarfile" $pendingBundle) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "Could not read the signed AAB certificate." }
    $certificateMatch = [regex]::Match($certificateText, "(?s)-----BEGIN CERTIFICATE-----\s*(.*?)\s*-----END CERTIFICATE-----")
    if (-not $certificateMatch.Success) { throw "The AAB signer certificate is missing." }
    $certificateBytes = [Convert]::FromBase64String(($certificateMatch.Groups[1].Value -replace "\s", ""))
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $actualCertificate = [BitConverter]::ToString($sha.ComputeHash($certificateBytes)).Replace("-", "") }
    finally { $sha.Dispose() }
    if ($actualCertificate -ne $expectedCertificate) {
        throw "Wrong upload key: the signer certificate does not match WebVault 1.0.4."
    }
    $before = Get-PayloadHashes $unsignedBundle
    $after = Get-PayloadHashes $pendingBundle
    if ($before.Count -ne $after.Count) { throw "Signing changed the bundle payload entries." }
    foreach ($name in $before.Keys) {
        if (-not $after.ContainsKey($name) -or $after[$name] -ne $before[$name]) {
            throw "Signing changed bundle payload: $name"
        }
    }
    Move-Item -LiteralPath $pendingBundle -Destination $signedBundle
    $pendingBundle = $null
    $verificationText | Set-Content -LiteralPath (Join-Path $release "signed-aab-verification.txt") -Encoding UTF8
    $result = [ordered]@{
        application_id = "site.webvault.app"; version_name = "1.0.5"; version_code = 6
        signed_aab = [IO.Path]::GetFileName($signedBundle)
        signed_aab_sha256 = (Get-FileHash -LiteralPath $signedBundle -Algorithm SHA256).Hash
        upload_certificate_sha256 = $actualCertificate
        signature_verified = $true; payload_unchanged = $true
        payload_entries_verified = $before.Count; google_play_uploaded = $false
        verified_at = [DateTime]::UtcNow.ToString("o")
    }
    $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $release "SIGNED-VERIFICATION.json") -Encoding UTF8
    Write-Host "SUCCESS: signed AAB verified with the same upload certificate as WebVault 1.0.4."
    Write-Host "Upload this file to Closed testing - Alpha: $signedBundle"
    exit 0
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    if ($pendingBundle -and (Test-Path -LiteralPath $pendingBundle)) {
        Remove-Item -LiteralPath $pendingBundle -Force
    }
}
