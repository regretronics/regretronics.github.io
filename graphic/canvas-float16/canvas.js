"use strict";

var cw, ch, mainCanvas, ctx, canUpdate;
var newCW, newCH;
var aspectRatio, resMagnitude, canvasScale;
var colorSpace, bgIntensity, spotIntensity, spotSize;

//const scaleValues = {"1_1": 1; };

function canvasScaleChanged(event) {
	let newCanvasScale = cbxCanvasScale.value.split("_");
	newCanvasScale = [parseInt(newCanvasScale[0]), parseInt(newCanvasScale[1])];
	if(isNaN(newCanvasScale[0]) || isNaN(newCanvasScale[1])) return;
	newCanvasScale = newCanvasScale[1] / newCanvasScale[0];
	if(!isFinite(newCanvasScale) || newCanvasScale == 0) return;

	canvasScale = newCanvasScale;
	//mainCanvas.style.height = canvasScale * ch + "px";
	mainCanvas.style.width = canvasScale * cw + "px";
}

function recalcResolution() {
	let rem = 2 ** resMagnitude / aspectRatio[0] / aspectRatio[1];
	rem = 0.5 * Math.log2(rem);
	const rem2 = rem - Math.log2(1.5);
	let mantissa;
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
	viewUpdate();
}
function canvasSizeChange(newCW, newCH) {
	ch = newCH;
	cw = newCW;

	//releaseCanvasResources(); //Dispose canvas-related kernels, etc.

	mainCanvas.height = ch;
	mainCanvas.width = cw;
}
function canvasSizeCheck() {
	//let newCH = parseInt(txtResH.value);
	//let newCW = parseInt(txtResW.value);
	if(isNaN(newCH) || isNaN(newCW)) return false;
	newCH |= 0;
	newCW |= 0;
	if(newCH <= 0 || newCW <= 0) return false;
	if(newCH === ch && newCW === cw) return false; 

	canvasSizeChange(newCW, newCH);
	canvasScaleChanged();
	return true;
}

/* function uRemainder(x, y) { //When x % y is not enough.
	let rem = x % y;
	if(rem < 0) rem += Math.abs(y);
	return rem;
} */
function viewUpdate() {
	canvasSizeCheck();
	if(!canUpdate) return false;
	if(!ctx) ctx = mainCanvas.getContext("2d", {
		alpha: false,
		colorSpace: "display-p3",
		colorType: "float16",
		/* desynchronized: true */
	});

	const tNow = performance.now();

	drawFrame(ctx, cw, ch, colorSpace, bgIntensity, spotIntensity, spotSize);

	const tRender = performance.now() - tNow;
	outFrameRenderT.innerText = tRender.toFixed(2);
}
