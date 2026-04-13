Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$outPath = 'C:\Users\i\Desktop\trimly_backend\social_exports\trimly-social-11-carousel-cover-v2.jpg'
$root = 'C:\Users\i\Desktop\trimly_backend\social_exports'

function C([int]$r,[int]$g,[int]$b,[int]$a=255){ [System.Drawing.Color]::FromArgb($a,$r,$g,$b) }
function Add-RR([System.Drawing.Drawing2D.GraphicsPath]$p,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $d=$r*2; $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90); $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure() }
function Fill-RR($g,$brush,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $g.FillPath($brush,$p); $p.Dispose() }
function Draw-RR($g,$pen,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $g.DrawPath($pen,$p); $p.Dispose() }
function Card($g,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $sb=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26,35,28,18)); Fill-RR $g $sb ($x+10) ($y+14) $w $h $r; $sb.Dispose(); $fb=New-Object System.Drawing.SolidBrush (C 250 246 239); $pen=New-Object System.Drawing.Pen((C 219 208 189),2); Fill-RR $g $fb $x $y $w $h $r; Draw-RR $g $pen $x $y $w $h $r; $fb.Dispose(); $pen.Dispose() }
function Img($g,[string]$path,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r,[int]$overlay=0){ $img=[System.Drawing.Image]::FromFile($path); try { $srcRatio=$img.Width/$img.Height; $dstRatio=$w/$h; if($srcRatio -gt $dstRatio){ $srcH=$img.Height; $srcW=[int]($srcH*$dstRatio); $srcX=[int](($img.Width-$srcW)/2); $srcY=0 } else { $srcW=$img.Width; $srcH=[int]($srcW/$dstRatio); $srcX=0; $srcY=[int](($img.Height-$srcH)/2) } $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $old=$g.Clip; $g.SetClip($p); $dest=New-Object System.Drawing.RectangleF($x,$y,$w,$h); $src=New-Object System.Drawing.RectangleF($srcX,$srcY,$srcW,$srcH); $g.DrawImage($img,$dest,$src,[System.Drawing.GraphicsUnit]::Pixel); if($overlay -gt 0){ $ob=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($overlay,255,255,255)); $g.FillRectangle($ob,$x,$y,$w,$h); $ob.Dispose() } $g.Clip=$old; $p.Dispose() } finally { $img.Dispose() } }
function Chip($g,[string]$text,[float]$x,[float]$y,$font,$fg,$bg){ $s=$g.MeasureString($text,$font); $w=[math]::Ceiling($s.Width)+28; $h=[math]::Ceiling($s.Height)+14; $bb=New-Object System.Drawing.SolidBrush($bg); Fill-RR $g $bb $x $y $w $h 18; $bb.Dispose(); $tb=New-Object System.Drawing.SolidBrush($fg); $g.DrawString($text,$font,$tb,$x+14,$y+6); $tb.Dispose(); return $w }

$bmp=New-Object System.Drawing.Bitmap 1080,1350
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode='AntiAlias'; $g.InterpolationMode='HighQualityBicubic'; $g.TextRenderingHint='ClearTypeGridFit'
$bg=New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle 0,0,1080,1350),(C 248 243 233),(C 243 237 226),90); $g.FillRectangle($bg,0,0,1080,1350); $bg.Dispose()
$w1=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(36,201,169,107)); $w2=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(24,46,106,79)); $g.FillEllipse($w1,720,-90,430,430); $g.FillEllipse($w2,-120,1000,350,350); $g.FillEllipse($w1,860,1080,220,220); $w1.Dispose(); $w2.Dispose()

$ink=C 31 54 45; $green=C 46 106 79; $gold=C 201 169 107; $muted=C 106 97 87
$brandFont=New-Object System.Drawing.Font('Segoe UI Semibold',20,[System.Drawing.FontStyle]::Bold)
$headlineFont=New-Object System.Drawing.Font('Georgia',28,[System.Drawing.FontStyle]::Bold)
$subFont=New-Object System.Drawing.Font('Segoe UI',15,[System.Drawing.FontStyle]::Regular)
$chipFont=New-Object System.Drawing.Font('Segoe UI Semibold',11,[System.Drawing.FontStyle]::Bold)
$labelFont=New-Object System.Drawing.Font('Segoe UI Semibold',12,[System.Drawing.FontStyle]::Bold)
$smallFont=New-Object System.Drawing.Font('Segoe UI',10.5,[System.Drawing.FontStyle]::Regular)

