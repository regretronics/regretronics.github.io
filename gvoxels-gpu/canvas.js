"use strict";

var ch, cw;
var canvasScale;
var frameCount, renderTimeSum, segmentCount;
var firstTimeout, updateCycleId, animating;

//const requires ECMAScript 6/2015.
//const scaleValues = {"1_1": 1; };

function canvasScaleChanged() {
	var newCanvasScale = cbxCanvasScale.value.split("_");
	newCanvasScale = [parseInt(newCanvasScale[0]), parseInt(newCanvasScale[1])];
	//isNaN and isFinite require ECMAScript 6/2015.
	if(isNaN(newCanvasScale[0]) || isNaN(newCanvasScale[1])) return;
	newCanvasScale = newCanvasScale[1] / newCanvasScale[0];
	if(!isFinite(newCanvasScale) || newCanvasScale == 0) return;

	canvasScale = newCanvasScale;
	//mainCanvas.style.height = canvasScale * ch + "px";
	mainCanvas.style.width = canvasScale * cw + "px";
}

function worldResCheck() {
	let newSize = parseInt(txtWorldSize.value);
	if(isNaN(newSize)) return false;
	newSize |= 0;
	if(newSize <= 0) return false;
	if(newSize === worldSize) return false; 

	worldResChange(newSize);
	return true;
}
function worldResChange(newSize) {
	worldSize = newSize;
	for(let i = 0; i < 3; i++) worldRes[i] = worldSize;
	//to do: change speeds in inputKeyMap and inputGamepadMap?

	releaseGPU();
	restartGPU();

	//canvasSizeChange(cw, ch);
	//canvasScaleChanged();
	cw = 0;
	ch = 0;
}
function canvasSizeCheck() {
	let newCH = parseInt(txtResH.value);
	let newCW = parseInt(txtResW.value);
	//isNaN requires ECMAScript 6/2015.
	if(isNaN(newCH) || isNaN(newCW)) return false;
	newCH |= 0;
	newCW |= 0;
	if(newCH <= 0 || newCW <= 0) return false;
	if(newCH === ch && newCW === cw) return false; 

	canvasSizeChange(newCW, newCH);
	canvasScaleChanged();
	return true;
}
function canvasSizeChange(newCW, newCH) {
	ch = newCH;
	cw = newCW;

	releaseCanvasResources(); //Dispose canvas-related kernels, etc.

	//Recreate kernels, except field-related ones
	generalKernels = registerGeneralKernels(gpu);
	/* rcKernels0 = registerRayCastingKernels(gpu, newKernels);
	rcKernels1 = registerRayCastingKernels(gpu, newKernels); */
	/* rcKernels0 = registerRayCastingKernelMap(gpu);
	rcKernels1 = registerRayCastingKernelMap(gpu); */
	rcKernels0 = registerRayCastingKernelMono(gpu);

	//From registerKernels
	/* generalKernels.rayDirs2d.setOutput([cw, ch]);
	generalKernels.rayDirsSigns.setOutput([cw, ch]); */
	/* generalKernels.resetRayAlive.setOutput([cw, ch]);
	generalKernels.resetRayCrossingPoints.setOutput([cw, ch]);
	generalKernels.resetAccumBufferEmission.setOutput([cw, ch]);
	generalKernels.resetAccumBufferTransp.setOutput([cw, ch]);
	generalKernels.renderAccum.setOutput([cw, ch]); */

	//rcKernelsSetDimensions(rcKernels0);
	//rcKernelsSetDimensions(rcKernels1);

	viewRayDirsCompute_Rectilinear(ch, cw);
	//texBuffer0 = {};
	//texBuffer1 = {};

	//force-compile
	//frameRenderRaycasting(ch, cw, 0);
	//frameRenderRaycasting(ch, cw, 0);
	//frameRenderRaycasting_kernelMap(0);
	//frameRenderRaycasting_kernelMap(0);
	frameRenderRaycasting_mono(1);
	/* frameRenderRaycasting_combinedKernel(0);
	frameRenderRaycasting_combinedKernel(0); */

	mainCanvas.height = ch;
	mainCanvas.width = cw;
}
function rcKernelsSetDimensions(rcKernels) {
	//From registerRayCastingKernels
	/* rcKernels.getDRay.setOutput([cw, ch]);
	rcKernels.nextCrossingPoints.setOutput([cw, ch]);
	rcKernels.pVoxel.setOutput([cw, ch]);
	rcKernels.segTransp.setOutput([cw, ch]);
	rcKernels.nextAccumEmission.setOutput([cw, ch]);
	rcKernels.nextAccumTransp.setOutput([cw, ch]);
	rcKernels.nextRayAlive.setOutput([cw, ch]); */

	//From registerRayCastingKernelMono
	rcKernels.rayCaster.setOutput([cw, ch]);

	//From registerRayCastingKernelMap
	//rcKernels.rayCastingCycle.setOutput([cw, ch]);
}

