# Copia os arquivos escolhidos de um .unitypackage já extraído (pastas <guid>/asset, asset.meta, pathname)
# para o projeto Unity, reduzindo as texturas TIFF/PNG para no máximo $Max px (PNG se tiver
# transparência, JPG se não tiver). O identificador (GUID) do .meta é mantido, então
# materiais e camadas de terreno continuam achando as texturas.
# Uso: powershell -File tools/unity/converter-texturas.ps1 -Origem <pasta extraída> -Destino CriaturasUnity
param(
    [Parameter(Mandatory)] [string]$Origem,
    [Parameter(Mandatory)] [string]$Destino,
    [int]$Max = 1024,
    [string]$Excluir = '\.hdr$'
)
Add-Type -AssemblyName System.Drawing
$jpg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$qual = New-Object System.Drawing.Imaging.EncoderParameters 1
$qual.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 92L

function TemAlfa($bmp) {
    if (-not [System.Drawing.Image]::IsAlphaPixelFormat($bmp.PixelFormat)) { return $false }
    # confere uma amostra de pixels: alfa todo 255 conta como sem transparência
    $passo = [Math]::Max(1, [int]($bmp.Width / 64))
    for ($y = 0; $y -lt $bmp.Height; $y += $passo) {
        for ($x = 0; $x -lt $bmp.Width; $x += $passo) { if ($bmp.GetPixel($x, $y).A -lt 250) { return $true } }
    }
    return $false
}

$n = 0
foreach ($dir in Get-ChildItem $Origem -Directory) {
    $pn = Join-Path $dir.FullName 'pathname'
    $asset = Join-Path $dir.FullName 'asset'
    if (-not (Test-Path $pn)) { continue }
    $rel = (Get-Content $pn -TotalCount 1).Trim()
    if ($rel -match $Excluir) { continue }
    $alvo = Join-Path $Destino $rel
    $meta = Join-Path $dir.FullName 'asset.meta'
    if (-not (Test-Path $asset)) {
        # pasta: só o .meta
        New-Item -ItemType Directory -Force $alvo | Out-Null
        if (Test-Path $meta) { Copy-Item $meta "$alvo.meta" -Force }
        continue
    }
    New-Item -ItemType Directory -Force (Split-Path $alvo) | Out-Null
    $ext = [IO.Path]::GetExtension($rel).ToLower()
    if ($ext -in '.tif', '.tiff', '.png', '.psd') {
        try {
            $img = [System.Drawing.Image]::FromFile($asset)
            $k = [Math]::Min(1.0, $Max / [Math]::Max($img.Width, $img.Height))
            $w = [int]($img.Width * $k); $h = [int]($img.Height * $k)
            $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.InterpolationMode = 'HighQualityBicubic'
            $g.CompositingMode = 'SourceCopy'
            $g.DrawImage($img, 0, 0, $w, $h)
            $g.Dispose(); $img.Dispose()
            $alfa = TemAlfa $bmp
            $novoExt = if ($alfa) { '.png' } else { '.jpg' }
            $novo = [IO.Path]::ChangeExtension($alvo, $novoExt)
            if ($alfa) { $bmp.Save($novo, [System.Drawing.Imaging.ImageFormat]::Png) } else { $bmp.Save($novo, $jpg, $qual) }
            $bmp.Dispose()
            if (Test-Path $meta) { Copy-Item $meta "$novo.meta" -Force }
            $n++
            continue
        } catch {
            Write-Warning "Não converti $rel ($($_.Exception.Message)); copiando o original."
        }
    }
    Copy-Item $asset $alvo -Force
    if (Test-Path $meta) { Copy-Item $meta "$alvo.meta" -Force }
}
Write-Output "$n texturas convertidas."
