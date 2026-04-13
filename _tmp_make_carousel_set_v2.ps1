Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\i\Desktop\trimly_backend\social_exports'

function C([int]$r,[int]$g,[int]$b,[int]$a=255){ [System.Drawing.Color]::FromArgb($a,$r,$g,$b) }
function Add-RR([System.Drawing.Drawing2D.GraphicsPath]$p,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $d=$r*2; $p.AddArc($x,$y,$d,$d,180,90); $p.AddArc($x+$w-$d,$y,$d,$d,270,90); $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90); $p.AddArc($x,$y+$h-$d,$d,$d,90,90); $p.CloseFigure() }
function Fill-RR($g,$brush,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $g.FillPath($brush,$p); $p.Dispose() }
function Draw-RR($g,$pen,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $g.DrawPath($pen,$p); $p.Dispose() }
function Card($g,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){ $sb=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(24,35,28,18)); Fill-RR $g $sb ($x+10) ($y+14) $w $h $r; $sb.Dispose(); $fb=New-Object System.Drawing.SolidBrush (C 250 246 239); $pen=New-Object System.Drawing.Pen((C 219 208 189),2); Fill-RR $g $fb $x $y $w $h $r; Draw-RR $g $pen $x $y $w $h $r; $fb.Dispose(); $pen.Dispose() }
function Img($g,[string]$path,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r,[int]$overlay=0){ $img=[System.Drawing.Image]::FromFile($path); try { $srcRatio=$img.Width/$img.Height; $dstRatio=$w/$h; if($srcRatio -gt $dstRatio){ $srcH=$img.Height; $srcW=[int]($srcH*$dstRatio); $srcX=[int](($img.Width-$srcW)/2); $srcY=0 } else { $srcW=$img.Width; $srcH=[int]($srcW/$dstRatio); $srcX=0; $srcY=[int](($img.Height-$srcH)/2) } $p=New-Object System.Drawing.Drawing2D.GraphicsPath; Add-RR $p $x $y $w $h $r; $old=$g.Clip; $g.SetClip($p); $dest=New-Object System.Drawing.RectangleF($x,$y,$w,$h); $src=New-Object System.Drawing.RectangleF($srcX,$srcY,$srcW,$srcH); $g.DrawImage($img,$dest,$src,[System.Drawing.GraphicsUnit]::Pixel); if($overlay -gt 0){ $ob=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($overlay,255,255,255)); $g.FillRectangle($ob,$x,$y,$w,$h); $ob.Dispose() } $g.Clip=$old; $p.Dispose() } finally { $img.Dispose() } }
function Chip($g,[string]$text,[float]$x,[float]$y,$font,$fg,$bg){ $s=$g.MeasureString($text,$font); $w=[math]::Ceiling($s.Width)+28; $h=[math]::Ceiling($s.Height)+14; $bb=New-Object System.Drawing.SolidBrush($bg); Fill-RR $g $bb $x $y $w $h 18; $bb.Dispose(); $tb=New-Object System.Drawing.SolidBrush($fg); $g.DrawString($text,$font,$tb,$x+14,$y+6); $tb.Dispose(); return $w }
function Brand($g,$ink,$green,$brandFont){ $lb=New-Object System.Drawing.SolidBrush($green); Fill-RR $g $lb 54 48 38 38 12; $lb.Dispose(); $tb=New-Object System.Drawing.SolidBrush((C 245 241 232)); $g.DrawString('T',(New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)),$tb,65,55); $tb.Dispose(); $nb=New-Object System.Drawing.SolidBrush($ink); $g.DrawString('Trimly',$brandFont,$nb,104,49); $nb.Dispose() }
function Save-Jpeg($bmp,[string]$path){ $jpeg=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }; $ep=New-Object System.Drawing.Imaging.EncoderParameters 1; $ep.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,92L); $bmp.Save($path,$jpeg,$ep) }

$ink=C 31 54 45; $green=C 46 106 79; $gold=C 201 169 107; $muted=C 108 98 87

$configs = @(
    @{
        Out='trimly-social-12-carousel-discovery-v2.jpg';
        Title='Discovery that feels simple and premium.';
        Subtitle='Lead with a clear first impression, then show how customers browse by service, price, and location.';
        Hero='trimly-social-01-landing-hero.jpg';
        Inset='trimly-social-03-browse-barbers.jpg';
        HeroTitle='Homepage clarity that leads into search';
        InsetTitle='Browse barbers by location, service, and price';
        Chips=@('Discovery','Ratings','NGN pricing')
    },
    @{
        Out='trimly-social-13-carousel-profile-v2.jpg';
        Title='Barber profiles that make booking feel easy.';
        Subtitle='Customers can check services, availability, location, and home service details in one calm view.';
        Hero='trimly-social-08-barber-profile-ngn-v1.jpg';
        Inset='trimly-social-05-create-account.jpg';
        HeroTitle='Everything needed before tapping book';
        InsetTitle='Smooth onboarding into the booking journey';
        Chips=@('Availability','Services','Home service')
    },
    @{
        Out='trimly-social-14-carousel-payment-v2.jpg';
        Title='Approved bookings flow naturally into payment.';
        Subtitle='Status, trust indicators, and a clean amount due make the next action obvious.';
        Hero='trimly-social-09-booking-payment-ngn-v2.jpg';
        Inset='trimly-social-10-chat-ngn-v2.jpg';
        HeroTitle='Payment readiness without confusion';
        InsetTitle='Chat handles last-mile coordination';
        Chips=@('Approved','Paid','Trust built in')
    },
    @{
        Out='trimly-social-15-carousel-dashboards-v2.jpg';
        Title='Dashboards for both customers and barbers.';
        Subtitle='Customers track bookings while barbers manage approvals, active jobs, and earnings.';
        Hero='trimly-social-06-customer-dashboard-ngn-v2.jpg';
        Inset='trimly-social-07-barber-dashboard-ngn-v2.jpg';
        HeroTitle='Customer dashboard with active booking visibility';
        InsetTitle='Barber dashboard for operations and earnings';
        Chips=@('Customer side','Barber side','Live workflow')
    }
)

