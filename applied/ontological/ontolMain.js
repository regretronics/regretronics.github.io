"use strict";

function randomFromList(list) {
	if(!list || list.length < 1) return undefined;
	return list[Math.floor(list.length * Math.random())];
}
function makeQuantitative(type) {
	const rnd = Math.random(); //uniform distribution: between 0 and 1 (0 <= rnd < 1, precisely)
	/* if(type.startsWith("analytical.fractionary")) return rnd;
	if(type.startsWith("analytical.bit")) return Math.round(rnd); //also serves as logical value
	if(type.startsWith("analytical.realpositive")) return - Math.log(rnd);
	if(type.startsWith("analytical.real")) return Math.log((1.0 - rnd) / rnd); //inverse sigmoid: real number (symmetrical)
	if(type.startsWith("analytical.intnonneg")) return Math.trunc(- Math.log(rnd));
	if(type.startsWith("analytical.int")) return Math.round(Math.log((1.0 - rnd) / rnd));
	//if(type.startsWith("analytical.")) return ;

	return - Math.log(- Math.log(rnd)); //inverse sigmoid: real number (skewed towards positive numbers) */

	let value;
	switch(true) {
		case type.startsWith("analytical.fractionary"):
			value = rnd;
			break;

		case type.startsWith("analytical.bit"):
			value = Math.round(rnd); //also serves as logical value
			break;

		case type.startsWith("analytical.realpositive"):
			value = - Math.log(rnd);
			break;

		case type.startsWith("analytical.real"):
			value = Math.log((1.0 - rnd) / rnd); //inverse sigmoid: real number (symmetrical)
			break;

		case type.startsWith("analytical.intnonneg"):
			value = Math.trunc(- Math.log(rnd));
			break;

		case type.startsWith("analytical.int"):
			value = Math.round(Math.log((1.0 - rnd) / rnd));
			break;

		/* case type.startsWith("analytical"):
			break; */

		default:
			value = - Math.log(- Math.log(Math.random())); //inverse sigmoid: real number (skewed towards positive numbers)
			break;
	}

	//const magnitude = Math.floor(Math.log10(Math.abs(value))), grain = Math.pow(10.0, magnitude - 3);
	//return grain * Math.round(value / grain);
	//return value.toPrecision(4);
	return value;

	//to do:
	//	vectors
	//	quantitative functions
}

var modRules;

//generator main routine
//recursive function
function makeNewContent(rootCat, repeatDepthLimit) {
	/* let content = { //rejected format
		conceptual: {
			process: "adolescence"
		}
	}; */
	/* let content = {
		"conceptual.process": "adolescence"
	}; */
	/* let content = {
		category: "conceptual",
		category2: "process",
		type: "adolescence",
		roles: {
			father: {
				category: "material",
				category2: "person",
				name: "Paul",
			},
			mother: {
				category: "material",
				category2: "person",
				name: "Mary",
			},
			firstPerson: {
				category: "material",
				category2: "person",
				name: "George",
			},
		},
	}; */

	const content = {category: rootCat};
	if(!rootCat) return content;
	if(!modRules) return;

	let cat1, cat2;
	//specific content generators
	//primary (depending only of category/type description)
	if(rootCat.startsWith("analytical"))
		content.value = makeQuantitative(rootCat);
	else {
		const pointIdx = rootCat.indexOf(".");
		if(pointIdx >= 0) {
			cat1 = rootCat.substring(0, pointIdx);
			cat2 = rootCat.slice(pointIdx + 1);
		}

		//e.g. if rootCat is "roles.role", and it admits a "value":
		//the value depends first on values for "roles.role", or else values for just "roles" (less specific).
		//if(cat2 && categoryValues[cat2])
		//	content.value = randomFromList(categoryValues[cat2]);
		if(!content.value && modRules.categoryValues[rootCat])
			content.value = randomFromList(modRules.categoryValues[rootCat]);
		if(!content.value && cat1 && modRules.categoryValues[cat1])
			content.value = randomFromList(modRules.categoryValues[cat1]);
	}
	//to do:
	//	strings
	//		names/pronounceable words
	//	colors
	//	variable-sized arrays
	//	references
	//	functions

	const defaultRepeatDepthLimit = 2;
	if(repeatDepthLimit == undefined)
		repeatDepthLimit = defaultRepeatDepthLimit;
	else
		if(repeatDepthLimit < 1) return content;

	//composite object (map): field choice and filling
	//required and primary (arbitrary, most independent) fields
	let fieldList = modRules.categoryFieldsReq[rootCat] ?? modRules.categoryFieldsReq[cat1];
	if(fieldList) {
		//const catIndex = modRules.fieldInstances.category.indexOf(rootCat) /* + 1 */;
		let catIndex = modRules.fieldInstances.category.indexOf(rootCat);
		const catCount = modRules.fieldInstances.category.length;
		if(catIndex + 1 < catCount && repeatDepthLimit < 2) catIndex++;
		for(const field of fieldList) {
			let fieldCat = cat2 ?? randomFromList(modRules.fieldCategories[field]), value;
			if(fieldCat) {
				value = randomFromList(modRules.fieldInstances[field + "." + fieldCat]);
				if(!value)
					value = makeNewContent(fieldCat, (fieldCat === rootCat) ? (repeatDepthLimit - 1) : defaultRepeatDepthLimit);
			} else {
				value = randomFromList(modRules.fieldInstances[field]);
				if(!value) {
					//if(catIndex > 0 && catIndex <= catCount)
					if(catIndex >= 0)
						fieldCat = modRules.fieldInstances.category[catIndex
						 + Math.floor((catCount - catIndex) * Math.random())];
					else
						fieldCat = modRules.fieldInstances.category.at(-1);
					value = makeNewContent(fieldCat, (fieldCat === rootCat) ? (repeatDepthLimit - 1) : defaultRepeatDepthLimit);
				}
			}
			content[field] = value;
		}
	}
	//to do:
	//modRules.categoryFieldsOpt
	//optional and primary (arbitrary) fields
	//required and dependent fields
	//optional and dependent fields

	//the explicit stack approach may become unnecessary, but I'm not sure yet.
	/* const contentStack = {};
	let field = "category";
	content[field] = rootCat;
	do {
		content[field] = modRules.fieldInstances[field][0];
		//deepen
		//iterate
		//return
	} while(); */

	return content;
}
function jsonReplacer(key, value) {
	if(typeof(value) === "number") {
		/* const magnitude = Math.floor(Math.log10(Math.abs(value)));
		const grain = Math.pow(10.0, magnitude - 3);
		return grain * Math.round(value / grain); */
		return value.toPrecision(4);
	}
	return value;
}

