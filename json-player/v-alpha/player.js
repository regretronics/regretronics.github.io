"use strict";

//imported variables
var releaseCurve;
//var playFreqScale, playVolScale/* , playTimeScale, playTimeDelta */;

//to do: iterative self-filtering for subtractive synthesis?
//done: consider changing setTimeout to setInterval or requestAnimationFrame. setTimeout produces seriously deep call stacks (at least in Ffx), and might be consuming resources.
//to do: (done?) log when .audioCtx state changes (by event), to be sure that it's not kept running.
//to do: review audioTimer(), clipEndPlayer(), clipEndExport().
//to do: allow a common audible AudioContext for both clip and interval playback
//to do: have a variable for the interval clip (?) (distinct from playerClip)

var playerClip = null; //shared variable
//const pauseToggleCaptions = {false: "Un<u>p</u>ause", true: "<u>P</u>ause"};
const pauseToggleCaptions = {
	false: '<span class="lang-static" translate="no">Un<u>p</u>ause</span><span class="lang-flex" hidden="hidden">Unpause (<u>p</u>)</span>', 
	true: '<span class="lang-static" translate="no"><u>P</u>ause</span><span class="lang-flex" hidden="hidden">Pause (<u>p</u>)</span>'};

//constructor
function SoundClip(flatStruct, duration, playTimeScale, playTimeDelta, playVolScale, playFreqScale) {
	Object.assign(this, {
			audioCtx: null, noiseBuffer: null, destNode: null, //variables for Web Audio
			open: false, t0: 0, duration: 0, timerID: NaN, //miscellaneous clip properties
			onClipEnd: clipEndDefault, //events for custom behavior
			generators: [], auxNodes: [], flatStruct: null, //node and note lists
			playTimeScale: prefsDefault.clipParams.timeScale, playTimeDelta: prefsDefault.clipParams.timeDelta, playVolScale: prefsDefault.clipParams.volScale, playFreqScale: prefsDefault.clipParams.freqScale, //overall controls
			lastFreq: 0, lastFreq0: 0, lastNoteStart: 0, lastPortamento: 0, //portamento variables
			clipEndDefault //methods
		});
	//to do: maybe use switch() here?
	if(arguments.length < 1) return;  //breaks silently; no need to log this or to provide a return value
	this.flatStruct = flatStruct;
	if(arguments.length < 2) return;
	this.duration = duration;
	if(arguments.length < 3) return;
	this.playTimeScale = playTimeScale;
	if(arguments.length < 4) return;
	this.playTimeDelta = playTimeDelta;
	if(arguments.length < 5) return;
	this.playVolScale = playVolScale;
	if(arguments.length < 6) return;
	this.playFreqScale = playFreqScale;
}

const noiseBufferTime = 86400 / 4096; //seconds
function createNoiseBuffer(audioCtx) {
	if(!audioCtx) return false;
	const sampleCount = noiseBufferTime * audioCtx.sampleRate;
	const buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
	const arr = buffer.getChannelData(0);

	for(let i = 0; i < sampleCount; i++) {
		//noise
		//arr[i] = 2 * Math.random() - 1; //non-gaussian
		//gaussian noise
		arr[i] = 0.5 * (Math.random() - Math.random() + Math.random() - Math.random());
		//arr[i] = 1 * (Math.random() - Math.random() + Math.random() - Math.random()); //can result in overdrive/clipping, but in practice seems ok

		//test: sine wave that fades in and then out
		//arr[i] = (1 - Math.abs((i - 0.5 * sampleCount) / (0.5 * sampleCount))) * Math.sin(2 * Math.PI * 440 * i / audioCtx.sampleRate);
	}

	return buffer;
}

//finds item in arr and remove from it.
//currently an in-place operation (instead of pure function), with optional return.
function removeFrom(arr, item) {
	if(!item || !arr) return false; //breaks silently; no need to log this
	const i = arr.indexOf(item);
	if(i >= 0) arr.splice(i, 1);
	return arr;
}

