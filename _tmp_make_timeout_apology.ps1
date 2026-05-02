Add-Type -AssemblyName System.Drawing

function Fill-RoundedRect([System.Drawing.Graphics]$graphics, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}
function Draw-RoundedRect([System.Drawing.Graphics]$graphics, [System.Drawing.Pen]$pen, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $graphics.DrawPath($pen, $path)
  $path.Dispose()
}
function New-Brush($hex) {
  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}
function New-Pen($hex, $w=1) {
  return New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($hex), $w)
}
function New-FontObj($name, $size, $style=[System.Drawing.FontStyle]::Regular) {
  return New-Object System.Drawing.Font($name, $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

$width = 1080
$height = 1350
$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.InterpolationMode = 'HighQualityBicubic'
$g.TextRenderingHint = 'ClearTypeGridFit'
$g.Clear([System.Drawing.Color]::FromArgb(247, 242, 232))

$deep = '#244236'
$green = '#2f6a50'
$muted = '#5f6e66'
$gold = '#d8c29a'
$cream = '#fbf8f2'
$line = '#d9cfbe'

$shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(130,231,222,206))
$cardBrush = New-Brush $cream
$deepBrush = New-Brush $deep
$greenBrush = New-Brush $green
$mutedBrush = New-Brush $muted
$goldBrush = New-Brush $gold
$linePen = New-Pen $line 2
$outlinePen = New-Pen '#9fb7a6' 4

$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(55,215,194,154))), -140, 120, 420, 420)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(40,47,106,80))), 760, 840, 340, 340)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28,36,66,54))), 820, 80, 220, 220)

$g.FillEllipse($greenBrush, 112, 92, 64, 64)
$brandFont = New-FontObj 'Segoe UI Semibold' 34
$g.DrawString('T', $brandFont, (New-Brush '#ffffff'), 133, 104)
$logoFont = New-FontObj 'Segoe UI Semibold' 40
$g.DrawString('Trimly', $logoFont, $deepBrush, 194, 100)

Fill-RoundedRect $g $shadowBrush 118 212 844 868 36
Fill-RoundedRect $g $cardBrush 98 190 844 868 36
Draw-RoundedRect $g $linePen 98 190 844 868 36

$g.FillEllipse($goldBrush, 390, 250, 260, 260)
$g.DrawEllipse($outlinePen, 390, 250, 260, 260)
$eyeBrush = New-Brush $deep
$g.FillEllipse($eyeBrush, 462, 342, 18, 26)
$g.FillEllipse($eyeBrush, 560, 342, 18, 26)
$g.DrawArc((New-Pen $deep 7), 445, 390, 150, 80, 18, 144)
$g.DrawArc((New-Pen $deep 6), 435, 412, 170, 92, 208, 124)
$g.FillEllipse($greenBrush, 635, 285, 20, 20)
$g.FillEllipse($greenBrush, 662, 260, 14, 14)
$g.FillEllipse($greenBrush, 670, 300, 10, 10)

$titleFont = New-FontObj 'Georgia' 58 ([System.Drawing.FontStyle]::Bold)
$subtitleFont = New-FontObj 'Segoe UI Semibold' 28
$bodyFont = New-FontObj 'Segoe UI' 28
$smallFont = New-FontObj 'Segoe UI' 24

$sfCenter = New-Object System.Drawing.StringFormat
$sfCenter.Alignment = 'Center'
$sfCenter.LineAlignment = 'Center'

$g.DrawString('We are sorry.', $titleFont, $deepBrush, (New-Object System.Drawing.RectangleF(180, 560, 680, 90)), $sfCenter)
$g.DrawString('Trimly had a timeout issue.', $subtitleFont, $greenBrush, (New-Object System.Drawing.RectangleF(180, 646, 680, 46)), $sfCenter)

$bodyRect = New-Object System.Drawing.RectangleF(188, 720, 664, 150)
$bodyText = 'Some customers could not log in or complete actions for a while. The issue has been resolved, and the platform is working again.'
$g.DrawString($bodyText, $bodyFont, $mutedBrush, $bodyRect)

$chipBrush = New-Brush '#eef4ee'
$chipPen = New-Pen '#c7d7cb' 2
Fill-RoundedRect $g $chipBrush 180 895 250 62 24
Draw-RoundedRect $g $chipPen 180 895 250 62 24
$g.DrawString('Service restored', $smallFont, $deepBrush, (New-Object System.Drawing.RectangleF(210, 911, 190, 30)))

Fill-RoundedRect $g $chipBrush 448 895 312 62 24
Draw-RoundedRect $g $chipPen 448 895 312 62 24
$g.DrawString('Thank you for your patience', $smallFont, $deepBrush, (New-Object System.Drawing.RectangleF(480, 911, 250, 30)))

$g.DrawString('If you still notice any issue, please try again or contact support.', $smallFont, $mutedBrush, (New-Object System.Drawing.RectangleF(178, 990, 670, 54)), $sfCenter)

$out = 'C:\Users\i\Desktop\trimly_backend\social_exports\trimly-social-38-timeout-apology-v1.jpg'
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$enc = New-Object System.Drawing.Imaging.EncoderParameters 1
$enc.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, 92L)
$bmp.Save($out, $jpegCodec, $enc)
$g.Dispose()
$bmp.Dispose()
Write-Host $out
