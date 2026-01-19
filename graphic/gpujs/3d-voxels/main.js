"use strict";

var /* ch, cw, */ gpu, mainCanvas;
var aspectRatio, resMagnitude; //, canvasScale;
var layerCount;
var targetFrameTime, firstTimeout, /* updateCycleId, */ animating;
var particles;

//var pos = [0.0, 0.0, 0.0];
var dPos = [0.0, 0.0, 0.0];
var rot = [0.0, 0.0, 0.0]; //currently out of use
var dRot = [0.0, 0.0, 0.0];
const vars = {pos: clientPos, dPos: dPos, rot: rot, dRot: dRot};
//const outVars = {pos: pos, vel: dPos, rot: rot, dRot: dRot};
let dynLastTime;
//var clientSpcTransf = Object.create(IdentityMatrix3);

var keyTarget;
var keysPressed = {};

function initParticles() {
	particles = {
		count: 2,
		r: new Float32Array([3.0 / 64.0 *  worldRes[0], 2.0 / 64.0 *  worldRes[0]]),
		pos: new Float32Array([
			0.5 * worldRes[0], 0.5 * worldRes[1], 0.5 * worldRes[2], 0.0,
			0.4375 * worldRes[0], 0.5 * worldRes[1], 0.5 * worldRes[2], 0.0
		]),
		emission: new Float32Array([
			1.0, 1.0, 1.0, 0.0,
			1.0, 0.5, 0.0, 0.0
		]),
		alpha: new Float32Array([ //to do: review name convention (transparency vs. opacity vs. alpha)
			1.0, 1.0, 1.0, 0.0,
			2.0, 2.0, 2.0, 0.0
		])
	};
}
function initParticles_random() {
	//const particleCount = 4096;
	const particleCount = 16384;
	//const particleCount = 65536;
	//const particleCount = 262144;
	//const particleCount = 1048576;
	particles = {
		count: particleCount,
		r: new Float32Array(particleCount),
		pos: new Float32Array(4 * particleCount),
		emission: new Float32Array(4 * particleCount),
		alpha: new Float32Array(4 * particleCount)
	};
	for(let i = 0; i < particleCount; i++) {
		particles.r[i] = 2.0 ** (5.0 * Math.random() - 2.0);
		particles.pos[4 * i    ] = worldRes[0] * Math.random();
		particles.pos[4 * i + 1] = worldRes[1] * Math.random();
		particles.pos[4 * i + 2] = worldRes[2] * Math.random();
		particles.emission[4 * i    ] = Math.random();
		particles.emission[4 * i + 1] = Math.random();
		particles.emission[4 * i + 2] = Math.random();
		particles.alpha[4 * i    ] = 2.0 ** (6.0 * Math.random() - 4.0);
		particles.alpha[4 * i + 1] = 2.0 ** (6.0 * Math.random() - 4.0);
		particles.alpha[4 * i + 2] = 2.0 ** (6.0 * Math.random() - 4.0);
	}
}

