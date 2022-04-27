"use strict";

//to do: output to file (e.g. .opus) (try AudioContext.createMediaStreamDestination)
//to do: iterative self-filtering for subtractive synthesis?

//note: some procedures here would be technically unnecessary (called only once), but are dedicated for the sake of readability and maintenance, and to avoid deep levels of statement nesting

//variables for web audio
let audioCtx = null, noiseBuffer = null;

const noiseBufferTime = 86400 / 4096; //seconds
function createNoiseBuffer() {
	if(!audioCtx) return false;
	let sampleCount = noiseBufferTime * audioCtx.sampleRate;
	let buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
	let arr = buffer.getChannelData(0);
	
	for (let i = 0; i < sampleCount; i++) {
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
	if(!item) return false;
	let i = arr.indexOf(item);
	if(i >= 0) arr.splice(i, 1);
}

let generators = [], auxNodes = [];
let t0 = 0, songDuration = 0;

//event handler for generator audio nodes
function defOnEnded() {
	if(this) {
		//console.debug("Note release: " + audioCtx.currentTime);
		if(this.fltBandPass) this.fltBandPass.disconnect();
		if(this.modGainDecay) this.modGainDecay.disconnect();
		if(this.modGainAttack) this.modGainAttack.disconnect();
		if(this.modGainRelease) this.modGainRelease.disconnect();
		if(this.modGainVibrato) this.modGainVibrato.disconnect();
		if(this.oscVibrato) this.oscVibrato.stop();
		this.disconnect();
	
		//remove modules from list.
		removeFrom(generators, this);
		removeFrom(auxNodes, this.fltBandPass);
		removeFrom(auxNodes, this.modGainDecay);
		removeFrom(auxNodes, this.modGainAttack);
		removeFrom(auxNodes, this.modGainRelease);
		removeFrom(auxNodes, this.modGainVibrato);
	}
	if(!audioCtx || (generators.length < 1) && (audioCtx.currentTime - t0 > songDuration) && (!flatStruct || (flatStruct.length < 1))) {
		console.log("defOnEnded: will stop playback.");
		stop();
		//return;
	}
}

let flatStruct, playTimeScale = 1;
let lastFreq, lastFreq0, lastNoteStart, lastPortamento;
function newToneNode(noteFreq, minStart, portamento, freq0) {
	//note: negative frequency causes phase inversion (at least in Ffx 100)
	let sourceNode = new OscillatorNode(audioCtx, {type: "sine", frequency: noteFreq});
	try {
		if(portamento <= 0) return;
		//portamento (using detune for an exponential frequency variation)
		//fixed start frequency?
		//question: should an explicit freq0 of 0 also disable portamento? (currently yes)
		if (isNaN(freq0)) {
			if(!lastFreq) return;

			freq0 = lastFreq;
			if(lastFreq0 && (lastPortamento > 0)) {
				//portamento of previous note may have been incomplete
				let lastNoteT = (audioCtx.currentTime - lastNoteStart) / (Math.abs(playTimeScale) * lastPortamento);
				freq0 *= (lastFreq0 / lastFreq) ** (0.5 ** lastNoteT);
			}
		}
		if(!freq0) return;

		sourceNode.detune.value = 1200 * Math.log2(freq0 / noteFreq);
		sourceNode.detune.setTargetAtTime(0, minStart, Math.abs(playTimeScale) * portamento * Math.LOG2E);
	} catch (error) {
		console.error(error);
	} finally {
		lastFreq = noteFreq; //set last note portamento parameters
		lastNoteStart = minStart;
		lastFreq0 = freq0;
		lastPortamento = portamento;
		return sourceNode;
	}
}
//question: which one to prefer? noteStop (current choice) or duration?
function renderNote(note) {
	//idea: Object.assign() from defaultNoteNode and note into a new note object
	let noteFreq = playFreqScale * note.freq;
	let noteStart = playTimeScale * note.noteStart;
	let noteStop = playTimeScale * note.noteStop;
	let duration = noteStop - noteStart;
	if(duration < 0) { //question: ignore negative-length notes? (currently no)
		let temp = noteStart;
		noteStart = noteStop;
		noteStop = temp;
	}
	let noteTimbre = note.timbre;
	if(!noteTimbre) noteTimbre = defaultNoteNode.timbre;
	let isNoise = noteTimbre.toLowerCase() === "noise";
	let minStart = Math.max(t0 + noteStart, audioCtx.currentTime);
	
	let sourceNode, oscVibrato = null;
	if(isNoise)
		sourceNode = new AudioBufferSourceNode(audioCtx, {buffer: noiseBuffer, loop: true});
	else
		sourceNode = newToneNode(noteFreq, minStart, NaNToDefault(note.portamento, defaultNoteNode.portamento), note.freq0);
	sourceNode.onended = defOnEnded;
	generators.push(sourceNode);
	let terminalNode = sourceNode;
	
	try {
		if(isNoise) {
			let fltBandPass = new BiquadFilterNode(audioCtx, {
				type: "bandpass",
				frequency: Math.abs(noteFreq),
				//Q: 0.0625
				//Q: 0.25
				Q: 1
				//Q: 4
			});
			terminalNode.connect(fltBandPass);
			terminalNode = fltBandPass;
			sourceNode.fltBandPass = fltBandPass;
			auxNodes.push(fltBandPass);
		} else {
			//vibrato (using detune for an exponential frequency variation)
			let vibratoDepth = NaNToDefault(note.vibratoDepth, defaultNoteNode.vibratoDepth);
			let vibratoFreq = NaNToDefault(note.vibratoFreq, defaultNoteNode.vibratoFreq);
			if(vibratoFreq && vibratoDepth) {
				oscVibrato = new OscillatorNode(audioCtx, {type: "sine", frequency: vibratoFreq});
				sourceNode.oscVibrato = oscVibrato;
				oscVibrato.onended = defOnEnded;
				generators.push(oscVibrato);

				let gainVibrato = new GainNode(audioCtx, {gain: 0});
				let vibratoAttack = NaNToDefault(note.vibratoAttack, defaultNoteNode.vibratoAttack);
				if(vibratoAttack)
					gainVibrato.gain.setTargetAtTime(1200 * vibratoDepth, minStart, Math.abs(playTimeScale) * vibratoAttack * Math.LOG2E);
				else
					gainVibrato.gain.setValueAtTime(1200 * vibratoDepth, minStart);
				sourceNode.modGainVibrato = gainVibrato;
				auxNodes.push(gainVibrato);
				oscVibrato.connect(gainVibrato);
				gainVibrato.connect(sourceNode.detune);
			}
		}

		let gainDecay, gainAttack, gainRelease;
		//volume scale and decay (from vol to 0)
		//note: negative gain causes phase inversion (at least in Ffx 100)
		gainDecay = new GainNode(audioCtx, {gain: playVolScale * (note.hasOwnProperty("vol") ? note.vol : defaultNoteNode.vol)});
		let decayFactor = NaNToDefault(note.decayFactor, defaultNoteNode.decayFactor);
		//question: should decay factor be subject to playTimeScale? (currently yes)
		gainDecay.gain.setTargetAtTime(0, minStart, Math.abs(playTimeScale) * decayFactor * Math.LOG2E / Math.abs(noteFreq)); //negative time constants currently don't work
		terminalNode.connect(gainDecay);
		terminalNode = gainDecay;
		sourceNode.modGainDecay = gainDecay;
		auxNodes.push(gainDecay);
		
		//volume attack (from 0 to 1)
		let attack = NaNToDefault(note.attack, defaultNoteNode.attack);
		if(attack > 0) {
			gainAttack = new GainNode(audioCtx, {gain: 0});
			//question: should attack time be subject to noteFreq? (currently no)
			//question: should attack time be subject to playTimeScale? (currently yes)
			gainAttack.gain.setTargetAtTime(1, minStart, Math.abs(playTimeScale) * attack * Math.LOG2E);
			terminalNode.connect(gainAttack);
			terminalNode = gainAttack;
			sourceNode.modGainAttack = gainAttack;
			auxNodes.push(gainAttack);
		}
		
		if(releaseCurve) {
			//volume decay within note time
			gainRelease = new GainNode(audioCtx);
			gainRelease.gain.setValueCurveAtTime(releaseCurve, minStart, Math.abs(duration));
			terminalNode.connect(gainRelease);
			terminalNode = gainRelease;
			sourceNode.modGainRelease = gainRelease;
			auxNodes.push(gainRelease);
		}
	} finally {
		terminalNode.connect(audioCtx.destination);
		if(isNoise) {
			sourceNode.start(minStart, Math.random() * noiseBuffer.duration); //random start point
		} else {
			sourceNode.start(minStart);
		}
		sourceNode.stop(Math.max(t0 + noteStop, audioCtx.currentTime));
		if(oscVibrato) {
			oscVibrato.start(minStart);
			oscVibrato.stop(Math.max(t0 + noteStop, audioCtx.currentTime));
		}
	}
}
function enqueueNotes(tNow, tMargin) {
	if(!audioCtx) return false;
	tNow /= playTimeScale; //to do: move the divisions outside this procedure (to facilitate variable time scale)?
	tMargin /= playTimeScale;
	let tMax = tNow + tMargin;
	let note;
	//progressively enter notes
	//this procedure presumes a time-sorted array of notes
	//to do: nondestructive list traversal
	while((flatStruct.length > 0) && (flatStruct[0].noteStart <= tMax)) { //to do: review time condition when allowing reverse playback
		note = flatStruct.shift();
		//in the flattened structure, all notes must have (non-zero) frequency
		if(!note.freq) continue; //note: negative frequency is allowed
		//if(note.noteStop <= note.noteStart) continue;
		if(note.noteStop === note.noteStart) continue;
		if(note.vol === 0) continue; //negative amplitude is allowed, but zero amplitude not played
		if(note.noteStop < tNow) continue;
		try {
			renderNote(note);
		} catch(error) {
			console.error(error);
		}
	}
}

let playing = false;
let lastT = 0;
function audioTUpdate() {
	//question: trunc instead of round for time?
	if(audioCtx && elems.outAudioT) {elems.outAudioT.innerText = (audioCtx.currentTime - t0).toFixed(timeDisplPrecision);}
	if(elems.outGenCount) elems.outGenCount.innerText = generators.length.toString();
}
function drawNote(sourceNode) {
	const svgns = "http://www.w3.org/2000/svg";
	const noteVisWidth = 1 / 128; //arbitrary size
	const freqMin = 20, freqMax = 20000, octaveScale = 1 / Math.log2(freqMax / freqMin);

	let freq, isNoise;
	if(sourceNode.frequency) {
		//freq = sourceNode.frequency.value;
		freq = sourceNode.frequency.value * 2 ** (sourceNode.detune.value / 1200);
		isNoise = false;
	} else
		if(sourceNode.fltBandPass && sourceNode.fltBandPass.frequency) {
			freq = sourceNode.fltBandPass.frequency.value;
			isNoise = true;
		}
	if(!freq) return false;

	let noteShape = document.createElementNS(svgns, "rect"), wid = noteVisWidth;
	if (isNoise)
		wid *= 16; //arbitrary factor
	else
		if(sourceNode.modGainVibrato)
			wid = Math.max(wid, 4 * sourceNode.modGainVibrato.gain.value / 1200 * octaveScale);
	noteShape.setAttributeNS(null, "width", `${100 * wid}%`);
	noteShape.setAttributeNS(null, "x", `${100 * (Math.log2(Math.abs(freq) / freqMin) * octaveScale - 0.5 * wid)}%`);
	//noteShape.setAttributeNS(null, "height", "100%");
	//noteShape.setAttributeNS(null, "y", "0");

	let vol = 1;
	if(sourceNode.modGainDecay) vol *= sourceNode.modGainDecay.gain.value;
	if(sourceNode.modGainAttack) vol *= sourceNode.modGainAttack.gain.value;
	if(sourceNode.modGainRelease) vol *= sourceNode.modGainRelease.gain.value;
	noteShape.setAttributeNS(null, "opacity", Math.sqrt(Math.abs(vol)).toString());
	
	elems.imgVisualizer.appendChild(noteShape);
	//elems.imgVisualizer.append(noteShape);
}
const audioTimerInterval = 86400 * 0.5 ** 21;
//to do: variable/adaptive enqueue interval? (high note density -> smaller intervals)
function audioTimer(noEnqueue) {
	if(elems.imgVisualizer) {
		let firstChild; //visualizer: clear
		firstChild = elems.imgVisualizer.firstElementChild; //avoid deleting the <defs> element
		while(firstChild.nextElementSibling) firstChild.nextElementSibling.remove();
	}

	if(!playing || !audioCtx || !flatStruct) return false;
	//playTimeScale = NaNToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale); //to do: ?variable speed
	audioTUpdate();
	//if((flatStruct.length < 1) && (audioCtx.currentTime - t0 > songDuration)) {
	if((audioCtx.state !== 'suspended') && (audioCtx.currentTime - t0 > 0) && (generators.length < 1) && (!flatStruct || (flatStruct.length < 1))) {
		console.log("audioTimer: will stop playback.");
		stop();
		return;
	}
	if(audioCtx.state === 'closed') return;

	//visualization
	if(elems.imgVisualizer)
		for (const node of generators)
			try {
				drawNote(node);
			} catch (error) {
				console.error(error);
			}

	window.setTimeout(audioTimer, audioTimerInterval * 1000);
	if(noEnqueue === undefined) noEnqueue = false;
	let currT = audioCtx.currentTime;
	if(!noEnqueue) enqueueNotes(currT - t0, Math.max(2 * audioTimerInterval, 2 * (currT - lastT)));
	lastT = currT;
	//to do: allow skipping/fast forward/rewind?
}

//loadAndPlay() presumes that a flattened representation already exists in ctlFlatScript.innerText.
function loadAndPlay() {
	if(playing) return false;
	if(!elems.ctlFlatScript) return false;
	if(playFreqScale == 0) return false;

	//to do: allow dynamic change of playTimeScale? (very hard)
	playTimeScale = NaNToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale);
	//to do: allow reverse playback?
	if(playTimeScale <= 0) return false;
	let playTimeDelta = NaNToDefault(parseNumber(elems.txtPlayTimeDelta.value), defaultBlockNode.timeDelta);

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

	//estimate total clip duration and fills order-dependent implied noteStart
	songDuration = 0;
	let len = flatStruct.length;
	if(elems.outNoteCount) elems.outNoteCount.innerText = len.toString();
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
		songDuration = Math.max(songDuration, playTimeScale * note.noteStop);
	}
	if(elems.outAudioDur) elems.outAudioDur.innerText = songDuration.toFixed(timeDisplPrecision);
	if(len <= 0) {
		if(elems.outAudioT) elems.outAudioT.innerText = (0).toFixed(timeDisplPrecision); //question: ignore lead-in here? (currently yes)
		return false;
	}
	//lastFreq = flatStruct[0].freq; //the first note may be actually noise...
	lastFreq = 0;
	lastFreq0 = 0;
	lastNoteStart = 0;
	lastPortamento = 0;
	flatStruct.sort(function(a, b) {
		let diff = a.noteStart - b.noteStart; //earlier start
		if(diff === 0) diff = a.attack - b.attack; //quicker attack
		if(diff === 0) diff = a.noteStop - b.noteStop; //earlier stop
		return diff;
	});
	
	if(!audioCtx || (audioCtx.state === 'closed')) audioCtx = new AudioContext();
	//if(!noiseBuffer || (noiseSource.context !== audioCtx)) noiseBuffer = createNoiseBuffer();
	//to do: use Promise here to defer the rest of the procedure?
	audioCtx.suspend();
	playing = true;
	if(!noiseBuffer) noiseBuffer = createNoiseBuffer();
	//to do: currently, audio clips are expected to start at time 0. i could do a leading silence trimming if relevant.
	lastT = audioCtx.currentTime;
	t0 = lastT + playTimeDelta;
	audioTimer();
	audioCtx.resume();
	if(elems.btnPause) {
		elems.btnPause.innerHTML = "<u>P</u>ause";
		elems.btnPause.disabled = false;
	}
}

