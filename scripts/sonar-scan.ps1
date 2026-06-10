<#
.SYNOPSIS
  Genera el reporte de cobertura (Jest) y ejecuta SonarScanner para un microservicio
  contra la instancia local de SonarQube (docker-compose.sonar.yml).

.PARAMETER Service
  Nombre de la carpeta del microservicio (auth-service, user-service, etc.).

.PARAMETER Token
  Token de usuario generado en SonarQube (My Account > Security > Generate Token).

.EXAMPLE
  ./scripts/sonar-scan.ps1 -Service review-service -Token squ_xxxxxxxx
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(
        "auth-service",
        "user-service",
        "restaurant-service",
        "review-service",
        "media-service",
        "social-service",
        "notification-service"
    )]
    [string]$Service,

    [Parameter(Mandatory = $true)]
    [string]$Token
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$servicePath = Join-Path $root $Service

Write-Host "==> Instalando dependencias y generando cobertura para $Service"
Push-Location $servicePath
try {
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    npm run test:ci
}
finally {
    Pop-Location
}

Write-Host "==> Ejecutando SonarScanner para $Service"
docker run --rm `
    --network api-reviews-sonar-network `
    -e SONAR_HOST_URL="http://sonarqube:9000" `
    -e SONAR_TOKEN="$Token" `
    -v "${servicePath}:/usr/src" `
    sonarsource/sonar-scanner-cli
