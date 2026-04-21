Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\i\Desktop\trimly_backend\social_exports'

function C([int]$r,[int]$g,[int]$b,[int]$a=255){ [System.Drawing.Color]::FromArgb($a,$r,$g,$b) }
function Add-RR([System.Drawing.Drawing2D.GraphicsPath]$p,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $d = $r * 2
  $p.AddArc($x,$y,$d,$d,180,90)
  $p.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $p.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $p.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $p.CloseFigure()
}
function Fill-RR($g,$brush,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RR $p $x $y $w $h $r
  $g.FillPath($brush,$p)
  $p.Dispose()
}
function Draw-RR($g,$pen,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RR $p $x $y $w $h $r
  $g.DrawPath($pen,$p)
  $p.Dispose()
}
function Card($g,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28,35,28,18))
  Fill-RR $g $shadow ($x+12) ($y+16) $w $h $r
  $shadow.Dispose()
  $fill = New-Object System.Drawing.SolidBrush (C 250 246 239)
  $pen = New-Object System.Drawing.Pen((C 219 208 189),2)
  Fill-RR $g $fill $x $y $w $h $r
  Draw-RR $g $pen $x $y $w $h $r
  $fill.Dispose()
  $pen.Dispose()
}
function ImgContain($g,[string]$path,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r){
  $img = [System.Drawing.Image]::FromFile($path)
  try {
    $scale = [Math]::Min($w / $img.Width, $h / $img.Height)
    $dw = [float]($img.Width * $scale)
    $dh = [float]($img.Height * $scale)
    $dx = [float]($x + (($w - $dw) / 2))
    $dy = [float]($y + (($h - $dh) / 2))
    $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
    Add-RR $clip $x $y $w $h $r
    $old = $g.Clip
    $g.SetClip($clip)
    $dest = New-Object System.Drawing.RectangleF($dx,$dy,$dw,$dh)
    $g.DrawImage($img,$dest)
    $g.Clip = $old
    $clip.Dispose()
  } finally {
    $img.Dispose()
  }
}
function Brand($g,$ink,$green,$brandFont){
  $badge = New-Object System.Drawing.SolidBrush($green)
  Fill-RR $g $badge 56 50 40 40 12
  $badge.Dispose()

  $light = New-Object System.Drawing.SolidBrush((C 245 241 232))
  $tFont = New-Object System.Drawing.Font('Segoe UI Semibold',18,[System.Drawing.FontStyle]::Bold)
  $g.DrawString('T',$tFont,$light,68,57)
  $light.Dispose()
  $tFont.Dispose()

  $name = New-Object System.Drawing.SolidBrush($ink)
  $g.DrawString('Trimly',$brandFont,$name,108,51)
  $name.Dispose()
}
function Save-Jpeg($bmp,[string]$path){
  $jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,92L)
  $bmp.Save($path,$jpeg,$ep)
}
function Draw-Badge($g,[float]$x,[float]$y,[string]$text,$bgColor,$textColor){
  $font = New-Object System.Drawing.Font('Segoe UI Semibold',13,[System.Drawing.FontStyle]::Bold)
  $size = $g.MeasureString($text,$font)
  $w = [Math]::Ceiling($size.Width + 32)
  $h = 38
  $fill = New-Object System.Drawing.SolidBrush($bgColor)
  Fill-RR $g $fill $x $y $w $h 18
  $fill.Dispose()
  $textBrush = New-Object System.Drawing.SolidBrush($textColor)
  $g.DrawString($text,$font,$textBrush,($x+16),($y+8))
  $textBrush.Dispose()
  $font.Dispose()
}
function Draw-StepCard($g,[float]$x,[float]$y,[float]$w,[float]$h,[string]$step,[string]$title,[string]$body,$ink,$green,$muted){
  Card $g $x $y $w $h 28

  $numFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26,46,106,79))
  Fill-RR $g $numFill ($x+26) ($y+22) 70 34 16
  $numFill.Dispose()

  $stepFont = New-Object System.Drawing.Font('Segoe UI Semibold',12,[System.Drawing.FontStyle]::Bold)
  $titleFont = New-Object System.Drawing.Font('Georgia',16,[System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font('Segoe UI',11,[System.Drawing.FontStyle]::Regular)
  $stepBrush = New-Object System.Drawing.SolidBrush($green)
  $inkBrush = New-Object System.Drawing.SolidBrush($ink)
  $mutedBrush = New-Object System.Drawing.SolidBrush($muted)

  $g.DrawString($step,$stepFont,$stepBrush,($x+42),($y+30))
  $g.DrawString($title,$titleFont,$inkBrush,(New-Object System.Drawing.RectangleF(($x+26),($y+74),($w-52),50)))
  $g.DrawString($body,$bodyFont,$mutedBrush,(New-Object System.Drawing.RectangleF(($x+26),($y+128),($w-52),54)))

  $stepFont.Dispose()
  $titleFont.Dispose()
  $bodyFont.Dispose()
  $stepBrush.Dispose()
  $inkBrush.Dispose()
  $mutedBrush.Dispose()
}

$ink = C 31 54 45
$green = C 46 106 79
$muted = C 107 98 87
$accent = C 201 169 107
$cream = C 248 243 233
$sage = C 243 237 226

$slides = @(
  @{
    Out='trimly-social-23-update-carousel-cover-v1.jpg'
    Kind='cover'
    Title='A clearer Trimly booking update is live.'
    Subtitle='Booking, payment, and home-service logistics now feel easier to follow for both customers and barbers.'
    Footer='Built to reduce confusion, missed payments, and extra back-and-forth.'
  },
  @{
    Out='trimly-social-24-update-carousel-steps-v1.jpg'
    Kind='steps'
    Title='How the updated booking flow works.'
    Subtitle='The path is now easier to follow from request to paid, confirmed appointment.'
    Footer='Only paid bookings should feel fully locked in.'
  },
  @{
    Out='trimly-social-25-update-carousel-customer-v1.jpg'
    Kind='feature'
    Title='Customer screens are now more booking-first.'
    Subtitle='The next action is easier to spot, so customers can see what needs payment and what is already confirmed.'
    Footer='The goal is less hesitation and fewer missed steps.'
    Source='trimly-social-06-customer-dashboard-ngn-v2.jpg'
    Mode='portrait'
  },
  @{
    Out='trimly-social-26-update-carousel-payment-v1.jpg'
    Kind='feature'
    Title='Pay now is clearer when the slot is ready.'
    Subtitle='Payment becomes the main focus at the right moment, so the booking never looks complete too early.'
    Footer='That makes the slot feel properly secured.'
    Source='trimly-booking-payment-preview-v2-approved.jpg'
    Mode='landscape'
  },
  @{
    Out='trimly-social-27-update-carousel-barber-v1.jpg'
    Kind='feature'
    Title='Barbers get better schedule clarity.'
    Subtitle='The day is easier to read when bookings waiting for payment do not feel the same as confirmed appointments.'
    Footer='Clearer queues make the workday more reliable.'
    Source='trimly-social-07-barber-dashboard-ngn-v2.jpg'
    Mode='portrait'
  },
  @{
    Out='trimly-social-28-update-carousel-directions-v1.jpg'
    Kind='feature'
    Title='Home-service directions are easier to handle.'
    Subtitle='Customers can share clearer location context, and arrival details feel more built into the flow.'
    Footer='Useful logistics should feel part of the product, not an extra chore.'
    Source='trimly-social-10-chat-ngn-v2.jpg'
    Mode='portrait'
  }
)

foreach($slide in $slides){
  $bmp = New-Object System.Drawing.Bitmap 1080,1350
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.TextRenderingHint = 'ClearTypeGridFit'

  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Rectangle 0,0,1080,1350),$cream,$sage,90)
  $g.FillRectangle($bg,0,0,1080,1350)
  $bg.Dispose()

  $wash1 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(32,201,169,107))
  $wash2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18,46,106,79))
  $g.FillEllipse($wash1,760,-80,380,380)
  $g.FillEllipse($wash2,-110,1070,300,300)
  $g.FillEllipse($wash1,860,1100,190,190)
  $wash1.Dispose()
  $wash2.Dispose()

  $brandFont = New-Object System.Drawing.Font('Segoe UI Semibold',20,[System.Drawing.FontStyle]::Bold)
  $headlineFont = New-Object System.Drawing.Font('Georgia',30,[System.Drawing.FontStyle]::Bold)
  $subFont = New-Object System.Drawing.Font('Segoe UI',15,[System.Drawing.FontStyle]::Regular)
  $footerFont = New-Object System.Drawing.Font('Segoe UI',12,[System.Drawing.FontStyle]::Regular)
  $headlineBrush = New-Object System.Drawing.SolidBrush($ink)
  $subBrush = New-Object System.Drawing.SolidBrush($muted)

  Brand $g $ink $green $brandFont
  Draw-Badge $g 56 116 'New customer update' ([System.Drawing.Color]::FromArgb(26,46,106,79)) $green
  $g.DrawString($slide.Title,$headlineFont,$headlineBrush,(New-Object System.Drawing.RectangleF 56,170,860,120))
  $g.DrawString($slide.Subtitle,$subFont,$subBrush,(New-Object System.Drawing.RectangleF 58,300,860,78))

  if($slide.Kind -eq 'cover'){
    Card $g 56 430 968 550 34

    Draw-Badge $g 92 474 'Clearer payment prompts' ([System.Drawing.Color]::FromArgb(24,201,169,107)) $green
    Draw-Badge $g 338 474 'Better schedule visibility' ([System.Drawing.Color]::FromArgb(20,46,106,79)) $ink
    Draw-Badge $g 636 474 'Smarter location flow' ([System.Drawing.Color]::FromArgb(24,201,169,107)) $green

    $bigFont = New-Object System.Drawing.Font('Georgia',28,[System.Drawing.FontStyle]::Bold)
    $copyFont = New-Object System.Drawing.Font('Segoe UI',15,[System.Drawing.FontStyle]::Regular)
    $bigBrush = New-Object System.Drawing.SolidBrush($ink)
    $copyBrush = New-Object System.Drawing.SolidBrush($muted)
    $g.DrawString('Trimly now makes the next booking action easier to understand.',$bigFont,$bigBrush,(New-Object System.Drawing.RectangleF 92,560,860,92))
    $g.DrawString("Customers can follow the flow more confidently, and barbers can separate confirmed bookings from bookings that still need payment.",$copyFont,$copyBrush,(New-Object System.Drawing.RectangleF 92,670,860,96))
    $g.DrawString($slide.Footer,$footerFont,$copyBrush,(New-Object System.Drawing.RectangleF 92,900,860,38))
    $bigFont.Dispose()
    $copyFont.Dispose()
    $bigBrush.Dispose()
    $copyBrush.Dispose()
  }
  elseif($slide.Kind -eq 'steps'){
    Draw-StepCard $g 56 410 460 210 'STEP 1' 'Request your preferred slot.' 'Choose the service, date, and time that works best for you.' $ink $green $muted
    Draw-StepCard $g 564 410 460 210 'STEP 2' 'Pay when the slot is ready.' 'Trimly pushes payment forward clearly when the booking is ready.' $ink $green $muted
    Draw-StepCard $g 56 660 460 210 'STEP 3' 'See when the booking is secured.' 'Paid bookings feel properly locked in, so the status is easier to trust.' $ink $green $muted
    Draw-StepCard $g 564 660 460 210 'STEP 4' 'Share clearer directions.' 'Use chat and saved address details to reduce arrival confusion.' $ink $green $muted

    $noteFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(20,201,169,107))
    Fill-RR $g $noteFill 56 930 968 180 28
    $noteFill.Dispose()
    $noteHeadlineFont = New-Object System.Drawing.Font('Georgia',22,[System.Drawing.FontStyle]::Bold)
    $noteBodyFont = New-Object System.Drawing.Font('Segoe UI',15,[System.Drawing.FontStyle]::Regular)
    $noteHeadlineBrush = New-Object System.Drawing.SolidBrush($ink)
    $noteBodyBrush = New-Object System.Drawing.SolidBrush($muted)
    $g.DrawString('The big idea: a booking should not feel complete before payment.',$noteHeadlineFont,$noteHeadlineBrush,(New-Object System.Drawing.RectangleF 86,972,860,46))
    $g.DrawString($slide.Footer,$noteBodyFont,$noteBodyBrush,(New-Object System.Drawing.RectangleF 86,1032,860,46))
    $noteHeadlineFont.Dispose()
    $noteBodyFont.Dispose()
    $noteHeadlineBrush.Dispose()
    $noteBodyBrush.Dispose()
  }
  else {
    if($slide.Mode -eq 'portrait'){
      Card $g 150 410 780 820 34
      ImgContain $g (Join-Path $root $slide.Source) 182 442 716 756 26
      $g.DrawString($slide.Footer,$footerFont,$subBrush,(New-Object System.Drawing.RectangleF 154,1240,760,42))
    } else {
      Card $g 44 410 992 720 34
      ImgContain $g (Join-Path $root $slide.Source) 70 438 940 664 26
      $g.DrawString($slide.Footer,$footerFont,$subBrush,(New-Object System.Drawing.RectangleF 70,1148,920,42))
    }
  }

  $brandFont.Dispose()
  $headlineFont.Dispose()
  $subFont.Dispose()
  $footerFont.Dispose()
  $headlineBrush.Dispose()
  $subBrush.Dispose()
  $g.Dispose()

  Save-Jpeg $bmp (Join-Path $root $slide.Out)
  $bmp.Dispose()
  Write-Output (Join-Path $root $slide.Out)
}
