"use strict";

//imported variables
var releaseCurve;
var playFreqScale, playVolScale;

//to do: iterative self-filtering for subtractive synthesis?

//done: consider changing setTimeout to setInterval or requestAnimationFrame. setTimeout produces seriously deep call stacks (at least in Ffx), and might be consuming resources.
//to do: log when .audioCtx state changes (by event), to be sure that it's not kept running.
//to do: review audioTimer(), playerClipEnd(), exportClipEnd().

var playerClip = null; //shared variable
const pauseToggleCaptions = {false: "Un<u>p</u>ause", true: "<u>P</u>ause"};

//constructor
function SoundClip(flatStruct, duration, playTimeScale, playTimeDelta, playVolScale, playFreqScale) {
	Object.assign(this, {
		audioCtx: null, noiseBuffer: null, destNode: null, //variables for Web Audio
		open: false, t0: 0, duration: 0, timerID: NaN, //miscellaneous clip properties
		onClipEnd: null, //events for custom behavior
		generators: [], auxNodes: [], flatStruct: null, //node and note lists
		playTimeScale: 1, playTimeDelta: 0, playVolScale: 1, playFreqScale: 1, //overall controls
		lastFreq: 0, lastFreq0: 0, lastNoteStart: 0, lastPortamento: 0 //portamento variables
	});
	if(arguments.length < 1) return;
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
//currently an in-place operation, not functional.
function removeFrom(arr, item) {
	if(!item || !arr) return false;
	const i = arr.indexOf(item);
	if(i >= 0) arr.splice(i, 1);
}

function printClip(clip, prefix) {
	prefix = (prefix ? prefix.toString() : "");
	if(!clip) {
		console.debug(prefix + `clip: ${clip}`);
		return;
	}
	/* if(clip == playerClip) {
		console.debug(prefix + "clip == playerClip");
		return;
	} */
	if(clip == exportClip) {
		console.debug(prefix + "clip == exportClip");
		//return;
	}
	//console.log(clip);
}
//event handler for generator audio nodes
function defNodeEnded() {
	if(!this) return;
	//console.debug("Note release: " + audioCtx.currentTime);

	if(this.fltBandPass) this.fltBandPass.disconnect();
	if(this.modGainDecay) this.modGainDecay.disconnect();
	if(this.modGainAttack) this.modGainAttack.disconnect();
	if(this.modGainRelease) this.modGainRelease.disconnect();
	if(this.modGainVibrato) this.modGainVibrato.disconnect();
	if(this.oscVibrato) this.oscVibrato.stop();
	this.disconnect();

	const clip = this.sndClip;
	if(!clip) return;
	//remove modules from list.
	//question: move this into conditionals above, to prevent strict-mode errors? (probably it's not raising errors)
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
			if(clip.onClipEnd) clip.onClipEnd(false); else emptyClip(clip, false);
		if(clip === playerClip && chkAutoReload && chkAutoReload.checked)
			loadAndPlay();
		return;
	}
	if((!clip.generators || clip.generators.length < 1)
		&& (clip.audioCtx.currentTime - clip.t0 >= clip.duration)
		&& (!clip.flatStruct || clip.flatStruct.length < 1)) {
		printClip(clip, "defNodeEnded(): ");
		//console.debug(`defNodeEnded(): clip.audioCtx.currentTime: ${clip.audioCtx.currentTime}; clip.flatStruct: ${clip.flatStruct}.`);
		//console.debug(`defNodeEnded(): clip.duration: ${clip.duration}; clip.t0: ${clip.t0}.`);
		if(clip.generators || clip.auxNodes || clip.flatStruct) {
			//console.log("defNodeEnded(): Will end clip.");
			if(clip.onClipEnd) clip.onClipEnd(false); else emptyClip(clip, false);
		}
		if(clip === playerClip && clip.audioCtx.state === 'running') {
			console.log("defNodeEnded(): Will suspend audioCtx.");
			clip.audioCtx.suspend().then(() => {
				if(clip === playerClip && chkAutoReload && chkAutoReload.checked)
					loadAndPlay();
			}); //keep audioCtx to avoid recreating noiseBuffer for different contexts.
		}
		//return;
	}
}

