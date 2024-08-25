"use strict";

//imported variables
var elems;
var autoFlatten;

//shared variables
var struct;

//recursive function
//to do: consider negative time scales
//question: propagation of arbitrary/unrecognized properties? (probably a bad idea, because of patterns)
//question: require a special format for pattern names? (to prevent collision with future properties)
function parseNode(flatStruct, node, blockContext) {
	//alter context.
	const newContext = Object.assign({}, blockContext);
	//to do: bounds check and node elimination? (e.g. when freqRatio or freq or volRatio or vol or timeScale = 0)
	newContext.timeDelta += newContext.timeScale * NaNToDefault(parseNumber(node.timeDelta), 0); //additive
	
	//multiplicative
	newContext.timeScale *= NaNToDefault(parseNumber(node.timeScale), 1);
	newContext.volRatio *= NaNToDefault(parseNumber(node.volRatio), 1);
	newContext.freqRatio *= NaNToDefault(parseNumber(node.freqRatio), 1);

	//absolute/substitutive
	/*for(const prop in node) { //and others
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

	//to do: allow noteStart to be inferred from previous noteStop? or inferred by its node index?
	if(node.hasOwnProperty("noteStart") || node.hasOwnProperty("duration") || node.hasOwnProperty("freq") || node.hasOwnProperty("vol"))
		try {
			//register a note.
			node.noteStart = NaNToDefault(parseNumber(node.noteStart), defaultNoteNode.noteStart);
			//if a node doesn't have the duration property, don't add it; adding it might override noteStop.
			if(node.hasOwnProperty("duration")) {
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
			for(const prop in newContext) { //copy other properties
				if(!relativeBlockProps.includes(prop) //exclude "blend" (relative) block properties
					&& !incrementalNoteProps.includes(prop) //exclude "blended" note properties
					&& (newNote.timbre != "noise" || !tonalOnlyProps.includes(prop))) { //some properties are pointless for atonal notes
						const val = newContext[prop];
						if(val !== undefined && (!defaultNoteNode.hasOwnProperty(prop) || val != defaultNoteNode[prop]))
							newNote[prop] = val;
					}
			}
			if(newContext.remark != defaultNoteNode.remark) newNote.remark = newContext.remark;
			if(newContext.tag != defaultNoteNode.tag) newNote.tag = newContext.tag;

			flatStruct.push(newNote);
		} catch(error) {
			console.error(error);
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
			if(node.hasOwnProperty(t))
				parseNode(flatStruct, node[t], newContext);
			else
				//pattern invocation, global
				if(struct.hasOwnProperty(t)) parseNode(flatStruct, struct[t], newContext);
		} else
			//primary recursion point.
			parseNode(flatStruct, t, newContext);
	}
}

let hasScriptChanged = true;
function flattenStruct() {
	if(!hasScriptChanged) return false;
	try {
		if(["INPUT", "TEXTAREA"].includes(ctlStructuredScript.tagName.toUpperCase()))
			struct = JSON.parse(ctlStructuredScript.value);
		else
			struct = JSON.parse(ctlStructuredScript.innerText);
		ctlStructuredScript.classList.remove("invalid");
		//ctlStructuredScript.setCustomValidity(""); //setCustomValidity not available for <pre> elements
		const flatStruct = [];
		if(Array.isArray(struct)) {
			for(const elem of struct)
				parseNode(flatStruct, elem, defaultBlockNode);
		} else
			parseNode(flatStruct, struct, defaultBlockNode);
		
		//finally, yield the flattened version
		let s = JSON.stringify(flatStruct, null, "\t");
		struct = null; //frees memory, hopefully
		//final adjustments on indentation
		let regex = new RegExp(/\{\n\t{2,}/, "g");
		s = s.replace(regex, "{");
		regex = new RegExp(/\n\t{2,}/, "g"); //to do: review this one closely, against hypothetical effects like " }"
		s = s.replace(regex, " ");
		regex = new RegExp(/\n\t{1,}\}/, "g");
		s = s.replace(regex, "}");
		ctlFlatScript.innerText = s;
		ctlFlatScript.classList.remove("invalid");
	} catch(error) {
		//ctlFlatScript.innerText = error.name + ": " + error.message;
		ctlFlatScript.innerText = error.toString();
		ctlStructuredScript.classList.add("invalid");
		//ctlStructuredScript.setCustomValidity(error.toString());
	}
	//job done, don't do it again
	hasScriptChanged = false;
	btnFlattenStruct.innerText = "Flattened";
}

function setStructuredText(s) {
	hasScriptChanged = true;
	if(window.btnFlattenStruct) btnFlattenStruct.innerText = "Flatten";
	if(window.ctlStructuredScript) {
		if(["INPUT", "TEXTAREA"].includes(ctlStructuredScript.tagName.toUpperCase()))
			ctlStructuredScript.value = s;
		else
			ctlStructuredScript.innerText = s;
	}
	if(autoFlatten) flattenStruct();
}

let flattenTimeoutID;
const flattenInterval = 1.5; //seconds
function scriptChanged() {
	hasScriptChanged = true;
	if(window.btnFlattenStruct) btnFlattenStruct.innerText = "Flatten";
	
	if(flattenTimeoutID) {
		window.clearTimeout(flattenTimeoutID);
		flattenTimeoutID = undefined;
	}
	if(autoFlatten)
		flattenTimeoutID = window.setTimeout(flattenStruct, flattenInterval * 1000);
}

function setAutoFlatten(value) {
	autoFlatten = value;
	if(autoFlatten) {
		if(hasScriptChanged && !flattenTimeoutID) flattenTimeoutID = window.setTimeout(flattenStruct, flattenInterval * 1000);
	} else {
		if(flattenTimeoutID) {
			window.clearTimeout(flattenTimeoutID);
			flattenTimeoutID = undefined;
		}
	}
}
