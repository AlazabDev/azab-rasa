param(
    [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

$sites = @(
    @{ Host = "alazab.com"; Brand = "alazab_construction"; Text = "What services do you offer?"; Voice = "Hello from alazab dot com voice test." },
    @{ Host = "brand-identity.alazab.com"; Brand = "brand_identity"; Text = "I need a visual identity for a new showroom."; Voice = "Hello from brand identity voice test." },
    @{ Host = "laban-alasfour.alazab.com"; Brand = "laban_alasfour"; Text = "I need a supply quotation."; Voice = "Hello from laban alasfour voice test." },
    @{ Host = "luxury-finishing.alazab.com"; Brand = "luxury_finishing"; Text = "I need a finishing quotation for an apartment."; Voice = "Hello from luxury finishing voice test." },
    @{ Host = "uberfix.alazab.com"; Brand = "uberfix"; Text = "I want to request maintenance."; Voice = "Hello from uberfix voice test." }
)

function Write-Step($message) {
    Write-Host ""
    Write-Host "== $message ==" -ForegroundColor Cyan
}

function Assert-Response($response, $label) {
    if (-not $response) {
        throw "${label}: no response"
    }
    if (-not $response.responses) {
        throw "${label}: empty responses"
    }
}

function New-VoiceSample($path, $text) {
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        $synth.SetOutputToWaveFile($path)
        $synth.Speak($text)
    } finally {
        $synth.Dispose()
    }
}

Write-Step "Health"
$health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
if ($health.status -ne "ok") {
    throw "Webhook health is not ok"
}
Write-Host "Webhook status: $($health.status)" -ForegroundColor Green

$tempDir = Join-Path $PWD ".tmp-smoke"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

foreach ($site in $sites) {
    Write-Step $site.Host

    $senderId = "smoke_$($site.Brand)_$(Get-Random)"

    $chatBody = @{
        sender_id = $senderId
        message   = $site.Text
        channel   = "website"
        site_host = $site.Host
    } | ConvertTo-Json

    $chat = Invoke-RestMethod -Uri "$BaseUrl/chat" -Method Post -ContentType "application/json" -Body $chatBody
    Assert-Response $chat "chat/$($site.Host)"
    Write-Host "chat ok -> $($chat.responses[0].text)" -ForegroundColor Green

    $uploadFile = Join-Path $tempDir "$($site.Brand)-upload.txt"
    Set-Content -Path $uploadFile -Value "smoke upload for $($site.Host)"
    $upload = & curl.exe -s -X POST "$BaseUrl/chat/upload" `
        -F "sender_id=$senderId" `
        -F "channel=website" `
        -F "site_host=$($site.Host)" `
        -F "file=@$uploadFile"
    $uploadJson = $upload | ConvertFrom-Json
    Assert-Response $uploadJson "upload/$($site.Host)"
    Write-Host "upload ok -> $($uploadJson.attachment.url)" -ForegroundColor Green

    $voiceFile = Join-Path $tempDir "$($site.Brand)-voice.wav"
    New-VoiceSample -path $voiceFile -text $site.Voice
    $audio = & curl.exe -s -X POST "$BaseUrl/chat/audio" `
        -F "sender_id=$senderId" `
        -F "channel=website" `
        -F "site_host=$($site.Host)" `
        -F "file=@$voiceFile"
    $audioJson = $audio | ConvertFrom-Json
    Assert-Response $audioJson "audio/$($site.Host)"
    Write-Host "audio ok -> $($audioJson.transcript)" -ForegroundColor Green
}

Write-Step "Done"
Write-Host "All five sites passed text, upload, and audio smoke tests." -ForegroundColor Green
