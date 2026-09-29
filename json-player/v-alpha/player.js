"use strict";

//imported variables
var releaseCurve;
var playFreqScale, playVolScale;

//to do: iterative self-filtering for subtractive synthesis?

//done: consider changing setTimeout to setInterval or requestAnimationFrame. setTimeout produces seriously deep call stacks (at least in Ffx), and might be consuming resources.
//to do: log when .audioCtx state changes (by event), to be sure that it's not kept running.
//to do: !review audioTimer(), playerClipEnd(), exportClipEnd().

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
			onClipEnd: emptyClip, //events for custom behavior
			generators: [], auxNodes: [], flatStruct: null, //node and note lists
			playTimeScale: 1, playTimeDelta: 0, playVolScale: 1, playFreqScale: 1, //overall controls
			lastFreq: 0, lastFreq0: 0, lastNoteStart: 0, lastPortamento: 0, //portamento variables
			emptyClip //methods
		});
	if(arguments.length < 1) return; //to do: maybe use switch() here?
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
		//arr[i] = 0.5 * (Math.random() + Math.random() + Math.random() + Math.random()) - 1;
		arr[i] = 1 * (Math.random() + Math.random() + Math.random() + Math.random()) - 2; //can result in overdrive/clipping, but in practice seems ok

		//test: sine wave that fades in and then out
		//arr[i] = (1 - Math.abs((i - 0.5 * sampleCount) / (0.5 * sampleCount))) * Math.sin(2 * Math.PI * 440 * i / audioCtx.sampleRate);
	}

	return buffer;
}

//finds item in arr and remove from it.
//currently an in-place operation (instead of pure function), with optional return.
function removeFrom(arr, item) {
	if(!item || !arr) return false;
	const i = arr.indexOf(item);
	if(i >= 0) arr.splice(i, 1);
	return arr;
}

function printClip(clip, prefix) { //question: should this be a SoundClip method?
	prefix = (prefix ? prefix.toString() : "");
	if(!clip) {
		console.debug(prefix + `clip: ${clip}`);
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
//event handler for generator audio nodes
function defNodeEnded(event) {
	if(!this) return;

	this.fltBandPass?.disconnect?.();
	this.modGainDecay?.disconnect?.();
	this.modGainAttack?.disconnect?.();
	this.modGainRelease?.disconnect?.();
	this.modGainVibrato?.disconnect?.();
	this.oscVibrato?.stop?.();
	this.disconnect?.();

	const clip = this.sndClip;
	if(!clip) return;
	const ctxTime = clip.audioCtx.currentTime;
	//console.debug("Note release: " + ctxTime);

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
		console.log("defNodeEnded(): clip.audioCtx is empty. Ending.");
		if(clip.open)
			clip.onClipEnd?.(false);
		if(playerClip === clip && window.chkAutoReload?.checked)
			loadAndPlay();
		return;
	}
	if((!clip.generators || clip.generators.length < 1)
		&& (ctxTime - clip.t0 >= clip.duration)
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
				})
				?.catch?.(error => {
					window.reportError(error);
				}); //keep audioCtx to avoid recreating noiseBuffer for different contexts.
		}
		//return;
	}
}