function newToneNode(clip, noteFreq, minStart, portamento, freq0) {
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

		sourceNode.detune.value = 1200 * Math.log2(freq0 / noteFreq);
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
function renderNote(clip, note) {
	//idea: Object.assign() from defaultNoteNode and note into a new note object
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
	const minStart = Math.max(clip.t0 + noteStart, clip.audioCtx.currentTime);

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
			const fltBandPass = new BiquadFilterNode(clip.audioCtx, {
				type: "bandpass",
				frequency: Math.abs(noteFreq),
				Q: NaNToDefault(note.q, defaultNoteNode.q)
			}); //to do: exponentially increasing Q? (but how?)
			terminalNode.connect(fltBandPass);
			terminalNode = fltBandPass;
			sourceNode.fltBandPass = fltBandPass;
			clip.auxNodes.push(fltBandPass);
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
		const gainDecay = new GainNode(clip.audioCtx, {gain: clip.playVolScale * (note.hasOwnProperty("vol") ? note.vol : defaultNoteNode.vol)}); //to do: consider the optional chaining operator here
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
		sourceNode.stop(Math.max(clip.t0 + noteStop, clip.audioCtx.currentTime));
		if(oscVibrato) {
			oscVibrato.start(minStart);
			oscVibrato.tStart = minStart;
			oscVibrato.stop(Math.max(clip.t0 + noteStop, clip.audioCtx.currentTime));
		}
	}
}
function enqueueNotes(clip, tNow, tMargin) {
	if(!clip || !clip.audioCtx || !clip.flatStruct) return false;
	tNow /= clip.playTimeScale; //to do: move the divisions outside this procedure (to facilitate variable time scale)?
	tMargin /= clip.playTimeScale;
	const tMax = tNow + tMargin;
	let note;
	//progressively enter notes
	//this procedure presumes a time-sorted array of notes
	//to do: nondestructive list traversal
	while(clip.flatStruct.length > 0 && clip.flatStruct[0].noteStart <= tMax) { //to do: review time condition when allowing reverse playback
		note = clip.flatStruct.shift();
		//in the flattened structure, all notes must have (non-zero) frequency
		if(!note.freq) continue; //note: negative frequency is allowed
		//if(note.noteStop <= note.noteStart) continue;
		if(note.noteStop === note.noteStart) continue; //note: negative length is not rejected
		if(note.vol === 0) continue; //negative amplitude is allowed, but zero amplitude not played
		if(note.noteStop < tNow) continue;
		try {
			renderNote(clip, note);
		} catch(error) {
			console.error(error);
		}
	}
}

