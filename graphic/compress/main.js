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

const factor = 4, factorInv = 1 / factor;
//subsampling (one round)
function encodeFrame_decimate(imgObj, resNewH, resNewW, factorInv) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(4 * resNewH * resNewW);
	//sum of blocks of pixels
	for(let oldY = 0; oldY < resOldH; oldY++) {
		const oldY2 = resOldW * oldY;
		const newY2 = resNewW * ((oldY * factorInv)|0);
		for(let oldX = 0, oldX2, newX2; oldX < resOldW; oldX++) {
			newX2 = 4 * (newY2 + ((oldX * factorInv)|0));
			oldX2 = 4 * (oldY2 + oldX);
			bufOut[newX2++] += bufIn[oldX2++];
			bufOut[newX2++] += bufIn[oldX2++];
			bufOut[newX2++] += bufIn[oldX2++];
			bufOut[newX2] += bufIn[oldX2];
		}
	}

	//normalization (from sum to mean)
	const factorInv2 = factorInv * factorInv;
	if(factorInv2 !== 1)
		for(let i = 0; i < 4 * resNewH * resNewW; i++)
			bufOut[i] *= factorInv2;

	return {
		h: resNewH, 
		w: resNewW, 
		dataFloat: bufOut
	};
}
function encodeFrame_difference(imgObj, encObj, factorInv) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const resNewH = encObj.h, resNewW = encObj.w;
	const bufBig = imgObj.dataFloat, bufSmall = encObj.dataFloat;
	const bufDiff = new Float32Array(4 * resOldH * resOldW), bufDev = new Float32Array(4 * resNewH * resNewW);
	for(let oldY = 0; oldY < resOldH; oldY++) {
		const oldY2 = resOldW * oldY;
		const newY2 = resNewW * ((oldY * factorInv)|0);
		for(let oldX = 0; oldX < resOldW; oldX++) {
			const newX2 = 4 * (newY2 + ((oldX * factorInv)|0));
			const oldX2 = 4 * (oldY2 + oldX);

			//difference from mean
			bufDiff[oldX2] = bufBig[oldX2] - bufSmall[newX2];
			bufDiff[oldX2 + 1] = bufBig[oldX2 + 1] - bufSmall[newX2 + 1];
			bufDiff[oldX2 + 2] = bufBig[oldX2 + 2] - bufSmall[newX2 + 2];
			bufDiff[oldX2 + 3] = bufBig[oldX2 + 3] - bufSmall[newX2 + 3];

			bufDev[newX2] += Math.abs(bufDiff[oldX2]);
			bufDev[newX2 + 1] += Math.abs(bufDiff[oldX2 + 1]);
			bufDev[newX2 + 2] += Math.abs(bufDiff[oldX2 + 2]);
			bufDev[newX2 + 3] += Math.abs(bufDiff[oldX2 + 3]);

			/* const quantStep = 0.25, quantStepInv = 1 / quantStep;
			bufDiff[oldX2] = quantStep * Math.round(quantStepInv * bufDiff[oldX2]);
			bufDiff[oldX2 + 1] = quantStep * Math.round(quantStepInv * bufDiff[oldX2 + 1]);
			bufDiff[oldX2 + 2] = quantStep * Math.round(quantStepInv * bufDiff[oldX2 + 2]);
			bufDiff[oldX2 + 3] = quantStep * Math.round(quantStepInv * bufDiff[oldX2 + 3]); */
		}
	}

	//normalization (from sum of absolute deviations to average absolute deviation)
	const factorInv2 = factorInv * factorInv;
	if(factorInv2 !== 1)
		for(let i = 0; i < 4 * resNewH * resNewW; i++)
			bufDev[i] *= factorInv2;

	//normalization of pixel differences
	for(let oldY = 0; oldY < resOldH; oldY++) {
		const oldY2 = resOldW * oldY;
		const newY2 = resNewW * ((oldY * factorInv)|0);
		for(let oldX = 0; oldX < resOldW; oldX++) {
			const newX2 = 4 * (newY2 + ((oldX * factorInv)|0));
			const oldX2 = 4 * (oldY2 + oldX);

			bufDiff[oldX2] = (bufDev[newX2] === 0 ? 0 : bufDiff[oldX2] / bufDev[newX2]);
			bufDiff[oldX2 + 1] = (bufDev[newX2 + 1] === 0 ? 0 : bufDiff[oldX2 + 1] / bufDev[newX2 + 1]);
			bufDiff[oldX2 + 2] = (bufDev[newX2 + 2] === 0 ? 0 : bufDiff[oldX2 + 2] / bufDev[newX2 + 2]);
			bufDiff[oldX2 + 3] = (bufDev[newX2 + 3] === 0 ? 0 : bufDiff[oldX2 + 3] / bufDev[newX2 + 3]);

			//quantization
			const quantStep = 0.5, quantStepInv = 1 / quantStep;
			bufDiff[oldX2] = quantStep * Math.round(quantStepInv * bufDiff[oldX2]);
			bufDiff[oldX2 + 1] = quantStep * Math.round(quantStepInv * bufDiff[oldX2 + 1]);
			bufDiff[oldX2 + 2] = quantStep * Math.round(quantStepInv * bufDiff[oldX2 + 2]);
			bufDiff[oldX2 + 3] = quantStep * Math.round(quantStepInv * bufDiff[oldX2 + 3]);
		}
	}

	return Object.assign({}, encObj, {diff: bufDiff, dev: bufDev});
}
function encodeFrame_posterize(imgObj, quantStep) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(4 * resOldH * resOldW);
	const quantStepInv = 1 / quantStep;

	for(let i = 0; i < 4 * resOldH * resOldW; i++)
		bufOut[i] = quantStep * Math.round(quantStepInv * bufIn[i]);

	return {
		h: resOldH, 
		w: resOldW, 
		dataFloat: bufOut
	};
}
function encodeFrame_luma(imgObj, hue0) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(4 * resOldH * resOldW);

	const c1r = 2 * Math.cos(2 * Math.PI * hue0 / 6) / 3, c1g = 2 * Math.cos(2 * Math.PI * (hue0 + 2) / 6) / 3, c1b = 2 * Math.cos(2 * Math.PI * (hue0 + 4) / 6) / 3;
	const c2r = 2 * Math.sin(2 * Math.PI * hue0 / 6) / 3, c2g = 2 * Math.sin(2 * Math.PI * (hue0 + 2) / 6) / 3, c2b = 2 * Math.sin(2 * Math.PI * (hue0 + 4) / 6) / 3;
	for(let i = 0; i < 4 * resOldH * resOldW; i += 4) {
		bufOut[i] = (bufIn[i] + bufIn[i + 1] + bufIn[i + 2]) / 3;
		bufOut[i + 1] = c1r * bufIn[i] + c1g * bufIn[i + 1] + c1b * bufIn[i + 2];
		bufOut[i + 2] = c2r * bufIn[i] + c2g * bufIn[i + 1] + c2b * bufIn[i + 2];
		bufOut[i + 3] = bufIn[i + 3];
	}

	return {
		h: resOldH, 
		w: resOldW, 
		dataFloat: bufOut
	};
}
function encodeFrame_chromaPosterize(imgObj, quantStep) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(4 * resOldH * resOldW);
	const quantStepInv = 1 / quantStep;

	for(let i = 0; i < 4 * resOldH * resOldW; i += 4) {
		bufOut[i] = bufIn[i];
		bufOut[i + 1] = quantStep * Math.round(quantStepInv * bufIn[i + 1]);
		bufOut[i + 2] = quantStep * Math.round(quantStepInv * bufIn[i + 2]);
		bufOut[i + 3] = bufIn[i + 3];
	}

	return {
		h: resOldH, 
		w: resOldW, 
		dataFloat: bufOut
	};
}
function encodeFrame_toPlanes4(imgObj) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat, bufOutArr = [
		new Float32Array(resOldH * resOldW), 
		new Float32Array(resOldH * resOldW), 
		new Float32Array(resOldH * resOldW), 
		new Float32Array(resOldH * resOldW)
	];

	for(let i = 0; i < resOldH * resOldW; i++) {
		bufOutArr[0][i] = bufIn[4 * i];
		bufOutArr[1][i] = bufIn[4 * i + 1];
		bufOutArr[2][i] = bufIn[4 * i + 2];
		bufOutArr[3][i] = bufIn[4 * i + 3];
	}

	return [
		{h: resOldH, w: resOldW, dataFloat: bufOutArr[0]}, 
		{h: resOldH, w: resOldW, dataFloat: bufOutArr[1]}, 
		{h: resOldH, w: resOldW, dataFloat: bufOutArr[2]}, 
		{h: resOldH, w: resOldW, dataFloat: bufOutArr[3]}
	];
}
function encodePlane_decimate(imgObj, resNewH, resNewW, factorInv) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(resNewH * resNewW);
	//sum of blocks of pixels
	for(let oldY = 0; oldY < resOldH; oldY++) {
		const oldY2 = resOldW * oldY;
		const newY2 = resNewW * ((oldY * factorInv)|0);
		for(let oldX = 0; oldX < resOldW; oldX++) {
			bufOut[newY2 + ((oldX * factorInv)|0)] += bufIn[oldY2 + oldX];
		}
	}

	//normalization (from sum to mean)
	const factorInv2 = factorInv * factorInv;
	if(factorInv2 !== 1)
		for(let i = 0; i < resNewH * resNewW; i++)
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
	let encObj;
	switch(selTransformType.value) {
		case "downsampling-sinc":
		case "blocksBasic":
			const h2 = Math.ceil(factorInv * sh), w2 = Math.ceil(factorInv * sw);
			encObj = encodeFrame_decimate(scalePixels[0], h2, w2, factorInv);
			if(selTransformType.value == "blocksBasic") {
				encObj = encodeFrame_difference(scalePixels[0], encObj, factorInv);
			}
			scalePixels.push(encObj);
			break;
		case "posterization":
			scalePixels.push(encodeFrame_posterize(scalePixels[0], 0.25));
			break;
		case "luma posterization":
			encObj = encodeFrame_luma(scalePixels[0], 0.0);
			encObj = encodeFrame_chromaPosterize(encObj, 0.0625);
			scalePixels.push(encObj);
			break;
		case "luma downsampling":
			encObj = encodeFrame_luma(scalePixels[0], 0.0);
			encObj = encodeFrame_toPlanes4(encObj);
			const c1sub = 1 / 2, c2sub = 1 / 4;
			encObj = [
				encObj[0],
				encodePlane_decimate(encObj[1], Math.ceil(sh * c1sub), Math.ceil(sw * c1sub), c1sub),
				encodePlane_decimate(encObj[2], Math.ceil(sh * c2sub), Math.ceil(sw * c2sub), c2sub),
				encObj[3]
			];
			scalePixels.push(encObj);
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

function decodeFrame_filterSinc(imgObj, factor) {
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
function decodeFrame_blocksBasic(imgObj, factor) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const resNewH = Math.ceil(factor * resOldH), resNewW = Math.ceil(factor * resOldW);
	const bufLow = imgObj.dataFloat, bufDiff = imgObj.diff, bufDev = imgObj.dev;
	const bufOut = new Float32Array(4 * resNewH * resNewW);
	const factorInv = 1 / factor;
	for(let newY = 0; newY < resNewH; newY++) {
		const newYRow = resNewW * newY;
		const oldYRow = resOldW * ((newY * factorInv)|0);
		for(let newX = 0; newX < resNewW; newX++) {
			const oldX2 = 4 * (oldYRow + ((newX * factorInv)|0));
			const newX2 = 4 * (newYRow + newX);
			bufOut[newX2] = bufLow[oldX2] + bufDiff[newX2] * bufDev[oldX2];
			bufOut[newX2 + 1] = bufLow[oldX2 + 1] + bufDiff[newX2 + 1] * bufDev[oldX2 + 1];
			bufOut[newX2 + 2] = bufLow[oldX2 + 2] + bufDiff[newX2 + 2] * bufDev[oldX2 + 2];
			bufOut[newX2 + 3] = bufLow[oldX2 + 3] + bufDiff[newX2 + 3] * bufDev[oldX2 + 3];
		}
	}

	return {
		h: resNewH, 
		w: resNewW, 
		dataFloat: bufOut
	};
}
function decodeFrame_luma(imgObj, hue0) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat;
	const bufOut = new Float32Array(4 * resOldH * resOldW);

	const rc1 = Math.cos(2 * Math.PI * hue0 / 6), rc2 = Math.sin(2 * Math.PI * hue0 / 6);
	const gc1 = Math.cos(2 * Math.PI * (hue0 + 2) / 6), gc2 = Math.sin(2 * Math.PI * (hue0 + 2) / 6);
	const bc1 = Math.cos(2 * Math.PI * (hue0 + 4) / 6), bc2 = Math.sin(2 * Math.PI * (hue0 + 4) / 6);
	for(let i = 0; i < 4 * resOldH * resOldW; i += 4) {
		bufOut[i] = bufIn[i] + rc1 * bufIn[i + 1] + rc2 * bufIn[i + 2];
		bufOut[i + 1] = bufIn[i] + gc1 * bufIn[i + 1] + gc2 * bufIn[i + 2];
		bufOut[i + 2] = bufIn[i] + bc1 * bufIn[i + 1] + bc2 * bufIn[i + 2];
		bufOut[i + 3] = bufIn[i + 3];
	}

	return {
		h: resOldH, 
		w: resOldW, 
		dataFloat: bufOut
	};
}
function decodePlanes4_toFrame(imgObjArr, resNewH, resNewW) {
	const bufOut = new Float32Array(4 * resNewH * resNewW);
	const factorInv = [
		[imgObjArr[0].h / resNewH, imgObjArr[0].w / resNewW],
		[imgObjArr[1].h / resNewH, imgObjArr[1].w / resNewW],
		[imgObjArr[2].h / resNewH, imgObjArr[2].w / resNewW],
		[imgObjArr[3].h / resNewH, imgObjArr[3].w / resNewW]
	];
	for(let newY = 0; newY < resNewH; newY++) {
		const newYRow = resNewW * newY;
		const oldYRow = [
			imgObjArr[0].w * ((newY * factorInv[0][0])|0),
			imgObjArr[1].w * ((newY * factorInv[1][0])|0),
			imgObjArr[2].w * ((newY * factorInv[2][0])|0),
			imgObjArr[3].w * ((newY * factorInv[3][0])|0)
		];
		for(let newX = 0; newX < resNewW; newX++) {
			const newX2 = 4 * (newYRow + newX);
			bufOut[newX2    ] = imgObjArr[0].dataFloat[oldYRow[0] + ((newX * factorInv[0][1])|0)];
			bufOut[newX2 + 1] = imgObjArr[1].dataFloat[oldYRow[1] + ((newX * factorInv[1][1])|0)];
			bufOut[newX2 + 2] = imgObjArr[2].dataFloat[oldYRow[2] + ((newX * factorInv[2][1])|0)];
			bufOut[newX2 + 3] = imgObjArr[3].dataFloat[oldYRow[3] + ((newX * factorInv[3][1])|0)];
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
			scalePixels[0] = decodeFrame_filterSinc(scalePixels[1], factor);
			break;
		case "blocksBasic":
			scalePixels[0] = decodeFrame_blocksBasic(scalePixels[1], factor);
			break;
		case "posterization":
			scalePixels[0] = scalePixels[1];
			break;
		case "luma posterization":
			scalePixels[0] = decodeFrame_luma(scalePixels[1], 0.0);
			break;
		case "luma downsampling":
			const encObj = decodePlanes4_toFrame(scalePixels[1], sh, sw);
			scalePixels[0] = decodeFrame_luma(encObj, 0.0);
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
