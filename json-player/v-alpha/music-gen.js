"use strict";

const defaultFreq = 440;

function renormalizeOctave(refFreq, targetFreq) {
	//octave comparison for overall normalization
	let diff = Math.round(Math.log2(parseNumber(refFreq))) - Math.round(Math.log2(parseNumber(targetFreq)));
	targetFreq[2] += diff;
}
//makes a simple interval by introducing a random prime factor up or down one unit
//to do: reuse this in melodySubNodes?
function addInterval(refFreq, targetFreq) {
	//question: weighted random on factor selection? (currently yes)
	//let iPrime = Math.floor(primeCount * Math.random());
	let iPrime = Math.floor((primeCount + 1) ** Math.random()) - 1;
	let sign = Math.random() >= 0.5 ? 1 : -1;
	Object.assign(targetFreq, refFreq);
	targetFreq[primes[iPrime]] += sign;
	//pitch normalization into factor 2, i.e. octave normalization, except when changing the very octave on purpose
	if(iPrime >= 1) renormalizeOctave(refFreq, targetFreq);
}
function newChord(voiceCount, polyphony) {
	let chordStruct = {
		0: {freq: {}}
	};
	//initialize prime factors (first note is always neutral)
	//question: variable first note?
	for(let i = 0; i < primeCount; i++) {
		chordStruct[0].freq[primes[i]] = 0;
	}
	let pitches = [parseNumber(chordStruct[0].freq)];
	for(let i = 0; i < voiceCount; i++) {
		let note;
		if(i > 0) {
			note = {};
			chordStruct[i] = note;
			let newPitch;
			while(true) { //duplicate prevention
				note.freq = {};
				//each note is based on a random previous note
				addInterval(chordStruct[Math.floor(i * Math.random())].freq, note.freq);
				newPitch = parseNumber(note.freq);
				if(!(pitches.indexOf(newPitch) >= 0)) break;
			}
			pitches.push(newPitch); //for duplicate prevention
		} else
			note = chordStruct[i];
		//will be played melodically (if played harmonically, note order would be lost)
		note.noteStart = i;
		note.duration = polyphony;
	}
	return chordStruct;
}
function makeChords() {
	if(primeCount < 2) return;
	let patCount = parseFloat(elems.txtPatternCount.value);
	if(patCount <= 0) return;
	let voiceCount = parseInt(elems.txtVoiceCount.value);
	if(voiceCount < 2) return;
	
	//let polyphony = 2; //two-note superposition
	let polyphony = voiceCount - 1; //partial superposition
	let _timeScale = nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let rootStruct = {
		timeScale: _timeScale,
		freqRatio: nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq),
		volRatio: 1 / polyphony,
		decayFactor: defaultBlockNode.decayFactor * _timeScale * polyphony
	};

	for(let i = 0; i < patCount; i++) {
		rootStruct[i] = newChord(voiceCount, polyphony);
		//to do: chord comparison to avoid duplicates?
		//rootStruct[i].timeDelta = voiceCount * i;
		rootStruct[i].timeDelta = (voiceCount - 1 + polyphony) * i;
	}

	let s = JSON.stringify(rootStruct, null, "\t");
	//final adjustments on indentation
	/*let regex = new RegExp(/\{\n\t{4,}/, "g"); //too much indentation will collapse to space
	s = s.replace(regex, "{");
	regex = new RegExp(/\n\t{4,}/, "g");
	s = s.replace(regex, " ");
	regex = new RegExp(/\n\t{3,}\}/, "g");
	s = s.replace(regex, "}");*/
	let regex = new RegExp(/(\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	do {
		let t = s.replace(regex, "$1 ");
		if(t == s) break;
		s = t;
	} while(true);
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	s = s.replace(regex, "\{$1\}");
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

function limitFreq(tuning, freq) {
	if(typeof(tuning) !== "number") tuning = nullToDefault(parseNumber(tuning), defaultBlockNode.freqRatio);
	let freqAbs = tuning * parseNumber(freq);
	while(true) {
		//i know the human ear is supposed to hear more than this, but it's already outside the ordinary. i can barely hear these extremes.
		if(freqAbs > 13000) {
			freq[2]--;
			freqAbs *= 0.5;
		} else {
			if(freqAbs < 30) {
				freq[2]++;
				freqAbs *= 2;
			} else {
				break;
			}
		}
	}
}

//the rhythm generator presumes that rhythmFactors and rhythmFactorsAccum are properly filled
//recursive call
function rhythmSubNodes(struct, level, tuning) {
	if(level >= rhythmFactors.length) return;
	let beats = rhythmFactors[level - 1];
	let scale = rhythmFactorsAccum[level];

	let freqDummy = {2: 0};
	tuning *= beats;
	limitFreq(tuning, freqDummy);
	let subNodePattern = {
		timeDelta: 0, //make it appear early in JSON, defer filling
		freqRatio: beats,
		volRatio: "1/" + beats,

		duration: 0
	};
	if(freqDummy[2] !== 0) {
		subNodePattern.freqRatio = (2 ** freqDummy[2]).toString() + "*" + subNodePattern.freqRatio.toString();
		tuning *= 2 ** freqDummy[2];
	}

	//when using non-integer measures, sub-bars may become non-uniform in number of beats
	let beats2 = struct.duration / scale;
	for(let i = 0; i < beats2; i++) {
		let newNode = {};
		struct[i] = newNode;
		Object.assign(newNode, subNodePattern);
		newNode.timeDelta = i * scale;

		let crumb = Math.min(1, beats2 - i); //the last beat may have a fraction of the normal duration
		newNode.duration = scale * crumb;
		//if(crumb !== 1) newNode.freq = "1/" + crumb.toString();
		if(crumb !== 1) newNode.freqRatio = newNode.freqRatio.toString() + "/" + crumb.toString();
		
		rhythmSubNodes(newNode, level + 1, tuning);
	}
}
function makeRhythm() {
	let repeatCount = parseInt(elems.txtReptCount.value);
	if(repeatCount <= 0) return;
	let rootFreq = nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq);
	if(rootFreq === 0) return;

	//hierarchy of beats
	let sumVol = 0;
	for (const scale of rhythmFactorsAccum) {
		//sumVol += 1 / scale;
		sumVol += rhythmFactorsAccum[0] / scale;
	}
	let freqDummy = {2: 0};
	let tuning = rootFreq / rhythmFactorsAccum[0];
	limitFreq(tuning, freqDummy); //not THAT low
	let pattern = [{ //rhythm formula root block and note
		freqRatio: (2 ** freqDummy[2]).toString() + "/" + rhythmFactorsAccum[0].toString(),
		//volRatio: 1,
		volRatio: rhythmFactorsAccum[0].toString() + "/" + sumVol.toString(),

		duration: rhythmFactorsAccum[0]
	}];
	rhythmSubNodes(pattern[0], 1, 2 ** freqDummy[2] * tuning);

	//bar fill
	//let noteCount = Math.floor((0.25 + 0.75 * Math.random()) * rhythmFactorsAccum[0]);
	//number of notes: 25% to almost 87.5% of bar length (beat count)
	let noteCount = Math.floor((0.25 + 0.625 * Math.random()) * rhythmFactorsAccum[0]);
	if((rhythmFactorsAccum[0] >= 3) && (noteCount < 2)) {noteCount = 2;}

	for(let x = 0; x < noteCount; x++) { //first let's meet the number of notes
		pattern.push({noteStart: 0, duration: 1, vol: 0.5});
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
		timeScale: _timeScale,
		freqRatio: rootFreq,
		volRatio: "2/3",
		decayFactor: defaultBlockNode.decayFactor * _timeScale * rhythmFactorsAccum[0], //lengthier bars = more sustain

		pat: pattern
	};
	for(let x = 0; x < repeatCount; x++) {
		rootStruct[x] = {timeDelta: x * rhythmFactorsAccum[0], 0: "pat"};
	}
	
	let s = JSON.stringify(rootStruct, null, "\t");
	//final adjustments on indentation
	let regex = new RegExp(/(\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
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
let maxPitches = null, expVariance = 2;

//the melody generator also presumes that rhythmFactors and rhythmFactorsAccum are properly filled
//recursive call
function melodySubNodes(struct, level, tuning) {
	if(level >= rhythmFactors.length) return;
	let beats = rhythmFactors[level - 1];
	let scale = rhythmFactorsAccum[level];
	let subNodePattern = {
		timeDelta: 0, //make it appear early in JSON, defer filling
		freqRatio: beats,
		volRatio: "1/" + beats,

		duration: 0,
		freq: null //using {} here will cause a bug of using the same reference without cloning {}
	};
	tuning *= subNodePattern.freqRatio;
	//when using non-integer measures, sub-bars may become non-uniform in number of beats
	let beats2 = struct.duration / scale;
	let realLevel = Math.log2(rhythmFactorsAccum[0] / scale);
	for(let i = 0; i < beats2; i++) {
		let newNode = {};
		struct[i] = newNode;
		Object.assign(newNode, subNodePattern);
		newNode.timeDelta = i * scale;

		let crumb = Math.min(1, beats2 - i); //the last beat may have a fraction of the normal duration
		newNode.duration = scale * crumb;
		//to do: newTuning?
		if(crumb !== 1) newNode.freqRatio = newNode.freqRatio.toString() + "/" + crumb.toString();

		newNode.freq = {}; //must be a fresh, independent instance
		//factor selection
		let previous, iPrime, rnd = Math.random();
		//let iPrime = 1 + Math.floor((primeCount - 1) * rnd); //uniform distribution
		if(i === 0) { //strong (#0) beat
			previous = struct;
			//question: what formula or algorithm will be the best random prime chooser? (quite hard)
			//conservative choice
			//iPrime = Math.floor((2 / 3 * primeCount) ** rnd) - 1;
			//iPrime = Math.floor((primeCount - 1) * rnd * rnd);
			//iPrime = Math.floor(primeCount * rnd * rnd * rnd);
			//iPrime = Math.floor(primeCount * rnd ** (level + 1));
			iPrime = Math.floor(primeCount * rnd ** (0.5 * Math.max(realLevel + 2, 1)));
		} else {
			//question: should the other beats base their frequency on the first one?
			//previous = struct[0]; //yes
			previous = struct; //no
			//alternative: each note is based on a random previous note in the same level
			//previous = struct[Math.floor(i * Math.random())]; //don't use rnd here

			//must be >= 1, to exclude factor 2
			//iPrime = Math.floor(primeCount ** rnd);
			//iPrime = Math.floor((primeCount - 1) * rnd * rnd) + 1; //to do: maybe rnd ** (primeCount - 1)
			//iPrime = Math.floor(primeCount * rnd * rnd);
			//iPrime = Math.floor(primeCount * rnd ** level);
			iPrime = Math.floor((primeCount - 0.5) * rnd ** (0.5 * Math.max(realLevel + 1, 1)) + 0.5);

			//let factor = Math.min(1 + Math.floor(0.5 * (1 - rnd) ** (-2)), primes[primeCount - 1]); //1 - rnd is to avoid division by zero
			//for(iPrime = 0; primes[iPrime + 1] <= factor; iPrime++) {}
		}
		Object.assign(newNode.freq, previous.freq);

		//exponent variation (a unit upwards or downwards)
		//question: should they only go downwards? (because the root factors only went upwards)
		//let sign = (iPrime === 0) ? 0 : ((Math.random() >= 0.5) ? 1 : -1); //neutral for factor 2
		let sign = (Math.random() >= 0.5) ? 1 : -1;

		let newExp = newNode.freq[primes[iPrime]] + sign;
		//bounds (tonality) check
		//question: should + 1 be + 0.5?
		//question: should the variance here be less than when choosing pattern root pitch?
		let maxPitch = expVariance * maxPitches[iPrime] + 1;
		let deviation = newExp - 0.5 * maxPitch;
		if((Math.abs(deviation) > 0.5 * maxPitch) && (sign === Math.sign(deviation))) sign *= -1;
		newNode.freq[primes[iPrime]] += sign;
		//pitch normalization into factor 2, i.e. octave normalization
		//to do: occasional use of higher primes for normalization
		if((iPrime > 1) && (Math.random() < 0.5 * (1 - 0.5 ** iPrime))) newNode.freq[3] -= sign; //occasional factor-3 compensation (up to 50% of chance for higher primes)
		if(iPrime >= 1) renormalizeOctave(previous.freq, newNode.freq);
		//if(i === 0) newNode.freq[2]++; //first beat -> new voice level -> one octave up
		limitFreq(tuning, newNode.freq);

		melodySubNodes(newNode, level + 1, tuning);
	}
}
function makeMelody() {
	if(primeCount < 2) return;
	let patCount = parseFloat(elems.txtPatternCount.value);
	if(patCount <= 0) return;
	let reptPeriod = parseInt(elems.txtReptPeriod.value);
	if(reptPeriod <= 0) return;
	let repeatCount = parseInt(elems.txtReptCount.value);
	if(repeatCount <= 0) return;

	//top-level node
	let _timeScale = nullToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let barDuration = rhythmFactorsAccum[0];
	let sumVol = 0;
	for (const scale of rhythmFactorsAccum) {
		//sumVol += 1 / scale;
		sumVol += barDuration / scale;
	}
	let rootFreq = nullToDefault(parseNumber(elems.txtFreq.value), defaultFreq);
	let rootStruct = {
		timeScale: _timeScale,
		//freqRatio: rootFreq.toString() + "/" + barDuration.toString(),
		//big range (lots of beats)? let's start a few octaves down
		//freqRatio: rootFreq * 0.5 ** Math.floor(Math.log2(barDuration) * 1 / 2),
		freqRatio: rootFreq.toString() + "/" + (2 ** Math.floor(Math.log2(barDuration) * 1 / 2)).toString(),
		//volRatio: 1 / sumVol,
		volRatio: barDuration.toString() + "/" + sumVol.toString(),
		decayFactor: defaultBlockNode.decayFactor * _timeScale * barDuration //lengthier bars = more sustain
	};
	//build table of exponent variance per prime factor (tonality limitation: high factors are too odd, and should have low exponents)
	//question: too simple? should it depend on primeCount? should it have an extra parameter of overall variance scale?
	if(maxPitches === null) {
		maxPitches = new Array(primes.length);
		for(const i in primes) {
			maxPitches[i] = 1 / Math.log2(primes[i]);
		}
	}

	//make various patterns of notes
	for(let x = 0; x < patCount; x++) {
		let pattern = {
			duration: barDuration,
			freq: {}
		};

		//randomize an initial note
		let product = 1;
		for(let p = 1; p < primeCount; p++) {
			//currently the factors can only go upwards
			//question: signed (bipolar) random is possibly better
			//	question: in such case, use round() instead of floor() or trunc()?
			let y = Math.trunc((expVariance * maxPitches[p] + 1) * Math.random());
			pattern.freq[primes[p]] = y;
			product *= primes[p] ** y;
		}
		//multiply the primes and balance factor 2 (octave normalization)
		pattern.freq[2] = - Math.round(Math.log2(product));
		limitFreq(rootStruct.freqRatio, pattern.freq);
		
		melodySubNodes(pattern, 1, parseNumber(rootStruct.freqRatio));
		
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
	let regex = new RegExp(/(\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	do {
		let t = s.replace(regex, "$1 ");
		if(t == s) break;
		s = t;
	} while(true);
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	s = s.replace(regex, "\{$1\}");
	setStructuredText(s);
}