function printClip(clip, prefix) { //question: should this be a SoundClip method?
	prefix = (prefix ? prefix.toString() : "");
	if(!clip) {
		//console.debug(prefix + `clip: ${clip}`);
		console.info("printClip(): parameter clip is empty. Returning.");
		return false;
	}
	/* if(clip == playerClip) {
		console.debug(prefix + "clip == playerClip");
		return true;
	} */
	if(clip == exportClip) {
		console.debug(prefix + "clip == exportClip");
		//return true;
	}
	//console.log(clip);
	return true;
}
//nonreversible operation, frees resources
function clipEndDefault(suspend) { //question: should this be a SoundClip method? (currently yes.)
	const clip = this;
	if(!clip || !clip.open) {
		console.info("clipEndDefault(): parameter clip is either empty or not open. Returning.");
		return false;
	}
	//console.log("clipEndDefault(): function started...");
	printClip(clip, "clipEndDefault(): ");

	for(const node of clip.generators) {
		try {
			node.stop();
		} catch(error) {
			console.info(error);
		}
		node.disconnect?.();
	}
	clip.generators.length = 0;

	for(const node of clip.auxNodes) node.disconnect?.();
	clip.auxNodes.length = 0;

	clip.duration = 0;
	clip.open = false;

	if(clip.flatStruct) { //empty and release
		clip.flatStruct.length = 0;
		clip.flatStruct = null;
	}

	/*try {
		if(clip.audioCtx) clip.audioCtx.close();
	} catch(error) {
		console.warn(error);
	}
	clip.audioCtx = null;*/
	if(suspend && clip.audioCtx) {
		console.log("clipEndDefault(): will suspend audioCtx.");
		return clip.audioCtx.suspend(); //keep audioCtx, to avoid recreating noiseBuffer for future audio contexts.
	} else
		return true;
}
function clipEndPlayer(suspend) {
	const clip = this ?? playerClip;
	printClip(clip, "clipEndPlayer(): ");
	if(!clip) {
		//console.info("clipEndPlayer(): clip is empty. Returning.");
		return false;
	}

	if(clip === playerClip) {
		if(clip.open) updateAudioT();
		if(window.btnPause) btnPause.innerHTML = pauseToggleCaptions[true];
	}
	return clip.clipEndDefault(suspend)/* ?.catch?.(reason => {
			window.reportError(reason);
		}) */;
}
//event handler for generator audio nodes
function defNodeEnded(event) {
	if(!this) {
		console.info("defNodeEnded(): parameter this is empty. Returning.");
		return false;
	}

	this.fltBandPass?.disconnect?.();
	this.modGainDecay?.disconnect?.();
	this.modGainAttack?.disconnect?.();
	this.modGainRelease?.disconnect?.();
	this.modGainVibrato?.disconnect?.();
	this.oscVibrato?.stop?.();
	this.disconnect?.();

	const clip = this.sndClip;
	if(!clip) {
		console.info("defNodeEnded(): member this.sndClip is empty. Returning.");
		return false;
	}

	//remove modules from list.
	removeFrom(clip.generators, this);
	const auxNodes = clip.auxNodes;
	removeFrom(auxNodes, this?.fltBandPass);
	removeFrom(auxNodes, this?.modGainDecay);
	removeFrom(auxNodes, this?.modGainAttack);
	removeFrom(auxNodes, this?.modGainRelease);
	removeFrom(auxNodes, this?.modGainVibrato);

	if(!clip.audioCtx) {
		printClip(clip, "defNodeEnded(): ");
		console.info("defNodeEnded(): member clip.audioCtx is empty. Returning.");
		if(clip.open)
			clip.onClipEnd?.(false);
		if(playerClip === clip && window.chkAutoReload?.checked)
			loadAndPlay();
		return true;
	}

	const ctxTime = clip.audioCtx.currentTime;
	//console.debug("Note release: " + ctxTime);
	if((!clip.generators || clip.generators.length < 1)
		&& (ctxTime - clip.t0) >= clip.duration
		&& (!clip.flatStruct || clip.flatStruct.length < 1)) {
		printClip(clip, "defNodeEnded(): ");
		//console.debug(`defNodeEnded(): clip.audioCtx.currentTime: ${ctxTime}; clip.flatStruct: ${clip.flatStruct}.`);
		//console.debug(`defNodeEnded(): clip.duration: ${clip.duration}; clip.t0: ${clip.t0}.`);
		if(clip.generators || clip.auxNodes || clip.flatStruct) {
			//console.log("defNodeEnded(): will end clip.");
			clip.onClipEnd?.(false);
		}
		if(clip === playerClip && clip.audioCtx.state === 'running') {
			console.log("defNodeEnded(): will suspend audioCtx.");
			clip.audioCtx.suspend()?.then?.(nil => { //suspend, resume, close yield promise's, but their values are just undefined.
					//question: remove the extra playerClip === clip check? (here and elsewhere)
					if(playerClip === clip && window.chkAutoReload?.checked)
						loadAndPlay();
				}/* , reason => {
					window.reportError(reason);
				} */); //keep audioCtx to avoid recreating noiseBuffer for different contexts.
		}
	}
	return true;
}

