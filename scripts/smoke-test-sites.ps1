param(
    [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"

$sites = @(
    @{ Path = "/"; Brand = "alazab_construction"; Text = "What services do you offer?"; Voice = "Hello from alazab bot voice test." },
    @{ Path = "/brand-identity"; Brand = "brand_identity"; Text = "I need a visual identity for a new showroom."; Voice = "Hello from brand identity voice test." },
    @{ Path = "/laban-alasfour"; Brand = "laban_alasfour"; Text = "I need a supply quotation."; Voice = "Hello from laban alasfour voice test." },
    @{ Path = "/luxury-finishing"; Brand = "luxury_finishing"; Text = "I need a finishing quotation for an apartment."; Voice = "Hello from luxury finishing voice test." },
    @{ Path = "/uberfix"; Brand = "uberfix"; Text = "I want to request maintenance."; Voice = "Hello from uberfix voice test." }
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
    Write-Step "bot.alazab.com$($site.Path)"

    $senderId = "smoke_$($site.Brand)_$(Get-Random)"

    $chatBody = @{
        sender_id = $senderId
        message   = $site.Text
        channel   = "website"
        site_host = "bot.alazab.com"
        site_path = $site.Path
    } | ConvertTo-Json

    $chat = Invoke-RestMethod -Uri "$BaseUrl/chat" -Method Post -ContentType "application/json" -Body $chatBody
    Assert-Response $chat "chat/bot.alazab.com$($site.Path)"
    Write-Host "chat ok -> $($chat.responses[0].text)" -ForegroundColor Green

    $uploadFile = Join-Path $tempDir "$($site.Brand)-upload.txt"
    Set-Content -Path $uploadFile -Value "smoke upload for bot.alazab.com$($site.Path)"
    $upload = & curl.exe -s -X POST "$BaseUrl/chat/upload" `
        -F "sender_id=$senderId" `
        -F "channel=website" `
        -F "site_host=bot.alazab.com" `
        -F "site_path=$($site.Path)" `
        -F "file=@$uploadFile"
    $uploadJson = $upload | ConvertFrom-Json
    Assert-Response $uploadJson "upload/bot.alazab.com$($site.Path)"
    Write-Host "upload ok -> $($uploadJson.attachment.url)" -ForegroundColor Green

    $voiceFile = Join-Path $tempDir "$($site.Brand)-voice.wav"
    New-VoiceSample -path $voiceFile -text $site.Voice
    $audio = & curl.exe -s -X POST "$BaseUrl/chat/audio" `
        -F "sender_id=$senderId" `
        -F "channel=website" `
        -F "site_host=bot.alazab.com" `
        -F "site_path=$($site.Path)" `
        -F "file=@$voiceFile"
    $audioJson = $audio | ConvertFrom-Json
    Assert-Response $audioJson "audio/bot.alazab.com$($site.Path)"
    Write-Host "audio ok -> $($audioJson.transcript)" -ForegroundColor Green
}

Write-Step "Done"
Write-Host "All five sites passed text, upload, and audio smoke tests." -ForegroundColor Green
