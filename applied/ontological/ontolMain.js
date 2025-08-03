"use strict";

function randomFromList(list, refValue, inclusive) {
	if(!list || list.length < 1) return undefined;
	if(refValue) {
		let itemIndex = Math.max(list.indexOf(refValue) + Number(!inclusive), 0);
		return list[itemIndex + Math.floor((list.length - itemIndex) * Math.random())];
	} else
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

		/* case type.startsWith("analytical.realpositive"):
			value = - Math.log(rnd); //may yield infinity
			break; */

		case type.startsWith("analytical.realnonneg"):
			value = - Math.log(1.0 - rnd);
			break;

		case type.startsWith("analytical.real"):
			value = Math.log((1.0 - rnd) / rnd); //inverse sigmoid: real number (symmetrical)
			break;

		case type.startsWith("analytical.intnonneg"):
			//value = Math.trunc(- Math.log(rnd)); //may yield infinity
			value = Math.trunc(- Math.log(1.0 - rnd));
			break;

		case type.startsWith("analytical.int"):
			value = Math.round(Math.log((1.0 - rnd) / rnd));
			break;

		/* case type.startsWith("analytical"):
			break; */

		default:
			value = - Math.log(- Math.log(rnd)); //inverse sigmoid: real number (skewed towards positive numbers)
			break;
	}

	//const magnitude = Math.floor(Math.log10(Math.abs(value))), grain = Math.pow(10.0, magnitude - 3);
	//return grain * Math.round(value / grain);
	//return value.toPrecision(4);
	return value;

	//to do:
	//	quantitative functions
}
function randomLength() {
	//(1.0 - Math.random()) avoids 0 (might return 1).
	//const rndPositive = -4 * Math.log(1.0 - Math.random());
	//const rndPositive = - Math.E * Math.log(1.0 - Math.random());
	const rndPositive = -2 * Math.log2(1.0 - Math.random());
	return 1 + Math.trunc(rndPositive);
}
function makeString(length) {
	let lengthN = Number(length);
	if(length === null || isNaN(lengthN)) {
		lengthN = randomLength();
	} else {
		if(lengthN < 1) return "";
	}

	const fnLetterCode = () => (
		"a".charCodeAt() + Math.trunc(26 * Math.random())
	);
	const charList = Array.from(Array(lengthN), fnLetterCode);
	//const charList = Array(lengthN).map(fnLetterCode); //map doesn't work with an empty array.
	return String.fromCodePoint(...charList);
}
/* function makeList(length, elemCategory) {
	let lengthN = Number(length);
	if(length === null || isNaN(lengthN)) {
		lengthN = randomLength();
	} else {
		if(lengthN < 1) return [];
	}

	const fnContent = (elem, index) => (
		makeNewContent(elemCategory)
	);
	const list = Array.from(Array(lengthN), fnContent);
	//const list = Array(lengthN).map(fnContent); //map doesn't work with an empty array.
	return list;
} */

var modRules;

//returns a (hierarchical) list of subtypes
//accepts a starting point, with refValues
function valuesFromTaxonomy(taxRoot, refValues, inclusive) {
	const value = [];
	let checkRef = Boolean(refValues) && refValues.length > 0;
	if(checkRef && !inclusive) { //transforms a non-inclusive path into an inclusive one
		for(let i = refValues.length - 1, parentList, pos; i >= 0; i--) {
			let parent = (i < 1) ? taxRoot : refValues[i - 1];
			parentList = modRules.taxonomy[parent];
			pos = parentList.indexOf(refValues[i]);
			if(pos < parentList.length - 1) { //is it the last in its list?
				refValues[i] = parentList[pos + 1];
				inclusive = true;
				break;
			} else {
				refValues.pop();
				if(refValues.length < 1) return value;
			}
		}
	}
	let i = 0, subValue;
	do {
		const rootList = modRules.taxonomy[taxRoot];
		if(checkRef) { //has starting point to check
			if(inclusive || i < refValues.length - 1)
				subValue = randomFromList(rootList, refValues[i], true);
			else
				subValue = randomFromList(rootList, refValues[i], false)
				 ?? randomFromList(rootList, refValues[i], true);

			checkRef = subValue === refValues[i] && ++i < refValues.length;
		} else
			subValue = randomFromList(rootList);

		if(subValue) { //add to list, if there is something, and move forward
			value.push(subValue);
			taxRoot = subValue;
		}
	} while(subValue);
	return value;
};