function newToneNode(clip, noteFreq, minStart, portamento, freq0) { //question: should this be a SoundClip method?
	//note: negative frequency causes phase inversion (at least in Ffx 100)
	const sourceNode = new OscillatorNode(clip.audioCtx, {type: "sine", frequency: noteFreq});
	try {
		if(portamento <= 0) return; //breaks silently; no need to log this or to provide a return value
		//portamento (using detune for an exponential frequency variation)
		//fixed start frequency?
		//question: should an explicit freq0 of 0 also disable portamento? (currently yes)
		if(isNaN(freq0)) {
			if(!clip.lastFreq) return;

			freq0 = clip.lastFreq;
			if(clip.lastFreq0 && clip.lastPortamento > 0) {
				//portamento of previous note may have been incomplete
				const lastNoteT = (clip.audioCtx.currentTime - clip.lastNoteStart) / (Math.abs(clip.playTimeScale) * clip.lastPortamento);
				freq0 *= (clip.lastFreq0 / clip.lastFreq) ** (0.5 ** lastNoteT);
			}
		}
		if(!freq0) return;

		sourceNode.detune.value = 1200 * Math.log2(freq0 / noteFreq); //measured in cents
		sourceNode.detune.setTargetAtTime(0, minStart, Math.abs(clip.playTimeScale) * portamento * Math.LOG2E);
	} catch(error) {
		console.warn(error);
	} finally {
		clip.lastFreq = noteFreq; //set last note portamento parameters
		clip.lastNoteStart = minStart;
		clip.lastFreq0 = freq0;
		clip.lastPortamento = portamento;
		return sourceNode;
	}
}
//question: which one to prefer? noteStop (current choice) or duration?
function renderNote(clip, note) { //question: should this be a SoundClip method?
	//to do: maybe Object.assign() or structuredClone() from defaultNoteNode and note into a new note object
	const noteFreq = clip.playFreqScale * note.freq;
	let noteStart = clip.playTimeScale * note.noteStart;
	let noteStop = clip.playTimeScale * note.noteStop;
	const duration = noteStop - noteStart;
	if(duration < 0) { //question: ignore negative-length notes? (currently no)
		const temp = noteStart;
		noteStart = noteStop;
		noteStop = temp;
	}
	let noteTimbre = note.timbre;
	if(!noteTimbre) noteTimbre = defaultNoteNode.timbre;
	const isNoise = noteTimbre.toLowerCase() === "noise";
	const ctxTime = clip.audioCtx.currentTime, minStart = Math.max(clip.t0 + noteStart, ctxTime);

	let sourceNode, oscVibrato = null;
	if(isNoise)
		sourceNode = new AudioBufferSourceNode(clip.audioCtx, {buffer: clip.noiseBuffer, loop: true});
	else
		sourceNode = newToneNode(clip, noteFreq, minStart, NaNToDefault(note.portamento, defaultNoteNode.portamento), note.freq0);
	sourceNode.sndClip = clip;
	sourceNode.onended = defNodeEnded;
	clip.generators.push(sourceNode);
	let terminalNode = sourceNode;

	try {
		if(isNoise) {
			const qFactor = NaNToDefault(note.q, defaultNoteNode.q);
			if(qFactor) {
				//to do: !exponentially increasing Q? (how? apparently it will require a script-based audio node for the reverse of an exponential decay.)
				const fltBandPass = new BiquadFilterNode(clip.audioCtx, {
						type: "bandpass",
						frequency: Math.abs(noteFreq),
						Q: qFactor
					});
				terminalNode.connect(fltBandPass);
				terminalNode = fltBandPass;
				sourceNode.fltBandPass = fltBandPass;
				clip.auxNodes.push(fltBandPass);
			}
		} else {
			//vibrato (using detune for an exponential frequency variation)
			const vibratoDepth = NaNToDefault(note.vibratoDepth, defaultNoteNode.vibratoDepth);
			const vibratoFreq = NaNToDefault(note.vibratoFreq, defaultNoteNode.vibratoFreq);
			if(vibratoFreq && vibratoDepth) {
				oscVibrato = new OscillatorNode(clip.audioCtx, {type: "sine", frequency: Math.abs(clip.playTimeScale) * vibratoFreq});
				sourceNode.oscVibrato = oscVibrato;
				oscVibrato.sndClip = clip;
				oscVibrato.onended = defNodeEnded;
				clip.generators.push(oscVibrato);

				const gainVibrato = new GainNode(clip.audioCtx, {gain: 0});
				const vibratoAttack = NaNToDefault(note.vibratoAttack, defaultNoteNode.vibratoAttack);
				if(vibratoAttack)
					gainVibrato.gain.setTargetAtTime(1200 * vibratoDepth, minStart, Math.abs(clip.playTimeScale) * vibratoAttack * Math.LOG2E);
				else
					gainVibrato.gain.setValueAtTime(1200 * vibratoDepth, minStart);
				sourceNode.modGainVibrato = gainVibrato;
				clip.auxNodes.push(gainVibrato);
				oscVibrato.connect(gainVibrato);
				gainVibrato.connect(sourceNode.detune);
			}
		}

		//volume scale and decay (from vol to 0)
		//note: negative gain causes phase inversion (at least in Ffx 100)
		const gainDecay = new GainNode(clip.audioCtx, {gain: clip.playVolScale * (note.vol ?? defaultNoteNode.vol)});
		if(noteFreq) {
			const decayFactor = NaNToDefault(note.decayFactor, defaultNoteNode.decayFactor);
			//question: should decay factor be subject to playTimeScale? (currently yes)
			gainDecay.gain.setTargetAtTime(0, minStart, Math.abs(clip.playTimeScale) * decayFactor * Math.LOG2E / Math.abs(noteFreq)); //negative time constants currently don't work
		}
		terminalNode.connect(gainDecay);
		terminalNode = gainDecay;
		sourceNode.modGainDecay = gainDecay;
		clip.auxNodes.push(gainDecay);

		//volume attack (from 0 to 1)
		const attack = NaNToDefault(note.attack, defaultNoteNode.attack);
		if(attack > 0) {
			const gainAttack = new GainNode(clip.audioCtx, {gain: 0});
			//question: !should attack time be subject to noteFreq? (currently no)
			//question: should attack time be subject to playTimeScale? (currently yes)
			gainAttack.gain.setTargetAtTime(1, minStart, Math.abs(clip.playTimeScale) * attack * Math.LOG2E);
			terminalNode.connect(gainAttack);
			terminalNode = gainAttack;
			sourceNode.modGainAttack = gainAttack;
			clip.auxNodes.push(gainAttack);
		}

		if(releaseCurve) {
			//volume decay within note time
			const gainRelease = new GainNode(clip.audioCtx);
			gainRelease.gain.setValueCurveAtTime(releaseCurve, minStart, Math.abs(duration));
			terminalNode.connect(gainRelease);
			terminalNode = gainRelease;
			sourceNode.modGainRelease = gainRelease;
			clip.auxNodes.push(gainRelease);
		}
	} finally {
		terminalNode.connect(clip.destNode);
		if(isNoise)
			sourceNode.start(minStart, Math.random() * clip.noiseBuffer.duration); //random start point
		else
			sourceNode.start(minStart);
		sourceNode.stop(Math.max(clip.t0 + noteStop, ctxTime));
		if(oscVibrato) {
			oscVibrato.start(minStart);
			oscVibrato.tStart = minStart;
			oscVibrato.stop(Math.max(clip.t0 + noteStop, ctxTime));
		}
	}
}
function enqueueNotes(clip, tNow, tMargin) { //question: should this be a SoundClip method?
	if(!clip || !clip.flatStruct) {
		console.info("enqueueNotes(): parameter clip.flatStruct is empty. Returning.");
		return false;
	}
	if(!clip.audioCtx) {
		console.info("enqueueNotes(): parameter clip.audioCtx is empty. Returning.");
		return false;
	}
	tNow /= clip.playTimeScale; //to do: move the divisions outside this procedure (to facilitate variable time scale)?
	tMargin /= clip.playTimeScale;
	const tMax = tNow + tMargin;

	//progressively enter notes
	//this procedure presumes a time-sorted array of notes
	//to do: nondestructive list traversal
	while(clip.flatStruct.length > 0 && clip.flatStruct[0].noteStart <= tMax) { //to do: review time condition when allowing reverse playback
		const note = clip.flatStruct.shift();

		//in the flattened structure, all notes must have (non-zero) frequency...
		if(!note.freq) //even unfiltered noise
		//if(!note.freq && ((note.timbre ?? defaultNoteNode.timbre) != "noise" || (note.q ?? defaultNoteNode.q) != 0)) //except for unfiltered noise
			continue; //note: negative frequency is allowed
		//if(note.noteStop <= note.noteStart) continue;
		if(note.noteStop === note.noteStart) continue; //note: negative length is not rejected, unlike length zero
		if(note.vol === 0) continue; //negative amplitude is allowed, but zero amplitude not played
		if(note.noteStop < tNow) continue;

		try {
			renderNote(clip, note);
		} catch(error) {
			console.warn(error);
		}
	}
	return true;
}