function audioTUpdate() {
	if(!playerClip) return false;
	//question: trunc instead of round for time?
	if(playerClip.audioCtx && outAudioT)
		outAudioT.innerText = (playerClip.audioCtx.currentTime - playerClip.t0).toFixed(timeDisplPrecision);
	if(outGenCount) outGenCount.innerText = playerClip.generators.length.toString();
}
const visSliceCount = 48;
const svgNS = "http://www.w3.org/2000/svg";
function drawNote(group, sourceNode) {
	const freqMin = 20, freqMax = 14000; //20000;
	const octaveScale = 1 / Math.log2(freqMax / freqMin);
	const noteVisWidth = 1 / 16; //bandwidth in octaves; hand-tuned, partially arbitrary scale

	let freq, isNoise;
	if(sourceNode.frequency) {
		freq = sourceNode.frequency.value * 2 ** (sourceNode.detune.value / 1200);
		isNoise = false;
	} else
		if(sourceNode.fltBandPass && sourceNode.fltBandPass.frequency) {
			freq = sourceNode.fltBandPass.frequency.value;
			isNoise = true;
		}
	if(!freq) return false;

	//to do: alternative blend modes such as lighten or hue?
	const noteShape = document.createElementNS(svgNS, "rect");
	let wid = octaveScale * (isNoise ? 8 * sourceNode.fltBandPass.Q.value ** (-1 / 3) : noteVisWidth); //hand-tuned parameters
	/* if(isNoise)
		wid *= 128 * sourceNode.fltBandPass.Q.value ** (-0.5);
	else */
	if(!isNoise)
		if(sourceNode.modGainVibrato) {
			const vibratoGain = sourceNode.modGainVibrato.gain.value / 1200;
			if(sourceNode.oscVibrato) //question: precisely estimate vibrato oscillation? (currently yes)
				freq *= 2 ** (vibratoGain * Math.sin(2 * Math.PI * (sourceNode.context.currentTime - sourceNode.oscVibrato.tStart) * sourceNode.oscVibrato.frequency.value)); //yes
			else
				wid = Math.max(wid, 4 * vibratoGain * octaveScale); //no
		}
	noteShape.setAttributeNS(null, "width", wid.toString());
	noteShape.setAttributeNS(null, "x", (Math.log2(Math.abs(freq) / freqMin) * octaveScale - 0.5 * wid).toString());
	//the attributes below are constant, so I could have replaced them with CSS;
	//however, visualization would become impossible in the unlikely case that style sheets are disabled
	noteShape.setAttributeNS(null, "height", (1 / visSliceCount).toString());
	noteShape.setAttributeNS(null, "y", "0");

	let vol = (isNoise ? 0.125 * sourceNode.fltBandPass.Q.value ** (-1 / 3) : 1); //hand-tuned parameters
	if(sourceNode.modGainDecay) vol *= sourceNode.modGainDecay.gain.value;
	if(sourceNode.modGainAttack) vol *= sourceNode.modGainAttack.gain.value;
	if(sourceNode.modGainRelease) vol *= sourceNode.modGainRelease.gain.value;
	noteShape.setAttributeNS(null, "opacity", /* Math.sqrt */(Math.abs(vol)).toString());

	group.appendChild(noteShape);
	//group.append(noteShape);
}
const audioTimerInterval = 86400 * 0.5 ** 21;
//to do: variable/adaptive enqueue interval? (high note density -> smaller intervals)
let lastT = 0, visT = 0;
//function audioTimer(noEnqueue) {
function audioTimer(clip) {
	if(!clip) {
		console.info("audioTimer(): Parameter clip is empty. Returning.");
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
	//if(clip.flatStruct.length < 1 && (clip.audioCtx.currentTime - clip.t0 >= clip.duration)) {
	if(clip.audioCtx.state !== 'suspended'
		&& (clip.audioCtx.currentTime - clip.t0 > 0)
		&& clip.generators.length < 1
		&& (!clip.flatStruct || clip.flatStruct.length < 1)) {
		if(clip.generators || clip.auxNodes || clip.flatStruct) {
			console.log("audioTimer(): Will close clip.");
			if(clip.onClipEnd) clip.onClipEnd(false); else emptyClip(clip, false);
		}
		if(clip === playerClip) {
			console.log("audioTimer(): Will suspend audioCtx and return.");
			clip.audioCtx?.suspend?.()?.then?.(() => {
				if(clip === playerClip && chkAutoReload && chkAutoReload.checked)
					loadAndPlay();
			}); //keep audioCtx to avoid recreating noiseBuffer for different contexts.
		}
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return;
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
		return;
	}

	//to do: move this upwards?
	//if(noEnqueue === undefined) noEnqueue = false;
	const currT = clip.audioCtx.currentTime;
	//if(!noEnqueue)
		enqueueNotes(clip, currT - clip.t0, 2 * Math.max(audioTimerInterval, currT - lastT));
	lastT = currT;

	//to do: catch clause that suspends audioCtx on error?

	//if(clip.audioCtx.state === 'suspended') return;
	if(clip === playerClip) {
		if(window.imgVisualizer) {
			//scroll
			const slices = imgVisualizer.getElementsByClassName("vis-slice");
			for(let i = slices.length - 1; i >= 0; i--) {
				const slice = slices[i];
				const t = parseFloat(slice.getAttribute("data-t")); //dataset doesn't work here, somehow
				let newY = t + visSliceCount - visT;
				if(newY <= -1) {
					slice.remove(); //it's easier to delete when we use groups
					continue;
				}
				newY /= visSliceCount;
				slice.setAttributeNS(null, "transform", `translate(0 ${newY})`);
			}
		}
		//visualization
		if(window.imgVisualizer) {
			//to do: consider SVG animation: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/animateTransform , https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/accumulate
			//to do: consider a node-based polyline
			const slice = document.createElementNS(svgNS, "g");
			slice.setAttributeNS(null, "class", "vis-slice");
			slice.setAttributeNS(null, "data-t", visT.toString());
			slice.setAttributeNS(null, "transform", `translate(0 ${(visSliceCount - 1) / visSliceCount})`);
			imgVisualizer.appendChild(slice);
			for(const node of clip.generators)
				try {
					drawNote(slice, node);
				} catch(error) {
					console.error(error);
				}
			visT++;
		}
	}

	//window.setTimeout(audioTimer, audioTimerInterval * 1000, clip);
	//if(clip.audioCtx.currentTime - clip.t0 >= clip.duration - 1)
	//if(clip.audioCtx.currentTime - clip.t0 >= 0.1)
		//throw "Test."; //call stack test
	//window.requestAnimationFrame((timestamp) => audioTimer(clip, timestamp));
	//to do: allow skipping/fast forward/rewind?
}

//loadNewClip() presumes that a flattened representation already exists in ctlFlatScript.
function loadNewClip() {
	if(!window.ctlFlatScript) return false;
	if(playFreqScale == 0) return false;

	//to do: allow dynamic change of playTimeScale? (very hard)
	const playTimeScale = NaNToDefault(parseNumber(txtPlayTimeScale.value), defaultBlockNode.timeScale);
	//to do: allow reverse playback?
	if(playTimeScale <= 0) return false;
	const playTimeDelta = NaNToDefault(parseNumber(txtPlayTimeDelta.value), defaultBlockNode.timeDelta);

	let flatStruct;
	try {
		flatStruct = JSON.parse(codeEditorContentGet(ctlFlatScript));
	} catch(error) {
		ctlFlatScript.classList.add("invalid");
		ctlFlatScript.title = error.message;
		console.error(error);
		return false;
	}
	ctlFlatScript.classList.remove("invalid");
	ctlFlatScript.title = "";
	if(!flatStruct) return false;

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
		if(note.noteStop < note.noteStart) { //question: ignore negative-length notes?
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
	flatStruct.sort(function(a, b) {
		let diff = a.noteStart - b.noteStart; //earlier start
		if(diff === 0) diff = a.attack - b.attack; //quicker attack
		if(diff === 0) diff = a.noteStop - b.noteStop; //earlier stop
		return diff;
	});

	return new SoundClip(flatStruct, duration, playTimeScale, playTimeDelta, playVolScale, playFreqScale);
}
function beforePlay() {
	console.log("beforePlay started...");
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
	//audioTimer(playerClip);
	audioTUpdate();
	enqueueNotes(playerClip, playerClip.playTimeDelta, 2 * audioTimerInterval);
	if(playerClip.audioCtx.state === 'suspended')
		//playerClip.audioCtx.resume().then(() => window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip));
		playerClip.audioCtx.resume().then(() => {
			audioTimer(playerClip);
			playerClip.timerID = window.setInterval(audioTimer, audioTimerInterval * 1000, playerClip);
		});
	else
		//audioTimer(playerClip);
		//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
		//window.requestAnimationFrame((timestamp) => audioTimer(clip, timestamp));
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
function loadAndPlay() {
	if(playerClip && playerClip.open) return false;

	let audioCtx = null, noiseBuffer = null;
	if(playerClip) {
		audioCtx = playerClip.audioCtx;
		noiseBuffer = playerClip.noiseBuffer;
		if(playerClip.onClipEnd) playerClip.onClipEnd(false); else emptyClip(playerClip, false);
	}
	playerClip = loadNewClip();
	if(!playerClip || !playerClip.flatStruct) return false;
	playerClip.audioCtx = audioCtx;
	playerClip.noiseBuffer = noiseBuffer;
	playerClip.onClipEnd = playerClipEnd;

	//to do: don't include empty remark nodes.
	if(window.outNoteCount) outNoteCount.innerText = playerClip.flatStruct.length.toString();
	if(window.outAudioDur) outAudioDur.innerText = playerClip.duration.toFixed(timeDisplPrecision);
	if(playerClip.flatStruct.length <= 0)
		if(window.outAudioT) outAudioT.innerText = (0).toFixed(timeDisplPrecision); //question: ignore lead-in here? (currently yes)

	playerClip.open = true;
	if(!playerClip.audioCtx || playerClip.audioCtx.state === 'closed') {
		//playerClip.audioCtx = new AudioContext({latencyHint: "playback"});
		playerClip.audioCtx = new AudioContext({latencyHint: "interactive"});
		playerClip.audioCtx.addEventListener("statechange", audioCtxDefStateChanged);
	}
	if(playerClip.audioCtx.state === 'running')
		//using Promise here to defer the rest of the procedure.
		playerClip.audioCtx.suspend().then(beforePlay);
	else
		beforePlay();
}

//--
//nonreversible operation, frees resources
function emptyClip(clip, suspend) {
	if(!clip) return false;
	if(!clip.open) return false;
	//console.log("emptyClip() started...");
	printClip(clip, "emptyClip(): ");

	for(const node of clip.generators) {
		try {
			node.stop();
		} catch(error) {
			console.error(error);
		}
		node.disconnect();
	}
	clip.generators.length = 0;

	for(const node of clip.auxNodes) node.disconnect();
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
	if(suspend && clip.audioCtx) return clip.audioCtx.suspend(); //keep audioCtx, to avoid recreating noiseBuffer for future audio contexts.
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
	return emptyClip(clip, suspend);
}

//reversible operation
function pauseToggle() {
	console.log("pauseToggle() started...");
	if(!playerClip) return false;
	if(!playerClip.open || !playerClip.audioCtx) return false;
	//audioTUpdate();
	if(playerClip.audioCtx.state === 'closed') return false;
	if(playerClip.audioCtx.state === 'running') {
		playerClip.audioCtx.suspend().then(() => {
			audioTUpdate();
			lastT = playerClip.audioCtx.currentTime;
			if(window.btnPause) btnPause.innerHTML = pauseToggleCaptions[false];
			if(playerClip?.timerID) {
				window.clearInterval(playerClip.timerID);
				playerClip.timerID = NaN;
			}
			});
	} else {
		//playerClip.audioCtx.resume().then(() => window.setTimeout(audioTimer, audioTimerInterval * 1000), playerClip);
		//playerClip.audioCtx.resume().then(() => window.requestAnimationFrame((timestamp) => audioTimer(playerClip, timestamp)));
		;
		playerClip.audioCtx.resume().then(() => {
			audioTimer(playerClip);
			if(window.btnPause) btnPause.innerHTML = pauseToggleCaptions[true];
			playerClip.timerID = window.setInterval(audioTimer, audioTimerInterval * 1000, playerClip);
		});
		//window.setTimeout(audioTimer, audioTimerInterval * 1000, playerClip);
		//window.requestAnimationFrame((timestamp) => audioTimer(playerClip, timestamp));
	}
	//audioTimer(playerClip.audioCtx.state !== 'running');
	//audioTimer(playerClip); //question: is this statement necessary?
}

//--
let lastAudioObjURL = null, exportType = "";
function audioDownload(data) {
	if(!data) return false;
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
}
let mediaRecorder, chunks = [], exportClip = null;
function exportClipEnd() {
	const clip = this ?? exportClip;
	if(!clip) return false;

	emptyClip(clip, false);
	if(clip.audioCtx) clip.audioCtx.suspend?.()?.then?.(() => {
	//if(clip.audioCtx) clip.audioCtx.close?.()?.then?.(() => {
		if(window.outExportProgress) outExportProgress.innerText = "Rendered";
		if(mediaRecorder) {
			mediaRecorder.requestData();
			mediaRecorder.stop(); //to do: move this into mediaRecorder.ondataavailable? (probably not)
			mediaRecorder = null;
		}
		clip.audioCtx.close(); //to do: use this place of suspend()?
		if(exportClip === clip) exportClip = null;
	});
}
function exportAudioTimer(clip) {
	if(!clip) return false;
	if(!clip.open || !clip.audioCtx) {
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		return false;
	}
	//question: trunc instead of round for time?
	if(window.outExportProgress)
		outExportProgress.innerText = (100 * (clip.audioCtx.currentTime) / (clip.duration + clip.t0)).toFixed(2) + "%";
	//if(clip.flatStruct.length < 1 && (clip.audioCtx.currentTime - clip.t0 > clip.duration)) {
	if(clip.audioCtx.state !== 'suspended' && (clip.audioCtx.currentTime - clip.t0 > 0) && clip.generators.length < 1) {
		printClip(clip, "exportAudioTimer(): ");
		console.log("exportAudioTimer(): will stop exporting.");
		if(clip.onClipEnd) clip.onClipEnd(true); else emptyClip(clip, false);
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
		//to do: suspend?
		return;
	}
	if(clip.audioCtx.state === 'closed') //return;
		if(clip?.timerID) {
			window.clearInterval(clip.timerID);
			clip.timerID = NaN;
		}
	//window.setTimeout(exportAudioTimer, 2 * audioTimerInterval * 1000, clip);
	//window.requestAnimationFrame((timestamp) => exportAudioTimer(clip, timestamp));
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
	mediaRecorder.ondataavailable = function(event) {
		//push each chunk (blobs) in an array
		console.debug("MediaRecorder.ondataavailable event");
		chunks.push(event.data);
	};
	mediaRecorder.onstop = function(event) {
		//console.debug("MediaRecorder.onstop event");
		audioDownload(chunks);
		chunks.length = 0;
	};

	enqueueNotes(exportClip, lastT, Infinity);
	//console.log("audioExport(): enqueueNotes done.");
	if(window.outExportProgress) outExportProgress.innerText = "Starting";
	mediaRecorder.start();
	exportClip.audioCtx.resume().then(() => {
		exportAudioTimer(exportClip);
		exportClip.timerID = window.setInterval(exportAudioTimer, audioTimerInterval * 1000, exportClip);
	});

	/*//audioCtxOff.oncomplete = ;
	exportClip.audioCtx.startRendering().then(function(renderedBuffer) {
		console.log('Rendering completed successfully');
		console.debug(renderedBuffer);

		//const chunks = [renderedBuffer.getChannelData(0)];
		const chunks = renderedBuffer.getChannelData(0);
		audioDownload(chunks);
		console.debug("audioCtx startRendering promise then end");
	}).catch(function(err) {
		console.error('Rendering failed: ' + err);
		//Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
	});*/
}
function audioExport() {
	if(exportClip && exportClip.open) return false;
	exportClip = new loadNewClip();
	exportClip.onClipEnd = exportClipEnd;
	if(window.outExportProgress) outExportProgress.innerText = "Note list loaded";
	if(window.outExportDuration) outExportDuration.innerText = (exportClip.duration).toFixed(timeDisplPrecision);
	//to do: stop AudioContext playback? (probably unnecessary)
	exportClip.open = true;
	const sampleRate = 48000; //will become a variable later
	//exportClip.audioCtx = new OfflineAudioContext(1, sampleRate * exportClip.duration, sampleRate);
	exportClip.audioCtx = new AudioContext({latencyHint: "playback", sampleRate: sampleRate});
	exportClip.audioCtx.addEventListener("statechange", audioCtxDefStateChanged);
	exportClip.audioCtx.suspend().then(beforeRecord);
}
function audioExportCancel() {
	if(!exportClip) return false;
	emptyClip(exportClip, false);
	if(exportClip.audioCtx) exportClip.audioCtx.suspend()?.then?.(() => {
		if(window.outExportProgress) outExportProgress.innerText = "Canceled";
		if(mediaRecorder) {
			//mediaRecorder.onstop = null; //question: allow partial download? (currently yes)
			mediaRecorder.stop();
			mediaRecorder = null;
		}
		exportClip.audioCtx.close();
		exportClip = null;
	});
}