function newToneNode(clip, noteFreq, minStart, portamento, freq0) { //question: should this be a SoundClip method?
	//note: negative frequency causes phase inversion (at least in Ffx 100)
	const sourceNode = new OscillatorNode(clip.audioCtx, {type: "sine", frequency: noteFreq});
	try {
		if(portamento <= 0) return;
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
		console.error(error);
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
	//to do: maybe Object.assign() from defaultNoteNode and note into a new note object
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
		const decayFactor = NaNToDefault(note.decayFactor, defaultNoteNode.decayFactor);
		//question: should decay factor be subject to playTimeScale? (currently yes)
		gainDecay.gain.setTargetAtTime(0, minStart, Math.abs(clip.playTimeScale) * decayFactor * Math.LOG2E / Math.abs(noteFreq)); //negative time constants currently don't work
		terminalNode.connect(gainDecay);
		terminalNode = gainDecay;
		sourceNode.modGainDecay = gainDecay;
		clip.auxNodes.push(gainDecay);

		//volume attack (from 0 to 1)
		const attack = NaNToDefault(note.attack, defaultNoteNode.attack);
		if(attack > 0) {
			const gainAttack = new GainNode(clip.audioCtx, {gain: 0});
			//question: should attack time be subject to noteFreq? (currently no)
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
	if(!clip || !clip.audioCtx || !clip.flatStruct) return false;
	tNow /= clip.playTimeScale; //to do: move the divisions outside this procedure (to facilitate variable time scale)?
	tMargin /= clip.playTimeScale;
	const tMax = tNow + tMargin;

	//progressively enter notes
	//this procedure presumes a time-sorted array of notes
	//to do: nondestructive list traversal
	while(clip.flatStruct.length > 0 && clip.flatStruct[0].noteStart <= tMax) { //to do: review time condition when allowing reverse playback
		const note = clip.flatStruct.shift();
		//in the flattened structure, all notes must have (non-zero) frequency
		if(!note.freq) continue; //note: negative frequency is allowed
		//if(note.noteStop <= note.noteStart) continue;
		if(note.noteStop === note.noteStart) continue; //note: negative length is not rejected, unlike length zero
		if(note.vol === 0) continue; //negative amplitude is allowed, but zero amplitude not played
		if(note.noteStop < tNow) continue;
		try {
			renderNote(clip, note);
		} catch(error) {
			console.error(error);
		}
	}
	return true;
}

function audioTUpdate() {
	if(!playerClip) return false;
	try {
		if(playerClip.audioCtx && outAudioT)
			//when dealing with time, it's better to round down
			outAudioT.innerText = toFixedTrunc(playerClip.audioCtx.currentTime - playerClip.t0, timeDisplPrecision);
		if(outGenCount) outGenCount.innerText = playerClip.generators.length.toString();
	} catch (error) {
		console.error(error);
	}
	return true;
}
const visSliceCount = 48;
const svgNS = "http://www.w3.org/2000/svg";
function drawNote(group, sourceNode) {
	if(!group || !sourceNode) return false;
	const noteVisWidth = 1 / 16; //bandwidth in octaves; hand-tuned, partially arbitrary scale

	let freq, isTone = Boolean(sourceNode.frequency), isFiltered = Boolean(sourceNode.fltBandPass);
	if(isTone)
		freq = sourceNode.frequency.value * 2 ** (sourceNode.detune.value / 1200); //1200 cents = 1 octave (log2)
	else
		if(isFiltered) freq = sourceNode.fltBandPass.frequency?.value;
	if((isTone || isFiltered) && !freq) return false;

	//to do: alternative blend modes such as lighten or hue?
	const noteShape = document.createElementNS(svgNS, "rect");
	//the attributes below are constant, so I could have replaced them with CSS;
	//however, visualization would become impossible in the unlikely case that style sheets are disabled
	noteShape.setAttributeNS(null, "height", "1");
	noteShape.setAttributeNS(null, "y", "0");

	if(isTone || isFiltered) {
		let width = (isTone ? noteVisWidth : 8 * sourceNode.fltBandPass.Q.value ** (-1 / 3)); //hand-tuned parameters
		if(isTone && sourceNode.modGainVibrato) {
			const vibratoGain = sourceNode.modGainVibrato.gain.value / 1200;
			if(sourceNode.oscVibrato) //question: precisely estimate vibrato oscillation? (currently yes)
				freq *= 2 ** (vibratoGain * Math.sin(2 * Math.PI * (sourceNode.context.currentTime - sourceNode.oscVibrato.tStart) * sourceNode.oscVibrato.frequency.value)); //yes
			else
				width = Math.max(wid, 4 * vibratoGain); //no
		}
		noteShape.classList.add("tapered");
		noteShape.setAttributeNS(null, "width", width.toString());
		noteShape.setAttributeNS(null, "x", (Math.log2(Math.abs(freq)) - 0.5 * width).toString());
	} else {
		noteShape.setAttributeNS(null, "x", "0");
		//noteShape.setAttributeNS(null, "x", Math.log2(1).toString());
		//noteShape.setAttributeNS(null, "width", "1");
		noteShape.setAttributeNS(null, "width", Math.log2(0.5 * sourceNode.context.sampleRate).toString());
	}

	let vol = (isTone ? 1 : 
		(isFiltered ? 0.125 * sourceNode.fltBandPass.Q.value ** (-1 / 3) : 0.5)); //hand-tuned parameters (to do: check for unfiltered noise)
	if(sourceNode.modGainDecay) vol *= sourceNode.modGainDecay.gain?.value ?? 1;
	if(sourceNode.modGainAttack) vol *= sourceNode.modGainAttack.gain?.value ?? 1;
	if(sourceNode.modGainRelease) vol *= sourceNode.modGainRelease.gain?.value ?? 1;
	noteShape.setAttributeNS(null, "opacity", /* Math.sqrt */(Math.abs(vol)).toString());

	group.appendChild(noteShape);
	//group.append(noteShape);
	return noteShape;
}
const audioTimerInterval = 86400 * 0.5 ** 21; //86400 / 2097152 = ~0.0411 s
//to do: variable/adaptive enqueue interval? (high note density -> smaller intervals)
let lastT = 0, visT = 0;
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
		console.info("audioTimer(): clip.audioCtx and clip.flatStruct are empty. Returning.");
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}
	//clip.playTimeScale = NaNToDefault(parseNumber(txtPlayTimeScale.value), defaultBlockNode.timeScale); //to do: ?variable speed
	if(clip === playerClip) audioTUpdate();
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
				})
				?.catch?.(error => {
					window.reportError(error);
				}); //keep audioCtx to avoid recreating noiseBuffer for different contexts.
		}
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}

	//if(clip.audioCtx.state === 'closed') return;
	//console.log("audioTimer: clip.audioCtx.state: " + clip.audioCtx.state.toString());
	if(clip.audioCtx.state !== 'running') {
		printClip(clip, "audioTimer(): ");
		console.info(`audioTimer(): clip.audioCtx.state is ${clip.audioCtx.state}. Returning.`);
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

	//if(clip.audioCtx.state === 'suspended') return;
	//visualization
	if(clip === playerClip && window.imgVisualizer)
		try {
			//to do: !move this block into a new function
			const nowY = visSliceCount - 1; //to do: !change scale reference

			//scroll
			const slices = imgVisualizer.getElementsByClassName("vis-slice"), lastSlice = slices.length - 1;
			if(lastSlice >= 0) {
				const slice = slices[lastSlice], t1 = parseFloat(slice.getAttribute("data-t"));
				slice.setAttributeNS(null, "data-dt", (tNow - t1).toString());
			}
			//to do: adjust visArea transform instead of moving every row
			for(let i = lastSlice; i >= 0; i--) {
				const slice = slices[i];
				const absY = parseFloat(slice.getAttribute("data-t")) / audioTimerInterval; //dataset doesn't work here, somehow (to do: re-check)
				//const newY = absY + (nowY - visT) /* * audioTimerInterval */;
				const newY = absY + (nowY - tNow / audioTimerInterval);
				if(newY <= -1) {
				//if(newY <= -audioTimerInterval) {
					slice.remove(); //it's easier to delete when we use groups
					continue;
				}
				const dy = parseFloat(slice.getAttribute("data-dt")) / audioTimerInterval;
				//newY /= visSliceCount;
				slice.setAttributeNS(null, "transform", `translate(0 ${newY}) scale(1 ${dy})`);
			}

			//new row of spectrum
			//to do: consider a node-based polyline
			//to do: consider SVG animation: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/animateTransform , https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/accumulate
			//https://developer.mozilla.org/en-US/docs/Web/API/SVGSVGElement/pauseAnimations
			//https://developer.mozilla.org/en-US/docs/Web/API/SVGSVGElement/unpauseAnimations
			const slice = document.createElementNS(svgNS, "g");
			slice.setAttributeNS(null, "class", "vis-slice");
			/* slice.setAttributeNS(null, "data-t", (visT * audioTimerInterval).toString()); */
			slice.setAttributeNS(null, "data-t", tNow.toString());
			slice.setAttributeNS(null, "data-dt", audioTimerInterval.toString());
			//slice.setAttributeNS(null, "transform", `translate(0 ${nowY / visSliceCount})`);
			slice.setAttributeNS(null, "transform", `translate(0 ${nowY})`);
			//slice.setAttributeNS(null, "transform", `translate(0 ${nowY}) scale(1 ${1})`);
			window.visArea?.appendChild(slice);
			for(const node of clip.generators)
				try {
					drawNote(slice, node);
					//drawNote(slice, node)?.setAttributeNS(null, "height", audioTimerInterval.toString());
				} catch(error) {
					console.error(error);
				}
			visT++;
		} catch(error) {
			console.error(error);
		}

	//window.setTimeout(audioTimer, audioTimerInterval * 1000, clip);
	//if(tNow >= clip.duration - 1)
	//if(tNow >= 0.1)
		//throw "Test."; //call stack test
	//window.requestAnimationFrame(timestamp => audioTimer(clip, timestamp));
	//to do: allow skipping/fast forward/rewind?
	return true;
}

