"use strict";

//imported variables
var elems; //?
//var autoFlatten;

//shared variables
var struct;

function parseExpRanges(event) {
	if(!globalThis.ctlPrimeExpRanges) return false;
	try {
		const parsed = JSON.parse(codeBoxContentGet(ctlPrimeExpRanges));
		if(!parsed) throw(new Error("Exponent ranges: couldn't parse JSON code."));
		ctlPrimeExpRanges.classList.remove("invalid");
		ctlPrimeExpRanges.title = "";
		//ctlPrimeExpRanges.setCustomValidity(""); //setCustomValidity not available for <pre> elements
		if(!adjustingPreferences) setToolTip(outToolTip, "");

		//clean-copying of JSON code
		const newExpRanges = {};
		let hasAnyRanges = false;
		for(const strFactor of Object.keys(parsed)) {
			const factor = parseNumber(strFactor);
			if(isNaN(factor)) continue;
			if(!primes.includes(factor)) continue;

			let element = parsed[strFactor];
			//normalize to 2-element array, ignore invalid entries
			if(typeof(element) === "number")
				element = [0, element];
			else
				if(Array.isArray(element))
					element = [NaNToDefault(parseNumber(element[0]), 0), NaNToDefault(parseNumber(element[1]), 0)];
				else {
					const elementNum = parseNumber(parseNumber);
					if(isNaN(elementNum)) continue;
					element = [0, elementNum];
				}
			if(element[0] > element[1]) continue;
			newExpRanges[factor] = element;
			hasAnyRanges ||= (element[1] > element[0]);
		}
		if(Object.keys(newExpRanges).length <= 0) throw(new Error("Exponent ranges: no valid entries."));
		if(!hasAnyRanges) throw(new Error("Exponent ranges: no valid ranges."));

		prefs.primeFactors.expRanges = newExpRanges;
		if(!adjustingPreferences) saveControlPreference(ctlPrimeExpRanges);
	} catch(error) {
		console.warn(error);
		//codeBoxContentSet(ctlFlatScript, error.name + ": " + (error.message ?? error));
		ctlPrimeExpRanges?.classList?.add?.("invalid");
		if(globalThis.ctlPrimeExpRanges) ctlPrimeExpRanges.title = (error.message ?? error).toString();
		//ctlPrimeExpRanges?.setCustomValidity?.((error.message ?? error).toString());
		return false;
	}
	return true;
}