//nonreversible operation, frees resources
function stop(event) {
	console.log("Stopping...");
	for(const node of generators) {
		try {
			node.stop();
		} catch(error) {
			console.error(error);
		}
		node.disconnect();
	}
	generators = [];

	for(const node of auxNodes) node.disconnect();
	auxNodes = [];

	if(playing) audioTUpdate();
	songDuration = 0;
	playing = false;

	/*try {
		if(audioCtx) audioCtx.close();
	} catch(error) {
		console.error(error);
	}
	audioCtx = null;*/
	if(audioCtx) audioCtx.suspend(); //avoid recreating noiseBuffer for different contexts.
	t0 = 0;

	if(flatStruct) {
		flatStruct.length = 0;
		flatStruct = null;
	}

	if(elems.btnPause) elems.btnPause.innerHTML = "<u>P</u>ause";
	if((arguments.length < 1) || !event)
		if(elems.chkAutoReload && elems.chkAutoReload.checked) loadAndPlay();
}
//reversible operation
function pauseToggle() {
	if(!playing || !audioCtx) return false;
	//audioTUpdate();
	if(audioCtx.state === 'closed') return false;
	if(audioCtx.state === 'running') {
		audioCtx.suspend();
		if(elems.btnPause) elems.btnPause.innerHTML = "Un<u>p</u>ause";
	} else {
		audioCtx.resume();
		if(elems.btnPause) elems.btnPause.innerHTML = "<u>P</u>ause";
		//window.setTimeout(audioTimer, audioTimerInterval * 1000);
	}
	lastT = audioCtx.currentTime;
	audioTimer(audioCtx.state !== 'running');
}
