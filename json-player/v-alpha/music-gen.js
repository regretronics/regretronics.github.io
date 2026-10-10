"use strict";

//imported variables
var prefs, primes, rhythmFactorsAccum;

function renormalizeOctave(refFreq, targetFreq) {
	//octave comparison for overall normalization, beyond octave rounding
	const refOctave = Math.round(Math.log2(parseNumber(refFreq)));
	const targetOctave = Math.round(Math.log2(parseNumber(targetFreq)));
	targetFreq[2] += refOctave - targetOctave;
}
//clamp to enforced range by changing octave
function limitFreq(tuning, freq) {
	if(!freq) return false;
	if(typeof(tuning) !== "number") tuning = NaNToDefault(parseNumber(tuning), defaultBlockNode.freqRatio);
	let freqAbs = Math.abs(tuning) * parseNumber(freq);
	if(!freq[2]) freq[2] = 0;
	while(true) {
		if(freqAbs > prefs.basicParams.freqRangeMax) {
			freq[2]--;
			freqAbs *= 0.5;
		} else
			if(freqAbs < prefs.basicParams.freqRangeMin) {
				freq[2]++;
				freqAbs *= 2;
			} else
				break;
	}
	return freq;
}

//makes a simple interval by introducing a random prime factor up or down one unit
//to do: reuse this in melodySubNodes? (probably not, but at least remove part of the repetition)
function addInterval(refFreq, targetFreq, primeCount, tuning, primeExpRanges) {
	//evaluate choices and ranges for each prime factor, building a revised table of ranges
	const newPrimeExpRanges = {};
	const maxFactor = primes[Math.ceil(primeCount) - 1], spans = [];
	for(const factor of Object.keys(primeExpRanges)) {
		if(factor > maxFactor) break;

		//the default range can be further restricted by current exponent values
		const range = primeExpRanges[factor], currExp = refFreq[factor], newRange = [
			/* Math.max(range[0], range[0] - currExp),
			Math.min(range[1], range[1] - currExp) */
			Math.max(range[0], Math.min(0, range[0] - currExp)),
			Math.min(range[1], Math.max(0, range[1] - currExp))
			/* Math.max(-1, Math.min(0, range[0] - currExp)),
			Math.min( 1, Math.max(0, range[1] - currExp)) */
		];
		newPrimeExpRanges[factor] = newRange;
		spans.push(newRange[1] - newRange[0]);
	}

	//through proportional division, try to find a random factor and a new exponent
	let accum = 0;
	for(const iSpan in spans) {
		//if(!Object.hasOwn(spans, iSpan)) continue; //probably unnecessary for arrays

		accum += spans[iSpan];
		spans[iSpan] = accum;
	}
	const randAccum = accum * Math.random(), iPrime = spans.findIndex((value, index, obj) => value > randAccum);
	//const newExp = Math.floor(newPrimeExpRanges[primes[iPrime]] + randAccum - spans[iPrime]);
	const factor = primes[iPrime], sign = (newPrimeExpRanges[factor][0] + spans[iPrime] - randAccum) >= 0 ? 1 : -1;

	Object.assign(targetFreq, refFreq);
	//targetFreq[factor] = newExp;
	targetFreq[factor] += sign;

	//pitch normalization into factor 2, i.e. octave normalization, except when changing the very octave on purpose
	//to do: occasional use of higher primes for normalization
	if(iPrime > 1 && Math.random() < 0.5 * (1 - 0.5 ** iPrime)) targetFreq[3] -= sign; //occasional factor-3 compensation (up to 50% of chance for higher primes)
	if(iPrime >= 1) renormalizeOctave(refFreq, targetFreq);

	limitFreq(tuning, targetFreq); //question: applicable for chords?
}
function newChord(voiceCount, polyphony, primeCount, tuning, primeExpRanges) {
	const chordStruct = {
		0: {freq: {}}
	};
	//initialize prime factors (first note is always neutral)
	//question: variable first note? (currently no)
	for(let iPrimes = 0; iPrimes < primeCount; iPrimes++)
		chordStruct[0].freq[primes[iPrimes]] = 0;
	const pitches = [parseNumber(chordStruct[0].freq)];
	for(let iVoice = 0; iVoice < voiceCount; iVoice++) {
		let note;
		if(iVoice > 0) {
			note = {};
			chordStruct[iVoice] = note;
			let newPitch;
			while(true) { //duplicate prevention
				note.freq = {};
				//each note is based on a random previous note
				addInterval(chordStruct[Math.floor(iVoice * Math.random())].freq, note.freq, primeCount, tuning, primeExpRanges);
				newPitch = parseNumber(note.freq);
				if(!(pitches.indexOf(newPitch) >= 0)) break; //to do: possibly subject to rounding errors (rewrite this detection)
			}
			pitches.push(newPitch); //for duplicate prevention
		} else
			note = chordStruct[iVoice];
		//will be played melodically (if played harmonically, note order would be lost)
		note.noteStart = iVoice;
		note.duration = polyphony;
	}
	return chordStruct;
}
function makeChords(patCount, voiceCount, _timeScale, primeCount, primeExpRanges) {
	if(primeCount <= 1) throw(new Error("Prime factors setting too low."));
	if(patCount <= 0) throw(new Error("Pattern count setting too low."));
	if(voiceCount < 2) throw(new Error("Voice count setting too low."));
	if(prefs.genParams.baseFreq == 0) throw(new Error("Invalid base frequency setting."));

	const polyphony = voiceCount - 1; //partial superposition
	_timeScale = NaNToDefault(_timeScale, /* defaultBlockNode.timeScale */prefsDefault.genParams.timeScale);
	const rootStruct = {
		timeScale: _timeScale,
		freqRatio: prefs.genParams.baseFreq,
		volRatio: 1 / polyphony,
		decayFactor: defaultBlockNode.decayFactor.toString() + "*" + _timeScale.toString() + "*" + polyphony.toString()
	};

	for(let iPattern = 0; iPattern < patCount; iPattern++) {
		rootStruct[iPattern] = newChord(voiceCount, polyphony, primeCount, rootStruct.freqRatio, primeExpRanges);
		//to do: chord comparison to avoid duplicates?
		//rootStruct[iPattern].timeDelta = iPattern * voiceCount;
		rootStruct[iPattern].timeDelta = iPattern.toString() + "*" + (voiceCount - 1 + polyphony).toString(); //in this case, the last note extra time = polyphony
	}

	return rootStruct;
}