//recursive function
//to do: consider negative time scales
//question: require a special format for pattern names? (to prevent collision with future properties)
//question: 	or maybe group them into a "patterns" property?
//question: propagation of arbitrary/unrecognized properties? (currently a bad idea, because of patterns)
function parseNode(flatStruct, node, blockContext) {
	//alter context.
	//const newContext = Object.assign({}, blockContext);
	const newContext = structuredClone(blockContext);
	//to do: bounds check and node elimination? (e.g. when freqRatio or freq or volRatio or vol or timeScale = 0)
	newContext.timeDelta += newContext.timeScale * NaNToDefault(parseNumber(node.timeDelta), defaultBlockNode.timeDelta); //additive

	//multiplicative
	newContext.timeScale *= NaNToDefault(parseNumber(node.timeScale), defaultBlockNode.timeScale);
	newContext.freqRatio *= NaNToDefault(parseNumber(node.freqRatio), defaultBlockNode.freqRatio);
	newContext.volRatio *= NaNToDefault(parseNumber(node.volRatio), defaultBlockNode.volRatio);

	//absolute/substitutive
	/*for(const prop of Object.keys(node)) { //and others
		if(!relativeBlockProps.includes(prop) //exclude "blend" block properties
			&& isNaN(Number(prop))) { //numerical indices are reserved for notes
			let val = node[prop];
			if(!["boolean", "number", "bigint"].includes(typeof(val))) { //things that are not numbers...
				const numVal = parseNumber(val);
				if(!isNaN(numVal)) val = numVal; //...but could become numbers, should become numbers
			}
			if(["boolean", "number", "bigint", "string"].includes(typeof(val))) //property content must be ultimately simple
				newContext[prop] = val;
		}
	}*/
	if(node.timbre) newContext.timbre = node.timbre; //string expected.
	newContext.q = NaNToDefault(parseNumber(node.q), newContext.q);
	newContext.decayFactor = NaNToDefault(parseNumber(node.decayFactor), newContext.decayFactor);
	newContext.attack = NaNToDefault(parseNumber(node.attack), newContext.attack);
	newContext.portamento = NaNToDefault(parseNumber(node.portamento), newContext.portamento);
	newContext.vibratoFreq = NaNToDefault(parseNumber(node.vibratoFreq), newContext.vibratoFreq);
	newContext.vibratoDepth = NaNToDefault(parseNumber(node.vibratoDepth), newContext.vibratoDepth);
	newContext.vibratoAttack = NaNToDefault(parseNumber(node.vibratoAttack), newContext.vibratoAttack);
	if(node.remark) newContext.remark = node.remark; //string expected.
	if(node.tag) newContext.tag = node.tag; //string expected.

	//the presence of any of certain properties confirms there is a note in the node
	//to do: !allow noteStart to be inferred from previous noteStop
	//question:	or inferred by its node index?
	//to do: 	!how to get the previous note and its noteStop?
	if(Object.hasOwn(node, "noteStart") || Object.hasOwn(node, "duration") 
		|| Object.hasOwn(node, "freq") //even for unfiltered noise, presence of freq is accepted
		//|| (Object.hasOwn(node, "freq") && (node.timbre != "noise" || node.q != 0 || defaultNoteNode.q != 0)) //presence of freq only doesn't matter for unfiltered noise
		|| Object.hasOwn(node, "vol"))

		try {
			//register a note.
			node.noteStart = NaNToDefault(parseNumber(node.noteStart), defaultNoteNode.noteStart);
			//if a node doesn't have the duration property, don't add it; adding it might override noteStop.
			if(Object.hasOwn(node, "duration")) {
				node.duration = NaNToDefault(parseNumber(node.duration), defaultNoteNode.duration);
				node.noteStop = node.noteStart + node.duration;
			} else
				node.noteStop = NaNToDefault(parseNumber(node.noteStop), node.noteStart + defaultNoteNode.duration);

			const newNote = { //preferred order...
				noteStart: newContext.timeDelta + newContext.timeScale * node.noteStart,
				noteStop: newContext.timeDelta + newContext.timeScale * node.noteStop
			};
			const noteVol = newContext.volRatio * NaNToDefault(parseNumber(node.vol), defaultNoteNode.vol);
			if(noteVol != defaultNoteNode.vol) newNote.vol = noteVol;

			if(newContext.timbre != defaultNoteNode.timbre) newNote.timbre = newContext.timbre;
			if(node.freq0) newNote.freq0 = newContext.freqRatio * node.freq0;
			//to do: calculate proper freq0 while notes are still in hierarchy
			newNote.freq = newContext.freqRatio * NaNToDefault(parseNumber(node.freq), defaultNoteNode.freq); //unconditional, but later than timbre and freq0
			for(const prop of Object.keys(newContext)) //copy other properties
				if(newNote[prop] === undefined //not already present
					&& !relativeBlockProps.includes(prop) //exclude "blend" (relative) block properties
					&& !incrementalNoteProps.includes(prop) //exclude "blended" note properties
					&& (newNote.timbre != "noise" || !tonalOnlyProps.includes(prop))) { //some properties are pointless for atonal notes

					const val = newContext[prop];
					if(val !== undefined && (!Object.hasOwn(defaultNoteNode, prop) || val != defaultNoteNode[prop]))
						newNote[prop] = val;
				}
			/* //unfiltered noise has no intrinsic frequency, but uses it for calculating decayFactor
			if(newNote.timbre == "noise" && (newNote.q == 0 || (newNote.q === undefined && defaultNoteNode.q == 0))) {
				//delete newNote.freq; //frequency value being useless and omitted
				newNote.freq = 1 / newContext.timeScale; //frequency value being redefined from timeScale (ignoring freqRatio)
				delete newNote.freq0; //currently, no noise portamento
			} */
			if(newContext.remark != defaultNoteNode.remark) newNote.remark = newContext.remark;
			if(newContext.tag != defaultNoteNode.tag) newNote.tag = newContext.tag;

			flatStruct.push(newNote);
		} catch(error) {
			console.warn(error);
		}
	else
		if(node.remark) {
			//remark-only dummy note
			node.noteStart = NaNToDefault(parseNumber(node.noteStart), defaultNoteNode.noteStart);
			node.duration = 0;
			const newNote = { //preferred order...
				noteStart: newContext.timeDelta + newContext.timeScale * node.noteStart,
				noteStop: newContext.timeDelta + newContext.timeScale * node.noteStart,
				remark: newContext.remark
			};
			if(newContext.tag != defaultNoteNode.tag) newNote.tag = newContext.tag;
			flatStruct.push(newNote);
		}

	delete newContext.remark;
	for(let iNote = 0, t; (t = node[iNote]); iNote++) { //indexed sub-nodes
		if(typeof(t) === "string") { //reference by name
			//pattern invocation, local
			//question: local first really?
			if(Object.hasOwn(node, t))
				parseNode(flatStruct, node[t], newContext);
			else
				//pattern invocation, global
				if(Object.hasOwn(struct, t)) parseNode(flatStruct, struct[t], newContext);
		} else
			//primary recursion point.
			parseNode(flatStruct, t, newContext);
	}
}

