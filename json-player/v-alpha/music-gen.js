"use strict";

let freqMin = 30, freqMax = 13000;

function renormalizeOctave(refFreq, targetFreq) {
	//octave comparison for overall normalization, beyond octave rounding
	let diff = Math.round(Math.log2(parseNumber(refFreq))) - Math.round(Math.log2(parseNumber(targetFreq)));
	targetFreq[2] += diff;
}
//makes a simple interval by introducing a random prime factor up or down one unit
//to do: reuse this in melodySubNodes? (probably not)
function addInterval(refFreq, targetFreq) {
	//question: weighted random on factor selection? (currently yes)
	//let iPrime = Math.floor(primeCount * Math.random());
	let iPrime = Math.floor((primeCount + 1) ** Math.random()) - 1;
	let sign = (Math.random() >= 0.5 ? 1 : -1);
	Object.assign(targetFreq, refFreq);

	let newExp = targetFreq[primes[iPrime]] + sign;
	//bounds (tonality) check
	//question: should + 1 be + 0.5?
	//for chords with a fixed first note, the exponents should vary in a bilateral way
	let maxExp = expVariance * maxPitches[iPrime] + 1;
	if((Math.abs(newExp) > 1 * maxExp) && sign === Math.sign(newExp)) sign *= -1;
	targetFreq[primes[iPrime]] += sign;

	//pitch normalization into factor 2, i.e. octave normalization, except when changing the very octave on purpose
	//to do: occasional use of higher primes for normalization
	if(iPrime > 1 && (Math.random() < 0.5 * (1 - 0.5 ** iPrime))) targetFreq[3] -= sign; //occasional factor-3 compensation (up to 50% of chance for higher primes)
	if(iPrime >= 1) renormalizeOctave(refFreq, targetFreq);

	//to do: limitFreq?
}
function newChord(voiceCount, polyphony) {
	let chordStruct = {
		0: {freq: {}}
	};
	//initialize prime factors (first note is always neutral)
	//question: variable first note? (currently no)
	for(let i = 0; i < primeCount; i++)
		chordStruct[0].freq[primes[i]] = 0;
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
				if(!(pitches.indexOf(newPitch) >= 0)) break; //to do: possibly subject to rounding errors
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
	if(primeCount < 2) return false;
	let patCount = parseInt(elems.txtPatternCount.value);
	if(patCount <= 0) return false;
	let voiceCount = parseInt(elems.txtVoiceCount.value);
	if(voiceCount < 2) return false;
	expVariance = NaNToDefault(parseNumber(elems.txtExpVariance.value), 2);
	if(expVariance <= 0) return false; //to do: set to < 0.5?
	if(rootFreq == 0) return false;
	
	let polyphony = voiceCount - 1; //partial superposition
	let _timeScale = NaNToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let rootStruct = {
		timeScale: _timeScale,
		freqRatio: rootFreq,
		volRatio: 1 / polyphony,
		decayFactor: defaultBlockNode.decayFactor.toString() + "*" + _timeScale.toString() + "*" + polyphony.toString()
	};

	for(let i = 0; i < patCount; i++) {
		rootStruct[i] = newChord(voiceCount, polyphony);
		//to do: chord comparison to avoid duplicates?
		//rootStruct[i].timeDelta = i * voiceCount;
		rootStruct[i].timeDelta = i.toString() + "*" + (voiceCount - 1 + polyphony).toString(); //in this case, the last note extra time = polyphony
	}

	let s = JSON.stringify(rootStruct, null, "\t");
	//final adjustments on indentation
	let regex = new RegExp(/(?<=\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	s = s.replace(regex, " ");
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	s = s.replace(regex, "\{$1\}");
	setStructuredText(s);
}

//rhythm structure generator
function makeRhythmFactors() {
	if(primeCount < 1) return false;
	rhythmFactors = [];
	let scale = Math.abs(NaNToDefault(parseNumber(elems.txtRhythmScale.value), 4));
	//builds a (random) product of prime factors
	//generate in reverse order (starting from high primes), and then use the lower ones in a complementary fashion
	for(let i = primeCount - 1, factor, y; i >= 0; i--) {
		factor = primes[i];
		if(factor > scale) continue; //ignore primes that are too large
		let maxExp = Math.log2(scale) / Math.log2(factor);
		//y = Math.floor(- 2 * Math.log(Math.random()) / factor);
		y = Math.floor((maxExp + 0.5) * Math.random());
		//if(y >= 1) rhythmFactors.unshift(Math.pow(factor, y));
		for(let j = 0; j < y; j++) {
			rhythmFactors.unshift(factor); //add as first
			scale /= factor;
		}
	}
	//the number of beats might be still small
	if(rhythmFactors.length < 1) {
		if(scale >= 2) {
			let factor;
			do {
				let rnd = Math.random();
				factor = primes[Math.floor(primeCount * rnd * rnd)];
			} while(factor > scale);
			rhythmFactors.push(factor);
		} //else
		//	rhythmFactors.push(1); //at least factor one
	}

	if(elems.txtRhythmFactors) elems.txtRhythmFactors.value = rhythmFactors.join("*");
	rhythmAccumUpdate();
}

function limitFreq(tuning, freq) {
	if(!freq) return false;
	if(typeof(tuning) !== "number") tuning = NaNToDefault(parseNumber(tuning), defaultBlockNode.freqRatio);
	let freqAbs = Math.abs(tuning) * parseNumber(freq);
	if(!freq[2]) freq[2] = 0;
	while(true) {
		//I know the human ear is supposed to hear more than this, but it's already outside the ordinary. I can barely hear these extremes.
		if(freqAbs > freqMax) {
			freq[2]--;
			freqAbs *= 0.5;
		} else
			if(freqAbs < freqMin) {
				freq[2]++;
				freqAbs *= 2;
			} else
				break;
	}
}

//the rhythm generator presumes that rhythmFactors and rhythmFactorsAccum are properly filled
//recursive function
function rhythmSubNodes(struct, level, tuning) {
	if(level >= rhythmFactors.length) return false;
	let beats = rhythmFactors[level - 1];
	let scale = rhythmFactorsAccum[level];

	let freqDummy = {2: 0};
	tuning *= beats;
	limitFreq(tuning, freqDummy); //not THAT high
	let subNodePattern = {
		timeDelta: 0, //make it appear early in JSON, defer filling
		
		freqRatio: beats,
		volRatio: "1/" + beats,

		duration: 0
	};
	if(freqDummy[2] !== 0) {
		//to do: explicitly represent exponentiation?
		subNodePattern.freqRatio = (2 ** freqDummy[2]).toString() + "*" + subNodePattern.freqRatio.toString();
		tuning *= 2 ** freqDummy[2];
	}

	//when using non-integer measures, sub-bars may become non-uniform in number of beats
	let beats2 = struct.duration / scale;
	for(let i = 0; i < beats2; i++) {
		let newNode = Object.assign({}, subNodePattern);
		struct[i] = newNode;
		newNode.timeDelta = i.toString() + "*" + scale.toString();
		if(i === 0) newNode.vol = 0; //omit strong beats, but not all their descendants

		let crumb = Math.min(1, beats2 - i); //the last beat may have a fraction of the normal duration
		newNode.duration = scale * crumb;
		//if(crumb !== 1) newNode.freq = "1/" + crumb.toString();
		if(crumb !== 1) newNode.freqRatio = newNode.freqRatio.toString() + "/" + crumb.toString(); //to do: include this in tuning calculation
		
		rhythmSubNodes(newNode, level + 1, tuning);
	}
}
function makeRhythm() {
	let repeatCount = parseInt(elems.txtReptCount.value);
	if(repeatCount <= 0) return false;
	if(rootFreq == 0) return false;

	//hierarchy of beats
	let percussion = elems.chkPercussivePattern.checked;
	let pattern = [];
	let _timeScale = NaNToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let rhythmStart = 0;
	if(percussion) {
		let sumVol = 0; //theoretical combined/maximum amplitude
		for(const scale of rhythmFactorsAccum) {
			//sumVol += 1 / scale;
			sumVol += rhythmFactorsAccum[0] / scale;
		}
		let freqDummy = {2: 0};
		let tuning = rootFreq / rhythmFactorsAccum[0];
		limitFreq(tuning, freqDummy); //not THAT low
		pattern.push({ //rhythm formula root block and note
			freqRatio: (2 ** freqDummy[2]).toString() + "/" + rhythmFactorsAccum[0].toString(), //lengthier bars -> lower pitch -> more sustain also
			//to do: what is the best register (frequency range) for percussion?
			//volRatio: 1,
			volRatio: (4).toString() + "*" + rhythmFactorsAccum[0].toString() + "/" + sumVol.toString(),
			
			duration: rhythmFactorsAccum[0],
			timbre: "noise",
			decayFactor: (defaultBlockNode.decayFactor / 8).toString() + "*" + _timeScale.toString()
		});
		rhythmStart++;
		rhythmSubNodes(pattern[0], 1, 2 ** freqDummy[2] * tuning);
	}

	//bar fill
	//let noteCount = Math.floor((0.25 + 0.75 * Math.random()) * rhythmFactorsAccum[0]);
	//number of notes: 25% to almost 87.5% of bar length (beat count)
	let noteCount = Math.floor((0.25 + 0.625 * Math.random()) * rhythmFactorsAccum[0]);
	if(rhythmFactorsAccum[0] >= 3 && noteCount < 2) {noteCount = 2;}

	for(let i = 0; i < noteCount; i++) { //first let's meet the number of notes
		const note = {
			noteStart: 0, //make it appear early in JSON, defer filling
			duration: 1};
		if(percussion) note.vol = 0.5;
		pattern.push(note);
	}
	if(noteCount >= 1) {
		let i;
		for(i = rhythmFactorsAccum[0] - noteCount; i >= 1; i--) {
			//increment the duration of some random notes until total length is met
			pattern[Math.floor(Math.random() * noteCount) + rhythmStart].duration++;
		}
		//fraction of a beat?
		if(i !== 0) pattern[Math.floor(Math.random() * noteCount) + rhythmStart].duration += i;
	}

	//now that the durations are known, adjust note start sequentially (let no superposition)
	for(let i = 0, t = 0, lastDuration = 0; i < noteCount; i++) {
		if(i > 0) {
			pattern[i + rhythmStart].noteStart = t.toString() + "+" + lastDuration.toString();
			t += lastDuration;
		} else {
			pattern[i + rhythmStart].noteStart = 0;
		}
		lastDuration = pattern[i + rhythmStart].duration;
	}

	let rootStruct = {
		timeScale: _timeScale,
		freqRatio: rootFreq,
		//decayFactor: defaultBlockNode.decayFactor * _timeScale * rhythmFactorsAccum[0] //lengthier bars = more sustain
	};
	if(percussion) rootStruct.volRatio = "2/3";
	rootStruct.pat = pattern; //make it appear later in JSON
	for(let i = 0; i < repeatCount; i++) {
		rootStruct[i] = {timeDelta: i.toString() + "*" + rhythmFactorsAccum[0].toString(), 0: "pat"};
	}
	
	let s = JSON.stringify(rootStruct, null, "\t");
	//final adjustments on indentation
	let regex = new RegExp(/(?<=\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	s = s.replace(regex, " ");
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	s = s.replace(regex, "\{$1\}");
	setStructuredText(s);
}

//the melody generator also presumes that rhythmFactors and rhythmFactorsAccum are properly filled
//recursive function
//to do: option for rhythm pattern in both rhythm and melody generator
function melodySubNodes(struct, level, tuning) {
	if(level >= rhythmFactors.length) return false;
	let beats = rhythmFactors[level - 1];
	let scale = rhythmFactorsAccum[level];
	let subNodePattern = {
		timeDelta: 0, //make it appear early in JSON, defer filling
		freqRatio: beats, //faster scales are higher-pitched
		volRatio: "1/" + beats,

		duration: 0,
		freq: null //using {} here will cause a bug of using the same reference without cloning {}
	};
	tuning *= subNodePattern.freqRatio;
	//when using non-integer measures, sub-bars may become non-uniform in number of beats
	let beats2 = struct.duration / scale;
	let altLevel = Math.log2(rhythmFactorsAccum[0] / scale);
	//let beatStrengthInv = Math.random() < 0.25;
	let beatStrengthInv = false;
	for(let i = 0; i < beats2; i++) {
		let newNode = Object.assign({}, subNodePattern);
		struct[i] = newNode;
		newNode.timeDelta = i.toString() + "*" + scale.toString();

		let crumb = Math.min(1, beats2 - i); //the last beat may have a fraction of the normal duration
		newNode.duration = scale * crumb;
		//to do: newTuning?
		if(crumb !== 1) newNode.freqRatio = newNode.freqRatio.toString() + "/" + crumb.toString();

		//question: should the other beats base their frequency on the first one?
		//let previous = struct; //no
		let previous = (i < 1 ? struct : struct[0]); //yes
		//alternative: each note is based on a random previous note in the same level
		//previous = (i < 1 ? struct : struct[Math.floor(i * Math.random())]); //don't use rnd here
		newNode.freq = Object.assign({}, previous.freq); //must be a fresh, independent instance

		//factor selection
		//let beatType = i < 1;
		let beatType = i >= (beats2 - 1);
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

			//let factor = Math.min(1 + Math.floor(0.5 * (1 - rnd) ** (-2)), primes[primeCount - 1]); //1 - rnd is to avoid division by zero
			//for(iPrime = 0; primes[iPrime + 1] <= factor; iPrime++) {}
		}*/
		
		//exponent variation (a unit upwards or downwards)
		//question: should they only go downwards? (because the root factors only went upwards)
		//let sign = (iPrime <= 0 ? 0 : (Math.random() >= 0.5 ? 1 : -1)); //neutral for factor 2
		//let sign = (Math.random() >= 0.5 ? 1 : -1);
		//const sign = 1;
		//const sign = (i < 1 ? 1 : -1);
		//const sign = (i >= (beats2 - 1) ? -1 : 1);
		//const sign = (i < 1 ^ beatStrengthInv ? 1 : -1);
		let sign;

		let newExp, maxExp;//, deviation;
		do {
			rnd = Math.random();
			//iPrime = 1 + Math.floor((primeCount - 1) * rnd); //uniform distribution
			iPrime = Math.floor((primeCount - 0.5) * rnd ** (0.5 * Math.max(altLevel + 1, 1)) + 0.5);
			//sign = ((beatType ^ (iPrime === 0)) ? 1 : -1);
			//sign = ((beatType ^ (iPrime === 0) ^ beatStrengthInv) ? -1 : 1);
			if(iPrime === 0)
				sign = ((beatType ^ beatStrengthInv) ? 1 : 0);
			else
				sign = ((beatType ^ beatStrengthInv) ? -1 : 1);
			newExp = newNode.freq[primes[iPrime]] + sign;
			maxExp = expVariance * maxPitches[iPrime] + 1;
			//deviation = newExp - 0.5 * maxExp;
		//} while((Math.abs(deviation) > 0.5 * maxExp) && sign === Math.sign(deviation));
		} while((Math.abs(newExp) > maxExp) && sign === Math.sign(newExp));
		//} while(newExp < 0 || newExp > maxExp);

		//let newExp = newNode.freq[primes[iPrime]] + sign;
		//bounds (tonality) check
		//question: should + 1 be + 0.5?
		//question: should the variance here be less than when choosing pattern root pitch?
		//let maxExp = expVariance * maxPitches[iPrime] + 1;
		//let deviation = newExp - 0.5 * maxExp;
		//if((Math.abs(deviation) > 0.5 * maxExp) && sign === Math.sign(deviation)) sign *= -1;
		newNode.freq[primes[iPrime]] += sign;

		//pitch normalization into factor 2, i.e. octave normalization
		//to do: occasional use of higher primes for normalization
		//if(iPrime > 1 && (Math.random() < 0.5 * (1 - 0.5 ** iPrime))) newNode.freq[3] -= sign; //occasional factor-3 compensation (up to 50% of chance for higher primes)
		if(iPrime >= 1) renormalizeOctave(previous.freq, newNode.freq);
		//if(i === 0) newNode.freq[2]++; //first beat -> new voice level -> one octave up
		limitFreq(tuning, newNode.freq); //not THAT high

		melodySubNodes(newNode, level + 1, tuning);
	}
}
//to do: pattern variations
function makeMelody() {
	if(primeCount < 2) return false;
	let patCount = parseInt(elems.txtPatternCount.value);
	if(patCount <= 0) return false;
	let reptPeriod = parseNumber(elems.txtReptPeriod.value);
	if(reptPeriod <= 0) return false;
	let repeatCount = parseInt(elems.txtReptCount.value);
	if(repeatCount <= 0) return false;
	expVariance = NaNToDefault(parseNumber(elems.txtExpVariance.value), 2);
	if(expVariance <= 0) return false; //to do: set to < 0.5?
	if(rootFreq == 0) return false;

	//top-level node
	let _timeScale = NaNToDefault(parseNumber(elems.txtTimeScale.value), defaultBlockNode.timeScale);
	let barDuration = rhythmFactorsAccum[0];
	let sumVol = 0;
	for(const scale of rhythmFactorsAccum) {
		//sumVol += 1 / scale;
		sumVol += barDuration / scale;
	}
	let partialScaleOffset = 2 ** Math.floor(Math.log2(barDuration) * 1 / 2); //to do: explicitly represent exponentiation?
	let rootStruct = {
		//to do: should some of these properties be exclusive for melodic notes?
		timeScale: _timeScale,
		//freqRatio: rootFreq.toString() + "/" + barDuration.toString(),
		//big range (lots of beats)? let's start a few octaves down
		//freqRatio: rootFreq * 0.5 ** Math.floor(Math.log2(barDuration) * 1 / 2),
		freqRatio: rootFreq.toString() + "/" + partialScaleOffset.toString(),
		//volRatio: 1 / sumVol,
		volRatio: barDuration.toString() + "/" + sumVol.toString(),
		decayFactor: defaultBlockNode.decayFactor.toString() + "*" + _timeScale.toString() + "*" + (barDuration / partialScaleOffset).toString() //lengthier bars = more sustain
	};

	//hierarchy of beats
	let percussion = elems.chkPercussivePattern.checked;
	let percussivePattern = null;
	if(percussion) {
		let sumVol = 0; //theoretical combined/maximum amplitude
		for(const scale of rhythmFactorsAccum) {
			//sumVol += 1 / scale;
			sumVol += rhythmFactorsAccum[0] / scale;
		}
		let freqDummy = {2: 0};
		let tuning = rootFreq / rhythmFactorsAccum[0];
		limitFreq(tuning, freqDummy); //not THAT low
		percussivePattern = { //rhythm formula root block and note
			//to do: readjust these parameters below
			//freqRatio: (2 ** freqDummy[2]).toString() + "/" + rhythmFactorsAccum[0].toString(), //lengthier bars -> lower pitch -> more sustain also
			freqRatio: (2 ** freqDummy[2]).toString() + "/" +  (barDuration / partialScaleOffset).toString(), //lengthier bars -> lower pitch -> more sustain also
			//to do: what is the best register (frequency range) for percussion?
			//volRatio: 1,
			volRatio: (4).toString() + "*" + rhythmFactorsAccum[0].toString() + "/" + sumVol.toString(),
			
			duration: rhythmFactorsAccum[0],
			timbre: "noise",
			decayFactor: (defaultBlockNode.decayFactor / 8).toString() + "*" + _timeScale.toString()
		};
		rhythmSubNodes(percussivePattern, 1, 2 ** freqDummy[2] * tuning);
		rootStruct["percussion"] = percussivePattern;
	}
	
	//make various patterns of notes
	for(let i = 0; i < patCount; i++) {
		let pattern = {
			duration: barDuration,
			freq: {}
		};
		if(percussivePattern) pattern.vol = 0.5;

		//randomize an initial note
		let product = 1;
		for(let p = 1; p < primeCount; p++) {
			//currently the factors can only go upwards
			//question: signed (bipolar) random is possibly better
			//	question: in such case, use round() instead of floor() or trunc()?
			//let exp = Math.trunc((expVariance * maxPitches[p] + 1) * Math.random());
			let exp = Math.round((expVariance * maxPitches[p] + 1) * (Math.random() - 0.5));
			pattern.freq[primes[p]] = exp;
			product *= primes[p] ** exp;
		}
		//multiply the primes and balance factor 2 (octave normalization)
		pattern.freq[2] = - Math.round(Math.log2(product));
		limitFreq(rootStruct.freqRatio, pattern.freq);
		
		melodySubNodes(pattern, 1, parseNumber(rootStruct.freqRatio));
		
		//rootStruct[i] = pattern;
		rootStruct["pat" + i.toString()] = pattern;
	}
	//make pattern instances referring to existing patterns
	for(let x = 0, iPat, barPos; x < Math.ceil(patCount / reptPeriod); x++) {
	//for(let x = 0; x < patCount; x++) {
		for(let y = 0; y < repeatCount; y++) {
			for(let z = 0; z < reptPeriod && (iPat = x * reptPeriod + z) < patCount; z++) {
				barPos = (x * repeatCount + y) * reptPeriod + z;
				const bar = {timeDelta: barPos.toString() + "*" + barDuration.toString()};
				let i = 0;
				if(percussivePattern)
					bar[i++] = "percussion";
				bar[i] = "pat" + iPat.toString();
				rootStruct[barPos] = bar;
				//rootStruct[x][0] = "pat" + x.toString();
				//rootStruct[x].timeDelta = x * barDuration;
			}
		}
	}

	let s = JSON.stringify(rootStruct, null, "\t");
	//final adjustments on indentation
	let regex = new RegExp(/(?<=\t{1,}[^\t\{\}\[\]]+,)\n\t{2,}/, "g"); //rows of properties without inner objects
	s = s.replace(regex, " ");
	regex = new RegExp(/\{\n\t{2,}([^\t\{\}\[\]\n]+)\n\t{1,}\}/, "g"); //object without inner objects
	s = s.replace(regex, "\{$1\}");
	setStructuredText(s);
}
