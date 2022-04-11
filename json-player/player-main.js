//variables for web audio
var audioCtx = null, oscs = [], gains = [];

//finds item in arr and remove from it.
//currently an in-place operation, not functional.
function removeFrom(arr, item) {
	if(!item) return;
	let i = arr.indexOf(item);
	if(i >= 0) {arr.splice(i, 1);}
}

var playing = false;
function defOnEnded() {
	//remove modules from list.
	//console.debug("Note release: " + audioCtx.currentTime);
	removeFrom(oscs, this);
	removeFrom(gains, this.assocGain1);
	removeFrom(gains, this.assocGain2);
	removeFrom(gains, this.assocGain3);
	if(oscs.length == 0) {stop();}
}

const audioTimerInterval = 0.1 * 1000;
function audioTimer() {
	if(!playing || !audioCtx) return;
	elems.outAudioT.innerText = audioCtx.currentTime.toFixed(timeDisplPrecision);
	if(audioCtx.state !== 'closed') {window.setTimeout(audioTimer, audioTimerInterval);}
}

var songDuration;
//play() assumes that a flattened representation already exists in ctlFlatScript.innerText.
function play() {
	if(playing) return;
	let playFreqScale = nullToDefault(parseNumber(elems.txtPlayFreqScale.value), defaultBlockNode.freqRatio);
	if(playFreqScale <= 0) return;
	let playVolScale = nullToDefault(parseNumber(elems.txtPlayVolScale.value), defaultBlockNode.volRatio);
	if(playVolScale < 0) return;
	let playTimeScale = nullToDefault(parseNumber(elems.txtPlayTimeScale.value), defaultBlockNode.timeScale);
	//to do: allow reverse playback?
	if(playTimeScale <= 0) return;
	let playTimeDelta = nullToDefault(parseNumber(elems.txtPlayTimeDelta.value), defaultBlockNode.timeDelta);
	let flatStruct = JSON.parse(elems.ctlFlatScript.innerText);

	songDuration = 0;
	if(!audioCtx) {audioCtx = new AudioContext();}
	//to do: use Promise here to defer the rest of the procedure?
	audioCtx.suspend();
	playing = true;

	let t0 = audioCtx.currentTime + playTimeDelta;
	//to do: ?progressively enter notes
	//  to do: sort array by notestart (leave for later?)
	//let iStart = 0, iStop = 0;
	let len = flatStruct.length;
	for(let i = 0, note, noteFreq, noteStart, noteStop, osc1, gain1, gain2, gain3; i < len; i++) {
		note = flatStruct[i];
		//in the flattened structure, all notes must have frequency.
		if(!note.freq) continue;
		noteFreq = playFreqScale * note.freq;
		noteStart = playTimeScale * note.noteStart;
		noteStop = playTimeScale * note.noteStop;
		if(noteStop <= noteStart) continue;
		//to do: negative frequency? negative volume? (check if web audio supports phase inversion)

		osc1 = audioCtx.createOscillator();
		oscs.push(osc1);
		osc1.type = "sine";
		osc1.frequency.value = noteFreq;
		osc1.onended = defOnEnded;

		//volume scale and decay (from vol to 0)
		gain1 = audioCtx.createGain();
		gains.push(gain1);
		gain1.gain.value = playVolScale * (note.hasOwnProperty("vol") ? note.vol : defaultNoteNode.vol);
		let decayFactor = note.decayFactor;
		if(!decayFactor) decayFactor = defaultNoteNode.decayFactor;
		//to do: should decay factor be subject to playTimeScale?
		gain1.gain.setTargetAtTime(0, t0 + noteStart, decayFactor / noteFreq);
		osc1.connect(gain1);
		osc1.assocGain1 = gain1;
		
		//volume attack (from 0 to 1)
		gain2 = audioCtx.createGain();
		gains.push(gain2);
		gain2.gain.value = 0;
		let attack = note.attack;
		if(!attack) attack = defaultNoteNode.attack;
		//to do: should attack time be subject to playTimeScale?
		gain2.gain.setTargetAtTime(1, t0 + noteStart, playTimeScale * attack);
		gain1.connect(gain2);
		osc1.assocGain2 = gain2;
		
		if(noteStop > noteStart) {
			//volume decay within note time
			//to do: review this (may be wrong)
			gain3 = audioCtx.createGain();
			gains.push(gain3);
			gain3.gain.setValueCurveAtTime(releaseCurve, t0 + noteStart, noteStop - noteStart);
			gain2.connect(gain3);
			osc1.assocGain3 = gain3;

			gain3.connect(audioCtx.destination);
		} else {
			osc1.assocGain3 = null;
			gain2.connect(audioCtx.destination);
		}
		
		//osc1.start(t0 + noteStart, 0, t0 + noteStop);
		osc1.start(t0 + noteStart);
		osc1.stop(t0 + noteStop);
		songDuration = Math.max(songDuration, t0 + noteStop);
	}
	audioCtx.resume();
	outAudioDur.innerText = songDuration.toFixed(timeDisplPrecision);
	audioTimer();
}
function stop() {
	if(audioCtx) {elems.outAudioT.innerText = audioCtx.currentTime.toFixed(timeDisplPrecision);}
	for(const osc of oscs) {
		osc.stop();
		osc.disconnect();
	}
	oscs = [];
	for(const gain of gains) {
		gain.disconnect();
	}
	gains = [];
	playing = false;
	audioCtx.close();
	audioCtx = null;
	elems.btnPause.innerHTML = "<u>P</u>ause";
}
function pauseToggle() {
	if(!playing || !audioCtx) return;
	elems.outAudioT.innerText = audioCtx.currentTime.toFixed(timeDisplPrecision);
	if(audioCtx.state === 'closed') return;
	if(audioCtx.state === 'running') {
		audioCtx.suspend();
		elems.btnPause.innerHTML = "Un<u>p</u>ause";
	} else {
		audioCtx.resume();
		elems.btnPause.innerHTML = "<u>P</u>ause";
		window.setTimeout(audioTimer, audioTimerInterval);
	}
}
