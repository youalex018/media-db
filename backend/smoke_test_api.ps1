param(
    [string]$BaseUrl = "http://localhost:5000",
    [string]$Token = "",
    [string]$SearchQuery = "matrix"
)

if ([string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "Missing -Token. Provide a Supabase access token." -ForegroundColor Red
    Write-Host "Example: .\\smoke_test_api.ps1 -Token <JWT>" -ForegroundColor Yellow
    exit 1
}

$headers = @{ Authorization = "Bearer $Token" }

function Fail($message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    exit 1
}

function Pass($message) {
    Write-Host "[PASS] $message" -ForegroundColor Green
}

try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/healthz" -Method Get
    if ($health.status -ne "ok") { Fail "Health check returned unexpected status" }
    Pass "Health check ok"
} catch {
    Fail "Health check failed: $($_.Exception.Message)"
}

try {
    $me = Invoke-RestMethod -Uri "$BaseUrl/api/me" -Method Get -Headers $headers
    if (-not $me.user_id) { Fail "/api/me missing user_id" }
    Pass "Authenticated user: $($me.user_id)"
} catch {
    Fail "/api/me failed: $($_.Exception.Message)"
}

try {
    $search = Invoke-RestMethod `
        -Uri "$BaseUrl/api/search?q=$SearchQuery&types=movie,show,book" `
        -Method Get `
        -Headers $headers

    if (-not $search.results) { Fail "Search response missing results" }
    if ($search.results.Count -lt 1) { Fail "Search returned no results" }
    Pass "Search returned $($search.results.Count) results"
} catch {
    Fail "/api/search failed: $($_.Exception.Message)"
}

$tmdb = $search.results | Where-Object { $_.source.provider -eq "tmdb" } | Select-Object -First 1
if (-not $tmdb) {
    Fail "No TMDb result found in search results. Try a different query."
}

$body = @{
    source = @{
        provider = "tmdb"
        external_id = $tmdb.source.external_id
        source_type = $tmdb.source.source_type
    }
    status = "finished"
    rating = 95
    notes = "Smoke test"
} | ConvertTo-Json

try {
    $add1 = Invoke-RestMethod `
        -Uri "$BaseUrl/api/library/add" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $body

    if (-not $add1.work.id) { Fail "Add response missing work.id" }
    if (-not $add1.user_item.id) { Fail "Add response missing user_item.id" }
    Pass "Add succeeded (work $($add1.work.id), item $($add1.user_item.id))"
} catch {
    Fail "/api/library/add failed: $($_.Exception.Message)"
}

try {
    $add2 = Invoke-RestMethod `
        -Uri "$BaseUrl/api/library/add" `
        -Method Post `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $body

    if ($add1.work.id -ne $add2.work.id) { Fail "Work id not idempotent" }
    if ($add1.user_item.id -ne $add2.user_item.id) { Fail "User item id not idempotent" }
    Pass "Idempotent add verified"
} catch {
    Fail "Repeat add failed: $($_.Exception.Message)"
}

Write-Host "[SUCCESS] Smoke tests complete" -ForegroundColor Green