//rhythm structure generator
//question: !currently, rhythmScale is like a maximum. follow it more closely?
//to do: !avoid repeating the last result, when the scale is reasonably high (e.g. 8) and the prime count too
function makeRhythmFactors(rhythmScale, primeCount) {
	if(primeCount < 1) throw(new Error("Too few prime factors."));
	const rhythmFactors = [];
	let scale = Math.abs(NaNToDefault(rhythmScale, prefsDefault.rhythmParams.rhythmScale));
	//builds a (random) product of prime factors
	//generate in reverse order (starting from high primes), and then use the lower ones in a complementary fashion
	for(let iPrime = Math.floor(primeCount) - 1, factor, exp; iPrime >= 0; iPrime--) {
		factor = primes[iPrime];
		if(factor > scale) continue; //ignore primes that are too large
		const maxExp = Math.log2(scale) / Math.log2(factor);
		//exp = Math.floor(- 2 * Math.log(Math.random()) / factor);
		exp = Math.floor((maxExp + 0.5) * Math.random());
		//if(exp >= 1) rhythmFactors.unshift(Math.pow(factor, exp));
		for(let rept = 0; rept < exp; rept++) {
			rhythmFactors.unshift(factor); //add as first
			scale /= factor;
		}
	}
	//the number of beats might be still small
	if(rhythmFactors.length < 1) {
		if(scale >= 2) {
			let factor;
			do {
				const rnd = Math.random();
				factor = primes[Math.floor(primeCount * rnd * rnd)];
			} while(factor > scale);
			rhythmFactors.push(factor);
		} //else
		//	rhythmFactors.push(1); //at least factor one
	}

	return rhythmFactors;
}

