"use strict";

//to do: output to file (e.g. .opus) (try AudioContext.createMediaStreamDestination)
//to do: iterative self-filtering for subtractive synthesis?

//variables for web audio
var audioCtx = null, noiseBuffer = null;
var oscs = [], auxNodes = [];
var t0 = 0, songDuration = 0;

const noiseBufferTime = 86400 / 4096; //seconds
function createNoiseBuffer() {
	if(!audioCtx) return;
	let sampleCount = noiseBufferTime * audioCtx.sampleRate;
	let buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
	let arr = buffer.getChannelData(0);
	
	for (let i = 0; i < sampleCount; i++) {
		//to do: why not gaussian noise?
		arr[i] = 2 * Math.random() - 1;

		//test: sine wave that fades in and then out
		//arr[i] = (1 - Math.abs((i - 0.5 * sampleCount) / (0.5 * sampleCount))) * Math.sin(2 * Math.PI * 440 * i / audioCtx.sampleRate);
	}

	return buffer;
}

//finds item in arr and remove from it.
//currently an in-place operation, not functional.
function removeFrom(arr, item) {
	if(!item) return;
	let i = arr.indexOf(item);
	if(i >= 0) arr.splice(i, 1);
}

let playing = false;
function defOnEnded() {
	if(this) {
		//console.debug("Note release: " + audioCtx.currentTime);
		if(this.fltBandPass) this.fltBandPass.disconnect();
		if(this.modGainDecay) this.modGainDecay.disconnect();
		if(this.modGainAttack) this.modGainAttack.disconnect();
		if(this.modGainRelease) this.modGainRelease.disconnect();
		this.disconnect();
	
		//remove modules from list.
		removeFrom(oscs, this);
		removeFrom(auxNodes, this.fltBandPass);
		removeFrom(auxNodes, this.modGainDecay);
		removeFrom(auxNodes, this.modGainAttack);
		removeFrom(auxNodes, this.modGainRelease);
	}
	if(!audioCtx) {
		console.log("defOnEnded: will stop playback.");
		stop();
		return;
	}
	if((oscs.length == 0) && (audioCtx.currentTime - t0 > songDuration) && (!flatStruct || (flatStruct.length == 0))) stop();
}

