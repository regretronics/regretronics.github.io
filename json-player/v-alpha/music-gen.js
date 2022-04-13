const defaultFreq = 440;

//makes a simple interval by introducing a random prime factor up or down one unit
function addInterval(refFreq, targetFreq) {
	//to do: weighted random on factor selection?
	let iPrime = Math.floor(primeCount * Math.random());
	let sign = Math.random() >= 0.5 ? 1 : -1;
	Object.assign(targetFreq, refFreq);
	targetFreq[primes[iPrime]] += sign;
	//pitch normalization into factor 2, i.e. octave normalization, except when changing the very octave on purpose
	//to do: round()? floor()?
	if(iPrime >= 1) {targetFreq[2] -= sign * Math.round(Math.log2(primes[iPrime]));}
}

function makeChord() {
	let voiceCount = parseInt(elems.txtVoices.value);
	let struct = {
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
	//will be played melodically, with two-note superposition (which is why volRatio: 0.5)
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
	flattenStruct();
}

//this procedure presumes that rhythmFactors and rhythmFactorsAccum are properly filled
function makeRhythm() {
	//to do: use the rhythm hierarchy
	//number of notes: 25% to 99.99...% of bar length (beat count)
	let noteCount = Math.floor((0.25 + 0.75 * Math.random()) * rhythmFactorsAccum[0]);
	if((rhythmFactorsAccum[0] >= 3) && (noteCount < 2)) {noteCount = 2;}

	let pattern = [{freq: 0.5, noteStart: 0, duration: rhythmFactorsAccum[0]}]; //bass note for bar scale
	for(let x = 0; x < noteCount; x++) { //first let's meet the number of notes
		pattern.push({noteStart: 0, duration: 1});
	}
	for(let x = rhythmFactorsAccum[0] - noteCount; x > 0; x--) {
		//increment the duration of some random notes until total length is met
		pattern[Math.floor(Math.random() * noteCount) + 1].duration++;
	}
	let y = 0;
	//now that the durations are known, adjust note start sequentially
	for(let x = 0; x < noteCount; x++) {
		//remember note #0 is the bass one
		pattern[x + 1].noteStart = y;
		y += pattern[x + 1].duration;
	}
	let _timeScale = nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let struct = {
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq),
		volRatio: 0.5,
		timeScale: _timeScale,
		decayFactor: defaultBlockNode.decayFactor * _timeScale * rhythmFactorsAccum[0], //lengthier bars = more sustain
		pat: pattern
	};
	let barCount = parseFloat(elems.txtPatterns.value);
	for(let x = 0; x < barCount; x++) {
		struct[x] = {timeDelta: x * rhythmFactorsAccum[0]};
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
	flattenStruct();
}

//variability per prime factor (2, 3, 5, 7, ...)
let maxPitches = null;

//recursive call
function melodyVoice(_struct, index, timeScale, voiceDepth) {
	if(voiceDepth < 1) return;
	//factor selection (must be >= 1, to exclude factor 2)
	//let p = 1 + Math.floor((primeCount - 1) * Math.random());
	//let p = Math.min(1 + Math.floor(- 2 * Math.log2(Math.random())), primeCount - 1);
	let p;
	if(index === 0) {
		//conservative choice for strong (index #0) beats
		//to do: consider other calculations?
		p = Math.floor((0.5 * primeCount) ** Math.random());
	} else {
		p = Math.floor(primeCount ** Math.random());
	}
	let sign = Math.random() >= 0.5 ? 1 : -1; //to do: should they only go downwards? (because the root factors only went upwards)

	let newStruct = {
		freq: Object.assign({}, _struct.freq),
		timeDelta: timeScale * index,
		noteStart: 0,
		duration: timeScale
	};
	let newExp = newStruct.freq[primes[p]] + sign;
	//bounds (tonality) check
	//to do: + 1 should be + 0.5?
	if((newExp < 0) || (newExp > maxPitches[p] + 1)) {sign *= -1;}
	newStruct.freq[primes[p]] += sign;
	//pitch normalization into factor 2, i.e. octave normalization
	if(p >= 1) {
		//octave comparison for overall normalization
		let diff = Math.round(Math.log2(parseNumber(_struct.freq))) - Math.round(Math.log2(parseNumber(newStruct.freq)));
		newStruct.freq[2] += diff;
	}
	//index 0 -> new voice level -> one octave up
	if(index === 0) {newStruct.freq[2] += 1;}
	
	if(voiceDepth > 1) {
		//upper voice in double speed
		//the first beat is a reference for the pitch of others.
		newStruct[0] = melodyVoice(newStruct, 0, timeScale * 0.5, voiceDepth - 1);
		newStruct[1] = melodyVoice(newStruct[0], 1, timeScale * 0.5, voiceDepth - 1);
	}
	return newStruct;
}

//to do: allow more arbitrary rhythms, e.g. 2*2*3
function makeMelody() {
	let patCount = parseFloat(elems.txtPatterns.value);
	if(patCount <= 0) return;
	let voiceCount = parseInt(elems.txtVoices.value);
	if(voiceCount < 1) return;
	let repPeriod = parseInt(elems.txtRepPeriod.value);
	if(repPeriod <= 0) return;
	let repeatCount = parseInt(elems.txtRepCount.value);
	if(repeatCount <= 0) return;

	//top-level node
	let _timeScale = nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let barDuration = 2 ** (voiceCount - 1);
	let struct = {
		//lots of voices? let's start a few octaves down
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq) * 0.5 ** Math.floor(voiceCount * 0.5),
		volRatio: "1/" + voiceCount.toString(), //inverse of maximum polyphony to avoid clipping
		timeScale: _timeScale,
		decayFactor: defaultBlockNode.decayFactor * _timeScale * barDuration //lengthier bars = more sustain
	};
	//build table of exponent variance per prime factor (tonality limitation: high factors are too odd, and should have low exponents)
	//to do: too simple? should it depend on primeCount? should it have an extra parameter?
	if(maxPitches === null) {
		maxPitches = new Array(primes.length);
		for(let i in primes) {
			maxPitches[i] = 3 / Math.log2(primes[i]);
		}
	}

	//make various patterns of notes
	for(let x = 0; x < /*repeatCount **/ patCount; x++) {
		//randomize an initial note
		let pattern = {
			freq: {},
			noteStart: 0,
			duration: barDuration
		};
		let product = 1;
		for(let p = 1; p < primeCount; p++) {
			//currently the factors can only go upwards
			//to do: signed (bipolar) random is possibly better
			//  to do: in such case, use round() instead of floor()?
			let y = Math.floor((maxPitches[p] + 1) * Math.random());
			pattern.freq[primes[p]] = y;
			product *= primes[p] ** y;
		}
		//multiply the primes and balance factor 2 (octave normalization)
		pattern.freq[2] = - Math.round(Math.log2(product));
		
		if(voiceCount > 1) {
			pattern[0] = melodyVoice(pattern, 0, 0.5 * barDuration, voiceCount - 1);
			pattern[1] = melodyVoice(pattern[0], 1, 0.5 * barDuration, voiceCount - 1);
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
					timeDelta: barDuration * barPos
				};
				//struct[x][0] = "pat" + x.toString();
				//struct[x].timeDelta = barDuration * x;
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
	flattenStruct();
}