//the rhythm generator presumes that prefs.rhythmParams.rhythmFactors and rhythmFactorsAccum are properly filled
//recursive function
function rhythmSubNodes(struct, level, tuning) {
	if(!struct) {
		console.info("rhythmSubNodes(): parameter struct is empty. Returning.");
		return false;
	}
	if(level >= prefs.rhythmParams.rhythmFactors.length) return false;
	const beats = prefs.rhythmParams.rhythmFactors[level - 1];
	const scale = rhythmFactorsAccum[level];

	const freqDummy = {2: 0};
	tuning *= beats;
	limitFreq(tuning, freqDummy);
	const subNodePattern = {
		timeDelta: 0, //make it appear early in JSON, defer filling

		freqRatio: beats,
		volRatio: "1/" + beats.toString(),

		duration: 0
	};
	if(freqDummy[2] !== 0) {
		//to do: explicitly represent exponentiation (instead of calculating immediately)?
		subNodePattern.freqRatio = (2 ** freqDummy[2]).toString() + "*" + subNodePattern.freqRatio.toString();
		tuning *= 2 ** freqDummy[2];
	}

	//when using non-integer measures, sub-bars may become non-uniform in number of beats
	const beats2 = struct.duration / scale;
	for(let iBeat = 0; iBeat < beats2; iBeat++) {
		const newNode = structuredClone(subNodePattern);
		struct[iBeat] = newNode;
		newNode.timeDelta = iBeat.toString() + "*" + scale.toString();
		if(iBeat === 0) newNode.vol = 0; //omit strong beats, but not all their descendants

		const crumb = Math.min(1, beats2 - iBeat); //the last beat may have a fraction of the normal duration
		newNode.duration = scale * crumb;
		//if(crumb !== 1) newNode.freq = "1/" + crumb.toString();
		if(crumb !== 1) newNode.freqRatio = newNode.freqRatio.toString() + "/" + crumb.toString(); //to do: include this in tuning calculation

		rhythmSubNodes(newNode, level + 1, tuning);
	}
	return struct;
}
function makeRhythm(repeatCount, percussion, timeScale) {
	if(repeatCount <= 0) throw(new Error("Repeat count setting too low."));
	if(prefs.genParams.baseFreq == 0) throw(new Error("Invalid base frequency setting."));

	//hierarchy of beats
	const pattern = [];
	const _timeScale = NaNToDefault(timeScale, /* defaultBlockNode.timeScale */prefsDefault.genParams.timeScale);
	let iRhythmStart = 0;
	if(percussion) {
		let sumVol = 0; //theoretical combined/maximum amplitude
		for(const scale of rhythmFactorsAccum) {
			//sumVol += 1 / scale;
			sumVol += rhythmFactorsAccum[0] / scale;
		}
		const freqDummy = {2: 0};
		const tuning = prefs.genParams.baseFreq / rhythmFactorsAccum[0];
		limitFreq(tuning, freqDummy);
		pattern.push({ //rhythm formula root block and note
				freqRatio: (2 ** freqDummy[2]).toString() + "/" + rhythmFactorsAccum[0].toString(), //lengthier bars -> lower pitch -> more sustain too
				//to do: what is the best register (frequency range) for percussion?
				//volRatio: 1,
				volRatio: (4).toString() + "*" + rhythmFactorsAccum[0].toString() + "/" + sumVol.toString(),

				duration: rhythmFactorsAccum[0],
				timbre: "noise",
				q: 1,
				decayFactor: (defaultBlockNode.decayFactor / 8).toString() + "*" + _timeScale.toString()
			});
		iRhythmStart++;
		rhythmSubNodes(pattern[0], 1, 2 ** freqDummy[2] * tuning);
	}

	//bar fill
	//let noteCount = Math.floor((0.25 + 0.75 * Math.random()) * rhythmFactorsAccum[0]);
	//number of notes: 25% to almost 87.5% of bar length (beat count)
	let noteCount = Math.floor((0.25 + 0.625 * Math.random()) * rhythmFactorsAccum[0]);
	if(rhythmFactorsAccum[0] >= 3 && noteCount < 2) noteCount = 2;

	for(let iNote = 0; iNote < noteCount; iNote++) { //first let's meet the number of notes
		const note = {
			noteStart: 0, //make it appear early in JSON, defer filling
			duration: 1};
		if(percussion) note.vol = 0.5;
		pattern.push(note);
	}
	if(noteCount >= 1) {
		let remainder;
		for(remainder = rhythmFactorsAccum[0] - noteCount; remainder >= 1; remainder--) {
			//increment the duration of some random notes until total length is met
			pattern[Math.floor(Math.random() * noteCount) + iRhythmStart].duration++;
		}
		//fraction of a beat?
		if(remainder !== 0) pattern[Math.floor(Math.random() * noteCount) + iRhythmStart].duration += remainder;
	}

	//now that the durations are known, adjust note start sequentially (allow no superposition)
	for(let iNote = 0, time = 0, lastDuration = 0; iNote < noteCount; iNote++) {
		if(iNote > 0) {
			pattern[iNote + iRhythmStart].noteStart = time.toString() + "+" + lastDuration.toString();
			time += lastDuration;
		} else {
			pattern[iNote + iRhythmStart].noteStart = 0;
		}
		lastDuration = pattern[iNote + iRhythmStart].duration;
	}

	const rootStruct = {
		timeScale: _timeScale,
		freqRatio: prefs.genParams.baseFreq,
		//decayFactor: defaultBlockNode.decayFactor * _timeScale * rhythmFactorsAccum[0] //lengthier bars = more sustain
	};
	if(percussion) rootStruct.volRatio = "2/3";
	rootStruct.pat = pattern; //make it appear later in JSON
	for(let repeat = 0; repeat < repeatCount; repeat++) {
		rootStruct[repeat] = {timeDelta: repeat.toString() + "*" + rhythmFactorsAccum[0].toString(), 0: "pat"};
	}
	return rootStruct;
}

