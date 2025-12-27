"use strict";
//idea: have a "reload script" button?

var sourceC2d, outputC2d;
//detail: I'm putting height before width, because x is subordinate to y in raster scan.
var sh, sw, imgSourceData;
var ch, cw, imgData;
var transformPerf = {};
var scalePixels = [];

var sinc_size, sinc_filter1Float = null;
const sinc_r = 3;

//note: as of 2022-09 browsers only support 8 bits per channel in raster/bitmap images; deep color and hdr pixel formats are not yet available for script manipulation.

function imgSourceLoaded(event) {
	imageScaleUpdate(selSourceScale.value, imgSource);
	sh = event.target.naturalHeight;
	sw = event.target.naturalWidth;

	outSourceRes.textContent = `${sw}x${sh}`;
	window.setTimeout(compEncode, 100, event.target);
}

const factor = 4, factorInv = 1 / factor, factorInv2 = factorInv * factorInv;
function encodeFrame_decimate(imgObj, resNewH, resNewW) {
	//subsampling (one round)
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(4 * resNewH * resNewW);
	for(let oldY = 0; oldY < resOldH; oldY++) {
		const oldY2 = resOldW * oldY;
		const newY2 = resNewW * ((oldY * factorInv)|0);
		for(let oldX = 0, oldX2, newX2; oldX < resOldW; oldX++) {
			newX2 = 4 * (newY2 + (oldX * factorInv)|0);
			oldX2 = 4 * (oldY2 + oldX);
			bufOut[newX2++] += bufIn[oldX2++];
			bufOut[newX2++] += bufIn[oldX2++];
			bufOut[newX2++] += bufIn[oldX2++];
			bufOut[newX2] += bufIn[oldX2];
		}
	}
	for(let i = 0; i < 4 * resNewH * resNewW; i++)
		bufOut[i] *= factorInv2;

	return {
		h: resNewH, 
		w: resNewW, 
		dataFloat: bufOut
	};
}
function compEncode(image) {
	//to do: ...OffscreenCanvas (not supported in Firefox as of 2022-09)
	//const offscreen = new OffscreenCanvas(sw, sh);
	if(!cnvSource || !cnvSource.getContext) return;
	cnvSource.height = sh;
	cnvSource.width = sw;

	//sourceC2d = cnvSource.getContext('2d');
	//sourceC2d = cnvSource.getContext('2d', {colorSpace: "display-p3", storageFormat: 'float16'});
	sourceC2d = cnvSource.getContext('2d', {alpha: false, willReadFrequently: true});
	//sourceC2d.globalAlpha = 1;
	//sourceC2d.imageSmoothingEnabled = false;

	sourceC2d.drawImage(image, 0, 0);
	imgSourceData = sourceC2d.getImageData(0, 0, sw, sh);

	scalePixels = [];
	const b8ToFloatScale = 1 / 255;
	scalePixels.push({
		h: sh, 
		w: sw, 
		dataFloat: Float32Array.from(imgSourceData.data, x => x * b8ToFloatScale)
	}); //question: change push() for unshift() (reverses the array order)?
	//question: subtract 0.5 from color values? (currently no)

	const tNow = performance.now();
	switch(selTransformType.value) {
		case "downsampling-sinc":
		case "blocksBasic":
			const h2 = Math.ceil(factorInv * sh), w2 = Math.ceil(factorInv * sw);
			/* const i = */ scalePixels.push(encodeFrame_decimate(scalePixels[0], h2, w2));
			if(selTransformType.value == "blocksBasic") {
				//;
			}
			break;
		case "posterization":
			//to do
			scalePixels.push(scalePixels[0]);
			break;
		/* default:
			transformPerf = {encode: 0, decode: 0};
			outMediaEncodeT.innerText = transformPerf.encode.toFixed(2);
			outMediaDecodeT.innerText = transformPerf.decode.toFixed(2);
			return; */
	}
	transformPerf.encode = performance.now() - tNow;

	compDecode(sh, sw, cnvOutput, outputC2d);
	outMediaEncodeT.innerText = transformPerf.encode.toFixed(2);
	outMediaDecodeT.innerText = transformPerf.decode.toFixed(2);
}

