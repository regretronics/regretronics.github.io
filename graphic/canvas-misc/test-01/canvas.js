"use strict";

function canvasScaleChanged(event) {
	if(!c2d) return;
	let newCanvasScale = cbxCanvasScale.selectedOptions[0].label.split(":");
	newCanvasScale = [parseInt(newCanvasScale[0]), parseInt(newCanvasScale[1])];
	//isNaN and isFinite requires ECMAScript 6/2015.
	if(isNaN(newCanvasScale[0]) || isNaN(newCanvasScale[1])) return;
	newCanvasScale = newCanvasScale[1] / newCanvasScale[0];
	if(!isFinite(newCanvasScale) || (newCanvasScale == 0)) return;

	canvasScale = newCanvasScale;
	//mainCanvas.style.height = canvasScale * ch + "px";
	mainCanvas.style.width = canvasScale * cw + "px";
}

function canvasSizeChanged() {
	if(!c2d) return;
	canvasScaleChanged();

	//to do: use ImageData() constructor instead of CanvasRenderingContext2D.createImageData()?
	imgData = c2d.createImageData(cw, ch);

	//pre-fill alpha
	let data = imgData.data, l = data.length;
	for(let i = 0; i < l; i += 4)
		data[i + 3] = 255;
}

function canvasSizeUpdate() {
	let newCH = parseInt(txtResH.value);
	let newCW = parseInt(txtResW.value);
	if(isNaN(newCH) || isNaN(newCW)) return false;
	newCH |= 0;
	newCW |= 0;
	if((newCH <= 0) || (newCW <= 0)) return false;

	if((newCH != ch) || (newCW != cw)) {
		ch = newCH;
		cw = newCW;
		mainCanvas.height = ch;
		mainCanvas.width = cw;
		canvasSizeChanged();
	}
	return true;
}

function viewUpdate(event) {
	if(!c2d) return;
	canvasSizeUpdate();
	if(!imgData) return;
	//if(frameCount) {kinematicsRefresh();}

	let t = performance.now();
	//frameRenderSimple(imgData);
	frameRenderPolar(imgData, frameCount);
	//frameRender(imgData);
	c2d.putImageData(imgData, 0, 0);
	t = performance.now() - t;

	frameCount++;
	renderTimeSum += t;
	outFrameRenderT.innerText = t.toFixed(2);
	outFrameRenderTAvg.innerText = (renderTimeSum / frameCount).toFixed(2);
	outFrameCount.innerText = frameCount.toString();

	//alert("breakpoint");
	//window.requestAnimationFrame(viewUpdate);
}

function startUpdating(event) {
	if(updateCycleId) return;
	if(!(c2d && imgData)) return;
	updateCycleId = setInterval(viewUpdate, 250);
}

function stopUpdating(event) {
	if(!updateCycleId) return;
	clearInterval(updateCycleId);
	updateCycleId = 0;
}