const defTimeout = 1000;
var timeout = defTimeout;
var clientSpeed = new Float32Array([0.0, 0.0, 0.0, 0.0]);

function uRemainder(x, y) { //When x % y is not enough.
	let rem = x % y;
	if(rem < 0) rem += Math.abs(y);
	return rem;
}
function viewUpdate() {
	worldResCheck();
	//if (!worldResCheck())
	canvasSizeCheck();
	outVoxelCount.innerText = (worldSize ** 3).toFixed(0);
	//if(frameCount) kinematicsRefresh();

	timeout = parseFloat(txtFrameTimeout.value);
	if(isNaN(timeout)) timeout = defTimeout;

	let tNow = performance.now();
	//frameRenderRaycasting(mainCanvas, timeout);
	//frameRenderRaycasting(/* ch, cw, */ timeout);
	//frameRenderRaycasting_kernelMap(/* ch, cw, */ timeout);
	//frameRenderRaycasting_combinedKernel(timeout);
	/* let */ layerCount = txtMarchingLayers.valueAsNumber;
	frameRenderRaycasting_mono(layerCount);
	let t = performance.now() - tNow;
	//layerCount = frameMaxLayers;

	outFrameRenderT.innerText = t.toFixed(1);
	//outFrameSegs.innerText = segmentCount.toString();
	//outFrameLayers.innerText = (segmentCount / ch / cw).toPrecision(4);
	//outFrameLayers.innerText = layerCount.toString();
	//let segTime = 1000000.0 * t / segmentCount; //milliseconds to nanoseconds
	let segTime = 1000000.0 * t / (layerCount * ch * cw); //milliseconds to nanoseconds
	outSegTime.innerText = segTime.toPrecision(5);

	frameCount++;
	renderTimeSum += segTime;
	outFrameCount.innerText = frameCount.toString();
	outSegTAvg.innerText = (renderTimeSum / frameCount).toPrecision(5);
	
	if(chkNavAuto.checked) {
		//Update virtual parameters
		let i = Math.floor(2 * Math.random());
		/* clientPos[i] = (clientPos[i] + 0.5 * (Math.random() - 0.5)) % worldRes[i];
		clientPos[2] = (clientPos[2] + 2.0 / 16.0) % worldRes[2]; */
		clientSpeed[i] += 4.0 / 64.0 * (Math.random() - 0.5);
		clientSpeed[2] = 4.0 / 16.0;
		const dt = 1.0 / 4.0;
		clientPos[0] = uRemainder(clientPos[0] + dt * clientSpeed[0], worldRes[0]);
		clientPos[1] = uRemainder(clientPos[1] + dt * clientSpeed[1], worldRes[1]);
		clientPos[2] = uRemainder(clientPos[2] + dt * clientSpeed[2], worldRes[2]);
		pos = Array.from(clientPos); //seam

		//particles.pos[0] += 0.25 / Math.E;
	} else {
		if(dynLastTime != undefined) {
			let dt = 0.001 * (tNow - dynLastTime);
			updateDynamics(dt);
			inputCycle(tNow, dt);
			clientPos.set(pos, 0); //seam
			//clientSpcTransf.set();
			viewRayDirsCompute_Rectilinear(ch, cw);
		}
	}
	dynLastTime = tNow;
	
	//window.requestAnimationFrame(viewUpdate);
	if(animating) updateCycleId = setTimeout(viewUpdate, Math.max(timeout - t, 0));
}

function startUpdating() {
	firstTimeout = 0;
	if(!animating || updateCycleId) return;
	//updateCycleId = setInterval(viewUpdate, 250);
	timeout = parseFloat(txtFrameTimeout.value);
	if(isNaN(timeout)) timeout = defTimeout;
	updateCycleId = setTimeout(viewUpdate, timeout);
}

function stopUpdating() {
	animating = false;
	if(firstTimeout) {
		clearTimeout(firstTimeout);
		firstTimeout = 0;
	}
	if(!updateCycleId) return;
	clearInterval(updateCycleId);
	updateCycleId = 0;
}
