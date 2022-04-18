"use strict";

//variables for web audio
//to do: percussion sounds using subtractive synthesis
var audioCtx = null, oscs = [], modGains = [], t0 = 0, songDuration = 0;

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
		if(this.modGainDecay) this.modGainDecay.disconnect();
		if(this.modGainAttack) this.modGainAttack.disconnect();
		if(this.modGainRelease) this.modGainRelease.disconnect();
		this.disconnect();
	
		//remove modules from list.
		removeFrom(oscs, this);
		removeFrom(modGains, this.modGainDecay);
		removeFrom(modGains, this.modGainAttack);
		removeFrom(modGains, this.modGainRelease);	
	}
	if(oscs.length == 0) {
		stop();
		if(elems.chkAutoReload.checked) play();
	}
}

let flatStruct, playTimeScale;
//question: which one to prefer? noteStop (current choice) or duration?
function enqueueNotes(tNow, tMargin) {
	tNow /= playTimeScale; //to do: move the divisions outside this procedure (to facilitate variable time scale)?
	tMargin /= playTimeScale;
	let tMax = tNow + tMargin;
	let note, noteFreq, noteStart, noteStop, duration, osc1;
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
			
			osc1 = audioCtx.createOscillator();
			osc1.type = "sine";
			osc1.frequency.value = noteFreq;
			//osc1.detune.value = 0;
			osc1.onended = defOnEnded;
			//osc1.connect(audioCtx.destination);
			oscs.push(osc1);
			let minStart = Math.max(t0 + noteStart, audioCtx.currentTime);
			let terminalNode = osc1;
			
			try {
				let gainDecay, gainAttack, gainRelease;
				//volume scale and decay (from vol to 0)
				gainDecay = audioCtx.createGain();
				gainDecay.gain.value = playVolScale * (note.hasOwnProperty("vol") ? note.vol : defaultNoteNode.vol);
				let decayFactor = note.decayFactor;
				if(!decayFactor) decayFactor = defaultNoteNode.decayFactor;
				//question: should decay factor be subject to playTimeScale?
				gainDecay.gain.setTargetAtTime(0, minStart, playTimeScale * decayFactor * Math.LOG2E / noteFreq);
				//osc1.disconnect(audioCtx.destination);
				osc1.connect(gainDecay);
				terminalNode = gainDecay;
				osc1.modGainDecay = gainDecay;
				//gainDecay.connect(audioCtx.destination);
				modGains.push(gainDecay);
				
				//volume attack (from 0 to 1)
				gainAttack = audioCtx.createGain();
				gainAttack.gain.value = 0;
				let attack = note.attack;
				if(!attack) attack = defaultNoteNode.attack;
				//question: should attack time be subject to noteFreq?
				//question: should attack time be subject to playTimeScale?
				gainAttack.gain.setTargetAtTime(1, minStart, playTimeScale * attack * Math.LOG2E);
				//gainDecay.disconnect(audioCtx.destination);
				gainDecay.connect(gainAttack);
				terminalNode = gainAttack;
				osc1.modGainAttack = gainAttack;
				//gainAttack.connect(audioCtx.destination);
				modGains.push(gainAttack);
				
				if(releaseCurve) {
					//volume decay within note time
					gainRelease = audioCtx.createGain();
					gainRelease.gain.setValueCurveAtTime(releaseCurve, minStart, Math.abs(duration));
					//gainAttack.disconnect(audioCtx.destination);
					gainAttack.connect(gainRelease);
					terminalNode = gainRelease;
					osc1.modGainRelease = gainRelease;
					
					//gainRelease.connect(audioCtx.destination);
					modGains.push(gainRelease);
				} else {
					osc1.modGainRelease = null;
					//gainAttack.connect(audioCtx.destination);
				}
			} finally {
				terminalNode.connect(audioCtx.destination);
				osc1.start(minStart);
				osc1.stop(Math.max(t0 + noteStop, audioCtx.currentTime));
			}
		} catch(error) {
			console.error(error);
		}
	}
}

