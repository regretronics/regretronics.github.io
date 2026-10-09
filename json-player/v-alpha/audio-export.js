"use strict";

//const audioTimerInterval = 86400 * 0.5 ** 21; //86400 / 2097152 = ~0.0411 s

let lastAudioObjURL = null, exportType = "";
function audioDownload(data) {
	if(!data) return false;
	try {
		let file, fileName = getDateTimeCode(5);
		if(exportType.includes("codecs=opus")) fileName += ".opus";
		if(exportType.startsWith("audio/ogg"))
			fileName += ".ogg";
		else
			if(exportType.startsWith("audio/webm"))
				fileName += ".webm";
		//const properties = {type: 'audio/webm; codecs=opus'}; //constructor parameters: container's MIME-type, and encoding.
		//const properties = {type: 'audio/webm'}; //constructor parameters: container's MIME-type.
		//const properties = {};
		try {
			//specify the filename using the File constructor, but...
			//file = new File(data, fileName, properties);
			file = new File(data, fileName);
		} catch(error) {
			//...fall back to the Blob constructor if that isn't supported.
			///file = new Blob(data, properties);
			file = new Blob(data);
		}
		if(lastAudioObjURL) URL.revokeObjectURL(lastAudioObjURL);
		lastAudioObjURL = URL.createObjectURL(file);
		//console.log("audioDownload(): createObjectURL object");

		if(!globalThis.aAudioDownload) throw(new Error("Anchor element not found (page may be corrupted)."));
		aAudioDownload.setAttribute('href', lastAudioObjURL);
		aAudioDownload.setAttribute('download', fileName);
		aAudioDownload.click();

		const sizeKB = file.size / 1024, sizeMB = sizeKB / 1024;
		if(globalThis.outExportProgress) {
			outExportProgress.innerText = `Exported (${sizeKB.toFixed(2)} kiB/${sizeMB.toFixed(2)} MiB)`;
			outExportProgress.classList?.remove?.("alert-error");
		}
		exportType = "";
	} catch(error) {
		console.error(error);
		//question: direct message to outToolTip (currently yes), btnAudioExport.title or outExportProgress (currently yes)?
		setToolTip(outToolTip, "Failure in audio saving. " + (error.message ?? error ?? ""), 3);
		//if(event && event?.target?.title) event.target.title = (error.message ?? error).toString();
		//if(globalThis.btnAudioExport) btnAudioExport.title = (error.message ?? error).toString();
		if(globalThis.outExportProgress) {
			outExportProgress.innerText = (error.message ?? error).toString();
			outExportProgress.classList?.add?.("alert-error");
		}
		return false;
	}
	return true;
}
let mediaRecorder, chunks = [], exportClip = null;
function clipEndExport(suspend) {
	const clip = this ?? exportClip;
	if(!clip) {
		console.info("clipEndExport(): parameters this and exportClip are empty. Returning.");
		return false;
	}

	return clip.clipEndDefault(true)?.then?.(nil => {
	//if(clip.audioCtx)
	//	clip.audioCtx.close?.()?.then?.(nil => {
			if(globalThis.outExportProgress) {
				outExportProgress.innerText = "Rendered";
				outExportProgress.classList?.remove?.("alert-error");
			}
			if(mediaRecorder) {
				mediaRecorder.requestData();
				mediaRecorder.stop(); //to do: move this into mediaRecorder.ondataavailable? (probably not)
				mediaRecorder = null;
			}
			clip.audioCtx.close(); //to do: use this in place of suspend()?
			if(exportClip === clip) exportClip = null;
		}/* , reason => {
			globalThis.reportError(reason);
		} */);
	//return true;
}
function exportAudioTimer(clip) { //question: should this be a SoundClip method?
	if(!clip) {
		console.info("exportAudioTimer(): parameter clip is empty. Returning.");
		return false;
	}
	if(!clip.open || !clip.audioCtx) {
		console.info("exportAudioTimer(): clip is either not open or has an empty audioCtx. Cancelling timer.");
		if(clip?.timerID) {
			globalThis.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}
	const ctxTime = clip.audioCtx.currentTime;
	if(globalThis.outExportProgress) {
		//question: round (toFixed) or trunc (toFixedTrunc) for completion? (currently trunc, as with time)
		//outExportProgress.innerText = (100 * ctxTime / (clip.duration + clip.t0)).toFixed(2) + "%";
		outExportProgress.innerText = toFixedTrunc(100 * ctxTime / (clip.duration + clip.t0), 2) + "%";
		outExportProgress.classList?.remove?.("alert-error");
	}
	//if(clip.flatStruct.length < 1 && (ctxTime - clip.t0) > clip.duration) {
	if(clip.audioCtx.state !== 'suspended' && (ctxTime - clip.t0) > 0 && clip.generators.length < 1) {
		printClip(clip, "exportAudioTimer(): ");
		console.log("exportAudioTimer(): will stop exporting and cancel timer.");
		clip.onClipEnd?.(true);
		if(clip?.timerID) {
			globalThis.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return true;
	}
	if(clip.audioCtx.state === 'closed') {
		console.debug("exportAudioTimer(): member clip.audioCtx.state is closed. Cancelling timer.");
		if(clip?.timerID) {
			globalThis.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}
	//globalThis.setTimeout(exportAudioTimer, 2 * audioTimerInterval * 1000, clip);
	//globalThis.requestAnimationFrame(timestamp => exportAudioTimer(clip, timestamp));
	return true;
}
function beforeRecord() {
	//exportClip.destNode = exportClip.audioCtx.destination;
	exportClip.noiseBuffer = createNoiseBuffer(exportClip.audioCtx);
	//to do: currently, audio clips are expected to start at time 0. I could do a leading silence trimming if relevant.
	lastT = exportClip.audioCtx.currentTime;
	exportClip.t0 = lastT - exportClip.playTimeDelta;

	//based on code from https://github.com/mdn/webaudio-examples/blob/master/create-media-stream-destination/index.html
	const dest = exportClip.audioCtx.createMediaStreamDestination();
	//const dest = new MediaStreamAudioDestinationNode(exportClip.audioCtx, {channelCount: 1});
	exportClip.destNode = dest;

	//audio/ogg, audio/webm, audio/mp4, audio/3gp2, audio/mpeg
	//codecs={vorbis, opus, mp4a.40.1 (AAC main), mp4a.40.34 (MP3)}
	exportType = 'audio/webm; codecs=opus'; //fallback: this is apparently the only thing that Opera supports
	const _exportType = 'audio/ogg; codecs=opus';
	if(MediaRecorder.isTypeSupported(_exportType)) exportType = _exportType;
	mediaRecorder = new MediaRecorder(dest.stream, {mimeType: exportType});
	if(globalThis.outExportFormat) outExportFormat.innerText = exportType;
	mediaRecorder.ondataavailable = event => {
			//push each chunk (blobs) in an array
			console.debug("MediaRecorder.ondataavailable event");
			chunks.push(event.data);
		};
	mediaRecorder.onstop = event => {
			//console.debug("MediaRecorder.onstop event");
			audioDownload(chunks);
			chunks.length = 0;
		};

	enqueueNotes(exportClip, lastT, Infinity);
	//console.log("beforeRecord(): enqueueNotes done.");
	if(globalThis.outExportProgress) {
		outExportProgress.innerText = "Starting";
		outExportProgress.classList?.remove?.("alert-error");
	}
	mediaRecorder.start();
	exportClip.audioCtx.resume()?.then?.(nil => {
			exportAudioTimer(exportClip);
			exportClip.timerID = globalThis.setInterval(exportAudioTimer, audioTimerInterval * 1000, exportClip);
		}, reason => {
			setToolTip(outToolTip, "Could not resume recording. " + (reason.message ?? reason ?? ""), 3);
			//globalThis.reportError(reason);
			console.error(reason);
		});

	/*//audioCtxOff.oncomplete = ;
	exportClip.audioCtx.startRendering()?.then?.(renderedBuffer => {
			console.log('Rendering completed successfully');
			console.debug(renderedBuffer);

			//const chunks = [renderedBuffer.getChannelData(0)];
			const chunks = renderedBuffer.getChannelData(0);
			audioDownload(chunks);
			console.log("audioCtx startRendering promise then end");
		}, reason => {
			setToolTip(outToolTip, "Could not start rendering. " + (reason.message ?? reason ?? ""), 3);
			//globalThis.reportError(reason);
			console.error(reason);
			//note: the promise should reject when startRendering is called a second time on an OfflineAudioContext
		});*/
}
function audioExport(event) {
	try {
		if(exportClip && exportClip.open) return false;
		exportClip = loadNewClip();
		if(!exportClip || !exportClip.flatStruct) throw(new Error("Failed to create or initialize clip object."));
		exportClip.onClipEnd = clipEndExport;
		if(globalThis.outExportProgress) {
			outExportProgress.innerText = "Note list loaded";
			outExportProgress.classList?.remove?.("alert-error");
		}
		//question: round (toFixed) or trunc (toFixedTrunc) here?
		if(globalThis.outExportDuration) outExportDuration.innerText = exportClip.duration.toFixed(timeDisplPrecision);
		//to do: stop AudioContext playback? (probably unnecessary)
		exportClip.open = true;
		const sampleRate = 48000; //to do: will become a variable later
		//console.debug("audioExport(): creating new OfflineAudioContext.");
		console.debug("audioExport(): creating new AudioContext.");
		//exportClip.audioCtx = new OfflineAudioContext(1, sampleRate * exportClip.duration, sampleRate);
		exportClip.audioCtx = new AudioContext({latencyHint: "playback", sampleRate: sampleRate});
		exportClip.audioCtx.addEventListener("statechange", audioCtxDefStateChanged);
		exportClip.audioCtx.suspend()?.then?.(beforeRecord)
			/* ?.catch?.(reason => {
				globalThis.reportError(reason);
			}) */;
		return true;
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Audio exporting failed. " + (error.message ?? error ?? ""), 3);
		return false;
	}
}
function audioExportCancel(event) {
	if(!exportClip) return false;
	exportClip.clipEndDefault(true)?.then?.(nil => {
			if(globalThis.outExportProgress) {
				outExportProgress.innerText = "Canceled";
				outExportProgress.classList?.remove?.("alert-error");
			}
			if(mediaRecorder) {
				//question: allow partial download? (currently yes)
				//mediaRecorder.onstop = null; //no
				mediaRecorder.stop();
				mediaRecorder = null;
			}
			exportClip.audioCtx.close();
			exportClip = null;
		}/* , reason => {
			globalThis.reportError(reason);
		} */);
	return true;
}