foreach($cfg in $configs){
    $bmp=New-Object System.Drawing.Bitmap 1080,1350
    $g=[System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode='AntiAlias'; $g.InterpolationMode='HighQualityBicubic'; $g.TextRenderingHint='ClearTypeGridFit'
    $bg=New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle 0,0,1080,1350),(C 248 243 233),(C 243 237 226),90)
    $g.FillRectangle($bg,0,0,1080,1350); $bg.Dispose()
    $w1=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(34,201,169,107))
    $w2=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22,46,106,79))
    $g.FillEllipse($w1,720,-90,430,430); $g.FillEllipse($w2,-120,1040,330,330); $g.FillEllipse($w1,860,1080,220,220)
    $w1.Dispose(); $w2.Dispose()

    $brandFont=New-Object System.Drawing.Font('Segoe UI Semibold',20,[System.Drawing.FontStyle]::Bold)
    $headlineFont=New-Object System.Drawing.Font('Georgia',28,[System.Drawing.FontStyle]::Bold)
    $subFont=New-Object System.Drawing.Font('Segoe UI',14,[System.Drawing.FontStyle]::Regular)
    $chipFont=New-Object System.Drawing.Font('Segoe UI Semibold',11,[System.Drawing.FontStyle]::Bold)
    $labelFont=New-Object System.Drawing.Font('Segoe UI Semibold',12,[System.Drawing.FontStyle]::Bold)
    $smallFont=New-Object System.Drawing.Font('Segoe UI',10.5,[System.Drawing.FontStyle]::Regular)

    Brand $g $ink $green $brandFont
    $hb=New-Object System.Drawing.SolidBrush($ink)
    $mb=New-Object System.Drawing.SolidBrush($muted)
    $g.DrawString($cfg.Title,$headlineFont,$hb,(New-Object System.Drawing.RectangleF 54,118,372,145))
    $g.DrawString($cfg.Subtitle,$subFont,$mb,(New-Object System.Drawing.RectangleF 56,252,352,92))

    $x=56
    foreach($chip in $cfg.Chips){ $fg = if($chip -like '*Paid*' -or $chip -like '*pricing*' -or $chip -like '*Trust*'){ $gold } else { $green }; $bgChip = if($chip -like '*Paid*' -or $chip -like '*pricing*' -or $chip -like '*Trust*'){ (C 247 239 221) } else { (C 231 239 233) }; $x += (Chip $g $chip $x 356 $chipFont $fg $bgChip) + 10 }

    $cb=New-Object System.Drawing.SolidBrush($green); Fill-RR $g $cb 56 412 174 50 24; $cb.Dispose(); $ct=New-Object System.Drawing.SolidBrush((C 248 244 236)); $g.DrawString('Carousel concept',(New-Object System.Drawing.Font('Segoe UI Semibold',13,[System.Drawing.FontStyle]::Bold)),$ct,83,427); $ct.Dispose()

    Card $g 430 86 600 808 36
    Img $g (Join-Path $root $cfg.Hero) 455 112 550 680 28 0
    $g.DrawString($cfg.HeroTitle,$labelFont,$hb,460,808)
    $g.DrawString('Built from the actual Trimly screen style for social storytelling.',$smallFont,$mb,(New-Object System.Drawing.RectangleF 460,832,460,40))

    Card $g 58 532 338 262 28
    Img $g (Join-Path $root $cfg.Inset) 76 550 302 168 20 0
    $g.DrawString($cfg.InsetTitle,$labelFont,$hb,82,730)
    $g.DrawString('A supporting page gives context without crowding the slide.',$smallFont,$mb,(New-Object System.Drawing.RectangleF 82,752,285,42))

    $rb=New-Object System.Drawing.SolidBrush((C 250 246 239 240)); Fill-RR $g $rb 434 916 594 56 22; $rb.Dispose(); $g.DrawString('One focused message per slide works better than a packed launch poster.',$labelFont,$hb,458,932)
    $g.DrawString('Trimly keeps the journey understandable from first discovery to completed service.',$subFont,$mb,(New-Object System.Drawing.RectangleF 56,844,348,88))

    $hb.Dispose(); $mb.Dispose(); $brandFont.Dispose(); $headlineFont.Dispose(); $subFont.Dispose(); $chipFont.Dispose(); $labelFont.Dispose(); $smallFont.Dispose(); $g.Dispose()
    Save-Jpeg $bmp (Join-Path $root $cfg.Out)
    $bmp.Dispose()
    Write-Output (Join-Path $root $cfg.Out)
}