$lb=New-Object System.Drawing.SolidBrush($green); Fill-RR $g $lb 54 48 38 38 12; $lb.Dispose(); $tb=New-Object System.Drawing.SolidBrush((C 245 241 232)); $g.DrawString('T',(New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)),$tb,65,55); $tb.Dispose(); $nb=New-Object System.Drawing.SolidBrush($ink); $g.DrawString('Trimly',$brandFont,$nb,104,49); $nb.Dispose()

$hb=New-Object System.Drawing.SolidBrush($ink)
$g.DrawString('Launch-ready visuals for the full Trimly journey.',$headlineFont,$hb,(New-Object System.Drawing.RectangleF 54,118,360,130))
$g.DrawString('From discovery to chat to payment, this cover ties the carousel together with the real product look and feel.',$subFont,(New-Object System.Drawing.SolidBrush($muted)),(New-Object System.Drawing.RectangleF 56,255,350,84))
$hb.Dispose()

$x=56; $x += (Chip $g 'Discovery' $x 348 $chipFont $green (C 231 239 233)) + 10; $x += (Chip $g 'Home service' $x 348 $chipFont $green (C 231 239 233)) + 10; [void](Chip $g 'Payments' $x 348 $chipFont $gold (C 247 239 221))
$cb=New-Object System.Drawing.SolidBrush($green); Fill-RR $g $cb 56 404 190 50 24; $cb.Dispose(); $ct=New-Object System.Drawing.SolidBrush((C 248 244 236)); $g.DrawString('Social carousel cover',(New-Object System.Drawing.Font('Segoe UI Semibold',13,[System.Drawing.FontStyle]::Bold)),$ct,79,419); $ct.Dispose()

Card $g 438 90 588 760 36
Img $g (Join-Path $root 'trimly-social-08-barber-profile-ngn-v1.jpg') 462 116 540 708 30 4

Card $g 58 502 356 248 28
Img $g (Join-Path $root 'trimly-social-03-browse-barbers.jpg') 76 520 320 158 20 0
$lab=New-Object System.Drawing.SolidBrush($ink); $mb=New-Object System.Drawing.SolidBrush($muted)
$g.DrawString('Browse and compare barbers',$labelFont,$lab,80,688)
$g.DrawString('Customers can scan services, ratings, locations, and pricing fast.',$smallFont,$mb,(New-Object System.Drawing.RectangleF 80,710,300,40))

Card $g 56 785 372 475 30
Img $g (Join-Path $root 'trimly-social-09-booking-payment-ngn-v2.jpg') 76 805 332 228 22 0
$g.DrawString('Booking to payment, clearly guided',$labelFont,$lab,82,1045)
$g.DrawString('Approved slots, payment summary, trust indicators, and status chips make checkout feel safe and polished.',$smallFont,$mb,(New-Object System.Drawing.RectangleF 82,1070,310,62))
[void](Chip $g 'Approved' 82 1152 $chipFont $green (C 231 239 233)); [void](Chip $g 'Paid' 188 1152 $chipFont $gold (C 247 239 221)); [void](Chip $g 'Completed' 264 1152 $chipFont $green (C 231 239 233))

Card $g 756 912 270 298 28
Img $g (Join-Path $root 'trimly-social-10-chat-ngn-v2.jpg') 774 930 234 176 20 0
$g.DrawString('Chat with real intent',$labelFont,$lab,778,1117)
$g.DrawString('Useful for arrival updates and giving house directions for home service.',$smallFont,$mb,(New-Object System.Drawing.RectangleF 778,1141,210,52))

$rb=New-Object System.Drawing.SolidBrush((C 250 246 239 240)); Fill-RR $g $rb 470 859 520 44 20; $rb.Dispose(); $g.DrawString('Beautiful enough for launch posts, grounded in the actual Trimly product UI.',$labelFont,$lab,492,870)

$lab.Dispose(); $mb.Dispose(); $brandFont.Dispose(); $headlineFont.Dispose(); $subFont.Dispose(); $chipFont.Dispose(); $labelFont.Dispose(); $smallFont.Dispose(); $g.Dispose()
$jpeg=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep=New-Object System.Drawing.Imaging.EncoderParameters 1; $ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,92L)
$bmp.Save($outPath,$jpeg,$ep); $bmp.Dispose(); Write-Output $outPath
