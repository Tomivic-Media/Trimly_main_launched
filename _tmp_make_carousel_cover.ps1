Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$outPath = 'C:\Users\i\Desktop\trimly_backend\social_exports\trimly-social-11-carousel-cover-v1.jpg'
$root = 'C:\Users\i\Desktop\trimly_backend\social_exports'

function New-Color([int]$r,[int]$g,[int]$b,[int]$a=255) {
    return [System.Drawing.Color]::FromArgb($a,$r,$g,$b)
}

function Add-RoundedRectPath([System.Drawing.Drawing2D.GraphicsPath]$path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
}

function Fill-RoundedRect($g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRectPath $path $x $y $w $h $r
    $g.FillPath($brush, $path)
    $path.Dispose()
}

function Draw-RoundedRect($g, $pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RoundedRectPath $path $x $y $w $h $r
    $g.DrawPath($pen, $path)
    $path.Dispose()
}

function Draw-ShadowCard($g, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 40, 30, 20))
    Fill-RoundedRect $g $shadow ($x + 10) ($y + 14) $w $h $r
    $shadow.Dispose()
    $fill = New-Object System.Drawing.SolidBrush((New-Color 249 245 238))
    $pen = New-Object System.Drawing.Pen((New-Color 217 206 187), 2)
    Fill-RoundedRect $g $fill $x $y $w $h $r
    Draw-RoundedRect $g $pen $x $y $w $h $r
    $fill.Dispose()
    $pen.Dispose()
}

function Draw-ImageCover($g, [string]$path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $img = [System.Drawing.Image]::FromFile($path)
    try {
        $srcRatio = $img.Width / $img.Height
        $dstRatio = $w / $h
        if ($srcRatio -gt $dstRatio) {
            $srcH = $img.Height
            $srcW = [int]($srcH * $dstRatio)
            $srcX = [int](($img.Width - $srcW) / 2)
            $srcY = 0
        } else {
            $srcW = $img.Width
            $srcH = [int]($srcW / $dstRatio)
            $srcX = 0
            $srcY = [int](($img.Height - $srcH) / 2)
        }

        $pathObj = New-Object System.Drawing.Drawing2D.GraphicsPath
        Add-RoundedRectPath $pathObj $x $y $w $h $r
        $oldClip = $g.Clip
        $g.SetClip($pathObj)
        $destRect = New-Object System.Drawing.RectangleF($x, $y, $w, $h)
        $srcRect = New-Object System.Drawing.RectangleF($srcX, $srcY, $srcW, $srcH)
        $g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        $g.Clip = $oldClip
        $pathObj.Dispose()
        $overlay = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12, 255,255,255))
        Fill-RoundedRect $g $overlay $x $y $w $h $r
        $overlay.Dispose()
    }
    finally {
        $img.Dispose()
    }
}

function Draw-Chip($g, [string]$text, [float]$x, [float]$y, $font, $fg, $bg) {
    $size = $g.MeasureString($text, $font)
    $w = [math]::Ceiling($size.Width) + 30
    $h = [math]::Ceiling($size.Height) + 14
    $b = New-Object System.Drawing.SolidBrush($bg)
    Fill-RoundedRect $g $b $x $y $w $h 20
    $b.Dispose()
    $tb = New-Object System.Drawing.SolidBrush($fg)
    $g.DrawString($text, $font, $tb, $x + 15, $y + 6)
    $tb.Dispose()
    return $w
}

$bmp = New-Object System.Drawing.Bitmap 1080, 1350
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 0,0,1080,1350),
    (New-Color 248 243 233),
    (New-Color 242 236 225),
    90
)
$g.FillRectangle($bg, 0, 0, 1080, 1350)
$bg.Dispose()

$wash1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(45, 201, 169, 107))
$wash2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(25, 46, 106, 79))
$g.FillEllipse($wash1, 690, -120, 470, 470)
$g.FillEllipse($wash2, -140, 980, 420, 420)
$g.FillEllipse($wash1, 820, 980, 260, 260)
$wash1.Dispose(); $wash2.Dispose()

$brandFont = New-Object System.Drawing.Font('Segoe UI Semibold', 20, [System.Drawing.FontStyle]::Bold)
$headlineFont = New-Object System.Drawing.Font('Georgia', 34, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Regular)
$chipFont = New-Object System.Drawing.Font('Segoe UI Semibold', 11, [System.Drawing.FontStyle]::Bold)
$smallFont = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Regular)
$cardLabelFont = New-Object System.Drawing.Font('Segoe UI Semibold', 12, [System.Drawing.FontStyle]::Bold)

$green = New-Color 46 106 79
$gold = New-Color 201 169 107
$ink = New-Color 32 56 47
$muted = New-Color 108 98 86
$cream = New-Color 250 246 239

$logoBrush = New-Object System.Drawing.SolidBrush($green)
Fill-RoundedRect $g $logoBrush 54 50 38 38 12
$logoBrush.Dispose()
$tBrush = New-Object System.Drawing.SolidBrush((New-Color 245 241 232))
$g.DrawString('T', (New-Object System.Drawing.Font('Segoe UI Semibold', 18, [System.Drawing.FontStyle]::Bold)), $tBrush, 65, 56)
$tBrush.Dispose()
$nameBrush = New-Object System.Drawing.SolidBrush($ink)
$g.DrawString('Trimly', $brandFont, $nameBrush, 105, 50)
$nameBrush.Dispose()