function audioTUpdate() {
	//question: trunc instead of round for time?
	if(audioCtx) {elems.outAudioT.innerText = (audioCtx.currentTime - t0).toFixed(timeDisplPrecision);}
	elems.outOscCount.innerText = oscs.length.toString();
}
const audioTimerInterval = 0.1; //to do: variable/adaptive enqueue interval? (high note density -> smaller intervals)
function audioTimer(noEnqueue) {
	if(!playing || !audioCtx || !flatStruct) return;
	//playTimeScale = nullToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale);
	audioTUpdate();
	//if((flatStruct.length < 1) && (audioCtx.currentTime - t0 > songDuration)) {
	if((audioCtx.state !== 'suspended') && (audioCtx.currentTime - t0 > 0) && (oscs.length < 1)) {
		stop();
		return;
	}
	if(audioCtx.state !== 'closed') {
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
		elems.ctlFlatScript.style.backgroundColor = "hsl(0, 100%, 75%)";
		elems.ctlFlatScript.title = error.message;
		console.error(error);
		return;
	}
	elems.ctlFlatScript.style.backgroundColor = "";
	elems.ctlFlatScript.title = "";

	//estimate total clip duration and fills order-dependent implied noteStart
	songDuration = 0;
	let len = flatStruct.length;
	elems.outNoteCount.innerText = len.toString();
	let lastNoteStop = 0;
	for(let i = 0, note; i < len; i++) {
		note = flatStruct[i];
		//in the flattened structure, all notes must have (non-zero) frequency.
		if(!note.freq) continue;
		if(note.noteStart === undefined) note.noteStart = lastNoteStop;
		if(note.noteStop === undefined) note.noteStop = note.noteStart + 1;
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
	elems.outAudioDur.innerText = songDuration.toFixed(timeDisplPrecision);
	if(len <= 0) {
		elems.outAudioT.innerText = (0).toFixed(timeDisplPrecision);
		return;
	}
	flatStruct.sort(function(a, b) {
		let diff = a.noteStart - b.noteStart; //earlier start
		if(diff === 0) diff = a.attack - b.attack; //quicker attack
		if(diff === 0) diff = a.noteStop - b.noteStop; //earlier stop
		return diff;
	});
	
	if(!audioCtx || (audioCtx.state === 'closed')) audioCtx = new AudioContext();
	//to do: use Promise here to defer the rest of the procedure?
	audioCtx.suspend();
	playing = true;
	//to do: currently, audio clips are expected to start at time 0. i could do a leading silence trimming if relevant.
	t0 = audioCtx.currentTime + playTimeDelta;
	audioTimer();
	audioCtx.resume();
	elems.btnPause.innerHTML = "<u>P</u>ause";
	elems.btnPause.disabled = false;
}

//non-reversible operation, frees resources
function stop() {
	for(const osc of oscs) {
		try {
			osc.stop();
		} catch(error) {
			console.error(error);
		}
		osc.disconnect();
	}
	oscs = [];

	for(const gain of modGains) {
		gain.disconnect();
	}
	modGains = [];

	audioTUpdate();
	songDuration = 0;
	playing = false;

	try {
		if(audioCtx) audioCtx.close();
	} catch(error) {
		console.error(error);
	}
	audioCtx = null;
	t0 = 0;

	if(flatStruct) {
		flatStruct.length = 0;
		flatStruct = null;
	}

	elems.btnPause.innerHTML = "<u>P</u>ause";
}
//reversible operation
function pauseToggle() {
	if(!playing || !audioCtx) return;
	//audioTUpdate();
	if(audioCtx.state === 'closed') return;
	if(audioCtx.state === 'running') {
		audioCtx.suspend();
		elems.btnPause.innerHTML = "Un<u>p</u>ause";
	} else {
		audioCtx.resume();
		elems.btnPause.innerHTML = "<u>P</u>ause";
		//window.setTimeout(audioTimer, audioTimerInterval * 1000);
	}
	audioTimer(audioCtx.state !== 'running');
}
