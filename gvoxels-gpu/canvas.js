"use strict";

var ch, cw;
var newCH, newCW;
var canvasScale;
var frameCount, renderTimeSum, segmentCount;
var firstTimeout, updateCycleId, animating;

//const requires ECMAScript 6/2015.
//const scaleValues = {"1_1": 1; };

function canvasScaleChanged() {
	let newCanvasScale = cbxCanvasScale.value.split("_");
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
	//let newCH = parseInt(txtResH.value);
	//let newCW = parseInt(txtResW.value);
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

	//timeout = parseFloat(txtFrameTimeout.value);
	timeout = targetFrameTime;
	if(isNaN(timeout)) timeout = defTimeout;
	let tNow = performance.now();
	if(dynLastTime == undefined) dynLastTime = tNow;
	
	//frameRenderRaycasting(mainCanvas, timeout);
	//frameRenderRaycasting(/* ch, cw, */ timeout);
	//frameRenderRaycasting_kernelMap(/* ch, cw, */ timeout);
	//frameRenderRaycasting_combinedKernel(timeout);
	///* let */ layerCount = txtMarchingLayers.valueAsNumber;
	frameRenderRaycasting_mono(layerCount);
	
	if(dynLastTime != undefined) {
		let tFrame = tNow - dynLastTime;
		const dt = Math.min(0.001 * tFrame, 1.0 / 4.0);
		if(chkNavDrift.checked) {
			//Update virtual parameters
			let i = Math.floor(2 * Math.random());
			/* clientPos[i] = (clientPos[i] + 0.5 * (Math.random() - 0.5)) % worldRes[i];
			clientPos[2] = (clientPos[2] + 2.0 / 16.0) % worldRes[2]; */
			clientSpeed[i] += 16.0 / 64.0 * (Math.random() - 0.5);
			clientSpeed[2] = (chkNavFwd.checked ? 16.0 / 16.0 : 0.0);
			let dPosAligned = vectorTransform_3(clientSpcTransf, clientSpeed);

			//const dt = 1.0 / 4.0;
			clientPos[0] += dt * dPosAligned[0];
			clientPos[1] += dt * dPosAligned[1];
			clientPos[2] += dt * dPosAligned[2];

			//particles.pos[0] += 0.25 / Math.E;
		} else {
			if(chkNavFwd.checked) dPos[2] += 16.0 / 16.0;
			updateDynamics(dt);
			inputCycle(tNow, dt);
			viewRayDirsCompute_Rectilinear(ch, cw);
		}
		outFrameRenderT.innerText = tFrame.toFixed(1);
	}
	if(chkNavFwd.checked) {
		clientPos[0] = uRemainder(clientPos[0], worldRes[0]);
		clientPos[1] = uRemainder(clientPos[1], worldRes[1]);
		clientPos[2] = uRemainder(clientPos[2], worldRes[2]);
	}

	let tNow2 = performance.now();
	let tRender = tNow2 - tNow;
	if(dynLastTime == undefined) outFrameRenderT.innerText = tRender.toFixed(1);
	dynLastTime = tNow;
	
	frameCount++;
	outFrameCount.innerText = frameCount.toString();
	
	//layerCount = frameMaxLayers;
	//outFrameSegs.innerText = segmentCount.toString();
	//outFrameLayers.innerText = (segmentCount / ch / cw).toPrecision(4);
	//outFrameLayers.innerText = layerCount.toString();
	//let segTime = 1000000.0 * t / segmentCount; //milliseconds to nanoseconds
	let segTime = 1000000.0 * tRender / (layerCount * ch * cw); //milliseconds to nanoseconds
	outSegTime.innerText = segTime.toPrecision(3);

	renderTimeSum += segTime;
	outSegTAvg.innerText = (renderTimeSum / frameCount).toPrecision(3);
	
	//window.requestAnimationFrame(viewUpdate);
	if(animating) updateCycleId = setTimeout(viewUpdate, Math.max(timeout - tRender, 0));
}

function startUpdating() {
	firstTimeout = 0;
	if(!animating || updateCycleId) return;
	//updateCycleId = setInterval(viewUpdate, 250);
	//timeout = parseFloat(txtFrameTimeout.value);
	timeout = targetFrameTime;
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