function updateAudioT() {
	if(!playerClip) return false;
	try {
		if(playerClip.audioCtx && outAudioT)
			//when dealing with time, it's better to round down
			outAudioT.innerText = toFixedTrunc(playerClip.audioCtx.currentTime - playerClip.t0, timeDisplPrecision);
		if(outGenCount) outGenCount.innerText = playerClip.generators.length.toString();
	} catch(error) {
		console.warn(error);
	}
	return true;
}
const audioTimerInterval = 86400 * 0.5 ** 21; //86400 / 2097152 = ~0.0411 s
//to do: variable/adaptive enqueue interval? (high note density -> smaller intervals)
var lastT = 0, visT = 0;
//function audioTimer(noEnqueue) {
function audioTimer(clip) { //question: should this be a SoundClip method?
	if(!clip) {
		console.info("audioTimer(): parameter clip is empty. Returning.");
		return false;
	}
	if(!clip.open) {
		console.info("audioTimer(): clip is not open. Returning.");
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}
	if(!clip.audioCtx && !clip.flatStruct) {
		console.info("audioTimer(): members clip.audioCtx and clip.flatStruct are both empty. Returning.");
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}
	//clip.playTimeScale = NaNToDefault(parseNumber(window.txtPlayTimeScale?.value), / * defaultBlockNode.timeScale * /prefsDefault.clipParams.timeScale); //to do: ?variable speed
	if(clip === playerClip) updateAudioT();
	const ctxTime = clip.audioCtx.currentTime, tNow = ctxTime - clip.t0;
	//if(clip.flatStruct.length < 1 && tNow >= clip.duration) {
	if(clip.audioCtx.state !== 'suspended'
		&& tNow > 0
		&& clip.generators.length < 1
		&& (!clip.flatStruct || clip.flatStruct.length < 1)) {

		if(clip.generators || clip.auxNodes || clip.flatStruct) {
			console.log("audioTimer(): will close clip.");
			clip.onClipEnd?.(false);
		}
		if(clip === playerClip) {
			console.log("audioTimer(): will suspend audioCtx and return.");
			clip.audioCtx?.suspend?.()?.then?.(nil => {
					//question: remove the extra playerClip === clip check?
					if(playerClip === clip && window.chkAutoReload?.checked)
						loadAndPlay();
				}/* , reason => {
					window.reportError(reason);
				} */); //keep audioCtx to avoid recreating noiseBuffer for different contexts.
		}
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}

	//if(clip.audioCtx.state === 'closed') return false;
	//console.log("audioTimer: clip.audioCtx.state: " + clip.audioCtx.state.toString());
	if(clip.audioCtx.state !== 'running') {
		printClip(clip, "audioTimer(): ");
		console.info(`audioTimer(): member clip.audioCtx.state is ${clip.audioCtx.state}. Returning.`);
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}

	//to do: move this upwards?
	//if(noEnqueue === undefined) noEnqueue = false;
	//if(!noEnqueue)
		enqueueNotes(clip, tNow, 2 * Math.max(audioTimerInterval, ctxTime - lastT));
	lastT = ctxTime;

	//to do: catch clause that suspends audioCtx on error?

	//if(clip.audioCtx.state === 'suspended') return true;
	//visualization
	if(clip === playerClip)
		try {
			updateVisualizer(clip, tNow);
		} catch(error) {
			console.warn(error);
		}

	//window.setTimeout(audioTimer, audioTimerInterval * 1000, clip);
	//if(tNow >= (clip.duration - 1))
	//if(tNow >= 0.1)
		//throw("Test."); //call stack test
	//window.requestAnimationFrame(timestamp => audioTimer(clip, timestamp));
	//to do: allow skipping/fast forward/rewind?
	return true;
}

