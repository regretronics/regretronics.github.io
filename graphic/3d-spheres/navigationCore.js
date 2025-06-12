"use strict";

var clientPos, dPos, rot, dRot;
//var vars;
var clientSpcTransf, clientSpcTransfInv;

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
	transfer: null,
	object: "",
	param: null
};
//to do: object inside of an object (keyed by inputMode)?
var keyTarget, inputKeyMap, keysPressed, inputGamepadMap;

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

function getControllerInput(controller, kind, path, transfer) {
	if (!controller) return undefined;
	var val = controller[kind];
	//if (val == null) return val;
	if (path == undefined) return val;
	val = val[path];
	//if (val == undefined) return false;
	if (/* kind === "axes" && */ val != undefined && transfer != undefined) {
		//val = deadZone(val, 0.0625);
		//val = Math.abs(val)**2 * Math.sign(val);
		val = transfer(val);
	}
	return val;
}

function matrixMultiply_3x3(m1, m2) {
	return new Float32Array([
		m1[0] * m2[0] + m1[1] * m2[3] + m1[2] * m2[6],
		m1[0] * m2[1] + m1[1] * m2[4] + m1[2] * m2[7],
		m1[0] * m2[2] + m1[1] * m2[5] + m1[2] * m2[8],

		m1[3] * m2[0] + m1[4] * m2[3] + m1[5] * m2[6],
		m1[3] * m2[1] + m1[4] * m2[4] + m1[5] * m2[7],
		m1[3] * m2[2] + m1[4] * m2[5] + m1[5] * m2[8],

		m1[6] * m2[0] + m1[7] * m2[3] + m1[8] * m2[6],
		m1[6] * m2[1] + m1[7] * m2[4] + m1[8] * m2[7],
		m1[6] * m2[2] + m1[7] * m2[5] + m1[8] * m2[8]
	]);
}
function vectorTransform_3(m1, v2) {
	return new Float32Array([
		v2[0] * m1[0] + v2[1] * m1[3] + v2[2] * m1[6],
		v2[0] * m1[1] + v2[1] * m1[4] + v2[2] * m1[7],
		v2[0] * m1[2] + v2[1] * m1[5] + v2[2] * m1[8]
	]);
}
function updateDynamics(dt) {
	/* clientPos[0] += dPos[0] * dt;
	clientPos[1] += dPos[1] * dt;
	clientPos[2] += dPos[2] * dt; */
	let dPosAligned = vectorTransform_3(clientSpcTransf, dPos);
	clientPos[0] += dPosAligned[0] * dt;
	clientPos[1] += dPosAligned[1] * dt;
	clientPos[2] += dPosAligned[2] * dt;

	const tau = 2 * Math.PI;
	//let newTransform = Object.create(IdentityMatrix3);

	let frac = tau * dt; //precalculation optimizations
	let rotAngle = [frac * dRot[0], frac * dRot[1], frac * dRot[2]];
	let catheti = [[Math.cos(rotAngle[0]), Math.sin(rotAngle[0])],
		[Math.cos(rotAngle[1]), Math.sin(rotAngle[1])],
		[Math.cos(rotAngle[2]), Math.sin(rotAngle[2])]];
	let r0Transform = [ //yaw
		catheti[0][0], 0.0, -catheti[0][1],
		0.0, 1.0, 0.0,
		catheti[0][1], 0.0, catheti[0][0]
	],
	r1Transform = [ //pitch
		1.0, 0.0, 0.0,
		0.0, catheti[1][0], -catheti[1][1],
		0.0, catheti[1][1], catheti[1][0]
	],
	r2Transform = [ //roll
		catheti[2][0], -catheti[2][1], 0.0,
		catheti[2][1], catheti[2][0], 0.0,
		0.0, 0.0, 1.0,
	];
	/* clientSpcTransf = matrixMultiply_3x3(matrixMultiply_3x3(r2Transform, r1Transform), r0Transform);
	rot[0] += dRot[0] * dt;
	rot[1] += dRot[1] * dt;
	rot[2] += dRot[2] * dt; */
	clientSpcTransf = matrixMultiply_3x3(matrixMultiply_3x3(matrixMultiply_3x3(r2Transform, r1Transform), r0Transform), clientSpcTransf);

	r0Transform = [ //yaw
		catheti[0][0], 0.0, catheti[0][1],
		0.0, 1.0, 0.0,
		-catheti[0][1], 0.0, catheti[0][0]
	];
	r1Transform = [ //pitch
		1.0, 0.0, 0.0,
		0.0, catheti[1][0], catheti[1][1],
		0.0, -catheti[1][1], catheti[1][0]
	];
	r2Transform = [ //roll
		catheti[2][0], catheti[2][1], 0.0,
		-catheti[2][1], catheti[2][0], 0.0,
		0.0, 0.0, 1.0,
	];
	clientSpcTransfInv = matrixMultiply_3x3(clientSpcTransfInv, matrixMultiply_3x3(r0Transform, matrixMultiply_3x3(r1Transform, r2Transform)));

	Object.assign(dPos, [0.0, 0.0, 0.0]); //question: replace with Object constructor?
	Object.assign(dRot, [0.0, 0.0, 0.0]);
}
function inputCycle(newLastTime, dt) {
	for (const key in keysPressed)
	if (Object.hasOwnProperty.call(keysPressed, key)) {
		const pressedRec = keysPressed[key];
		if (pressedRec.lastDown < newLastTime - 30000) {
			delete keysPressed[key];
			continue;
		}
		for (const inputObj of inputKeyMap)
			if (inputObj.keyCode == key && inputObj.inputMode.startsWith("ifPressed")) {
				commandFired(inputObj.action, inputObj.object, inputObj.param);
				//commandFired(inputObj.action, inputObj.object, inputObj.param, dt);
			}
	}

	if (!navigator.getGamepads) return;
	const gpList = navigator.getGamepads();
	for (const inputObj of inputGamepadMap) {
		if (inputObj.controllerIndex >= gpList.length) continue;
		const gp = gpList[inputObj.controllerIndex];
		const val = getControllerInput(gp, inputObj.inputKind, inputObj.inputPath, inputObj.transfer);
		if (val == undefined /* || val === false */) continue;
		//controllerFeed(inputObj.action, inputObj.object, inputObj.param, val * dt);
		commandFired(inputObj.action, inputObj.object, inputObj.param, val /* * dt */);
	}
}

function navKeyDown(event) {
	if(event.target != keyTarget) return; //to do: event.srcElement or event.target?
	//console.log(event);
	//const now = performance.now();
	const now = event.timeStamp;

	for (const inputObj of inputKeyMap)
		if (inputObj.keyCode == event.code) {
			event.preventDefault();
			//event.stopImmediatePropagation();
			if (inputObj.inputMode.startsWith("onKeyDown")) commandFired(inputObj.action, inputObj.object, inputObj.param);
		}

	let pressedRec = keysPressed[event.code];
	if (pressedRec === undefined) {
		pressedRec = { firstDown: now };
		keysPressed[event.code] = pressedRec;
	};
	pressedRec.lastDown = now;
}
function navKeyUp(event) {
	for (const inputObj of inputKeyMap)
		if (inputObj.keyCode == event.code && inputObj.inputMode.startsWith("onKeyUp")) {
			commandFired(inputObj.action, inputObj.object, inputObj.param);
		}

	if (keysPressed[event.code]) {
		delete keysPressed[event.code];
	}
}
