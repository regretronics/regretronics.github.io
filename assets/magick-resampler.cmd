chcp 65001
@rem resize experiment
@rem %1: resampling filter strategy (ewa or rect)
@rem %2: resampling filter type (gaussian or lobed)
@rem %3: blur parameter
@rem %4: filter name (ignored for gaussian)
@rem %5: number of lobes (ignored for gaussian)
@rem %6: source file name(s)
@rem %7: target size(s)
@rem %8: target color depth (bits per channel)

@rem set vp=-virtual-pixel gray
@rem set vp=-virtual-pixel edge
set vp=-virtual-pixel mirror

@rem set map=
@rem set unmap=
@rem set outprefix=!magick-resize-

@set filterstrategy=%~1
call :set-filterstrategy-%~1
@set filtertype=%~2
call :set-filtertype-%~2 %3 %4 %5
set outsuffix=.png

@for %%n in (%~6) do (
	set outfilename=%%~nxn
	for %%s in (%~7) do @(
		md %outprefix%%%spx 2>nul
		set outmidpart=%%spx\%filterprofile%\
		call :invoke-converter %3 %4 %5 "%%n" %%s %8
	)
	@title done %~n0 %~1 %~2 %~3 %~4 %~5 %%~nxn
)
@exit /b

@rem %1: blur parameter
@rem %2: filter name (ignored for gaussian)
@rem %3: number of lobes (ignored for gaussian)
@rem %4: source file name(s)
@rem %5: target size(s)
@rem %6: target color depth (bits per channel)
:set-filterstrategy-ewa
	@set operationpart=-distort Resize
	@exit /b
:set-filterstrategy-rect
	@set operationpart=-resize
	@exit /b

:set-filtertype-gaussian
	@set filterpart=-filter gaussian
	@set filterprofile=blur%~1-%filterstrategy%-%filtertype%
	@exit /b
:set-filtertype-lobed
	@set filterpart=-define filter:lobes=%3 -filter %2
	@set filterprofile=blur%~1-%filterstrategy%-%~2%~3
	@exit /b

:invoke-converter
	if exist "%outprefix%%outmidpart%%outfilename%%outsuffix%" exit /b
	md "%outprefix%%outmidpart%" 2>nul
	magick -verbose "%~4[0]" -define quantum:format=floating-point -depth 32^
	 %map% %vp% -define filter:blur=%1 %filterpart% %operationpart% %~5x%~5 %unmap%^
	 -define quantum:format=unsigned -depth %6^
	 "%outprefix%%outmidpart%%outfilename%%outsuffix%"
	@exit /b
