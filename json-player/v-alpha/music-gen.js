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
function newChord(voiceCount, polyphony) {
	let chordStruct = {
		0: {freq: {}}
	};
	//initialize prime factors (first note is always neutral)
	for(let i = 0; i < primeCount; i++) {
		chordStruct[0].freq[primes[i]] = 0;
	}
	for(let i = 1; i < voiceCount; i++) {
		//each note is based on a random previous note
		chordStruct[i] = {freq: {}};
		addInterval(chordStruct[Math.floor(i * Math.random())].freq, chordStruct[i].freq);
	}
	//will be played melodically (if played harmonically, note order would be lost)
	for(let i = 0; i < voiceCount; i++) {
		chordStruct[i].noteStart = i;
		chordStruct[i].duration = polyphony;
	}
	return chordStruct;
}
function makeChords() {
	if(primeCount < 2) return;
	let patCount = parseFloat(elems.txtPatternCount.value);
	if(patCount <= 0) return;
	let voiceCount = parseInt(elems.txtVoiceCount.value);
	if(voiceCount < 2) return;
	
	let polyphony = 2; //two-note superposition
	let _timeScale = nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let rootStruct = {
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq),
		timeScale: _timeScale,
		volRatio: 1 / polyphony,
		decayFactor: defaultBlockNode.decayFactor * _timeScale * polyphony
	};

	for(let i = 0; i < patCount; i++) {
		rootStruct[i] = newChord(voiceCount, polyphony); //to do: note comparison to avoid duplicates
		//rootStruct[i].timeDelta = voiceCount * i;
		rootStruct[i].timeDelta = (voiceCount - 1 + polyphony) * i;
	}

	let s = JSON.stringify(rootStruct, null, "\t");
	//final adjustments on indentation
	let regex = new RegExp(/\{\n\t{3,}/, "g"); //too much indentation will collapse to space
	s = s.replace(regex, "{");
	regex = new RegExp(/\n\t{3,}/, "g");
	s = s.replace(regex, " ");
	regex = new RegExp(/\n\t{2,}\}/, "g");
	s = s.replace(regex, "}");
	setStructuredText(s);
}

//rhythm structure generator
function makeRhythmFactors() {
	if(primeCount < 1) return;
	rhythmFactors = [];
	let scale = nullToDefault(parseNumber(elems.txtRhythmScale.value), 4);
	//let product = 1;
	//builds a (random) product of prime factors
	//generate in reverse order (starting from high primes), and then use the lower ones in a complementary fashion
	for(let i = primeCount - 1, factor, y; i >= 0; i--) {
		factor = primes[i];
		if(factor > scale) continue; //ignore primes that are too large
		let maxExp = Math.log(scale) / Math.log(factor);
		//y = Math.floor(- 2 * Math.log(Math.random()) / factor);
		y = Math.floor((maxExp + 0.5) * Math.random());
		//if(y >= 1) rhythmFactors.unshift(Math.pow(factor, y));
		for(let j = 0; j < y; j++) {
			rhythmFactors.unshift(factor);
			scale /= factor;
			//product *= factor;
		}
	}
	//the number of beats might be still small
	if(rhythmFactors.length < 1) {
		if(scale >= 2) {
			let x;
			do {
				x = Math.random();
				x = primes[Math.floor(primeCount * x * x)];
			} while(x > scale);
			rhythmFactors.push(x);
		} else {
			rhythmFactors.push(1); //at least factor one
		}
	}

	elems.txtRhythmFactors.value = rhythmFactors.join("*");
	rhythmAccumUpdate();
}