//loadNewClip() presumes that a flattened representation already exists in ctlFlatScript.
function loadNewClip() {
	if(!window.ctlFlatScript) return false;
	if(prefs.clipParams.freqScale == 0) throw(new Error("Invalid playback frequency scale setting."));

	//to do: allow dynamic change of playTimeScale? (very hard)
	const playTimeScale = NaNToDefault(parseNumber(window.txtPlayTimeScale?.value), /* defaultBlockNode.timeScale */prefsDefault.clipParams.timeScale);
	//question: allow reverse playback? (how? apparently it will require a script-based audio node for the reverse of an exponential decay.)
	if(playTimeScale <= 0) throw(new Error("Invalid playback time scale setting.")); //currently no.
	const playTimeDelta = NaNToDefault(parseNumber(window.txtPlayTimeDelta?.value), /* defaultBlockNode.timeDelta */prefsDefault.clipParams.timeDelta);

	let flatStruct;
	try {
		flatStruct = JSON.parse(codeBoxContentGet(ctlFlatScript));
		if(!flatStruct) throw(new Error("Unrecognized flattened structure."));
		ctlFlatScript.classList.remove("invalid");
		ctlFlatScript.title = "";
	} catch(error) {
		ctlFlatScript?.classList?.add?.("invalid");
		if(window.ctlFlatScript) ctlFlatScript.title = (error.message ?? error).toString();
		console.error(error); //to do: change to console.warn()?
		return false; //to do: move this handler outwards?
	}

	//estimate total clip duration and fills order-dependent implied noteStart's
	let duration = 0;
	const len = flatStruct.length;
	let lastNoteStop = 0;
	for(let i = 0, note; i < len; i++) {
		note = flatStruct[i];
		//in the flattened structure, all notes must have (non-zero) frequency...
		if(!note.freq) //even unfiltered noise
		//if(!note.freq && ((note.timbre ?? defaultNoteNode.timbre) != "noise" || (note.q ?? defaultNoteNode.q) != 0)) //except for unfiltered noise
			continue; //note: negative frequency is allowed
		if(note.noteStart === undefined) note.noteStart = lastNoteStop;
		if(note.noteStop === undefined)
			note.noteStop = note.noteStart + NaNToDefault(note.duration, defaultNoteNode.duration);
		lastNoteStop = note.noteStop;

		//if(note.noteStop <= note.noteStart) continue;
		if(note.noteStop < note.noteStart) { //question: ignore negative-length notes? (currently no.)
			const temp = note.noteStart;
			note.noteStart = note.noteStop;
			note.noteStop = temp;
			lastNoteStop = temp;
		} else
			//question: should trailing zero-length notes influence clip total duration?
			if(note.noteStop == note.noteStart) continue; //(currently no.)
		duration = Math.max(duration, playTimeScale * note.noteStop);
	}
	if(len <= 0) return false;
	//lastFreq = flatStruct[0].freq; //the first note may be actually noise...
	flatStruct.sort((a, b) => {
			let diff = a.noteStart - b.noteStart; //earlier start
			if(diff === 0) diff = a.attack - b.attack; //quicker attack
			if(diff === 0) diff = a.noteStop - b.noteStop; //earlier stop
			return diff;
		});

	return new SoundClip(flatStruct, duration, playTimeScale, playTimeDelta, prefs.clipParams.volScale, prefs.clipParams.freqScale);
}
function playerBeforePlay() {
	console.log("playerBeforePlay(): function started...");
	playerClip.destNode = playerClip.audioCtx.destination;

	//if(!playerClip.noiseBuffer || noiseSource.context !== playerClip.audioCtx) playerClip.noiseBuffer = createNoiseBuffer();
	if(!playerClip.noiseBuffer) playerClip.noiseBuffer = createNoiseBuffer(playerClip.audioCtx);

	//to do: currently, audio clips are expected to start at time 0. I could do a leading silence trimming if relevant.
	lastT = playerClip.audioCtx.currentTime;
	playerClip.t0 = lastT - playerClip.playTimeDelta;

	try { //visualizer errors shouldn't block the rest of the procedure
		visT = 0;
		if(window.imgVisualizer) {
			const slices = imgVisualizer.getElementsByClassName("vis-slice");
			for(let i = slices.length - 1; i >= 0; i--)
				slices[i].remove();
		}
		updateVisAreaTransform();
	} catch(error) {
		console.warn(error);
	}
	//audioTimer(playerClip);
	updateAudioT();
	enqueueNotes(playerClip, playerClip.playTimeDelta, 2 * audioTimerInterval);
	if(playerClip.audioCtx.state === 'suspended')
		playerClip.audioCtx.resume()?.then?.(nil => {
				//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
				audioTimer(playerClip);
				playerClip.timerID = window.setInterval(audioTimer, audioTimerInterval * 1000, playerClip);
			}, reason => {
				setToolTip(outToolTip, "Could not resume playback. " + (reason.message ?? reason ?? ""), 3);
				//window.reportError(reason);
				console.error(reason);
			});
	else
		//audioTimer(playerClip);
		//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
		//window.requestAnimationFrame(timestamp => audioTimer(clip, timestamp));
		playerClip.timerID = window.setInterval(audioTimer, audioTimerInterval * 1000, playerClip);
	if(window.btnPause) {
		btnPause.innerHTML = pauseToggleCaptions[true];
		btnPause.disabled = false;
	}
}
function audioCtxDefStateChanged(event) {
	printClip(this, "audioCtxDefStateChanged(): ");
	if(!this) return false;
	console.debug(`audioCtxDefStateChanged(): state: ${this.state}`);
}
async function loadAndPlay(event) {
	try {
		if(playerClip && playerClip.open) return false;

		let audioCtx = null, noiseBuffer = null;
		if(playerClip) {
			audioCtx = playerClip.audioCtx;
			noiseBuffer = playerClip.noiseBuffer;
			playerClip.onClipEnd?.(false);
		}
		playerClip = loadNewClip();
		if(!playerClip || !playerClip.flatStruct) return false;
		playerClip.audioCtx = audioCtx;
		playerClip.noiseBuffer = noiseBuffer;
		playerClip.onClipEnd = clipEndPlayer;

		//to do: don't include empty remark nodes.
		if(window.outNoteCount) outNoteCount.innerText = playerClip.flatStruct.length.toString();
		if(window.outAudioDur) outAudioDur.innerText = toFixedTrunc(playerClip.duration, timeDisplPrecision);
		if(playerClip.flatStruct.length <= 0)
			if(window.outAudioT) outAudioT.innerText = toFixedTrunc(0, timeDisplPrecision); //question: ignore lead-in here? (currently yes)

		playerClip.open = true;
		if(!playerClip.audioCtx || playerClip.audioCtx.state === 'closed') {
			console.debug("loadAndPlay(): creating new AudioContext.");
			//playerClip.audioCtx = new AudioContext({latencyHint: "playback"});
			playerClip.audioCtx = new AudioContext({latencyHint: "interactive"});
			playerClip.audioCtx.addEventListener("statechange", audioCtxDefStateChanged);
		}
		if(playerClip.audioCtx.state === 'running')
			//use of Promise here will defer the rest of the procedure.
			playerClip.audioCtx.suspend()?.then?.(playerBeforePlay, playerBeforePlay)
				?.catch?.(reason => {
					setToolTip(outToolTip, "Playback reset failed. " + (reason.message ?? reason ?? ""), 2);
					//window.reportError(reason);
					console.error(reason);
				});
		else
			playerBeforePlay();
		return true;
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Playback start failed. " + (error.message ?? error ?? ""), 3);
		return false;
	}
}

