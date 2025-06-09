"use strict";

const categoryValues = {
	/* "analytical.bit": [0, 1], */
	role: ["Mary", "John"],
};
const fieldInstances = {
	category: ["conceptual", "practical", "material", "physical", "analytical"],
	process: ["adolescence"],
	entity: ["person", "object"],
	property: ["age", "length", "matComposition"],
	type: ["typeA", "typeB", "typeC"],
	something1: ["fasf", 123, {asdf: 31234}],
	"something1.string": ["asdf", "tert", "asdfdr"],
};
/* const ontolSubcategories = {
	conceptual: ["process", "relation", "role", "agent"],
	practical: ["entity", "property", "propValue"],
	material: ["universe", "person", "time", "space", "density", "probability"],
	physical: ["quantity", "unit", "measurement"],
	analytical: ["set", "sequence", "vector", "number"],
}; */

const categoryFieldsReq = {
	conceptual: ["type", "roles"],
	practical: ["practical1", "practical2"],
	material: ["material1", "material2"],
	physical: ["physical1", "physical2"],
	//analytical: [],

	roles: ["protagonist", "antagonist"],
	/* process: ["type", "roles"],
	relation: ["type", ""],
	role: ["type", "agent"],
	agent: ["category", ""], */
};
const categoryFieldsOpt = {
	process: ["type", "roles"],
};

const instanceFields = { //?
	/* "adolescence": ["roles"], */
};
const fieldCategories = {
	category: ["string"],
	/* type: ["string", "analytical"], */
	/* roles: ["list of agent"], */
	roles: ["roles.role"],
	/* role: ["agent"], */
	physical1: ["analytical", "string"],
};
