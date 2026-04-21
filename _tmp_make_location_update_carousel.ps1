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
function Card($g,[float]$x,[float]$y,[float]$w,[float]$h,[float]$r,[System.Drawing.Color]$fillColor){
  $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28,35,28,18))
  Fill-RR $g $shadow ($x+12) ($y+16) $w $h $r
  $shadow.Dispose()
  $fill = New-Object System.Drawing.SolidBrush($fillColor)
  $pen = New-Object System.Drawing.Pen((C 219 208 189),2)
  Fill-RR $g $fill $x $y $w $h $r
  Draw-RR $g $pen $x $y $w $h $r
  $fill.Dispose()
  $pen.Dispose()
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
function Draw-StepBlock($g,[float]$x,[float]$y,[float]$w,[string]$step,[string]$title,[string]$body,$ink,$green,$muted){
  Card $g $x $y $w 170 26 (C 250 246 239)
  $pillFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(26,46,106,79))
  Fill-RR $g $pillFill ($x+24) ($y+20) 84 32 15
  $pillFill.Dispose()

  $stepFont = New-Object System.Drawing.Font('Segoe UI Semibold',11,[System.Drawing.FontStyle]::Bold)
  $titleFont = New-Object System.Drawing.Font('Georgia',16,[System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font('Segoe UI',11,[System.Drawing.FontStyle]::Regular)
  $stepBrush = New-Object System.Drawing.SolidBrush($green)
  $titleBrush = New-Object System.Drawing.SolidBrush($ink)
  $bodyBrush = New-Object System.Drawing.SolidBrush($muted)

  $g.DrawString($step,$stepFont,$stepBrush,($x+40),($y+28))
  $g.DrawString($title,$titleFont,$titleBrush,(New-Object System.Drawing.RectangleF(($x+24),($y+64),($w-48),36)))
  $g.DrawString($body,$bodyFont,$bodyBrush,(New-Object System.Drawing.RectangleF(($x+24),($y+102),($w-48),48)))

  $stepFont.Dispose()
  $titleFont.Dispose()
  $bodyFont.Dispose()
  $stepBrush.Dispose()
  $titleBrush.Dispose()
  $bodyBrush.Dispose()
}
function Draw-BulletPanel($g,[float]$x,[float]$y,[float]$w,[float]$h,[string]$title,[string[]]$items,$ink,$green,$muted){
  Card $g $x $y $w $h 28 (C 250 246 239)
  $titleFont = New-Object System.Drawing.Font('Georgia',20,[System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font('Segoe UI',13,[System.Drawing.FontStyle]::Regular)
  $titleBrush = New-Object System.Drawing.SolidBrush($ink)
  $bodyBrush = New-Object System.Drawing.SolidBrush($muted)
  $dotBrush = New-Object System.Drawing.SolidBrush($green)

  $g.DrawString($title,$titleFont,$titleBrush,(New-Object System.Drawing.RectangleF(($x+28),($y+28),($w-56),34)))
  $currentY = $y + 86
  foreach($item in $items){
    $g.FillEllipse($dotBrush,($x+30),$currentY+7,12,12)
    $g.DrawString($item,$bodyFont,$bodyBrush,(New-Object System.Drawing.RectangleF(($x+54),$currentY,($w-82),42)))
    $currentY += 52
  }

  $titleFont.Dispose()
  $bodyFont.Dispose()
  $titleBrush.Dispose()
  $bodyBrush.Dispose()
  $dotBrush.Dispose()
}

$ink = C 31 54 45
$green = C 46 106 79
$muted = C 107 98 87
$cream = C 248 243 233
$sage = C 243 237 226

$slides = @(
  @{
    Out='trimly-social-29-location-update-cover-v1.jpg'
    Title='A new Trimly location update is live.'
    Subtitle='Customers and barbers can now save better address details so bookings and arrivals feel smoother.'
    Kind='cover'
  },
  @{
    Out='trimly-social-30-location-update-customer-steps-v1.jpg'
    Title='How customers update their saved address.'
    Subtitle='Use your Settings page once, then Trimly can reuse the details for home-service bookings.'
    Kind='customer-steps'
  },
  @{
    Out='trimly-social-31-location-update-barber-steps-v1.jpg'
    Title='How barbers update shop or studio location.'
    Subtitle='Customers can find your shop details more easily when your address is filled properly.'
    Kind='barber-steps'
  },
  @{
    Out='trimly-social-32-location-update-how-it-helps-v1.jpg'
    Title='What this location update improves.'
    Subtitle='The goal is easier arrivals, clearer directions, and less confusion around where a service should happen.'
    Kind='benefits'
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
  $headlineBrush = New-Object System.Drawing.SolidBrush($ink)
  $subBrush = New-Object System.Drawing.SolidBrush($muted)

  Brand $g $ink $green $brandFont
  Draw-Badge $g 56 116 'Location update' ([System.Drawing.Color]::FromArgb(26,46,106,79)) $green
  $g.DrawString($slide.Title,$headlineFont,$headlineBrush,(New-Object System.Drawing.RectangleF 56,170,880,120))
  $g.DrawString($slide.Subtitle,$subFont,$subBrush,(New-Object System.Drawing.RectangleF 58,300,880,78))

  if($slide.Kind -eq 'cover'){
    Draw-StepBlock $g 56 430 460 'STEP 1' 'Go to Settings.' 'Open your Trimly settings page to update your saved address details.' $ink $green $muted
    Draw-StepBlock $g 564 430 460 'STEP 2' 'Add your address info.' 'Use address line, area, landmark, and any useful note for directions.' $ink $green $muted
    Draw-StepBlock $g 56 640 460 'STEP 3' 'Save it once.' 'Trimly can reuse the details during home-service bookings.' $ink $green $muted
    Draw-StepBlock $g 564 640 460 'STEP 4' 'Book with more clarity.' 'That gives customers and barbers a clearer location flow.' $ink $green $muted

    Draw-BulletPanel $g 56 890 968 240 'Why this matters' @(
      'Customers can reuse their saved address instead of typing from scratch every time.'
      'Barbers can keep shop or studio details easier to find.'
      'Home-service conversations become smoother when location context is clearer.'
    ) $ink $green $muted
  }
  elseif($slide.Kind -eq 'customer-steps'){
    Draw-StepBlock $g 56 430 968 'STEP 1' 'Open Settings on your Trimly account.' 'Once you are logged in, go to Settings so you can manage your saved booking address.' $ink $green $muted
    Draw-StepBlock $g 56 630 968 'STEP 2' 'Fill in address line, area, landmark, and note.' 'Use details that would actually help a barber arrive quickly for home service.' $ink $green $muted
    Draw-StepBlock $g 56 830 968 'STEP 3' 'Save your profile changes.' 'Trimly can use that saved address later when you book a home-service appointment.' $ink $green $muted
    Draw-BulletPanel $g 56 1040 968 170 'Customer tip' @(
      'Use the landmark field for gate details, estate names, or something easy to spot nearby.'
    ) $ink $green $muted
  }
  elseif($slide.Kind -eq 'barber-steps'){
    Draw-StepBlock $g 56 430 968 'STEP 1' 'Open Settings and go to your barber details.' 'This is where you manage your public business information.' $ink $green $muted
    Draw-StepBlock $g 56 630 968 'STEP 2' 'Add your shop or studio address.' 'Use the address and landmark fields so customers can understand where your shop is located.' $ink $green $muted
    Draw-StepBlock $g 56 830 968 'STEP 3' 'Save it so customers can use it during booking.' 'This helps shop-visit bookings feel clearer and easier to navigate.' $ink $green $muted
    Draw-BulletPanel $g 56 1040 968 170 'Barber tip' @(
      'Use a simple landmark like an estate gate, bus stop, plaza name, or street-facing sign.'
    ) $ink $green $muted
  }
  else {
    Draw-BulletPanel $g 56 430 968 260 'What gets better now' @(
      'Saved addresses make home-service booking faster for customers.'
      'Shop or studio details become easier for customers to trust and follow.'
      'Barbers get better context for arrival without unnecessary back-and-forth.'
      'Location details feel more built into the product flow.'
    ) $ink $green $muted

    Draw-BulletPanel $g 56 740 460 310 'For customers' @(
      'Go to Settings once.'
      'Save your real booking address.'
      'Use clearer notes for home service.'
      'Book faster next time.'
    ) $ink $green $muted

    Draw-BulletPanel $g 564 740 460 310 'For barbers' @(
      'Keep shop address updated.'
      'Add a useful landmark.'
      'Make arrivals easier.'
      'Reduce location confusion.'
    ) $ink $green $muted
  }

  $brandFont.Dispose()
  $headlineFont.Dispose()
  $subFont.Dispose()
  $headlineBrush.Dispose()
  $subBrush.Dispose()
  $g.Dispose()

  Save-Jpeg $bmp (Join-Path $root $slide.Out)
  $bmp.Dispose()
  Write-Output (Join-Path $root $slide.Out)
}