function restartGPU() {
	let GPUClass = GPU;
	if(typeof(GPUClass) !== "function") GPUClass = GPUClass.GPU;
	gpu = new GPUClass();
	//Warning: CPU mode doesn't seem to be multithreaded.
	//Warning: CPU mode doesn't support Texture.delete() and Texture.toArray().
	//gpu = new GPUClass({ mode: "cpu" });
	if(!gpu) return false;

	//isBufferSecond = false;
	//registerKernels();
	fieldKernels = registerFieldKernels(gpu);
	let mazeMap = fieldKernels.createMaze(mazeFillThres);
	fieldMap = fieldKernels.mapField_maze(mazeMap, worldRes, mazeSize);
	mazeMap.delete();
	//fieldMap = fieldKernels.mapField_particles(particles.count, particles.r, particles.pos, particles.emission, particles.alpha);

	if(canvasContainer.firstElementChild) canvasContainer.firstElementChild.remove();
	//mainCanvas = generalKernels.renderAccum.canvas;
	//mainCanvas = rcKernels0.rayCaster.canvas;
	mainCanvas = gpu.canvas;
	canvasContainer.appendChild(mainCanvas);
	return true;
}
function releaseKernelCollection(obj) {
	if(!obj) return;
	for(const prop in obj)
		if(Object.hasOwnProperty.call(obj, prop)) {
			if(obj[prop].destroy) obj[prop].destroy();
			delete(obj[prop]);
		}
}
function releaseTextureCollection(obj) { //to do: use for other textures
	if(!obj) return;
	for(const prop in obj)
		if(Object.hasOwnProperty.call(obj, prop)) {
			if(obj[prop].delete) obj[prop].delete();
			delete(obj[prop]);
		}
}
function releaseCanvasResources() {
	//Some textures and arrays
	if(typeof(rayDirsCol) !== "undefined") rayDirsCol = null;
	if(typeof(rayDirsRow) !== "undefined") rayDirsRow = null;
	if(typeof(texRayDirs) !== "undefined") { texRayDirs?.delete(); texRayDirs = null; }
	if(typeof(texRayDirsSign) !== "undefined") { texRayDirsSign?.delete(); texRayDirsSign = null; }
	if(typeof(texBuffer0) !== "undefined") releaseTextureCollection(texBuffer0);
	if(typeof(texBuffer1) !== "undefined") releaseTextureCollection(texBuffer1);

	if(typeof(generalKernels) !== "undefined") releaseKernelCollection(generalKernels);
	if(typeof(kernel0) !== "undefined") releaseKernelCollection(kernel0);
	if(typeof(kernel1) !== "undefined") releaseKernelCollection(kernel1);
}
function releaseGPU() {
	releaseCanvasResources();
	if(typeof(fieldMap) !== "undefined") releaseTextureCollection(fieldMap);
	if(typeof(fieldKernels) !== "undefined") releaseKernelCollection(fieldKernels);

	/* if(typeof(resetState) !== "undefined") resetState = null; */
	//if(typeof(rayCastingCycle) !== "undefined") { rayCastingCycle.destroy(); rayCastingCycle = null; }

	if(!gpu) return;
	gpu.destroy();
	gpu = undefined;
}

function log2WithFactor3(x) {
	const
		thres3_2Log = 0.5 * Math.log2(1.5),
		roundThres = 0.5 - thres3_2Log,
		magnitudeF = Math.log2(x),
		magnitudeI = Math.floor(magnitudeF + roundThres),
		remainder = Number((magnitudeF - magnitudeI) >= thres3_2Log);
	return 2 * magnitudeI + remainder;
}
function exp2WithFactor3(x) {
	const magnitude = Math.floor(x * 0.5), mod = x - 2 * magnitude;
	return 2 ** magnitude * [1, 1.5][mod];
}
function recalcResolution() {
	let rem = 2 ** resMagnitude / aspectRatio[0] / aspectRatio[1];
	rem = 0.5 * Math.log2(rem);
	let rem2 = rem - Math.log2(1.5), mantissa;
	if(Math.abs(rem - Math.round(rem)) <= Math.abs(rem2 - Math.round(rem2))) {
		mantissa = 1;
		rem = Math.round(rem);
	} else {
		mantissa = 1.5;
		rem = Math.round(rem2);
	}
	rem = mantissa * 2 ** rem;
	newCW = rem * aspectRatio[0];
	newCH = rem * aspectRatio[1];

	outCanvasResW.innerText = newCW.toString();
	outCanvasResH.innerText = newCH.toString();
	//cw = newCW;
	//ch = newCH;
	//canvasSizeChange(newCW, newCH);
	//canvasScaleChanged();
}
function cbxCanvasRatioChanged(event) {
	const elem = event.target;
	//const v = elem.value;
	let newAspectRatio = elem.selectedOptions[0].label.split(":");
	aspectRatio = [parseInt(newAspectRatio[0]), parseInt(newAspectRatio[1])];
	recalcResolution();
}
function rngCanvasResolutionInput(event) {
	const elem = event.target;
	resMagnitude = elem.valueAsNumber;
	recalcResolution();
}
function rngMarchingLayersInput(event) {
	const elem = event.target;
	layerCount = exp2WithFactor3(elem.valueAsNumber);
	localStorage.setItem("layerCount", layerCount);
	txtMarchingLayers.valueAsNumber = layerCount;
}
function txtMarchingLayersInput(event) {
	const elem = event.target;
	const v = elem.valueAsNumber;
	layerCount = v;
	localStorage.setItem("layerCount", layerCount);
	rngMarchingLayers.valueAsNumber = log2WithFactor3(v);
}
function motionRateInput(event) {
	const elem = event.target;
	const fps = exp2WithFactor3(elem.valueAsNumber) * 5;
	outMotionRate.innerText = fps.toString() + " fps";
	targetFrameTime = 1000 / fps;
	localStorage.setItem("targetFrameTime", targetFrameTime);
	txtFrameTimeout.valueAsNumber = Math.round(targetFrameTime);
}
function frameTimeoutInput(event) {
	const elem = event.target;
	const t = elem.valueAsNumber;
	targetFrameTime = t;
	localStorage.setItem("targetFrameTime", targetFrameTime);

	let fps = 1000 / t;
	const fpsLog = log2WithFactor3(fps / 5);
	rngMotionRate.valueAsNumber = fpsLog;
	fps = exp2WithFactor3(fpsLog) * 5;
	outMotionRate.innerText = fps.toString() + " fps";
}