//the melody generator also presumes that prefs.rhythmParams.rhythmFactors and rhythmFactorsAccum are properly filled
//recursive function
//done: option for rhythm pattern in both rhythm and melody generator
function melodySubNodesOld(struct, level, tuning, primeCount, primeExpRanges) {
	if(!struct) {
		console.info("melodySubNodes(): parameter struct is empty. Returning.");
		return false;
	}
	if(level >= prefs.rhythmParams.rhythmFactors.length) return false;
	const beats = prefs.rhythmParams.rhythmFactors[level - 1];
	const scale = rhythmFactorsAccum[level];
	const subNodePattern = {
		timeDelta: 0, //make it appear early in JSON, defer filling
		freqRatio: beats, //faster scales are higher-pitched
		volRatio: "1/" + beats.toString(),

		duration: 0,
		freq: {}
	};
	tuning *= subNodePattern.freqRatio;
	//when using non-integer measures, sub-bars may become non-uniform in number of beats
	const beats2 = struct.duration / scale;
	const altLevel = Math.log2(rhythmFactorsAccum[0] / scale);
	//const beatStrengthInv = Math.random() < 0.25;
	const beatStrengthInv = false;
	for(let iBeat = 0; iBeat < beats2; iBeat++) {
		const newNode = structuredClone(subNodePattern);
		struct[iBeat] = newNode;
		newNode.timeDelta = iBeat.toString() + "*" + scale.toString();

		const crumb = Math.min(1, beats2 - iBeat); //the last beat may have a fraction of the normal duration
		newNode.duration = scale * crumb;
		//to do: newTuning?
		if(crumb !== 1) newNode.freqRatio = newNode.freqRatio.toString() + "/" + crumb.toString();

		//question: should the other beats base their frequency on the first one?
		//let previous = struct; //no
		let previous = (iBeat < 1 ? struct : struct[0]); //yes
		//alternative: each note is based on a random previous note in the same level
		//previous = (iBeat < 1 ? struct : struct[Math.floor(iBeat * Math.random())]); //don't use rnd here
		Object.assign(newNode.freq, previous.freq); //must be a fresh, independent instance

		//factor selection
		//const beatType = iBeat < 1; //is first beat?
		const beatType = iBeat >= (beats2 - 1); //is last beat?
		let iPrime, rnd;// = Math.random();
		//iPrime = 1 + Math.floor((primeCount - 1) * rnd); //uniform distribution
		//if(beatType) { //strong (#0) beat
		/*if(beatType ^ beatStrengthInv) { //strong (#0) beat, sometimes inverted (surprisingly the ^^ operator doesn't exist)
			//newNode.vol = 0; //omit strong beats except for the root one? (probably no.)
			//question: what formula or algorithm will be the best random prime chooser? (quite hard)
			//conservative choice
			//iPrime = Math.floor((2 / 3 * primeCount) ** rnd) - 1;
			//iPrime = Math.floor((primeCount - 1) * rnd * rnd);
			//iPrime = Math.floor(primeCount * rnd * rnd * rnd);
			//iPrime = Math.floor(primeCount * rnd ** (level + 1));
			iPrime = Math.floor(primeCount * rnd ** (0.5 * Math.max(altLevel + 2, 1)));
		} else {
			//must be >= 1, to exclude factor 2
			//iPrime = Math.floor(primeCount ** rnd);
			//iPrime = Math.floor((primeCount - 1) * rnd * rnd) + 1; //to do: maybe rnd ** (primeCount - 1)
			//iPrime = Math.floor(primeCount * rnd * rnd);
			//iPrime = Math.floor(primeCount * rnd ** level);
			iPrime = Math.floor((primeCount - 0.5) * rnd ** (0.5 * Math.max(altLevel + 1, 1)) + 0.5);

			//const factor = Math.min(1 + Math.floor(0.5 * (1 - rnd) ** (-2)), primes[Math.ceil(primeCount) - 1]); //1 - rnd (instead of rnd - 1) is to avoid division by zero
			//for(iPrime = 0; primes[iPrime + 1] <= factor; iPrime++) {}
		}*/

		//exponent variation (a unit upwards or downwards)
		//question: should they only go downwards? (because the root factors only went upwards)
		//let sign = (iPrime <= 0 ? 0 : (Math.random() >= 0.5 ? 1 : -1)); //neutral for factor 2
		//let sign = (Math.random() >= 0.5 ? 1 : -1);
		//const sign = 1;
		//const sign = (iBeat < 1 ? 1 : -1);
		//const sign = (iBeat >= (beats2 - 1) ? -1 : 1);
		//const sign = (iBeat < 1 ^ beatStrengthInv ? 1 : -1);
		let sign;

		let newExp, /* maxExp */expBounds;//, deviation;
		do {
			rnd = Math.random();
			//iPrime = 1 + Math.floor((primeCount - 1) * rnd); //uniform distribution
			iPrime = Math.floor((primeCount - 0.5) * rnd ** (0.5 * Math.max(altLevel + 1, 1)) + 0.5);
			//sign = ((beatType ^ (iPrime === 0)) ? 1 : -1);
			//sign = ((beatType ^ (iPrime === 0) ^ beatStrengthInv) ? -1 : 1);
			if(iPrime === 0) //the simplest prime factor has slightly different rules
				sign = ((beatType ^ beatStrengthInv) ? 1 : 0);
			else
				sign = ((beatType ^ beatStrengthInv) ? -1 : 1);
			newExp = newNode.freq[primes[iPrime]] + sign;
			expBounds = primeExpRanges[primes[iPrime]];
			//deviation = newExp - 0.5 * maxExp;
		//} while((Math.abs(deviation) > 0.5 * maxExp) && sign === Math.sign(deviation));
		//} while(Math.abs(newExp) > maxExp && sign === Math.sign(newExp));
		//} while((newExp > maxExp || - newExp < -0.5 * maxExp) && sign === Math.sign(newExp));
		} while((newExp < expBounds[0] || newExp > expBounds[1]) && sign === Math.sign(newExp));
		//} while(newExp < 0 || newExp > maxExp);

		//const newExp = newNode.freq[primes[iPrime]] + sign;
		//bounds (tonality) check
		//question: should + 1 be + 0.5?
		//question: should the variance here be less than when choosing pattern root pitch?
		//const deviation = newExp - 0.5 * maxExp;
		//if(Math.abs(deviation) > (0.5 * maxExp) && sign === Math.sign(deviation)) sign *= -1;
		newNode.freq[primes[iPrime]] += sign;

		//pitch normalization into factor 2, i.e. octave normalization
		//to do: occasional use of higher primes for normalization
		//if(iPrime > 1 && (Math.random() < 0.5 * (1 - 0.5 ** iPrime))) newNode.freq[3] -= sign; //occasional factor-3 compensation (up to 50% of chance for higher primes)
		if(iPrime >= 1) renormalizeOctave(previous.freq, newNode.freq);
		//if(iBeat === 0) newNode.freq[2]++; //first beat -> new voice level -> one octave up
		limitFreq(tuning, newNode.freq);

		melodySubNodesOld(newNode, level + 1, tuning, primeCount, primeExpRanges);
	}
	return struct;
}
function melodySubNodes(struct, level, tuning, primeCount, primeExpRanges) {
	if(!struct) {
		console.info("melodySubNodes(): parameter struct is empty. Returning.");
		return false;
	}
	if(level >= prefs.rhythmParams.rhythmFactors.length) return false;
	const beats = prefs.rhythmParams.rhythmFactors[level - 1];
	const scale = rhythmFactorsAccum[level];
	const subNodePattern = {
		timeDelta: 0, //make it appear early in JSON, defer filling
		freqRatio: beats, //faster scales are higher-pitched
		volRatio: "1/" + beats.toString(),

		duration: 0,
		freq: {}
	};
	tuning *= subNodePattern.freqRatio;
	//when using non-integer measures, sub-bars may become non-uniform in number of beats
	const beats2 = struct.duration / scale;
	const altLevel = Math.log2(rhythmFactorsAccum[0] / scale);
	//const beatStrengthInv = Math.random() < 0.25;
	const beatStrengthInv = false;
	for(let iBeat = 0; iBeat < beats2; iBeat++) {
		const newNode = structuredClone(subNodePattern);
		struct[iBeat] = newNode;
		newNode.timeDelta = iBeat.toString() + "*" + scale.toString();

		const crumb = Math.min(1, beats2 - iBeat); //the last beat may have a fraction of the normal duration
		newNode.duration = scale * crumb;
		//to do: newTuning?
		if(crumb !== 1) newNode.freqRatio = newNode.freqRatio.toString() + "/" + crumb.toString();

		//question: should the other beats base their frequency on the first one?
		//let previous = struct; //no
		let previous = (iBeat < 1 ? struct : struct[0]); //yes
		//alternative: each note is based on a random previous note in the same level
		//previous = (iBeat < 1 ? struct : struct[Math.floor(iBeat * Math.random())]); //don't use rnd here
		Object.assign(newNode.freq, previous.freq); //must be a fresh, independent instance

		//factor selection
		//const beatType = iBeat < 1; //is first beat?
		//const beatType = iBeat >= (beats2 - 1); //is last beat?

		//evaluate choices and ranges for each prime factor, building a revised table of ranges
		const newPrimeExpRanges = {};
		const maxFactor = primes[Math.ceil(primeCount) - 1], spans = [];
		for(const factor of Object.keys(primeExpRanges)) {
			if(factor > maxFactor) break;

			//the default range can be further restricted by current exponent values
			const range = primeExpRanges[factor], currExp = previous.freq[factor], newRange = [
				Math.max(range[0], Math.min(0, range[0] - currExp)),
				Math.min(range[1], Math.max(0, range[1] - currExp))
				/* Math.max(-1, Math.min(0, range[0] - currExp)),
				Math.min( 1, Math.max(0, range[1] - currExp)) */
			];
			newPrimeExpRanges[factor] = newRange;
			spans.push(newRange[1] - newRange[0]);
		}

		//through proportional division, try to find a random factor and a new exponent
		let accum = 0;
		for(const iSpan in spans) {
			//if(!Object.hasOwn(spans, iSpan)) continue; //probably unnecessary for arrays

			accum += spans[iSpan];
			spans[iSpan] = accum;
		}
		//const sumRange = spans.reduce((previousValue, currentValue, currentIndex, array) => previousValue + currentValue);
		const randAccum = accum * Math.random(), iPrime = spans.findIndex((value, index, obj) => value > randAccum);
		//const newExp = Math.floor(newPrimeExpRanges[primes[iPrime]][0] + randAccum - spans[iPrime]);
		const factor = primes[iPrime], sign = (newPrimeExpRanges[factor][0] + spans[iPrime] - randAccum) >= 0 ? 1 : -1;

		//newNode.freq[factor] = newExp;
		newNode.freq[factor] += sign;

		//pitch normalization into factor 2, i.e. octave normalization
		//to do: occasional use of higher primes for normalization
		//if(iPrime > 1 && (Math.random() < 0.5 * (1 - 0.5 ** iPrime))) newNode.freq[3] -= sign; //occasional factor-3 compensation (up to 50% of chance for higher primes)
		if(iPrime >= 1) renormalizeOctave(previous.freq, newNode.freq);
		//if(iBeat === 0) newNode.freq[2]++; //first beat -> new voice level -> one octave up
		limitFreq(tuning, newNode.freq);

		melodySubNodes(newNode, level + 1, tuning, primeCount, primeExpRanges);
	}
	return struct;
}
//to do: pattern variations
function makeMelody(patCount, reptPeriod, reptCount, timeScale, percussion, primeCount, primeExpRanges) {
	if(primeCount <= 1) throw(new Error("Prime factors setting too low."));
	if(patCount <= 0) throw(new Error("Pattern count setting too low."));
	if(reptPeriod <= 0) throw(new Error("Repeat period setting too low."));
	if(reptCount <= 0) throw(new Error("Repeat count setting too low."));
	const baseFreq = prefs.genParams.baseFreq;
	if(baseFreq == 0) throw(new Error("Invalid base frequency setting."));

	//top-level node
	const _timeScale = NaNToDefault(timeScale, /* defaultBlockNode.timeScale */prefsDefault.genParams.timeScale);
	const barDuration = rhythmFactorsAccum[0];
	let sumVol = 0;
	for(const scale of rhythmFactorsAccum) {
		//sumVol += 1 / scale;
		sumVol += barDuration / scale;
	}
	const partialScaleOffset = 2 ** Math.floor(Math.log2(barDuration) * 1 / 2); //to do: explicitly represent exponentiation (instead of calculating immediately)?
	const rootStruct = {
		//to do: should some of these properties be exclusive for melodic notes?
		timeScale: _timeScale,
		//freqRatio: baseFreq.toString() + "/" + barDuration.toString(),
		//big range (lots of beats)? let's start a few octaves down
		//freqRatio: baseFreq * 0.5 ** Math.floor(Math.log2(barDuration) * 1 / 2),
		freqRatio: baseFreq.toString() + "/" + partialScaleOffset.toString(),
		//volRatio: 1 / sumVol,
		volRatio: barDuration.toString() + "/" + sumVol.toString(),
		decayFactor: defaultBlockNode.decayFactor.toString() + "*" + _timeScale.toString() + "*" + (barDuration / partialScaleOffset).toString() //lengthier bars = more sustain
	};

	//hierarchy of beats
	let percussivePattern = null;
	if(percussion) {
		let sumVol = 0; //theoretical combined/maximum amplitude
		for(const scale of rhythmFactorsAccum) {
			//sumVol += 1 / scale;
			sumVol += rhythmFactorsAccum[0] / scale;
		}
		const freqDummy = {2: 0};
		const tuning = baseFreq / rhythmFactorsAccum[0];
		limitFreq(tuning, freqDummy);
		percussivePattern = { //rhythm formula root block and note
			//to do: readjust these parameters below
			//freqRatio: (2 ** freqDummy[2]).toString() + "/" + rhythmFactorsAccum[0].toString(), //lengthier bars -> lower pitch -> more sustain too
			freqRatio: (2 ** freqDummy[2]).toString() + "/" +  (barDuration / partialScaleOffset).toString(), //lengthier bars -> lower pitch -> more sustain too
			//to do: what is the best register (frequency range) for percussion?
			//volRatio: 1,
			volRatio: (4).toString() + "*" + rhythmFactorsAccum[0].toString() + "/" + sumVol.toString(),

			duration: rhythmFactorsAccum[0],
			timbre: "noise",
			q: 1,
			decayFactor: (defaultBlockNode.decayFactor / 8).toString() + "*" + _timeScale.toString()
		};
		rhythmSubNodes(percussivePattern, 1, 2 ** freqDummy[2] * tuning);
		rootStruct["percussion"] = percussivePattern;
	}

	//make various patterns of notes
	for(let iPattern = 0; iPattern < patCount; iPattern++) {
		const pattern = {
			duration: barDuration,
			freq: {}
		};
		if(percussivePattern) pattern.vol = 0.5;

		//randomize an initial note
		let product = 1;
		for(let iPrime = 1; iPrime < primeCount; iPrime++) {
			const 
				factor = primes[iPrime], expBounds = primeExpRanges[factor],
				exp = Math.floor(expBounds[0] + (expBounds[1] - expBounds[0] + 1) * Math.random());
			pattern.freq[factor] = exp;
			product *= factor ** exp;
		}
		//multiply the primes and balance factor 2 (octave normalization)
		pattern.freq[2] = - Math.round(Math.log2(product));
		limitFreq(rootStruct.freqRatio, pattern.freq);

		melodySubNodes(pattern, 1, parseNumber(rootStruct.freqRatio), primeCount, primeExpRanges);

		//rootStruct[iPattern] = pattern;
		rootStruct["pat" + iPattern.toString()] = pattern;
	}
	//make pattern instances referring to existing patterns
	for(let iPatBlock = 0, iPat, barPos; iPatBlock < Math.ceil(patCount / reptPeriod); iPatBlock++) {
	//for(let iPatBlock = 0; iPatBlock < patCount; iPatBlock++) {
		for(let repeat = 0; repeat < reptCount; repeat++) {
			for(let offset = 0; offset < reptPeriod && (iPat = iPatBlock * reptPeriod + offset) < patCount; offset++) {
				barPos = (iPatBlock * reptCount + repeat) * reptPeriod + offset;
				const bar = {timeDelta: barPos.toString() + "*" + barDuration.toString()};
				let iNode = 0;
				if(percussivePattern)
					bar[iNode++] = "percussion";
				bar[iNode] = "pat" + iPat.toString();
				rootStruct[barPos] = bar;
				//rootStruct[iPatBlock][0] = "pat" + iPatBlock.toString();
				//rootStruct[iPatBlock].timeDelta = iPatBlock * barDuration;
			}
		}
	}

	return rootStruct;
}