//generator main routine
//recursive function
//rootCat should be an array, that might include the categories of its fields
function makeNewContent(rootCat, parentContext, repeatDepthLimit) {
	console.log("makeNewContent", ...arguments);
	/* const content = {category: rootCat};
	if(!rootCat) return content; */
	let content = {category: rootCat};
	if(!rootCat) return content;
	if(!modRules) return content;

	if(!Array.isArray(rootCat)) rootCat = rootCat.split("/");
	let cat1, cat2; //to do: use just an array?
	/* const separatorIdx = rootCat.indexOf("/");
	if(separatorIdx >= 0) {
		cat1 = rootCat.substring(0, separatorIdx);
		cat2 = rootCat.slice(separatorIdx + 1);
	} */
	cat1 = rootCat[0];
	if(Array.isArray(cat1)) cat1 = cat1.join("."); //necessary?
	cat2 = rootCat.slice(1);

	if(parentContext == undefined) parentContext = "";
	//for the moment, only take the last part of the parent context.
	//if(parentContext.includes("/")) parentContext = parentContext.split("/").at(-1);
	const lastSeparatorIdx = parentContext.lastIndexOf("/");
	if(lastSeparatorIdx >= 0) parentContext = parentContext.slice(lastSeparatorIdx + 1);

	//to do: add a parentCat parameter, and maybe an inclusive boolean?

	const defaultRepeatDepthLimit = 2;
	if(repeatDepthLimit == undefined)
		repeatDepthLimit = defaultRepeatDepthLimit;
	else
		if(repeatDepthLimit < 1) return content; //?

	const fieldValue = (field) => {
		let newContext = (parentContext.length > 0) ? parentContext + "/" + field : field;
		let fieldCat;
		const newContent = (fieldCat) => makeNewContent(fieldCat, newContext, repeatDepthLimit - Number(fieldCat[0] === cat1));

		//try to define category first
		if(cat2.length >= 1) {
			fieldCat = cat2;
		} else {
			const newCat = randomFromList(modRules.fieldCategories[cat1 + "/" + field]) 
			 ?? randomFromList(modRules.fieldCategories[field]);
			if(newCat)
				fieldCat = newCat.split("/");
			else
				fieldCat = [];
		}
		let value;
		if(fieldCat[0]) { //value later
			//question: direct value generation here, or in the sub-call?
			value = randomFromList(modRules.categoryValues[field + "/" + fieldCat[0]]); //currently: here if the selector is more specific
			//value = randomFromList(modRules.categoryValues[field + "/" + fieldCat[0]]) ?? randomFromList(modRules.categoryValues[fieldCat[0]]); //here, as much as possible
			if(!value)
				value = newContent(fieldCat);
		} else {
			//ok, try value first then
			value = randomFromList(modRules.fieldValues[cat1 + "/" + field])
			 ?? randomFromList(modRules.fieldValues[field]);
			if(value) {
				if(value.startsWith("taxonomy:"))
					value = valuesFromTaxonomy(value.slice(value.indexOf(":") + 1)).join("."); //to do: potential starting point (refValue)?
			} else {
				//ok, category first again
				if(modRules.taxonomy.category.includes(cat1.split(".")[0]))
					fieldCat = [valuesFromTaxonomy("category", cat1.split("."), repeatDepthLimit > 1).join(".")];
				else
					//something from the last category (analytical)
					//fieldCat = modRules.fieldValues.category.at(-1);
					fieldCat = valuesFromTaxonomy("category", [modRules.taxonomy.category.at(-1)], true);
				value = newContent(fieldCat);
			}
		}
		return value;
	};

	//specific content generators
	//primary (depending only of category/type description)
	const cat1Arr = cat1.split(".");
	if(cat1Arr[0] == "analytical") {
		if(cat1Arr[1] == "list") {
			const length = cat1Arr[2];
			let lengthN = Number(length);
			if(length === null || isNaN(lengthN)) {
				lengthN = randomLength();
			}
			//content = makeList(length, cat2);
			//content = Array.from(Array(lengthN), fnContent);
			content = [];
			for(let index = 0; index < lengthN; index++) {
				const field = index.toString();
				content[index] = fieldValue(field);
			}
		} else
			content.value = makeQuantitative(cat1);
	} else {
		//if(!modRules) return content;

		//e.g. if rootCat is ["roles", "agent"] ("roles/agent" in the rule-set), and it admits a "value":
		//the value depends first on values for "roles/agent", or else values for just "roles" (less specific).
		//including parent field name makes the selector more specific, which goes first.
		const tryTakeFromList = (selector) => { //to do: rename "take" to "get" of "fill"
			if(content.value) return;
			const list = modRules.categoryValues[selector];

			if(!list) return;
			let value = randomFromList(list);

			if(value.startsWith("taxonomy:"))
				value = valuesFromTaxonomy(value.slice(value.indexOf(":") + 1)).join("."); //to do: potential starting point (refValue)?

			content.value = value;
		};
		//if(cat2) tryTakeFromList(cat2);
		if(parentContext.length > 0) {
			tryTakeFromList(parentContext + "/" + rootCat.join("/"));
			if(rootCat.length > 1) tryTakeFromList(parentContext + "/" + cat1);
		}
		tryTakeFromList(rootCat.join("/"));
		if(rootCat.length > 1) tryTakeFromList(cat1);

		/* if(!content.value && rootCat === "string")
			content.value = makeString(); */
		if(!content.value && cat1Arr[0] === "string")
			content.value = makeString(...cat1Arr.slice(1));
	}
	//to do:
	//	strings: names/pronounceable words
	//	colors
	//	references
	//	functions

	if(Array.isArray(content)) return content; //properties wouldn't survive the serialization of an array
	//if(!modRules) return content;
	//composite object (map): field choice and filling
	//required and primary (arbitrary, i.e. most independent) fields
	//let fieldList = modRules.categoryFieldsReq[rootCat] ?? modRules.categoryFieldsReq[cat1];
	//looks under multiple selection criteria. if multiple field lists exist, merge them.
	let fieldList = [];
	const tryIncludeFieldList = (selector) => {
		const list = modRules.categoryFieldsReq[selector];
		if(list) fieldList = fieldList.concat(list);
	};
	//including parent field name makes the selector more specific, which goes first.
	if(parentContext.length > 0) {
		tryIncludeFieldList(parentContext + "/" + rootCat.join("/"));
		tryIncludeFieldList(parentContext + "/" + cat1);
	}
	tryIncludeFieldList(rootCat.join("/"));
	tryIncludeFieldList(cat1);

	if(fieldList.length >= 1)
		for(const field of fieldList) {
			if(content[field]) continue; //avoid superposition/duplicate generation (I could have used a set of fields instead)
			content[field] = fieldValue(field);
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
		content[field] = modRules.fieldValues[field][0];
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
