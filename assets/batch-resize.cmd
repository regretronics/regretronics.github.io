cls

@rem for downsampling, sigmoidal mapping raises the very kind of aliasing I'm trying to avoid. great idea in theory, but for downscaling it's worse than useless.
@set map=
@set unmap=
@set mappart=

@rem set contrast=4
@rem set map=+sigmoidal-contrast %contrast%,50%%
@rem set unmap=-sigmoidal-contrast %contrast%,50%%
@rem set mappart=-sigm%contrast%

set filename=images-wmcommons-poty\original\*
@rem set filename=images-wmcommons-poty\original\Covid*

@set outprefix=images-wmcommons-poty\resize-magick-png-u8bpc%mappart%-
rem del /s /q /a %outprefix%*
@rem set sizes=4096
@set sizes="4096 1024 256 64"
for %%b in (1.00) do @(
	start /low magick-resampler rect gaussian %%b gaussian 0 %filename% %sizes% 8
)
for %%b in (2.00) do @(
	rem start "" /low magick-resampler ewa lobed %%b lanczos 6 %filename% %sizes% 8
	start /low magick-resampler ewa lobed %%b lanczos 4 %filename% %sizes% 8
)
@set outprefix=images-wmcommons-poty\resize-magick-png-u16bpc%mappart%-
for %%b in (1.00) do @(
	start /low magick-resampler rect gaussian %%b gaussian 0 %filename% %sizes% 16
)
for %%b in (2.00) do @(
	rem start "" /low magick-resampler ewa lobed %%b lanczos 6 %filename% %sizes% 16
	start /low magick-resampler ewa lobed %%b lanczos 4 %filename% %sizes% 16
)
@exit /b