function pageLoaded() {
	for(const s of document.querySelectorAll('[id]'))
		window[s.id] = s;

	cbxCanvasRatio.addEventListener("change", cbxCanvasRatioChanged);
	rngCanvasResolution.addEventListener("input", rngCanvasResolutionInput);

	let s;
	if(s = localStorage.getItem("canvas.aspectRatio")) {
		aspectRatio = JSON.parse(s);
		//cbxCanvasRatio.value = aspectRatio.join(":");
		cbxCanvasRatio.querySelector(`[label="${aspectRatio.join(":")}"]`).selected = true;
		//+?
	} else {
		let newAspectRatio = cbxCanvasRatio.selectedOptions[0].label.split(":");
		aspectRatio = [parseInt(newAspectRatio[0]), parseInt(newAspectRatio[1])];
	}
	if(s = localStorage.getItem("canvas.resMagnitude")) {
		resMagnitude = JSON.parse(s);
		rngCanvasResolution.valueAsNumber = resMagnitude;
	} else {
		resMagnitude = rngCanvasResolution.valueAsNumber;
	}
	recalcResolution();

	//btnResDiv2.addEventListener("click", event => {txtResW.valueAsNumber *= 0.5; txtResH.valueAsNumber *= 0.5;});
	//btnResMul2.addEventListener("click", event => {txtResW.valueAsNumber *= 2.0; txtResH.valueAsNumber *= 2.0;});
	btnResDiv2.addEventListener("click", event => {resMagnitude -= 2; rngCanvasResolution.valueAsNumber = resMagnitude; recalcResolution();});
	btnResMul2.addEventListener("click", event => {resMagnitude += 2; rngCanvasResolution.valueAsNumber = resMagnitude; recalcResolution();});
	cbxCanvasScale.addEventListener("change", canvasScaleChanged);

	if(s = localStorage.getItem("layerCount")) {
		layerCount = JSON.parse(s);

		txtMarchingLayers.valueAsNumber = layerCount;
		rngMarchingLayers.valueAsNumber = log2WithFactor3(layerCount);
	} else
		layerCount = txtMarchingLayers.valueAsNumber;
	if(s = localStorage.getItem("targetFrameTime")) {
		targetFrameTime = JSON.parse(s);

		txtFrameTimeout.valueAsNumber = Math.round(targetFrameTime);

		let fps = 1000 / targetFrameTime;
		const fpsLog = log2WithFactor3(fps / 5);
		rngMotionRate.valueAsNumber = fpsLog;
		fps = exp2WithFactor3(fpsLog) * 5;
		outMotionRate.innerText = fps.toString() + " fps";
	} else
		targetFrameTime = txtFrameTimeout.valueAsNumber;

	rngMarchingLayers.addEventListener("input", rngMarchingLayersInput);
	txtMarchingLayers.addEventListener("input", txtMarchingLayersInput);
	rngMotionRate.addEventListener("input", motionRateInput);
	txtFrameTimeout.addEventListener("input", frameTimeoutInput);

	btnViewUpdate.addEventListener("click", viewUpdate);
	btnStartUpdating.addEventListener("click", event => {animating = true; startUpdating();});
	btnStopUpdating.addEventListener("click", stopUpdating);
	keyTarget = document.body;
}
function pageReady() {
	if(!GPU) {
		btnViewUpdate.disabled = true;
		btnStartUpdating.disabled = true;
		cbxCanvasScale.disabled = true;
		return;
	}

	//initParticles();
	//initParticles_random();
	//worldVoxelsInit();
	restartGPU();
	dynLastTime = performance.now();
	viewUpdate();
	//pos = clientPos;
	//Object.assign(pos, clientPos);
	document.addEventListener("keydown", navKeyDown);
	document.addEventListener("keyup", navKeyUp);

	animating = true;
	firstTimeout = setTimeout(startUpdating, 3000);
}

//window.addEventListener("DOMContentLoaded", pageLoaded);
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