//reversible operation
function pauseToggle(event) {
	//console.log("pauseToggle(): function started...");
	try {
		if(!playerClip) return false;
		if(!playerClip.open || !playerClip.audioCtx) return false;
		//updateAudioT();
		if(playerClip.audioCtx.state === 'closed') return false;
		if(playerClip.audioCtx.state === 'running') {
			playerClip.audioCtx.suspend()?.then?.(nil => {
					updateAudioT();
					lastT = playerClip.audioCtx.currentTime;
					if(window.btnPause) btnPause.innerHTML = pauseToggleCaptions[false];
					if(playerClip?.timerID) {
						window.clearInterval(playerClip.timerID);
						playerClip.timerID = NaN;
					}
				}/* , reason => {
					window.reportError(reason);
				} */);
		} else {
			updateVisAreaTransform();
			playerClip.audioCtx.resume()?.then?.(nil => {
					//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
					//window.requestAnimationFrame(timestamp => audioTimer(playerClip, timestamp))
					audioTimer(playerClip);
					if(window.btnPause) btnPause.innerHTML = pauseToggleCaptions[true];
					playerClip.timerID = window.setInterval(audioTimer, audioTimerInterval * 1000, playerClip);
				}, reason => {
					setToolTip(outToolTip, "Could not resume playback. " + (reason.message ?? reason ?? ""), 3);
					//window.reportError(reason);
					console.error(reason);
				});
			//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
			//window.requestAnimationFrame(timestamp => audioTimer(playerClip, timestamp));
		}
		//audioTimer(playerClip.audioCtx.state !== 'running');
		//audioTimer(playerClip); //question: is this statement necessary?
	} catch(error) {
		console.error(error);
		setToolTip(outToolTip, "Playback state toggling failed. " + (error.message ?? error ?? ""), 3);
		return false;
	}
	return true;
}
