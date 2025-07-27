"use strict";

var pos, dPos, rot, dRot;
//var vars;
var clientSpcTransf;

//to do: interpretation of key press time.
const inputKeyBlank = {
	keyCode: NaN,
	inputMode: "", //inputMode could be "onKeyDownOnce", "onKeyDown", "onKeyUp", "ifPressed".
	cmdName: "",
	action: "",
	object: "",
	param: null
};
const inputGamepadBlank = {
	controllerIndex: NaN,
	inputKind: "",
	inputPath: NaN,
	varName: "",
	action: "",
	object: "",
	param: null
};
//to do: object inside of an object (keyed by inputMode)?
var inputKeyMap, keysPressed, inputGamepadMap;

const IdentityMatrix3 = [
	1.0, 0.0, 0.0,
	0.0, 1.0, 0.0,
	0.0, 0.0, 1.0
];

function actionAdd(actionName, obj, param, magnitude) {
	//if (magnitude === undefined) magnitude = 1.0;
	if (!actionName.startsWith("add")) return;
	for (const key in obj)
		if (Object.hasOwnProperty.call(obj, key) && Object.hasOwnProperty.call(param, key))
			if (magnitude === undefined)
				obj[key] += param[key];
			else
				obj[key] += magnitude * param[key];
}
function commandFired(actionName, objName, param, magnitude) {
	//if (actionName.startsWith("add")) actionAdd(actionName, vars[objName], param, magnitude);
	const actionMap = {
		"add": actionAdd
	};
	const action = actionMap[actionName]; //to do: prefix search
	if(typeof(action) === "function") action(actionName, vars[objName], param, magnitude);
}
function deadZone(v, thres) {
	return (Math.abs(v) <= thres) ? 0.0 : (v - Math.sign(v) * thres) / (1.0 - thres);
}

function getControllerInput(controller, kind, path) {
	if (!controller) return undefined;
	let val = controller[kind];
	//if (val == null) return val;
	if (path == undefined) return val;
	val = val[path];
	//if (val == undefined) return false;
	if (kind === "axes" && val != undefined) {
		val = deadZone(val, 0.0625);
		val = Math.abs(val)**2 * Math.sign(val);
	}
	return val;
}

function matrixMultiply_3x3(m1, m2) {
	return [
		m1[0] * m2[0] + m1[1] * m2[3] + m1[2] * m2[6],
		m1[0] * m2[1] + m1[1] * m2[4] + m1[2] * m2[7],
		m1[0] * m2[2] + m1[1] * m2[5] + m1[2] * m2[8],

		m1[3] * m2[0] + m1[4] * m2[3] + m1[5] * m2[6],
		m1[3] * m2[1] + m1[4] * m2[4] + m1[5] * m2[7],
		m1[3] * m2[2] + m1[4] * m2[5] + m1[5] * m2[8],

		m1[6] * m2[0] + m1[7] * m2[3] + m1[8] * m2[6],
		m1[6] * m2[1] + m1[7] * m2[4] + m1[8] * m2[7],
		m1[6] * m2[2] + m1[7] * m2[5] + m1[8] * m2[8]
	];
}
function updateDynamics(dt) {
	/* pos[0] += dPos[0] * dt;
	pos[1] += dPos[1] * dt;
	pos[2] += dPos[2] * dt; */
	pos[0] += (dPos[0] * clientSpcTransf[0] + dPos[1] * clientSpcTransf[3] + dPos[2] * clientSpcTransf[6]) * dt;
	pos[1] += (dPos[0] * clientSpcTransf[1] + dPos[1] * clientSpcTransf[4] + dPos[2] * clientSpcTransf[7]) * dt;
	pos[2] += (dPos[0] * clientSpcTransf[2] + dPos[1] * clientSpcTransf[5] + dPos[2] * clientSpcTransf[8]) * dt;

	const tau = 2 * Math.PI;
	//const newTransform = Object.create(IdentityMatrix3);
	const r0Transform = [ //yaw
		Math.cos(tau * rot[0]), 0.0, Math.sin(tau * rot[0]),
		0.0, 1.0, 0.0,
		-Math.sin(tau * rot[0]), 0.0, Math.cos(tau * rot[0])
	],
	r1Transform = [ //pitch
		1.0, 0.0, 0.0,
		0.0, Math.cos(tau * rot[1]), Math.sin(tau * rot[1]),
		0.0, -Math.sin(tau * rot[1]), Math.cos(tau * rot[1])
	],
	r2Transform = [ //roll
		Math.cos(tau * rot[2]), -Math.sin(tau * rot[2]), 0.0,
		Math.sin(tau * rot[2]), Math.cos(tau * rot[2]), 0.0,
		0.0, 0.0, 1.0,
	];
	clientSpcTransf = matrixMultiply_3x3(matrixMultiply_3x3(r0Transform, r1Transform), r2Transform);
	rot[0] += dRot[0] * dt;
	rot[1] += dRot[1] * dt;
	rot[2] += dRot[2] * dt;

	/* dPos[0] = 0.0;
	dPos[1] = 0.0;
	dPos[2] = 0.0;
	dRot[0] = 0.0;
	dRot[1] = 0.0;
	dRot[2] = 0.0; */
	Object.assign(dPos, [0.0, 0.0, 0.0]);
	Object.assign(dRot, [0.0, 0.0, 0.0]);
}
function inputCycle(newLastTime, dt) {
	for (const key in keysPressed)
	if (Object.hasOwnProperty.call(keysPressed, key)) {
		const pressedRec = keysPressed[key];
		if (pressedRec.lastDown < newLastTime - 1000) {
			delete keysPressed[key];
			continue;
		}
		for (const inputObj of inputKeyMap)
			if (inputObj.keyCode == key && inputObj.inputMode.startsWith("ifPressed")) {
				commandFired(inputObj.action, inputObj.object, inputObj.param);
				//commandFired(inputObj.action, inputObj.object, inputObj.param, dt);
			}
	}

	const gpList = navigator.getGamepads();
	for (const inputObj of inputGamepadMap) {
		if (inputObj.controllerIndex >= gpList.length) continue;
		const gp = gpList[inputObj.controllerIndex];
		const val = getControllerInput(gp, inputObj.inputKind, inputObj.inputPath);
		if (val == undefined /* || val === false */) continue;
		//controllerFeed(inputObj.action, inputObj.object, inputObj.param, val * dt);
		commandFired(inputObj.action, inputObj.object, inputObj.param, val /* * dt */);
	}
}

function navKeyDown(event) {
	//const now = performance.now();
	const now = event.timeStamp;

	for (const inputObj of inputKeyMap)
		if (inputObj.keyCode == event.keyCode && inputObj.inputMode.startsWith("onKeyDown")) {
			commandFired(inputObj.action, inputObj.object, inputObj.param);
		}

	let pressedRec = keysPressed[event.keyCode];
	if (pressedRec === undefined) {
		pressedRec = { firstDown: now };
		keysPressed[event.keyCode] = pressedRec;
	};
	pressedRec.lastDown = now;
}
function navKeyUp(event) {
	for (const inputObj of inputKeyMap)
		if (inputObj.keyCode == event.keyCode && inputObj.inputMode.startsWith("onKeyUp")) {
			commandFired(inputObj.action, inputObj.object, inputObj.param);
		}

	if (keysPressed[event.keyCode]) {
		delete keysPressed[event.keyCode];
	}
}