function decodeFrame_filterSinc(imgObj) {
	const oldResH = imgObj.h, oldResW = imgObj.w;
	const newResH = Math.ceil(factor * oldResH), newResW = Math.ceil(factor * oldResW);
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(4 * newResH * newResW);
	for(let y = 0; y < oldResH; y++) {
		const oldYRow = oldResW * y;
		const newYRow = newResW * y * factor;
		for(let x = 0; x < oldResW; x++) {
			const oldX2 = 4 * (oldYRow + x);
			const newX2 = 4 * (newYRow + x * factor);
			for(let dy = -sinc_r * factor, dx; dy < (1 + sinc_r) * factor; dy++) {
				const fy = sinc_filter1Float[dy + sinc_r * factor];
				for(dx = -sinc_r * factor; dx < (1 + sinc_r) * factor; dx++) {
					const fx = fy * sinc_filter1Float[dx + sinc_r * factor];
					const newX3 = newX2 + 4 * (newResW * dy + dx);
					bufOut[newX3] += bufIn[oldX2] * fx;
					bufOut[newX3 + 1] += bufIn[oldX2 + 1] * fx;
					bufOut[newX3 + 2] += bufIn[oldX2 + 2] * fx;
					bufOut[newX3 + 3] += bufIn[oldX2 + 3] * fx;
				}
			}
		}
	}

	return {
		h: newResH, 
		w: newResW, 
		dataFloat: bufOut
	};
}
function decodeFrame_blocksBasic(imgObj) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const resNewH = Math.ceil(factor * resOldH), resNewW = Math.ceil(factor * resOldW);
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(4 * resNewH * resNewW);
	for(let newY = 0; newY < resNewH; newY++) {
		const newYRow = resNewW * newY;
		const oldYRow = resOldW * ((newY * factorInv)|0);
		for(let newX = 0; newX < resNewW; newX++) {
			const oldX2 = 4 * (oldYRow + (newX * factorInv)|0);
			const newX2 = 4 * (newYRow + newX);
			bufOut[newX2] = bufIn[oldX2];
			bufOut[newX2 + 1] = bufIn[oldX2 + 1];
			bufOut[newX2 + 2] = bufIn[oldX2 + 2];
			bufOut[newX2 + 3] = bufIn[oldX2 + 3];
		}
	}

	return {
		h: resNewH, 
		w: resNewW, 
		dataFloat: bufOut
	};
}
function compDecode(sh, sw, cnvOutput, outputC2d) {
	canvasSizeUpdate(cnvOutput, sh, sw);

	const tNow = performance.now();
	switch(selTransformType.value) {
		case "downsampling-sinc":
			scalePixels[0] = decodeFrame_filterSinc(scalePixels[1]);
			break;
		case "blocksBasic":
			scalePixels[0] = decodeFrame_blocksBasic(scalePixels[1]);
			break;
		case "posterization":
			//to do
			scalePixels[0] = scalePixels[1];
			break;
		/* default:
			return; */
	}
	transformPerf.decode = performance.now() - tNow;

	//imgData = outputC2d.createImageData(cw, ch);
	const imgArray = Uint8ClampedArray.from(scalePixels[0].dataFloat, x => x * 255);
	//var imgArray = new Uint8ClampedArray(4 * ch * cw);
	imgData = new ImageData(imgArray, scalePixels[0].w, scalePixels[0].h);
	outputC2d.putImageData(imgData, 0, 0);
}

function inImageChange(event) {
	const fileList = this.files;
	if(fileList.length < 1) return;
	const file = fileList[0];
	imgSource.src = URL.createObjectURL(file);
	imgSource.addEventListener("load", (event) => {
		URL.revokeObjectURL(this.src);
	}, {once: true});
}
function loadURL(event) {
	//imgSource.src = "";
	//imgSource.crossOrigin = (chkSourceCORS.checked ? "anonymous" : null);
	imgSource.src = txtImgURL.value;
}
function cbxURLPresetChanged(event) {
	const elem = event.target;
	if(!elem) return;
	txtImgURL.value = elem.value;
	/* if(!elem.dataset) return;
	const id = elem.dataset["remote"];
	if(!id) return;
	chkSourceCORS.checked = id.toLowerCase() == "true"; */
}
function chkShrinkChanged(event) {
	const elem = event.target;
	if(!elem) return;
	//const image = imgSource;
	//const parent = image.parentElement;
	if(elem.checked) {
		imgSource.classList.add("shrink");
		cnvOutput.classList.add("shrink");
		//parent.style.;
	} else {
		imgSource.classList.remove("shrink");
		cnvOutput.classList.remove("shrink");
	}
}

function pageReady(event) {
	if(cnvOutput.getContext) {
		outputC2d = cnvOutput.getContext('2d');
		//outputC2d = cnvOutput.getContext('2d', {colorSpace: "display-p3", storageFormat: 'float16'});
		//outputC2d = cnvOutput.getContext('2d', {alpha: false});
		//outputC2d.globalAlpha = 1;
		//outputC2d.imageSmoothingEnabled = false;

		ch = cnvOutput.height;
		cw = cnvOutput.width;

		//imageScaleUpdate(selSourceScale.value, imgSource);
		//imageScaleUpdate(selSourceScale.value, cnvOutput);
	} else {
		btnTransform.disabled = true;
	}

	//precomputation
	sinc_size = factor * (1 + 2 * sinc_r);
	const dx = -0.5 * (sinc_size - 1);
	sinc_filter1Float = new Float32Array(sinc_size);
	const normalFactor = -(0.25 ** 2);
	for(let x = 0; x < sinc_size; x++) {
		const x2 = (x + dx) * factorInv * Math.PI;
		//sinc_filter1Float[x] = Math.sin(x2) / x2; //rectangular window
		sinc_filter1Float[x] = Math.exp(normalFactor * x2 * x2) * Math.sin(x2) / x2; //gaussian window
	}
}
function btnTransformClick(event) {
	compEncode(imgSource);
}
function pageLoaded(event) {
	for(const s of document.querySelectorAll('[id]'))
		window[s.id] = s;

	inImage.addEventListener("change", inImageChange);
	btnImgLoad.addEventListener("click", loadURL);
	cbxURLPreset1.addEventListener("change", cbxURLPresetChanged);
	cbxURLPreset2.addEventListener("change", cbxURLPresetChanged);
	//chkSourceCORS.addEventListener("change", (event) => {imgSource.crossOrigin = (chkSourceCORS.checked ? "anonymous" : null)});
	imgSource.addEventListener("load", imgSourceLoaded);
	selSourceScale.addEventListener("change", selScaleChanged);
	chkSourceShrink.addEventListener("change", chkShrinkChanged);

	btnTransform.addEventListener("click", btnTransformClick);

	const evt = new Event("change");
	chkSourceShrink.dispatchEvent(evt);
}

//window.addEventListener("DOMContentLoaded", pageLoaded);
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