function btnGenerateContentClick(event) {
	const selectedCat = selRootCategory.value;
	let isCatRandom = selectedCat == "random";
	if(!isCatRandom && !modRules.fieldInstances.category.includes(selectedCat))
		isCatRandom = true;
	const rootCat = (isCatRandom ? randomFromList(modRules.fieldInstances.category) : selectedCat);

	const content = makeNewContent(rootCat);
	//outSummary.textContent = JSON.stringify(content, null, "\t");
	outSummary.textContent = JSON.stringify(content, jsonReplacer, "\t");
}
function editorKeyDown(event) {
	if(event.key == "Tab") {
		event.stopPropagation();
		event.preventDefault();

		//tried to dispatch input or beforeinput events. didn't work.
		//event.target.dispatchEvent(new InputEvent("beforeinput", {data: "\t", inputType: "insertText"}));

		event.target.focus(); //unnecessary?
		/* if(event.shiftKey)
			deletePrevTab();
		else */
			document.execCommand("insertText", false, "\t");
	}
	//to do: home key goes past initial indentation?
}
async function inputDBBlur(event) {
	await loadRules(inputDB.textContent);
	loadCategoryList();
}

async function loadDefaultRules() {
	//if(!window.defaultRules) return false;
	//const url = defaultRules.href;
	const url = "ontolSource.js";
	const response = await fetch(url, {mode: "same-origin"});
	//const response = await fetch(url, {mode: "no-cors"});
	//const response = await fetch(url, {mode: "cors"});
	if(!response.ok) {
		console.log(response);
		throw new Error(`Response status: ${response.status}`);
	}
	return await response.text();
}
function loadCategoryList() {
	selRootCategory.options.length = 1 + modRules.fieldInstances.category.length;
	modRules.fieldInstances.category.forEach((element, index) => {
		const optItem = selRootCategory.item(1 + index);
		if(!optItem) return;
		optItem.text = element;
	});
}
async function loadRules(scriptText) {
	const blob = new Blob([scriptText], {type: "text/javascript"});
	//const script = document.createElement("script");
	const url = URL.createObjectURL(blob);
	//script.onload = script.onerror = () => URL.revokeObjectURL(url);
	//script.src = url;
	//document.body.appendChild(script);
	//modRules = await import(defaultRules.href);
	//modRules = await import("ontolSource.js");
	modRules = await import(url);
	URL.revokeObjectURL(url);
}
function pageLoaded(event) {
	//load HTML element references (renders document.getElementById unnecessary)
	for(const s of document.querySelectorAll("[id]"))
		window[s.id] = s;

	//trap UI changes
	btnGenerateContent.addEventListener("click", btnGenerateContentClick);
	for(const elem of document.getElementsByClassName("code-editor")) {
		elem.addEventListener("keydown", editorKeyDown);
		//elem.addEventListener("paste", editorPaste);
		//elem.addEventListener("input", editorChanged);
		//elem.addEventListener("keyup", recalcEditorCursorPos);
		//elem.addEventListener("click", recalcEditorCursorPos);
	}
	if(window.inputDB) inputDB.addEventListener("blur", inputDBBlur);
}
async function pageReady(event) {
	/* try {
		const text = await loadDefaultRules();
		inputDB.textContent = text;
		await loadRules(text);
	} catch(error) {
		//await loadRules(inputDB.textContent);
		inputDB.textContent = error.message;
	} */
	await loadRules(inputDB.textContent);
	loadCategoryList();

	const rootCat = randomFromList(modRules.fieldInstances.category);
	const content = makeNewContent(rootCat);
	//outSummary.textContent = JSON.stringify(content, null, "\t");
	outSummary.textContent = JSON.stringify(content, jsonReplacer, "\t");
}
