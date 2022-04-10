const defaultFreq = 440;

//makes a simple interval by introducing a random prime factor up or down one unit
function addInterval(refFreq, targetFreq) {
	let iPrime = Math.floor(primeCount * Math.random());
	let sign = Math.random() >= 0.5 ? 1 : -1;
	Object.assign(targetFreq, refFreq);
	targetFreq[primes[iPrime]] += sign;
	//pitch normalization into factor 2, i.e. octave normalization
	//to do: round? floor?
	if(iPrime > 0) {targetFreq[2] -= sign * Math.round(Math.log2(primes[iPrime]));}
}

function makeChord() {
	let voiceCount = parseInt(elems.txtVoices.value);
	struct = {
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq),
		timeScale: nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale),
		volRatio: 0.5,
		0: {freq: {}}
	};
	//initialize prime factors (first note is always neutral)
	for(let i = 0; i < primeCount; i++) {
		struct[0].freq[primes[i]] = 0;
	}
	for(let i = 1; i < voiceCount; i++) {
		//each note is based on a random previous note
		struct[i] = {freq: {}};
		addInterval(struct[Math.floor(i * Math.random())].freq, struct[i].freq);
	}
	//will be played melodically
	for(let i = 0; i < voiceCount; i++) {
		struct[i].noteStart = i;
		struct[i].duration = 2;
	}

	let s = JSON.stringify(struct, null, "\t");
	//final adjustments on indentation
	let regex = new RegExp(/\{\n\t{3,}/, "g"); //too much indentation will collapse to space
	s = s.replace(regex, "{");
	regex = new RegExp(/\n\t{3,}/, "g");
	s = s.replace(regex, " ");
	regex = new RegExp(/\n\t{2,}\}/, "g");
	s = s.replace(regex, "}");
	elems.ctlStructuredScript.innerText = s;
	parseScript();
}