let flatStruct, playTimeScale;//, lastFreq;
//question: which one to prefer? noteStop (current choice) or duration?
function enqueueNotes(tNow, tMargin) {
	if(!audioCtx) return;
	tNow /= playTimeScale; //to do: move the divisions outside this procedure (to facilitate variable time scale)?
	tMargin /= playTimeScale;
	let tMax = tNow + tMargin;
	let note, noteFreq, noteStart, noteStop, duration, noteTimbre, osc1;
	//progressively enter notes
	//this procedure presumes a time-sorted array of notes
	while((flatStruct.length > 0) && (flatStruct[0].noteStart <= tMax)) { //to do: review time condition when allowing reverse playback
		note = flatStruct.shift();
		//in the flattened structure, all notes must have (non-zero) frequency
		if(!note.freq) continue;
		//if(note.noteStop <= note.noteStart) continue;
		if(note.noteStop === note.noteStart) continue;
		if(note.vol === 0) continue; //negative amplitude is allowed, but zero amplitude not played
		if(note.noteStop < tNow) continue;
		try {
			noteFreq = playFreqScale * note.freq;
			noteStart = playTimeScale * note.noteStart;
			noteStop = playTimeScale * note.noteStop;
			duration = noteStop - noteStart;
			if(duration < 0) { //question: ignore negative-length notes?
				let temp = noteStart;
				noteStart = noteStop;
				noteStop = temp;
			}
			//to do: negative frequency? (check if this causes phase inversion in web audio)
			noteTimbre = note.timbre;
			if(!noteTimbre) noteTimbre = defaultNoteNode.timbre;
			let isNoise = noteTimbre.toLowerCase() === "noise";
			let minStart = Math.max(t0 + noteStart, audioCtx.currentTime);

			if(isNoise) {
				osc1 = new AudioBufferSourceNode(audioCtx);
				osc1.buffer = noiseBuffer;
				osc1.loop = true;
			} else {
				osc1 = new OscillatorNode(audioCtx, {type: "sine", frequency: noteFreq});
				/*let attack = note.attack;
				if(!attack) attack = defaultNoteNode.attack;
				//osc1 = new OscillatorNode(audioCtx, {type: "sine", frequency: 2 * noteFreq});
				osc1 = new OscillatorNode(audioCtx, {type: "sine", frequency: lastFreq});
				osc1.frequency.setTargetAtTime(noteFreq, minStart, playTimeScale * attack * Math.LOG2E); //portamento*/
			}
			osc1.onended = defOnEnded;
			oscs.push(osc1);
			let terminalNode = osc1;
			
			try {
				if(isNoise) {
					let fltBandPass = new BiquadFilterNode(audioCtx, {type: "bandpass", frequency: noteFreq});
					terminalNode.connect(fltBandPass);
					terminalNode = fltBandPass;
					osc1.fltBandPass = fltBandPass;
					auxNodes.push(fltBandPass);
				}

				let gainDecay, gainAttack, gainRelease;
				//volume scale and decay (from vol to 0)
				gainDecay = new GainNode(audioCtx, {gain: playVolScale * (note.hasOwnProperty("vol") ? note.vol : defaultNoteNode.vol)});
				let decayFactor = note.decayFactor;
				if(!decayFactor) decayFactor = defaultNoteNode.decayFactor;
				//question: should decay factor be subject to playTimeScale? (currently yes)
				gainDecay.gain.setTargetAtTime(0, minStart, playTimeScale * decayFactor * Math.LOG2E / noteFreq);
				terminalNode.connect(gainDecay);
				terminalNode = gainDecay;
				osc1.modGainDecay = gainDecay;
				auxNodes.push(gainDecay);
				
				//volume attack (from 0 to 1)
				gainAttack = new GainNode(audioCtx, {gain: 0});
				let attack = note.attack;
				if(!attack) attack = defaultNoteNode.attack;
				//question: should attack time be subject to noteFreq? (currently no)
				//question: should attack time be subject to playTimeScale? (currently yes)
				gainAttack.gain.setTargetAtTime(1, minStart, playTimeScale * attack * Math.LOG2E);
				terminalNode.connect(gainAttack);
				terminalNode = gainAttack;
				osc1.modGainAttack = gainAttack;
				auxNodes.push(gainAttack);
				
				if(releaseCurve) {
					//volume decay within note time
					gainRelease = new GainNode(audioCtx);
					gainRelease.gain.setValueCurveAtTime(releaseCurve, minStart, Math.abs(duration));
					terminalNode.connect(gainRelease);
					terminalNode = gainRelease;
					osc1.modGainRelease = gainRelease;
					auxNodes.push(gainRelease);
				} else {
					osc1.modGainRelease = null;
				}
			} finally {
				terminalNode.connect(audioCtx.destination);
				if(isNoise) {
					osc1.start(minStart, Math.random() * noiseBuffer.duration); //for noise
				} else {
					osc1.start(minStart);
					//lastFreq = noteFreq;
				}
				osc1.stop(Math.max(t0 + noteStop, audioCtx.currentTime));
			}
		} catch(error) {
			console.error(error);
		}
	}
}

