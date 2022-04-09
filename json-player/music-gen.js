//to do: primeCount probably should be a parameter
const primeCount = 4, defaultFreq = 440;

function addInterval(refFreq, targetFreq) {
	let iPrime = Math.floor(primeCount * Math.random());
	let sign = Math.random() >= 0.5 ? 1 : -1;
	Object.assign(targetFreq, refFreq);
	targetFreq[primes[iPrime]] += sign;
	//to do: round? floor?
	if(iPrime > 0) {targetFreq[2] -= sign * Math.round(Math.log2(primes[iPrime]));}
}

function makeChord() {
	let voiceCount = parseInt(txtVoices.value);
	
	struct = {
		freqRatio: nullToDefault(parseNumber(txtFreq.value), defaultFreq),
		timeScale: nullToDefault(parseNumber(txtTimeScale.value), defaultTimeScale),
		volRatio: 0.5,
		0: {freq: {2: 0, 3: 0, 5: 0, 7: 0}}
	};
	for(let i = 1; i < voiceCount; i++) {
		struct[i] = {freq: {}};
		addInterval(struct[Math.floor(i * Math.random())].freq, struct[i].freq);
	}
	for(let i = 0; i < voiceCount; i++) {
		struct[i].noteStart = i;
		struct[i].duration = 2;
	}

	let s = JSON.stringify(struct, null, "\t");
	//final adjustments on indentation
	let regex = new RegExp(/\n\t{3,}/, "g");
	s = s.replace(regex, " ");
	regex = new RegExp(/\n\t{2,}\}/, "g");
	s = s.replace(regex, "}");
	ctlStructuredScript.innerText = s;
	parseScript();
}

function makeRhythm() {
	let signature = {2: 0, 3: 0, 5: 0, 7: 0};
	signature.beats = 1;
	for(let i = 0, y; i < 4; i++) {
		y = Math.floor(- 2 * Math.log(Math.random()) / primes[i]);
		signature[primes[i]] = y;
		signature.beats *= Math.pow(primes[i], y);
	}
	//if the number of beats is still small
	if(signature.beats == 1) {
		let x = Math.random();
		x = Math.floor(4 * x * x);
		signature[primes[x]]++;
		signature.beats *= primes[x];
	}
	if(signature.beats < 2) {signature.beats = 2;}
	
	let noteCount = Math.floor((0.25 + 0.75 * Math.random()) * signature.beats);
	if(noteCount < 2) {noteCount = 2;}
	let bar = [{freq: 0.5, noteStart: 0, duration: signature.beats}];
	for(let x = 0; x < noteCount; x++) {
		bar.push({noteStart: 0, duration: 1});
	}
	for(let x = signature.beats - noteCount; x > 0; x--) {
		bar[Math.floor(Math.random() * noteCount) + 1].duration++;
	}
	let y = 0;
	for(let x = 0; x < noteCount; x++) {
		bar[x + 1].noteStart = y;
		y += bar[x + 1].duration;
	}
	struct = {
		freqRatio: nullToDefault(parseNumber(txtFreq.value), defaultFreq),
		volRatio: 0.5,
		timeScale: nullToDefault(parseNumber(txtTimeScale.value), defaultTimeScale),
		bar: bar
	};
	//struct.bar = bar;
	let barCount = parseFloat(txtBars.value);
	for(let x = 0; x < barCount; x++) {
		struct[x] = {timeDelta: x * signature.beats};
		struct[x][0] = "bar";
	}
	
	let s = JSON.stringify(struct, null, "\t");
	ctlStructuredScript.innerText = s;
	parseScript();
}

//variability per prime factor (2, 3, 5, 7, 11)
const maxPitches = [5, 2, 1, 1, 0];