function makeRhythm() {
	//number of beats as a product of (random) prime factors
	let signature = {};
	signature.beats = 1;
	for(let i = 0, y; i < primeCount; i++) {
		y = Math.floor(- 2 * Math.log(Math.random()) / primes[i]);
		signature[primes[i]] = y;
		signature.beats *= Math.pow(primes[i], y);
	}
	//if the number of beats is still small
	if(signature.beats == 1) {
		let x = Math.random();
		x = Math.floor(primeCount * x * x);
		signature[primes[x]]++;
		signature.beats *= primes[x];
	}
	if(signature.beats < 2) {signature.beats = 2;}
	
	let noteCount = Math.floor((0.25 + 0.75 * Math.random()) * signature.beats);
	if(noteCount < 2) {noteCount = 2;}
	let pattern = [{freq: 0.5, noteStart: 0, duration: signature.beats}]; //bass note for bar scale
	for(let x = 0; x < noteCount; x++) {
		pattern.push({noteStart: 0, duration: 1});
	}
	for(let x = signature.beats - noteCount; x > 0; x--) {
		pattern[Math.floor(Math.random() * noteCount) + 1].duration++;
	}
	let y = 0;
	for(let x = 0; x < noteCount; x++) {
		pattern[x + 1].noteStart = y;
		y += pattern[x + 1].duration;
	}
	struct = {
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq),
		volRatio: 0.5,
		timeScale: nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale),
		pat: pattern
	};
	let barCount = parseFloat(elems.txtPatterns.value);
	for(let x = 0; x < barCount; x++) {
		struct[x] = {timeDelta: x * signature.beats};
		struct[x][0] = "pat";
	}
	
	let s = JSON.stringify(struct, null, "\t");
	//final adjustments on indentation
	/*let regex = new RegExp(/\{\n\t{3,}/, "g"); //too much indentation will collapse to space
	s = s.replace(regex, "{");
	regex = new RegExp(/\n\t{3,}/, "g");
	s = s.replace(regex, " ");
	regex = new RegExp(/\n\t{2,}\}/, "g");
	s = s.replace(regex, "}");*/
	regex = new RegExp(/(\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	do {
		let t = s.replace(regex, "$1 ");
		if(t == s) break;
		s = t;
	} while(true);
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	s = s.replace(regex, "\{$1\}");
	elems.ctlStructuredScript.innerText = s;
	parseScript();
}

//variability per prime factor (2, 3, 5, 7, 11)
//to do: soft-code this. i will need more sophistication.
const maxPitches = [5, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

//recursive call
function melodyVoice(_struct, index, timeScale, voiceDepth) {
	if(voiceDepth < 1) return;
	let p = 1 + Math.floor((primeCount - 1) * Math.random());
	let sign = Math.random() >= 0.5 ? 1 : -1;

	let newStruct = {
		freq: Object.assign({}, _struct.freq),
		timeDelta: timeScale * index,
		noteStart: 0,
		duration: timeScale
	};
	let newExp = newStruct.freq[primes[p]] + sign;
	//bounds (tonality) check
	if((newExp < 0) || (newExp > maxPitches[p])) {sign *= -1;}
	newStruct.freq[primes[p]] += sign;
	//pitch normalization into factor 2, i.e. octave normalization
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
	let patCount = parseFloat(elems.txtPatterns.value);
	if(patCount <= 0) return;
	let voiceCount = parseInt(elems.txtVoices.value);
	if(voiceCount <= 0) return;
	let repPeriod = parseInt(elems.txtRepPeriod.value);
	if(repPeriod <= 0) return;
	let repeatCount = parseInt(elems.txtRepCount.value);
	if(repeatCount <= 0) return;

	//top-level node
	//struct = {freqRatio: 660, volRatio: "1/" + voiceCount};
	//struct = {freqRatio: 160, volRatio: "1/" + voiceCount, timeScale: parseFloat(elems.txtTimeScale.value)};
	struct = {
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq) * 0.5 ** Math.floor(voiceCount * 0.5),
		volRatio: "1/" + voiceCount.toString(),
		timeScale: nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale)
	};
	//make various patterns of notes
	for(let x = 0; x < /*repeatCount **/ patCount; x++) {
		//randomize an initial note
		//let pattern = {freq: {}, timeDelta: 4 * x, noteStart: 0, duration: 2 ** (voiceCount - 1)};
		let pattern = {
			freq: {},
			noteStart: 0,
			duration: 2 ** (voiceCount - 1)
		};
		let product = 1;
		for(let p = 1; p < primeCount; p++) {
			let y = Math.floor((maxPitches[p] + 1) * Math.random());
			pattern.freq[primes[p]] = y;
			product *= primes[p] ** y;
		}
		//multiply the primes and balance factor 2 (octave normalization)
		pattern.freq[2] = - Math.round(Math.log2(product));
		
		if(voiceCount > 1) {
			pattern[0] = melodyVoice(pattern, 0, 2 ** (voiceCount - 2), voiceCount - 1);
			pattern[1] = melodyVoice(pattern[0], 1, 2 ** (voiceCount - 2), voiceCount - 1);
		}
		
		//struct[x] = pattern;
		struct["pat" + x.toString()] = pattern;
	}
	//make pattern instances referring to existing patterns
	for(let x = 0, iPat, barPos; x < Math.ceil(patCount / repPeriod); x++) {
	//for(let x = 0; x < patCount; x++) {
		for(let y = 0; y < repeatCount; y++) {
			for(let z = 0; (z < repPeriod) && ((iPat = x * repPeriod + z) < patCount); z++) {
				barPos = (x * repeatCount + y) * repPeriod + z;
				struct[barPos] = {
					0: "pat" + iPat.toString(),
					timeDelta: 2 ** (voiceCount - 1) * barPos
				};
				//struct[x][0] = "pat" + x.toString();
				//struct[x].timeDelta = 2 ** (voiceCount - 1) * x;
			}
		}
	}

	let s = JSON.stringify(struct, null, "\t");
	//final adjustments on indentation
	regex = new RegExp(/(\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	do {
		let t = s.replace(regex, "$1 ");
		if(t == s) break;
		s = t;
	} while(true);
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	s = s.replace(regex, "\{$1\}");
	elems.ctlStructuredScript.innerText = s;
	parseScript();
}