let hasScriptChanged = true;
function flattenStruct(event) {
	if(!hasScriptChanged) return false;
	if(!globalThis.ctlStructuredScript) return false;
	try {
		struct = JSON.parse(codeBoxContentGet(ctlStructuredScript));
		if(!struct) throw(new Error("Structured script: couldn't parse JSON code."));

		ctlStructuredScript.classList.remove("invalid");
		ctlStructuredScript.title = "";
		//ctlStructuredScript.setCustomValidity(""); //setCustomValidity not available for <pre> elements
		setToolTip(outToolTip, "");

		const flatStruct = [];
		if(Array.isArray(struct)) {
			for(const elem of struct)
				parseNode(flatStruct, elem, defaultBlockNode);
		} else
			parseNode(flatStruct, struct, defaultBlockNode);

		//finally, yield the flattened version
		let objText = JSON.stringify(flatStruct, null, "\t");
		struct = null; //frees memory, hopefully
		//final adjustments on indentation
		let regex = new RegExp(/\{\n\t{2,}/, "g");
		objText = objText.replace(regex, "{");
		regex = new RegExp(/\n\t{2,}/, "g"); //to do: review this one closely, against hypothetical effects like " }"
		objText = objText.replace(regex, " ");
		regex = new RegExp(/\n\t{1,}\}/, "g");
		objText = objText.replace(regex, "}");

		if(!adjustingPreferences) saveControlPreference(ctlStructuredScript);
		codeBoxContentSet(ctlFlatScript, objText);
		ctlFlatScript.classList.remove("invalid", "outdated");
	} catch(error) {
		console.warn(error);
		//codeBoxContentSet(ctlFlatScript, error.name + ": " + (error.message ?? error));
		//codeBoxContentSet(ctlFlatScript, (error.message ?? error).toString());
		setToolTip(outToolTip, "Failure in structured code conversion. " + (error.message ?? error ?? ""), 3);

		ctlStructuredScript?.classList?.add?.("invalid");
		if(globalThis.ctlStructuredScript) ctlStructuredScript.title = (error.message ?? error).toString();
		//ctlStructuredScript?.setCustomValidity?.((error.message ?? error).toString());
		return false;
	}
	//job done, don't do it again
	hasScriptChanged = false;
	btnFlattenStruct.innerText = "Flattened";
	console.log("flattenStruct(): function ending");
	return true;
}

function setStructuredText(codeText) {
	hasScriptChanged = true;
	if(globalThis.btnFlattenStruct) btnFlattenStruct.innerText = "Flatten";
	if(globalThis.ctlStructuredScript) {
		codeBoxContentSet(ctlStructuredScript, codeText);
		if(!adjustingPreferences) saveControlPreference(ctlStructuredScript);
	} else
		throw(new Error("Control ctlStructuredScript not found."));
	if(prefs.flatScript.autoFlatten) flattenStruct();
	return true;
}

let flattenTimeoutID;
const flattenInterval = 1.5; //seconds
function scriptChanged(event) {
	ctlFlatScript?.classList?.add?.("outdated");
	if(!globalThis.flattenStruct) {
		console.info("scriptChanged(): function flattenStruct() not found. Returning.");
		return false;
	}
	hasScriptChanged = true;
	if(globalThis.btnFlattenStruct) btnFlattenStruct.innerText = "Flatten";

	if(flattenTimeoutID) {
		globalThis.clearTimeout(flattenTimeoutID);
		flattenTimeoutID = undefined;
	}
	if(prefs.flatScript.autoFlatten && !adjustingPreferences)
		flattenTimeoutID = globalThis.setTimeout(flattenStruct, flattenInterval * 1000);
	return true;
}

function setAutoFlatten(value) {
	if(!globalThis.flattenStruct) return false;
	prefs.flatScript.autoFlatten = value;
	if(prefs.flatScript.autoFlatten) {
		if(hasScriptChanged && !flattenTimeoutID)
			flattenTimeoutID = globalThis.setTimeout(flattenStruct, flattenInterval * 1000);
	} else {
		if(flattenTimeoutID) {
			globalThis.clearTimeout(flattenTimeoutID);
			flattenTimeoutID = undefined;
		}
	}
	return true;
}
