"use strict";

var ch, cw;
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

const defTimeout = 1000;
var timeout = defTimeout;
var clientSpeed = new Float32Array([0.0, 0.0, 0.0, 0.0]);

//When x % y is not enough.
//(-1) % 10 = -1
//uRemainder(-1, 10) = 9
function uRemainder(x, y) {
	let rem = x % y;
	if(rem < 0) rem += Math.abs(y);
	return rem;
}
function viewUpdate() {
	canvasSizeCheck();
	//if(frameCount) kinematicsRefresh();

	timeout = parseFloat(txtFrameTimeout.value);
	if(isNaN(timeout)) timeout = defTimeout;
	const tNow = performance.now();
	if(dynLastTime == undefined) dynLastTime = tNow;

	///* let */ layerCount = txtMarchingLayers.valueAsNumber;
	//frameRenderRaycasting3(layerCount);
	frameRenderRaycasting3(1);

	if(dynLastTime != undefined) {
		const tFrame = tNow - dynLastTime;
		const dt = Math.min(0.001 * tFrame, 1.0 / 4.0);
		if(chkNavDrift.checked) {
			//Update virtual parameters
			const i = Math.floor(2 * Math.random());
			/* clientPos[i] = (clientPos[i] + 0.5 * (Math.random() - 0.5)) % worldRes[i];
			clientPos[2] = (clientPos[2] + 2.0 / 16.0) % worldRes[2]; */
			clientSpeed[i] += 16.0 / 64.0 * (Math.random() - 0.5);
			clientSpeed[2] = (chkNavFwd.checked ? 16.0 / 16.0 : 0.0);
			const dPosAligned = vectorTransform_3(clientSpcTransf, clientSpeed);

			//const dt = 1.0 / 4.0;
			clientPos[0] += dt * dPosAligned[0];
			clientPos[1] += dt * dPosAligned[1];
			clientPos[2] += dt * dPosAligned[2];

			//particles.pos[0] += 0.25 / Math.E;
		} else {
			if(chkNavFwd.checked) dPos[2] += 16.0 / 16.0;
			updateDynamics(dt);
			inputCycle(tNow, dt);
			//viewRayDirsCompute_Rectilinear(ch, cw);
		}
		outFrameRenderT.innerText = tFrame.toFixed(1);
	}
	if(chkNavFwd.checked) {
		clientPos[0] = uRemainder(clientPos[0], worldRes[0]);
		clientPos[1] = uRemainder(clientPos[1], worldRes[1]);
		clientPos[2] = uRemainder(clientPos[2], worldRes[2]);
	}

	const tNow2 = performance.now();
	const tRender = tNow2 - tNow;
	if(dynLastTime == undefined) outFrameRenderT.innerText = tRender.toFixed(1);
	dynLastTime = tNow;

	frameCount++;
	outFrameCount.innerText = frameCount.toString();

	//layerCount = frameMaxLayers;
	//outFrameSegs.innerText = segmentCount.toString();
	//outFrameLayers.innerText = (segmentCount / ch / cw).toPrecision(4);
	//outFrameLayers.innerText = layerCount.toString();
	//const segTime = 1000000.0 * t / segmentCount; //milliseconds to nanoseconds
	//const segTime = 1000000.0 * tRender / (layerCount * ch * cw); //milliseconds to nanoseconds
	//outSegTime.innerText = segTime.toPrecision(3);

	//renderTimeSum += segTime;
	//outSegTAvg.innerText = (renderTimeSum / frameCount).toPrecision(3);

	//window.requestAnimationFrame(viewUpdate);
	if(animating) updateCycleId = setTimeout(viewUpdate, Math.max(timeout - tRender, 0));
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
