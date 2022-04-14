let struct;

//recursive call
function parseNode(flatStruct, node, blockContext) {
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
	//to do: use a logical disjunction (OR port) to allow multiple properties to define a note?
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
				parseNode(flatStruct, node[t], newContext);
			} else {
				//pattern invocation, global
				if(struct.hasOwnProperty(t)) {parseNode(flatStruct, struct[t], newContext);}
			}
		} else {
			//primary recursion point.
			parseNode(flatStruct, t, newContext);
		}
	}
}

var hasScriptChanged = true;
function flattenStruct() {
	if(!hasScriptChanged) return;
	try {
		struct = JSON.parse(elems.ctlStructuredScript.innerText);
		let flatStruct = [];
		if(Array.isArray(struct)) {
			for(let x of struct) {
				parseNode(flatStruct, x, defaultBlockNode);
			}
		} else {
			parseNode(flatStruct, struct, defaultBlockNode);
		}
		
		//finally, yield the flattened version
		let s = JSON.stringify(flatStruct, null, "\t");
		struct = null; //frees memory
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
	elems.btnFlattenStruct.innerText = "Flattened";
}

function setStructuredText(s) {
	hasScriptChanged = true;
	elems.btnFlattenStruct.innerText = "Flatten";
	elems.ctlStructuredScript.innerText = s;
	if(autoFlatten) flattenStruct();
}

var flattenTimeoutID;
const flattenInterval = 1.5;
function scriptChanged() {
	hasScriptChanged = true;
	elems.btnFlattenStruct.innerText = "Flatten";
	
	if(flattenTimeoutID) {
		window.clearTimeout(flattenTimeoutID);
		flattenTimeoutID = undefined;
	}
	if(autoFlatten) {
		flattenTimeoutID = window.setTimeout(flattenStruct, flattenInterval * 1000);
	}
}

function setAutoFlatten(value) {
	autoFlatten = value;
	if(autoFlatten) {
		if(hasScriptChanged && !flattenTimeoutID) {flattenTimeoutID = window.setTimeout(flattenStruct, flattenInterval * 1000);}
	} else {
		if(flattenTimeoutID) {
			window.clearTimeout(flattenTimeoutID);
			flattenTimeoutID = undefined;
		}
	}
}