//the rhythm generator presumes that rhythmFactors and rhythmFactorsAccum are properly filled
//recursive call
function rhythmSubNodes(struct, level) {
	if(level >= rhythmFactors.length) return;
	let beats = rhythmFactors[level - 1];
	let scale = rhythmFactorsAccum[level];
	let subNodePattern = {
		timeDelta: 0, //make it appear early in JSON, defer filling
		freqRatio: beats,
		volRatio: "1/" + beats,

		noteStart: 0, //to do: remove this? (currently required for notes)
		duration: 0
	};
	//when using non-integer measures, sub-bars may become non-uniform in number of beats
	let beats2 = struct.duration / scale;
	for(let i = 0; i < beats2; i++) {
		let newNode = {};
		struct[i] = newNode;
		Object.assign(newNode, subNodePattern);
		newNode.timeDelta = i * scale;
		let crumb = Math.min(1, beats2 - i); //the last beat may have a fraction of the normal duration
		newNode.duration = scale * crumb;
		if(crumb !== 1) newNode.freq = "1/" + crumb.toString();
		rhythmSubNodes(newNode, level + 1);
	}
}
function makeRhythm() {
	let repeatCount = parseInt(elems.txtReptCount.value);
	if(repeatCount <= 0) return;

	//number of notes: 25% to 99.99...% of bar length (beat count)
	let noteCount = Math.floor((0.25 + 0.75 * Math.random()) * rhythmFactorsAccum[0]);
	if((rhythmFactorsAccum[0] >= 3) && (noteCount < 2)) {noteCount = 2;}

	let pattern = [{ //rhythm formula root block and note
		freqRatio: "1/" + rhythmFactorsAccum[0].toString(),
		//volRatio: 1,

		noteStart: 0, //to do: remove this? (currently required for notes)
		duration: rhythmFactorsAccum[0]
	}];
	rhythmSubNodes(pattern[0], 1);

	for(let x = 0; x < noteCount; x++) { //first let's meet the number of notes
		pattern.push({noteStart: 0, duration: 1, vol: 0.25});
	}
	if(noteCount >= 1) {
		let x;
		for(x = rhythmFactorsAccum[0] - noteCount; x >= 1; x--) {
			//increment the duration of some random notes until total length is met
			pattern[Math.floor(Math.random() * noteCount) + 1].duration++;
		}
		//fraction of a beat?
		if(x !== 0) pattern[Math.floor(Math.random() * noteCount) + 1].duration += x;
	}

	//now that the durations are known, adjust note start sequentially
	for(let x = 0, y = 0; x < noteCount; x++) {
		//remember note #0 is the regular block
		pattern[x + 1].noteStart = y;
		y += pattern[x + 1].duration;
	}

	let _timeScale = nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let rootStruct = {
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq),
		volRatio: 0.25, //to do: calculate maximum volume
		timeScale: _timeScale,
		decayFactor: defaultBlockNode.decayFactor * _timeScale * rhythmFactorsAccum[0], //lengthier bars = more sustain

		pat: pattern
	};
	for(let x = 0; x < repeatCount; x++) {
		rootStruct[x] = {timeDelta: x * rhythmFactorsAccum[0], 0: "pat"};
	}
	
	let s = JSON.stringify(rootStruct, null, "\t");
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
	setStructuredText(s);
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
		//conservative choice for strong (#0) beats
		//to do: consider other calculations? allow factor 2 here?
		p = Math.floor((0.5 * primeCount) ** Math.random());
	} else {
		p = Math.floor(primeCount ** Math.random());
	}
	let sign = Math.random() >= 0.5 ? 1 : -1; //to do: should they only go downwards? (because the root factors only went upwards)

	let subNode = {
		timeDelta: timeScale * index,

		noteStart: 0, //to do: remove this? (currently required for notes)
		duration: timeScale,
		freq: Object.assign({}, _struct.freq)
	};
	let newExp = subNode.freq[primes[p]] + sign;
	//bounds (tonality) check
	//to do: + 1 should be + 0.5?
	if((newExp < 0) || (newExp > maxPitches[p] + 1)) {sign *= -1;}
	subNode.freq[primes[p]] += sign;
	//pitch normalization into factor 2, i.e. octave normalization
	if(p >= 1) {
		//octave comparison for overall normalization
		let diff = Math.round(Math.log2(parseNumber(_struct.freq))) - Math.round(Math.log2(parseNumber(subNode.freq)));
		subNode.freq[2] += diff;
	}
	//index 0 -> new voice level -> one octave up
	if(index === 0) {subNode.freq[2] += 1;}
	
	if(voiceDepth > 1) {
		//upper voice in double speed
		//the first beat is a reference for the pitch of others.
		subNode[0] = melodyVoice(subNode, 0, timeScale * 0.5, voiceDepth - 1);
		subNode[1] = melodyVoice(subNode[0], 1, timeScale * 0.5, voiceDepth - 1);
	}
	return subNode;
}

//to do: allow more arbitrary rhythms, e.g. 2*2*3
function makeMelody() {
	if(primeCount < 2) return;
	let patCount = parseFloat(elems.txtPatternCount.value);
	if(patCount <= 0) return;
	let voiceCount = parseInt(elems.txtVoiceCount.value);
	if(voiceCount < 1) return;
	let reptPeriod = parseInt(elems.txtReptPeriod.value);
	if(reptPeriod <= 0) return;
	let repeatCount = parseInt(elems.txtReptCount.value);
	if(repeatCount <= 0) return;

	//top-level node
	let _timeScale = nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let barDuration = 2 ** (voiceCount - 1);
	let rootStruct = {
		//lots of voices? let's start a few octaves down
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq) * 0.5 ** Math.floor(voiceCount * 0.5),
		volRatio: "1/" + voiceCount.toString(), //inverse of maximum polyphony to avoid clipping
		timeScale: _timeScale,
		decayFactor: defaultBlockNode.decayFactor * _timeScale * barDuration //lengthier bars = more sustain
	};
	//build table of exponent variance per prime factor (tonality limitation: high factors are too odd, and should have low exponents)
	//to do: too simple? should it depend on primeCount? should it have an extra parameter of overall variance scale?
	if(maxPitches === null) {
		maxPitches = new Array(primes.length);
		for(const i in primes) {
			maxPitches[i] = 3 / Math.log2(primes[i]);
		}
	}

	//make various patterns of notes
	for(let x = 0; x < patCount; x++) {
		//randomize an initial note
		let pattern = {
			noteStart: 0, //to do: remove this? (currently required for notes)
			duration: barDuration,
			freq: {}
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
		
		//rootStruct[x] = pattern;
		rootStruct["pat" + x.toString()] = pattern;
	}
	//make pattern instances referring to existing patterns
	for(let x = 0, iPat, barPos; x < Math.ceil(patCount / reptPeriod); x++) {
	//for(let x = 0; x < patCount; x++) {
		for(let y = 0; y < repeatCount; y++) {
			for(let z = 0; (z < reptPeriod) && ((iPat = x * reptPeriod + z) < patCount); z++) {
				barPos = (x * repeatCount + y) * reptPeriod + z;
				rootStruct[barPos] = {
					0: "pat" + iPat.toString(),
					timeDelta: barDuration * barPos
				};
				//rootStruct[x][0] = "pat" + x.toString();
				//rootStruct[x].timeDelta = barDuration * x;
			}
		}
	}

	let s = JSON.stringify(rootStruct, null, "\t");
	//final adjustments on indentation
	regex = new RegExp(/(\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	do {
		let t = s.replace(regex, "$1 ");
		if(t == s) break;
		s = t;
	} while(true);
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	s = s.replace(regex, "\{$1\}");
	setStructuredText(s);
}