$headlineBrush = New-Object System.Drawing.SolidBrush($ink)
$headlineRect = New-Object System.Drawing.RectangleF(54, 120, 470, 180)
$sf = New-Object System.Drawing.StringFormat
$sf.LineAlignment = [System.Drawing.StringAlignment]::Near
$sf.Alignment = [System.Drawing.StringAlignment]::Near
$g.DrawString('Barber booking that feels premium from first tap to final payment.', $headlineFont, $headlineBrush, $headlineRect, $sf)
$headlineBrush.Dispose()

$subBrush = New-Object System.Drawing.SolidBrush($muted)
$subRect = New-Object System.Drawing.RectangleF(56, 285, 430, 80)
$g.DrawString('Built for modern Nigerian grooming: discover trusted barbers, approve bookings, pay smoothly, and coordinate home service without friction.', $subFont, $subBrush, $subRect)
$subBrush.Dispose()

$xChip = 56
$xChip += (Draw-Chip $g 'Home service ready' $xChip 378 $chipFont $green (New-Color 231 239 233)) + 12
$xChip += (Draw-Chip $g 'Real-time chat' $xChip 378 $chipFont $green (New-Color 231 239 233)) + 12
[void](Draw-Chip $g 'NGN pricing' $xChip 378 $chipFont $gold (New-Color 247 239 221))

$ctaBrush = New-Object System.Drawing.SolidBrush($green)
Fill-RoundedRect $g $ctaBrush 56 438 210 52 24
$ctaBrush.Dispose()
$ctaTextBrush = New-Object System.Drawing.SolidBrush((New-Color 248 244 236))
$g.DrawString('Launch-ready product', (New-Object System.Drawing.Font('Segoe UI Semibold', 14, [System.Drawing.FontStyle]::Bold)), $ctaTextBrush, 85, 452)
$ctaTextBrush.Dispose()

Draw-ShadowCard $g 470 170 520 670 34
Draw-ImageCover $g (Join-Path $root 'trimly-social-01-landing-hero.jpg') 495 195 470 620 28

Draw-ShadowCard $g 70 545 330 230 28
Draw-ImageCover $g (Join-Path $root 'trimly-social-03-browse-barbers.jpg') 88 563 294 160 20
$labBrush = New-Object System.Drawing.SolidBrush($ink)
$mutBrush = New-Object System.Drawing.SolidBrush($muted)
$g.DrawString('Browse trusted barbers', $cardLabelFont, $labBrush, 92, 730)
$g.DrawString('Discovery, pricing, location, and services in one view.', $smallFont, $mutBrush, 92, 752)

Draw-ShadowCard $g 80 815 360 430 30
Draw-ImageCover $g (Join-Path $root 'trimly-social-09-booking-payment-ngn-v2.jpg') 98 833 324 240 22
$g.DrawString('Approval to payment, clearly mapped', $cardLabelFont, $labBrush, 104, 1085)
$descRect = New-Object System.Drawing.RectangleF(104, 1112, 300, 60)
$g.DrawString('Customers can see status, total amount, and payment confidence before checkout.', $smallFont, $mutBrush, $descRect)
[void](Draw-Chip $g 'Approved' 104 1188 $chipFont $green (New-Color 231 239 233))
[void](Draw-Chip $g 'Paid' 206 1188 $chipFont $gold (New-Color 247 239 221))

Draw-ShadowCard $g 750 885 250 300 28
Draw-ImageCover $g (Join-Path $root 'trimly-social-10-chat-ngn-v2.jpg') 768 903 214 182 20
$g.DrawString('Chat that solves real logistics', $cardLabelFont, $labBrush, 770, 1095)
$chatRect = New-Object System.Drawing.RectangleF(770, 1120, 195, 62)
$g.DrawString('Perfect for home-service directions, arrival updates, and trust.', $smallFont, $mutBrush, $chatRect)

$footerBrush = New-Object System.Drawing.SolidBrush((New-Color 250 246 239 235))
Fill-RoundedRect $g $footerBrush 500 810 490 52 22
$footerBrush.Dispose()
$footText = New-Object System.Drawing.SolidBrush($ink)
$g.DrawString('A complete grooming experience for customers and barbers.', (New-Object System.Drawing.Font('Segoe UI Semibold', 14, [System.Drawing.FontStyle]::Bold)), $footText, 528, 825)
$footText.Dispose()

$labBrush.Dispose(); $mutBrush.Dispose(); $headlineFont.Dispose(); $subFont.Dispose(); $chipFont.Dispose(); $smallFont.Dispose(); $cardLabelFont.Dispose(); $brandFont.Dispose(); $sf.Dispose()

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 92L)
$bmp.Save($outPath, $jpegCodec, $encParams)

$g.Dispose()
$bmp.Dispose()

Write-Output $outPath
