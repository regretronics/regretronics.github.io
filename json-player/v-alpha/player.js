"use strict";

//to do: iterative self-filtering for subtractive synthesis?
//to do: array variable or boolean-indexed object for pause button caption per playback state

//note: some procedures here would be technically unnecessary (called only once), but are dedicated for the sake of readability and maintenance, and to avoid deep levels of statement nesting

let playerClip = null;

//constructor
function SoundClip(flatStruct, duration, playTimeScale, playTimeDelta, playVolScale, playFreqScale) {
	Object.assign(this, {
		audioCtx: null, noiseBuffer: null, destNode: null, //variables for Web Audio
		playing: false, t0: 0, duration: 0, //miscellaneous clip properties
		onEnd: null, //events for custom behavior
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
	let sampleCount = noiseBufferTime * audioCtx.sampleRate;
	let buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
	let arr = buffer.getChannelData(0);
	
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
	let i = arr.indexOf(item);
	if(i >= 0) arr.splice(i, 1);
}

//event handler for generator audio nodes
function defOnEnded() {
	if(!this) return;
	//console.debug("Note release: " + audioCtx.currentTime);

	if(this.fltBandPass) this.fltBandPass.disconnect();
	if(this.modGainDecay) this.modGainDecay.disconnect();
	if(this.modGainAttack) this.modGainAttack.disconnect();
	if(this.modGainRelease) this.modGainRelease.disconnect();
	if(this.modGainVibrato) this.modGainVibrato.disconnect();
	if(this.oscVibrato) this.oscVibrato.stop();
	this.disconnect();

	let clip = this.sndClip;
	if(!clip) return;
	//remove modules from list.
	//to do: move this into conditionals above, to prevent strict-mode errors?
	removeFrom(clip.generators, this);
	let auxNodes = clip.auxNodes;
	removeFrom(auxNodes, this.fltBandPass);
	removeFrom(auxNodes, this.modGainDecay);
	removeFrom(auxNodes, this.modGainAttack);
	removeFrom(auxNodes, this.modGainRelease);
	removeFrom(auxNodes, this.modGainVibrato);

	if(!clip.audioCtx || (clip.generators.length < 1) && (clip.audioCtx.currentTime - clip.t0 > clip.duration) && (!clip.flatStruct || (clip.flatStruct.length < 1))) {
		console.log("defOnEnded: will stop playback.");
		if(clip.onEnd) clip.onEnd();
		//return;
	}
}

function newToneNode(clip, noteFreq, minStart, portamento, freq0) {
	//note: negative frequency causes phase inversion (at least in Ffx 100)
	let sourceNode = new OscillatorNode(clip.audioCtx, {type: "sine", frequency: noteFreq});
	try {
		if(portamento <= 0) return;
		//portamento (using detune for an exponential frequency variation)
		//fixed start frequency?
		//question: should an explicit freq0 of 0 also disable portamento? (currently yes)
		if(isNaN(freq0)) {
			if(!clip.lastFreq) return;

			freq0 = clip.lastFreq;
			if(clip.lastFreq0 && (clip.lastPortamento > 0)) {
				//portamento of previous note may have been incomplete
				let lastNoteT = (clip.audioCtx.currentTime - clip.lastNoteStart) / (Math.abs(clip.playTimeScale) * clip.lastPortamento);
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
	let noteFreq = clip.playFreqScale * note.freq;
	let noteStart = clip.playTimeScale * note.noteStart;
	let noteStop = clip.playTimeScale * note.noteStop;
	let duration = noteStop - noteStart;
	if(duration < 0) { //question: ignore negative-length notes? (currently no)
		let temp = noteStart;
		noteStart = noteStop;
		noteStop = temp;
	}
	let noteTimbre = note.timbre;
	if(!noteTimbre) noteTimbre = defaultNoteNode.timbre;
	let isNoise = noteTimbre.toLowerCase() === "noise";
	let minStart = Math.max(clip.t0 + noteStart, clip.audioCtx.currentTime);
	
	let sourceNode, oscVibrato = null;
	if(isNoise)
		sourceNode = new AudioBufferSourceNode(clip.audioCtx, {buffer: clip.noiseBuffer, loop: true});
	else
		sourceNode = newToneNode(clip, noteFreq, minStart, NaNToDefault(note.portamento, defaultNoteNode.portamento), note.freq0);
	sourceNode.sndClip = clip;
	sourceNode.onended = defOnEnded;
	clip.generators.push(sourceNode);
	let terminalNode = sourceNode;
	
	try {
		if(isNoise) {
			let fltBandPass = new BiquadFilterNode(clip.audioCtx, {
				type: "bandpass",
				frequency: Math.abs(noteFreq),
				//Q: 0.0625
				//Q: 0.25
				Q: 1
				//Q: 4
			}); //to do: exponentially increasing Q? (but how?)
			terminalNode.connect(fltBandPass);
			terminalNode = fltBandPass;
			sourceNode.fltBandPass = fltBandPass;
			clip.auxNodes.push(fltBandPass);
		} else {
			//vibrato (using detune for an exponential frequency variation)
			let vibratoDepth = NaNToDefault(note.vibratoDepth, defaultNoteNode.vibratoDepth);
			let vibratoFreq = NaNToDefault(note.vibratoFreq, defaultNoteNode.vibratoFreq);
			if(vibratoFreq && vibratoDepth) {
				oscVibrato = new OscillatorNode(clip.audioCtx, {type: "sine", frequency: Math.abs(clip.playTimeScale) * vibratoFreq});
				sourceNode.oscVibrato = oscVibrato;
				oscVibrato.sndClip = clip;
				oscVibrato.onended = defOnEnded;
				clip.generators.push(oscVibrato);

				let gainVibrato = new GainNode(clip.audioCtx, {gain: 0});
				let vibratoAttack = NaNToDefault(note.vibratoAttack, defaultNoteNode.vibratoAttack);
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

		let gainDecay, gainAttack, gainRelease;
		//volume scale and decay (from vol to 0)
		//note: negative gain causes phase inversion (at least in Ffx 100)
		gainDecay = new GainNode(clip.audioCtx, {gain: clip.playVolScale * (note.hasOwnProperty("vol") ? note.vol : defaultNoteNode.vol)}); //to do: consider the optional chaining operator here
		let decayFactor = NaNToDefault(note.decayFactor, defaultNoteNode.decayFactor);
		//question: should decay factor be subject to playTimeScale? (currently yes)
		gainDecay.gain.setTargetAtTime(0, minStart, Math.abs(clip.playTimeScale) * decayFactor * Math.LOG2E / Math.abs(noteFreq)); //negative time constants currently don't work
		terminalNode.connect(gainDecay);
		terminalNode = gainDecay;
		sourceNode.modGainDecay = gainDecay;
		clip.auxNodes.push(gainDecay);
		
		//volume attack (from 0 to 1)
		let attack = NaNToDefault(note.attack, defaultNoteNode.attack);
		if(attack > 0) {
			gainAttack = new GainNode(clip.audioCtx, {gain: 0});
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
			gainRelease = new GainNode(clip.audioCtx);
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
			oscVibrato.stop(Math.max(clip.t0 + noteStop, clip.audioCtx.currentTime));
		}
	}
}
function enqueueNotes(clip, tNow, tMargin) {
	if(!clip) return false;
	if(!clip.audioCtx) return false;
	tNow /= clip.playTimeScale; //to do: move the divisions outside this procedure (to facilitate variable time scale)?
	tMargin /= clip.playTimeScale;
	let tMax = tNow + tMargin;
	let note;
	//progressively enter notes
	//this procedure presumes a time-sorted array of notes
	//to do: nondestructive list traversal
	while((clip.flatStruct.length > 0) && (clip.flatStruct[0].noteStart <= tMax)) { //to do: review time condition when allowing reverse playback
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
	if(playerClip.audioCtx && elems.outAudioT)
		elems.outAudioT.innerText = (playerClip.audioCtx.currentTime - playerClip.t0).toFixed(timeDisplPrecision);
	if(elems.outGenCount) elems.outGenCount.innerText = playerClip.generators.length.toString();
}
const visSliceCount = 32;
const svgNS = "http://www.w3.org/2000/svg";
function drawNote(group, sourceNode) {
	const noteVisWidth = 1 / 128; //arbitrary size
	const freqMin = 20, freqMax = 14000; //20000;
	const octaveScale = 1 / Math.log2(freqMax / freqMin);

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
	let noteShape = document.createElementNS(svgNS, "rect"), wid = noteVisWidth;
	if(isNoise)
		wid *= 16 / sourceNode.fltBandPass.Q.value; //arbitrary factor
	else
		if(sourceNode.modGainVibrato)
			wid = Math.max(wid, 4 * sourceNode.modGainVibrato.gain.value / 1200 * octaveScale);
	noteShape.setAttributeNS(null, "width", wid.toString());
	noteShape.setAttributeNS(null, "x", (Math.log2(Math.abs(freq) / freqMin) * octaveScale - 0.5 * wid).toString());
	//the attributes below are constant, so I could have replaced them with CSS;
	//however, visualization would become impossible in the unlikely case that style sheets are disabled
	noteShape.setAttributeNS(null, "height", (1 / visSliceCount).toString());
	noteShape.setAttributeNS(null, "y", "0");

	let vol = 1;
	if(sourceNode.modGainDecay) vol *= sourceNode.modGainDecay.gain.value;
	if(sourceNode.modGainAttack) vol *= sourceNode.modGainAttack.gain.value;
	if(sourceNode.modGainRelease) vol *= sourceNode.modGainRelease.gain.value;
	noteShape.setAttributeNS(null, "opacity", Math.sqrt(Math.abs(vol)).toString());
	
	group.appendChild(noteShape);
	//group.append(noteShape);
}
const audioTimerInterval = 86400 * 0.5 ** 21;
//to do: variable/adaptive enqueue interval? (high note density -> smaller intervals)
let lastT = 0, visT = 0;
//function audioTimer(noEnqueue) {
function audioTimer() {
	if(!playerClip) return false;
	//console.debug("audioTimer() #1.");
	if(!playerClip.playing || !playerClip.audioCtx || !playerClip.flatStruct) return false;
	//playerClip.playTimeScale = NaNToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale); //to do: ?variable speed
	audioTUpdate();
	//console.debug("audioTimer() #2.");
	//if((playerClip.flatStruct.length < 1) && (playerClip.audioCtx.currentTime - playerClip.t0 > playerClip.duration)) {
	if((playerClip.audioCtx.state !== 'suspended') && (playerClip.audioCtx.currentTime - playerClip.t0 > 0) && (playerClip.generators.length < 1) && (!playerClip.flatStruct || (playerClip.flatStruct.length < 1))) {
		console.log("audioTimer: will stop playback.");
		playerStop();
		return;
	}
	//if(playerClip.audioCtx.state === 'closed') return;
	//console.log("audioTimer: playerClip.audioCtx.state: " + playerClip.audioCtx.state.toString());
	if(playerClip.audioCtx.state !== 'running') return;
	//console.debug("audioTimer() #3.");
	
	//if(noEnqueue === undefined) noEnqueue = false;
	let currT = playerClip.audioCtx.currentTime;
	//if(!noEnqueue)
		enqueueNotes(playerClip, currT - playerClip.t0, Math.max(2 * audioTimerInterval, 2 * (currT - lastT)));
	lastT = currT;
	
	//if(playerClip.audioCtx.state === 'suspended') return;
	if(elems.imgVisualizer) {
		//scroll
		let slices = elems.imgVisualizer.getElementsByClassName("vis-slice");
		for(let i = slices.length - 1; i >= 0; i--) {
			const slice = slices[i];
			let t = parseFloat(slice.getAttribute("data-t"));
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
	if(elems.imgVisualizer) {
		//to do: consider SVG animation: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/animateTransform , https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/accumulate
		//to do: consider a node-based polyline
		let slice = document.createElementNS(svgNS, "g");
		slice.setAttributeNS(null, "class", "vis-slice");
		slice.setAttributeNS(null, "data-t", visT.toString());
		slice.setAttributeNS(null, "transform", `translate(0 ${(visSliceCount - 1) / visSliceCount})`);
		elems.imgVisualizer.appendChild(slice);
		for(const node of playerClip.generators)
			try {
				drawNote(slice, node);
			} catch(error) {
				console.error(error);
			}
		visT++;
	}
	
	window.setTimeout(audioTimer, audioTimerInterval * 1000);
	//to do: allow skipping/fast forward/rewind?
	//console.debug("audioTimer() end.");
}

//loadNewClip() presumes that a flattened representation already exists in ctlFlatScript.innerText.
function loadNewClip() {
	if(!elems.ctlFlatScript) return false;
	if(playFreqScale == 0) return false;

	//to do: allow dynamic change of playTimeScale? (very hard)
	let playTimeScale = NaNToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale);
	//to do: allow reverse playback?
	if(playTimeScale <= 0) return false;
	let playTimeDelta = NaNToDefault(parseNumber(elems.txtPlayTimeDelta.value), defaultBlockNode.timeDelta);

	let flatStruct;
	try {
		flatStruct = JSON.parse(elems.ctlFlatScript.innerText);
	} catch(error) {
		elems.ctlFlatScript.classList.add("invalid");
		elems.ctlFlatScript.title = error.message;
		console.error(error);
		return false;
	}
	elems.ctlFlatScript.classList.remove("invalid");
	elems.ctlFlatScript.title = "";
	if(!flatStruct) return false;

	//estimate total clip duration and fills order-dependent implied noteStart's
	let duration = 0;
	let len = flatStruct.length;
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
			let temp = note.noteStart;
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
	
	let clip = new SoundClip(flatStruct, duration, playTimeScale, playTimeDelta, playVolScale, playFreqScale);
	return clip;
}
function beforePlay() {
	playerClip.destNode = playerClip.audioCtx.destination;
	playerClip.playing = true;

	//if(!playerClip.noiseBuffer || (noiseSource.context !== playerClip.audioCtx)) playerClip.noiseBuffer = createNoiseBuffer();
	if(!playerClip.noiseBuffer) playerClip.noiseBuffer = createNoiseBuffer(playerClip.audioCtx);

	//to do: currently, audio clips are expected to start at time 0. I could do a leading silence trimming if relevant.
	lastT = playerClip.audioCtx.currentTime;
	playerClip.t0 = lastT - playerClip.playTimeDelta;

	visT = 0;
	if(elems.imgVisualizer) {
		let slices = elems.imgVisualizer.getElementsByClassName("vis-slice");
		for(let i = slices.length - 1; i >= 0; i--)
			slices[i].remove();
	}
	//audioTimer();
	audioTUpdate();
	enqueueNotes(playerClip, playerClip.playTimeDelta, 2 * audioTimerInterval);
	//playerClip.audioCtx.resume().then(() => window.setTimeout(audioTimer, audioTimerInterval * 1000));
	playerClip.audioCtx.resume().then(audioTimer);
	if(elems.btnPause) {
		elems.btnPause.innerHTML = "<u>P</u>ause";
		elems.btnPause.disabled = false;
	}
	//window.setTimeout(audioTimer, audioTimerInterval * 1000);
}
function loadAndPlay() {
	if(playerClip && playerClip.playing) return false;

	let audioCtx = null, noiseBuffer = null;
	if(playerClip) {
		audioCtx = playerClip.audioCtx;
		noiseBuffer = playerClip.noiseBuffer;
	}
	playerClip = loadNewClip();
	if(!playerClip) return false;
	playerClip.audioCtx = audioCtx;
	playerClip.noiseBuffer = noiseBuffer;
	playerClip.onEnd = playerStop;

	if(elems.outNoteCount) elems.outNoteCount.innerText = playerClip.flatStruct.length.toString();
	if(elems.outAudioDur) elems.outAudioDur.innerText = playerClip.duration.toFixed(timeDisplPrecision);
	if(playerClip.flatStruct.length <= 0)
		if(elems.outAudioT) elems.outAudioT.innerText = (0).toFixed(timeDisplPrecision); //question: ignore lead-in here? (currently yes)

	if(!playerClip.audioCtx || (playerClip.audioCtx.state === 'closed'))
		playerClip.audioCtx = new AudioContext({latencyHint: "playback"});
	//to do: use Promise here to defer the rest of the procedure?
	playerClip.audioCtx.suspend().then(beforePlay);
}

//nonreversible operation, frees resources
function stopClip(clip) {
	if(!clip) return false;
	console.log("stopClip started...");

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
	clip.playing = false;

	/*try {
		if(clip.audioCtx) clip.audioCtx.close();
	} catch(error) {
		console.error(error);
	}
	clip.audioCtx = null;*/
	if(clip.audioCtx) clip.audioCtx.suspend(); //avoid recreating noiseBuffer for different contexts.
	clip.t0 = 0;

	if(clip.flatStruct) { //empty and release
		clip.flatStruct.length = 0;
		clip.flatStruct = null;
	}
}
function playerStop(event) {
	if(!playerClip) return false;
	if(playerClip.playing) audioTUpdate();
	stopClip(playerClip);

	if(elems.btnPause) elems.btnPause.innerHTML = "<u>P</u>ause";
	if((arguments.length < 1) || !event)
		if(elems.chkAutoReload && elems.chkAutoReload.checked) loadAndPlay();
}

//reversible operation
function pauseToggle() {
	if(!playerClip) return false;
	if(!playerClip.playing || !playerClip.audioCtx) return false;
	//audioTUpdate();
	if(playerClip.audioCtx.state === 'closed') return false;
	if(playerClip.audioCtx.state === 'running') {
		playerClip.audioCtx.suspend();
		if(elems.btnPause) elems.btnPause.innerHTML = "Un<u>p</u>ause";
	} else {
		//playerClip.audioCtx.resume().then(() => window.setTimeout(audioTimer, audioTimerInterval * 1000));
		playerClip.audioCtx.resume().then(audioTimer);
		if(elems.btnPause) elems.btnPause.innerHTML = "<u>P</u>ause";
		//window.setTimeout(audioTimer, audioTimerInterval * 1000);
	}
	lastT = playerClip.audioCtx.currentTime;
	//audioTimer(playerClip.audioCtx.state !== 'running');
	audioTimer(); //to do: is this statement necessary?
}

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
	//let properties = {type: 'audio/webm; codecs=opus'}; //constructor parameters: container's MIME-type, and encoding.
	//let properties = {type: 'audio/webm'}; //constructor parameters: container's MIME-type.
	//let properties = {};
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

	if(!elems.aAudioDownload) return false;
	elems.aAudioDownload.setAttribute('href', lastAudioObjURL);
	elems.aAudioDownload.setAttribute('download', fileName);
	elems.aAudioDownload.click();
	let sizeKB = file.size / 1024, sizeMB = sizeKB / 1024;
	if(elems.outExportProgress)
		elems.outExportProgress.innerText = `Exported (${sizeKB.toFixed(2)} kiB/${sizeMB.toFixed(2)} MiB)`;
	exportType = "";
}
let mediaRecorder, chunks = [], exportClip = null;
function exportClipEnd() {
	if(!exportClip) return false;
	stopClip(exportClip);
	if(elems.outExportProgress) elems.outExportProgress.innerText = "Rendered";
	if(mediaRecorder) {
		mediaRecorder.requestData();
		mediaRecorder.stop();
		mediaRecorder = null;
	}
	exportClip.audioCtx.close();
	exportClip = null;
}
function exportAudioTimer() {
	if(!exportClip) return false;
	if(!exportClip.playing || !exportClip.audioCtx) return false;
	//question: trunc instead of round for time?
	if(elems.outExportProgress)
		elems.outExportProgress.innerText = (100 * (exportClip.audioCtx.currentTime) / (exportClip.duration + exportClip.t0)).toFixed(2) + "%";
	//if((exportClip.flatStruct.length < 1) && (exportClip.audioCtx.currentTime - exportClip.t0 > exportClip.duration)) {
	if((exportClip.audioCtx.state !== 'suspended') && (exportClip.audioCtx.currentTime - exportClip.t0 > 0) && (exportClip.generators.length < 1)) {
		console.log("exportAudioTimer: will stop exporting.");
		exportClipEnd();
		return;
	}
	if(exportClip.audioCtx.state === 'closed') return;
	window.setTimeout(exportAudioTimer, 2 * audioTimerInterval * 1000);
}
function beforeRecord() {
	//exportClip.destNode = exportClip.audioCtx.destination;
	exportClip.playing = true;
	exportClip.noiseBuffer = createNoiseBuffer(exportClip.audioCtx);
	//to do: currently, audio clips are expected to start at time 0. I could do a leading silence trimming if relevant.
	lastT = exportClip.audioCtx.currentTime;
	exportClip.t0 = lastT - exportClip.playTimeDelta;

	//based on code from https://github.com/mdn/webaudio-examples/blob/master/create-media-stream-destination/index.html
	let dest = exportClip.audioCtx.createMediaStreamDestination();
	//let dest = new MediaStreamAudioDestinationNode(exportClip.audioCtx, {channelCount: 1});
	exportClip.destNode = dest;

	//audio/ogg, audio/webm, audio/mp4, audio/3gp2, audio/mpeg
	//codecs={vorbis, opus, mp4a.40.1 (AAC main), mp4a.40.34 (MP3)}
	exportType = 'audio/webm; codecs=opus'; //fallback: this is apparently the only thing that Opera supports
	let _exportType = 'audio/ogg; codecs=opus';
	if(MediaRecorder.isTypeSupported(_exportType)) exportType = _exportType;
	mediaRecorder = new MediaRecorder(dest.stream, {mimeType: exportType});
	if(elems.outExportFormat) elems.outExportFormat.innerText = exportType;
	mediaRecorder.ondataavailable = function(event) {
		//push each chunk (blobs) in an array
		console.debug("MediaRecorder.ondataavailable event");
		chunks.push(event.data);
	};
	mediaRecorder.onstop = function(event) {
		//console.debug("MediaRecorder.onstop event");
		audioDownload(chunks);
	};

	enqueueNotes(exportClip, lastT, Infinity);
	//console.log("audioExport(): enqueueNotes done.");
	if(elems.outExportProgress) elems.outExportProgress.innerText = "Starting";
	mediaRecorder.start();
	exportClip.audioCtx.resume().then(exportAudioTimer);

	/*//audioCtxOff.oncomplete = ;
	exportClip.audioCtx.startRendering().then(function(renderedBuffer) {
		console.log('Rendering completed successfully');
		console.debug(renderedBuffer);

		//let chunks = [renderedBuffer.getChannelData(0)];
		let chunks = renderedBuffer.getChannelData(0);
		audioDownload(chunks);
		console.debug("audioCtx startRendering promise then end");
	}).catch(function(err) {
		console.error('Rendering failed: ' + err);
		//Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
	});*/
}
function audioExport() {
	if(exportClip && exportClip.playing) return false;
	exportClip = new loadNewClip();
	exportClip.onEnd = exportClipEnd;
	if(elems.outExportProgress) elems.outExportProgress.innerText = "Note list loaded";
	if(elems.outExportDuration) elems.outExportDuration.innerText = (exportClip.duration).toFixed(timeDisplPrecision);
	//to do: stop AudioContext playback? (probably unnecessary)
	const sampleRate = 48000; //will become a variable later
	//exportClip.audioCtx = new OfflineAudioContext(1, sampleRate * exportClip.duration, sampleRate);
	exportClip.audioCtx = new AudioContext({latencyHint: "playback", sampleRate: sampleRate});
	exportClip.audioCtx.suspend().then(beforeRecord);
}
function audioExportCancel() {
	if(!exportClip) return false;
	stopClip(exportClip);
	if(elems.outExportProgress) elems.outExportProgress.innerText = "Canceled";
	if(mediaRecorder) {
		//mediaRecorder.onstop = null; //question: allow partial download? (currently yes)
		mediaRecorder.stop();
		mediaRecorder = null;
	}
	exportClip.audioCtx.close();
	exportClip = null;
}
