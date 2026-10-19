# Schoolpost Localhost Server
# Run this in PowerShell to serve the app on your local network
# Anyone on your WiFi can access: http://<your-ip>:8080

$port = 8080
$path = "C:\Users\ETHCOT16638\SchoolPost\public"

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://+:$port/")
$listener.Start()

Write-Host "Schoolpost server running on port $port" -ForegroundColor Green
Write-Host "Local access:  http://localhost:$port" -ForegroundColor Cyan
Write-Host "Network access: http://<your-ip-address>:$port" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray

try {
    while ($true) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $filePath = Join-Path $path $request.Url.AbsolutePath.TrimStart("/")
        if (-not (Test-Path $filePath)) {
            $filePath = Join-Path $path "index.html"
        }

        if (Test-Path $filePath) {
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $extension = [System.IO.Path]::GetExtension($filePath)
            switch ($extension) {
                ".html" { $response.ContentType = "text/html" }
                ".css"  { $response.ContentType = "text/css" }
                ".js"   { $response.ContentType = "application/javascript" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                default { $response.ContentType = "application/octet-stream" }
            }
            $response.ContentEncoding = [System.Text.UTF8Encoding]::UTF8
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
            $response.StatusDescription = "Not Found"
        }
        $response.OutputStream.Close()
    }
} catch {
    Write-Host "Server stopped" -ForegroundColor Yellow
} finally {
    $listener.Stop()
    $listener.Close()
}