//loadNewClip() presumes that a flattened representation already exists in ctlFlatScript.
function loadNewClip() {
	if(!window.ctlFlatScript) return false;
	if(playFreqScale == 0) throw new Error("Invalid playback frequency scale setting.");

	//to do: allow dynamic change of playTimeScale? (very hard)
	const playTimeScale = NaNToDefault(parseNumber(txtPlayTimeScale.value), defaultBlockNode.timeScale);
	//question: allow reverse playback? (how? apparently it will require a script-based audio node for the reverse of an exponential decay.)
	if(playTimeScale <= 0) throw new Error("Invalid playback time scale setting."); //currently no.
	const playTimeDelta = NaNToDefault(parseNumber(txtPlayTimeDelta.value), defaultBlockNode.timeDelta);

	let flatStruct;
	try {
		flatStruct = JSON.parse(codeEditorContentGet(ctlFlatScript));
	} catch(error) {
		ctlFlatScript.classList.add("invalid");
		ctlFlatScript.title = error.message;
		console.error(error);
		return false; //to do: move this handler outwards?
	}
	ctlFlatScript.classList.remove("invalid");
	ctlFlatScript.title = "";
	if(!flatStruct) throw new Error("Unrecognized flattened structure.");

	//estimate total clip duration and fills order-dependent implied noteStart's
	let duration = 0;
	const len = flatStruct.length;
	let lastNoteStop = 0;
	for(let i = 0, note; i < len; i++) {
		note = flatStruct[i];
		//in the flattened structure, all notes must have (non-zero) frequency.
		if(!note.freq) continue;
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

	return new SoundClip(flatStruct, duration, playTimeScale, playTimeDelta, playVolScale, playFreqScale);
}
function updateVisAreaTransform() {
	if(!window.imgVisualizer) return false;

	freqMin = NaNToDefault(parseNumber(window.txtFreqRangeMin?.value), defaultFreqMin);
	freqMax = NaNToDefault(parseNumber(window.txtFreqRangeMax?.value), defaultFreqMax);
	//if(window.visArea) visArea.setAttributeNS(null, "transform", `translate()`);
	if(!window.visArea?.transform?.baseVal) return false;

	const newScale = imgVisualizer.createSVGTransform();
	newScale.setScale(1 / Math.log2(freqMax / freqMin), 1 / visSliceCount);
	//newScale.setScale(1 / Math.log2(freqMax / freqMin), 1 / (visSliceCount * audioTimerInterval));
	visArea.transform.baseVal.initialize(newScale);
	const newTranslate = imgVisualizer.createSVGTransform();
	newTranslate.setTranslate(- Math.log2(freqMin), 0);
	visArea.transform.baseVal.appendItem(newTranslate);
	return true;
}
function playerBeforePlay() {
	console.log("playerBeforePlay(): function started...");
	playerClip.destNode = playerClip.audioCtx.destination;

	//if(!playerClip.noiseBuffer || noiseSource.context !== playerClip.audioCtx) playerClip.noiseBuffer = createNoiseBuffer();
	if(!playerClip.noiseBuffer) playerClip.noiseBuffer = createNoiseBuffer(playerClip.audioCtx);

	//to do: currently, audio clips are expected to start at time 0. I could do a leading silence trimming if relevant.
	lastT = playerClip.audioCtx.currentTime;
	playerClip.t0 = lastT - playerClip.playTimeDelta;

	visT = 0;
	if(window.imgVisualizer) {
		const slices = imgVisualizer.getElementsByClassName("vis-slice");
		for(let i = slices.length - 1; i >= 0; i--)
			slices[i].remove();
	}
	updateVisAreaTransform();
	//audioTimer(playerClip);
	audioTUpdate();
	enqueueNotes(playerClip, playerClip.playTimeDelta, 2 * audioTimerInterval);
	if(playerClip.audioCtx.state === 'suspended')
		playerClip.audioCtx.resume()?.then?.(nil => {
				//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
				audioTimer(playerClip);
				playerClip.timerID = window.setInterval(audioTimer, audioTimerInterval * 1000, playerClip);
			}, reason => setToolTip(outToolTip, "Could not resume playback. " + reason.toString()))
			?.catch?.(error => {
				window.reportError(error);
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
function audioCtxDefStateChanged() {
	printClip(this, "audioCtxDefStateChanged(): ");
	if(!this) return;
	console.log(`audioCtxDefStateChanged(): state: ${this.state}`);
}
async function loadAndPlay() { //to do: !exception handling
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
	playerClip.onClipEnd = playerClipEnd;

	//to do: don't include empty remark nodes.
	if(window.outNoteCount) outNoteCount.innerText = playerClip.flatStruct.length.toString();
	if(window.outAudioDur) outAudioDur.innerText = toFixedTrunc(playerClip.duration, timeDisplPrecision);
	if(playerClip.flatStruct.length <= 0)
		if(window.outAudioT) outAudioT.innerText = toFixedTrunc(0, timeDisplPrecision); //question: ignore lead-in here? (currently yes)

	playerClip.open = true;
	if(!playerClip.audioCtx || playerClip.audioCtx.state === 'closed') {
		//playerClip.audioCtx = new AudioContext({latencyHint: "playback"});
		playerClip.audioCtx = new AudioContext({latencyHint: "interactive"});
		playerClip.audioCtx.addEventListener("statechange", audioCtxDefStateChanged);
	}
	if(playerClip.audioCtx.state === 'running')
		//use of Promise here will defer the rest of the procedure.
		playerClip.audioCtx.suspend()?.then?.(playerBeforePlay)
			?.catch?.(error => {
				window.reportError(error);
			});
	else
		playerBeforePlay();
	return true;
}

//--
//nonreversible operation, frees resources
//to do: !move up in this file?
//to do: rename emptyClip, playerClipEnd, exportClipEnd to the same prefix (maybe clipEndDefault, clipEndPlayer, clipEndExport)
function emptyClip(suspend) { //question: should this be a SoundClip method? (currently yes.)
	const clip = this;
	if(!clip || !clip.open) return false;
	//console.log("emptyClip(): function started...");
	printClip(clip, "emptyClip(): ");

	for(const node of clip.generators) {
		try {
			node.stop();
		} catch(error) {
			console.error(error);
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
		console.error(error);
	}
	clip.audioCtx = null;*/
	if(suspend && clip.audioCtx) {
		console.log("emptyClip(): will suspend audioCtx.");
		return clip.audioCtx.suspend(); //keep audioCtx, to avoid recreating noiseBuffer for future audio contexts.
	} else
		return true;
}
function playerClipEnd(suspend) {
	const clip = this ?? playerClip;
	printClip(clip, "playerClipEnd(): ");
	if(!clip) {
		//console.info("playerClipEnd(): clip is empty. Returning.");
		return false;
	}

	if(clip === playerClip) {
		if(clip.open) audioTUpdate();
		if(window.btnPause) btnPause.innerHTML = pauseToggleCaptions[true];
	}
	return clip.emptyClip(suspend)?.catch?.(error => {
			window.reportError(error);
		});
}

//reversible operation
function pauseToggle() {
	//console.log("pauseToggle(): function started...");
	if(!playerClip) return false;
	if(!playerClip.open || !playerClip.audioCtx) return false;
	//audioTUpdate();
	if(playerClip.audioCtx.state === 'closed') return false;
	if(playerClip.audioCtx.state === 'running') {
		playerClip.audioCtx.suspend()?.then?.(nil => {
				audioTUpdate();
				lastT = playerClip.audioCtx.currentTime;
				if(window.btnPause) btnPause.innerHTML = pauseToggleCaptions[false];
				if(playerClip?.timerID) {
					window.clearInterval(playerClip.timerID);
					playerClip.timerID = NaN;
				}
			})
			?.catch?.(error => {
				window.reportError(error);
			});
	} else {
		updateVisAreaTransform();
		playerClip.audioCtx.resume()?.then?.(nil => {
				//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
				//window.requestAnimationFrame(timestamp => audioTimer(playerClip, timestamp))
				audioTimer(playerClip);
				if(window.btnPause) btnPause.innerHTML = pauseToggleCaptions[true];
				playerClip.timerID = window.setInterval(audioTimer, audioTimerInterval * 1000, playerClip);
			}, reason => setToolTip(outToolTip, "Could not resume playback. " + reason.toString()))
			?.catch?.(error => {
				window.reportError(error);
			});
		//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
		//window.requestAnimationFrame(timestamp => audioTimer(playerClip, timestamp));
	}
	//audioTimer(playerClip.audioCtx.state !== 'running');
	//audioTimer(playerClip); //question: is this statement necessary?
	return true;
}

//--
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

		if(!aAudioDownload) return false;
		aAudioDownload.setAttribute('href', lastAudioObjURL);
		aAudioDownload.setAttribute('download', fileName);
		aAudioDownload.click();
		const sizeKB = file.size / 1024, sizeMB = sizeKB / 1024;
		if(window.outExportProgress)
			outExportProgress.innerText = `Exported (${sizeKB.toFixed(2)} kiB/${sizeMB.toFixed(2)} MiB)`;
		exportType = "";
	} catch(error) {
		console.error(error);
		return false;
	}
	return true;
}
let mediaRecorder, chunks = [], exportClip = null;
function exportClipEnd(suspend) {
	const clip = this ?? exportClip;
	if(!clip) return false;

	return clip.emptyClip(true)?.then?.(nil => {
	//if(clip.audioCtx)
	//	clip.audioCtx.close?.()?.then?.(nil => {
			if(window.outExportProgress) outExportProgress.innerText = "Rendered";
			if(mediaRecorder) {
				mediaRecorder.requestData();
				mediaRecorder.stop(); //to do: move this into mediaRecorder.ondataavailable? (probably not)
				mediaRecorder = null;
			}
			clip.audioCtx.close(); //to do: use this in place of suspend()?
			if(exportClip === clip) exportClip = null;
		})
		?.catch?.(error => {
			window.reportError(error);
		});
	//return true;
}
function exportAudioTimer(clip) { //question: should this be a SoundClip method?
	if(!clip) return false;
	if(!clip.open || !clip.audioCtx) {
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}
	const ctxTime = clip.audioCtx.currentTime;
	if(window.outExportProgress)
		//question: round or trunc for completion? (currently trunc, as with time)
		//outExportProgress.innerText = (100 * ctxTime / (clip.duration + clip.t0)).toFixed(2) + "%";
		outExportProgress.innerText = toFixedTrunc(100 * ctxTime / (clip.duration + clip.t0), 2) + "%";
	//if(clip.flatStruct.length < 1 && (ctxTime - clip.t0) > clip.duration) {
	if(clip.audioCtx.state !== 'suspended' && (ctxTime - clip.t0) > 0 && clip.generators.length < 1) {
		printClip(clip, "exportAudioTimer(): ");
		console.log("exportAudioTimer(): will stop exporting.");
		clip.onClipEnd?.(true);
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return true;
	}
	if(clip.audioCtx.state === 'closed') //return;
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
	//window.setTimeout(exportAudioTimer, 2 * audioTimerInterval * 1000, clip);
	//window.requestAnimationFrame(timestamp => exportAudioTimer(clip, timestamp));
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
	if(window.outExportFormat) outExportFormat.innerText = exportType;
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
	if(window.outExportProgress) outExportProgress.innerText = "Starting";
	mediaRecorder.start();
	exportClip.audioCtx.resume()?.then?.(nil => {
			exportAudioTimer(exportClip);
			exportClip.timerID = window.setInterval(exportAudioTimer, audioTimerInterval * 1000, exportClip);
		}, reason => setToolTip(outToolTip, "Could not resume playback. " + reason.toString()))
		?.catch?.(error => {
			window.reportError(error);
		});

	/*//audioCtxOff.oncomplete = ;
	exportClip.audioCtx.startRendering()?.then?.(renderedBuffer => {
			console.log('Rendering completed successfully');
			console.debug(renderedBuffer);

			//const chunks = [renderedBuffer.getChannelData(0)];
			const chunks = renderedBuffer.getChannelData(0);
			audioDownload(chunks);
			console.debug("audioCtx startRendering promise then end");
		}, reason => setToolTip(outToolTip, "Could not start rendering. " + reason.toString()))?.catch?.(error => {
			console.error('Rendering failed.');
			window.reportError(error);
			//note: the promise should reject when startRendering is called a second time on an OfflineAudioContext
		})
		?.catch?.(error => {
			window.reportError(error);
		});*/
}
function audioExport() { //to do: !exception handling
	if(exportClip && exportClip.open) return false;
	exportClip = loadNewClip();
	exportClip.onClipEnd = exportClipEnd;
	if(window.outExportProgress) outExportProgress.innerText = "Note list loaded";
	//question: round (toFixed) or trunc (toFixedTrunc) here?
	if(window.outExportDuration) outExportDuration.innerText = exportClip.duration.toFixed(timeDisplPrecision);
	//to do: stop AudioContext playback? (probably unnecessary)
	exportClip.open = true;
	const sampleRate = 48000; //to do: will become a variable later
	//exportClip.audioCtx = new OfflineAudioContext(1, sampleRate * exportClip.duration, sampleRate);
	exportClip.audioCtx = new AudioContext({latencyHint: "playback", sampleRate: sampleRate});
	exportClip.audioCtx.addEventListener("statechange", audioCtxDefStateChanged);
	exportClip.audioCtx.suspend()?.then?.(beforeRecord)
		?.catch?.(error => {
			window.reportError(error);
		});
	return true;
}
function audioExportCancel() {
	if(!exportClip) return false;
	exportClip.emptyClip(true)?.then?.(nil => {
			if(window.outExportProgress) outExportProgress.innerText = "Canceled";
			if(mediaRecorder) {
				//mediaRecorder.onstop = null; //question: allow partial download? (currently yes)
				mediaRecorder.stop();
				mediaRecorder = null;
			}
			exportClip.audioCtx.close();
			exportClip = null;
		})
		?.catch?.(error => {
			window.reportError(error);
		});
	return true;
}