function audioTUpdate() {
	//question: trunc instead of round for time?
	if(audioCtx && elems.outAudioT) {elems.outAudioT.innerText = (audioCtx.currentTime - t0).toFixed(timeDisplPrecision);}
	if(elems.outOscCount) elems.outOscCount.innerText = oscs.length.toString();
}
const audioTimerInterval = 86400 * 0.5 ** 21;
//to do: variable/adaptive enqueue interval? (high note density -> smaller intervals)
function audioTimer(noEnqueue) {
	if(elems.imgVisualizer) {
		let firstChild; //visualizer: clear
		firstChild = elems.imgVisualizer.firstElementChild; //avoid deleting the <defs> element
		while(firstChild.nextElementSibling) firstChild.nextElementSibling.remove();
	}

	if(!playing || !audioCtx || !flatStruct) return;
	//playTimeScale = nullToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale); //to do: ?variable speed
	audioTUpdate();
	//if((flatStruct.length < 1) && (audioCtx.currentTime - t0 > songDuration)) {
	if((audioCtx.state !== 'suspended') && (audioCtx.currentTime - t0 > 0) && (oscs.length < 1)) {
		console.log("audioTimer: will stop playback.");
		stop();
		return;
	}
	if((audioCtx.state !== 'closed') && playing && elems.imgVisualizer) {
		//visualization
		const svgns = "http://www.w3.org/2000/svg";
		const noteVisWidth = 1 / 128, freqMin = 20, freqMax = 20000, freqBase = 1 / Math.log2(freqMax / freqMin);
		for (const osc of oscs) {
			try {
				let freq, isNoise;
				if(osc.frequency) {
					freq = osc.frequency.value;
					isNoise = false;
				} else {
					if(osc.fltBandPass && osc.fltBandPass.frequency) {
						freq = osc.fltBandPass.frequency.value;
						isNoise = true;
					}
				}
				if(!freq) continue;
				let noteShape = document.createElementNS(svgns, "rect");
				if (isNoise) {
					noteShape.setAttributeNS(null, "width", `${100 * 16 * noteVisWidth}%`);
					noteShape.setAttributeNS(null, "x", `${100 * (Math.log2(freq / freqMin) * freqBase - 0.5 * 16 * noteVisWidth)}%`);
				} else {
					noteShape.setAttributeNS(null, "width", `${100 * noteVisWidth}%`);
					noteShape.setAttributeNS(null, "x", `${100 * (Math.log2(freq / freqMin) * freqBase - 0.5 * noteVisWidth)}%`);
				}
				//noteShape.setAttributeNS(null, "height", "100%");
				//noteShape.setAttributeNS(null, "y", "0");
				/*noteShape.x.baseVal.value = 50;
				noteShape.y.baseVal.value = 50;
				noteShape.width.baseVal.value = 50;
				noteShape.height.baseVal.value = 50;*/

				let vol = 1;
				if(osc.modGainDecay) vol *= osc.modGainDecay.gain.value;
				if(osc.modGainAttack) vol *= osc.modGainAttack.gain.value;
				if(osc.modGainRelease) vol *= osc.modGainRelease.gain.value;
				noteShape.setAttributeNS(null, "opacity", Math.sqrt(Math.abs(vol)).toString());
				
				elems.imgVisualizer.appendChild(noteShape);
				//elems.imgVisualizer.append(noteShape);
			} catch (error) {
				console.error(error);
			}
		}

		window.setTimeout(audioTimer, audioTimerInterval * 1000);
		if(noEnqueue === undefined) noEnqueue = false;
		if(!noEnqueue) enqueueNotes(audioCtx.currentTime - t0, 2 * audioTimerInterval);
		//to do: allow skipping/fast forward/rewind?
	}
}

//play() presumes that a flattened representation already exists in ctlFlatScript.innerText.
function play() {
	if(playing) return;
	if(playFreqScale <= 0) return;

	//to do: allow dynamic change of playTimeScale? (very hard)
	playTimeScale = nullToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale);
	//to do: allow reverse playback?
	if(playTimeScale <= 0) return;
	let playTimeDelta = nullToDefault(parseNumber(elems.txtPlayTimeDelta.value), defaultBlockNode.timeDelta);

	try {
		flatStruct = JSON.parse(elems.ctlFlatScript.innerText);
	} catch(error) {
		if(elems.ctlFlatScript) {
			elems.ctlFlatScript.classList.add("invalid");
			elems.ctlFlatScript.title = error.message;
		}
		console.error(error);
		return;
	}
	if(elems.ctlFlatScript) {
		elems.ctlFlatScript.classList.remove("invalid");
		elems.ctlFlatScript.title = "";
	}

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
		if(note.noteStop === undefined) {
			let dur = defaultNoteNode.duration;
			if(note.duration !== undefined) dur = note.duration;
			note.noteStop = note.noteStart + dur;
		}
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
		return;
	} /*else {
		lastFreq = flatStruct[0].freq;
	}*/
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
	t0 = audioCtx.currentTime + playTimeDelta;
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
	for(const osc of oscs) {
		try {
			osc.stop();
		} catch(error) {
			console.error(error);
		}
		osc.disconnect();
	}
	oscs = [];

	for(const node of auxNodes) {
		node.disconnect();
	}
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
	if(event === undefined)
		if(elems.chkAutoReload && elems.chkAutoReload.checked) play();
}
//reversible operation
function pauseToggle() {
	if(!playing || !audioCtx) return;
	//audioTUpdate();
	if(audioCtx.state === 'closed') return;
	if(audioCtx.state === 'running') {
		audioCtx.suspend();
		if(elems.btnPause) elems.btnPause.innerHTML = "Un<u>p</u>ause";
	} else {
		audioCtx.resume();
		if(elems.btnPause) elems.btnPause.innerHTML = "<u>P</u>ause";
		//window.setTimeout(audioTimer, audioTimerInterval * 1000);
	}
	audioTimer(audioCtx.state !== 'running');
}