//recursive call
function melodyVoice(_struct, index, timeScale, voiceDepth) {
	if(voiceDepth < 1) {return;}
	let newStruct = {
		freq: Object.assign({}, _struct.freq),
		timeDelta: timeScale * index,
		noteStart: 0,
		duration: timeScale};
	let p = 1 + Math.floor((primeCount - 1) * Math.random());
	let sign = Math.random() >= 0.5 ? 1 : -1;
	let newExp = newStruct.freq[primes[p]] + sign;
	//bounds (tonality) check
	if((newExp < 0) || (newExp > maxPitches[p])) {sign *= -1;}
	newStruct.freq[primes[p]] += sign;
	newStruct.freq[2] -= sign * Math.round(Math.log2(primes[p]));
	//one octave up
	if(index == 0) {newStruct.freq[2] += 1;}
	
	if(voiceDepth > 1) {
		//upper voice in double speed
		newStruct[0] = melodyVoice(newStruct, 0, timeScale * 0.5, voiceDepth - 1);
		newStruct[1] = melodyVoice(newStruct[0], 1, timeScale * 0.5, voiceDepth - 1);
	}
	return newStruct;
}

function makeMelody() {
	let barCount = parseFloat(txtBars.value);
	let voiceCount = parseInt(txtVoices.value);
	let repPeriod = parseInt(txtRepPeriod.value);
	let repeatCount = parseInt(txtRepCount.value);

	//struct = {freqRatio: 660, volRatio: "1/" + voiceCount};
	//struct = {freqRatio: 160, volRatio: "1/" + voiceCount, timeScale: parseFloat(txtTimeScale.value)};
	struct = {
		freqRatio: nullToDefault(parseNumber(txtFreq.value), defaultFreq) / 2 ** Math.floor(voiceCount / 2),
		volRatio: "1/" + voiceCount.toString(),
		timeScale: nullToDefault(parseNumber(txtTimeScale.value), defaultTimeScale)
	};
	for(let x = 0; x < /*repeatCount **/ barCount; x++) {
		//randomize an initial note
		//let bar = {freq: {2: 0, 3: 0, 5: 0, 7: 0}, timeDelta: 4 * x, noteStart: 0, duration: 2 ** (voiceCount - 1)};
		let bar = {
			freq: {2: 0, 3: 0, 5: 0, 7: 0},
			noteStart: 0,
			duration: 2 ** (voiceCount - 1)
		};
		let product = 1;
		for(let p = 1; p < primeCount; p++) {
			let y = Math.floor((maxPitches[p] + 1) * Math.random());
			bar.freq[primes[p]] = y;
			product *= primes[p] ** y;
		}
		//multiply the primes and balance factor 2
		bar.freq[2] = - Math.round(Math.log2(product));
		
		if(voiceCount > 1) {
			bar[0] = melodyVoice(bar, 0, 2 ** (voiceCount - 2), voiceCount - 1);
			bar[1] = melodyVoice(bar[0], 1, 2 ** (voiceCount - 2), voiceCount - 1);
		}
		
		//struct[x] = bar;
		struct["bar" + x.toString()] = bar;
	}
	for(let x = 0; x < Math.ceil(barCount / repPeriod); x++) {
	//for(let x = 0; x < barCount; x++) {
		for(let y = 0; (y < repeatCount); y++) {
			for(let z = 0; (z < repPeriod) && (x * repPeriod + z < barCount); z++) {
				struct[(x * repeatCount + y) * repPeriod + z] = {
					0: "bar" + (x * repPeriod + z).toString(),
					timeDelta: 2 ** (voiceCount - 1) * ((x * repeatCount + y) * repPeriod + z)
				};
				//struct[x][0] = "bar" + x.toString();
				//struct[x].timeDelta = 2 ** (voiceCount - 1) * x;
			}
		}
	}

	let s = JSON.stringify(struct, null, "\t");
	//final adjustments on indentation
	let regex = new RegExp(/\n\t{5,}/, "g");
	s = s.replace(regex, " ");
	regex = new RegExp(/\n\t{4,}\}/, "g");
	s = s.replace(regex, "}");
	ctlStructuredScript.innerText = s;
	parseScript();
}
