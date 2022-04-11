var struct, flatStruct;

//recursive call
function parseObj(node, blockContext) {
	//alter context.
	let newContext = {};
	Object.assign(newContext, blockContext);
	//to do: bounds check and node elimination? (e.g. when freqRatio <= 0)
	newContext.timeDelta += newContext.timeScale * nullToDefault(parseNumber(node.timeDelta), 0); //additive
	
	//multiplicative
	newContext.timeScale *= nullToDefault(parseNumber(node.timeScale), 1);
	newContext.volRatio *= nullToDefault(parseNumber(node.volRatio), 1);
	newContext.freqRatio *= nullToDefault(parseNumber(node.freqRatio), 1);

	//absolute
	newContext.decayFactor = nullToDefault(parseNumber(node.decayFactor), newContext.decayFactor);
	newContext.attack = nullToDefault(parseNumber(node.attack), newContext.attack);

	//to do: allow noteStart to be inferred from previous noteStop?
	if(node.hasOwnProperty("noteStart")) {
		//register a note.
		node.noteStart = nullToDefault(parseNumber(node.noteStart), defaultNoteNode.noteStart);
		//if a node doesn't have the duration property, don't add it; adding it might override noteStop.
		if(node.hasOwnProperty("duration")) {
			node.duration = nullToDefault(parseNumber(node.duration), defaultNoteNode.duration);
			node.noteStop = node.noteStart + node.duration;
		} else {
			node.noteStop = nullToDefault(parseNumber(node.noteStop), node.noteStart + defaultNoteNode.duration);
		}
		
		let newNote = {
			noteStart: newContext.timeDelta + newContext.timeScale * node.noteStart,
			noteStop: newContext.timeDelta + newContext.timeScale * node.noteStop,
			freq: newContext.freqRatio * nullToDefault(parseNumber(node.freq), defaultNoteNode.freq)
		};
		let noteVol = newContext.volRatio * nullToDefault(parseNumber(node.vol), defaultNoteNode.vol);
		if(noteVol != defaultNoteNode.vol) {newNote.vol = noteVol;}
		if(newContext.decayFactor != defaultNoteNode.decayFactor) {newNote.decayFactor = newContext.decayFactor;}
		if(newContext.attack != defaultNoteNode.attack) {newNote.attack = newContext.attack;}
		flatStruct.push(newNote);
	}

	for(let iNote = 0, t; t = node[iNote]; iNote++) {
		if(typeof(t) === "string") {
			//pattern invocation, local
			//to do: local first really?
			if(node.hasOwnProperty(t)) {
				parseObj(node[t], newContext);
			} else {
				//pattern invocation, global
				if(struct.hasOwnProperty(t)) {parseObj(struct[t], newContext);}
			}
		} else {
			//primary recursion point.
			parseObj(t, newContext);
		}
	}
}

var hasScriptChanged = false;
function parseScript() {
	try {
		struct = JSON.parse(elems.ctlStructuredScript.innerText);
		flatStruct = []; //out with the old regardless of success
		if(Array.isArray(struct)) {
			for(let x of struct) {
				parseObj(x, defaultBlockNode);
			}
		} else {
			parseObj(struct, defaultBlockNode);
		}
		
		//finally, yield the flattened version
		let s = JSON.stringify(flatStruct, null, "\t");
		//final adjustments on indentation
		let regex = new RegExp(/\{\n\t{2,}/, "g");
		s = s.replace(regex, "{");
		regex = new RegExp(/\n\t{2,}/, "g");
		s = s.replace(regex, " ");
		regex = new RegExp(/\n\t{1,}\}/, "g");
		s = s.replace(regex, "}");
		elems.ctlFlatScript.innerText = s;
	} catch(err) {
		//elems.ctlFlatScript.innerText = err.name + ": " + err.message;
		elems.ctlFlatScript.innerText = err.toString();
	}
	//job done, don't do it again
	hasScriptChanged = false;
	elems.btnParseScript.innerText = "Flattened";
}

var flattenTimeoutID;
const flattenInterval = 1.5 * 1000;
function scriptChanged() {
	hasScriptChanged = true;
	elems.btnParseScript.innerText = "Flatten";
	
	if(flattenTimeoutID) {
		window.clearTimeout(flattenTimeoutID);
		flattenTimeoutID = undefined;
	}
	if(autoFlatten) {
		flattenTimeoutID = window.setTimeout(parseScript, flattenInterval);
	}
}

function setAutoFlatten(value) {
	autoFlatten = value;
	if(autoFlatten) {
		if(hasScriptChanged && !flattenTimeoutID) {flattenTimeoutID = window.setTimeout(parseScript, flattenInterval);}
	} else {
		if(flattenTimeoutID) {
			window.clearTimeout(flattenTimeoutID);
			flattenTimeoutID = undefined;
		}
	}
}
