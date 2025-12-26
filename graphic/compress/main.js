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
	imageScaleUpdate(cbxSourceScale, imgSource);
	sh = event.target.naturalHeight;
	sw = event.target.naturalWidth;

	outSourceRes.textContent = `${sw}x${sh}`;
	window.setTimeout(compEncode, 100, event.target);
}

const factor = 4, factorInv = 1 / factor, factorInv2 = factorInv * factorInv;
function encodeFrame(bufIn, sw, sh, h2, w2) {
	//subsampling (first round)
	const bufOut = new Float32Array(4 * h2 * w2);
	for(let sy = 0; sy < sh; sy++) {
		const sy2 = sw * sy;
		const y2 = w2 * ((sy * factorInv)|0);
		for(let sx = 0, sx2, x2; sx < sw; sx++) {
			x2 = 4 * (y2 + (sx * factorInv)|0);
			sx2 = 4 * (sy2 + sx);
			bufOut[x2++] += bufIn[sx2++];
			bufOut[x2++] += bufIn[sx2++];
			bufOut[x2++] += bufIn[sx2++];
			bufOut[x2] += bufIn[sx2];
		}
	}
	for(let sy = 0; sy < 4 * h2 * w2; sy++)
		bufOut[sy] *= factorInv2;

	return bufOut;
}
function compEncode(image) {
	//to do: ...OffscreenCanvas (not supported in Firefox as of 2022-09)
	//const offscreen = new OffscreenCanvas(sw, sh);
	if(!cnvSource || !cnvSource.getContext) return;
	cnvSource.height = sh;
	cnvSource.width = sw;

	//sourceC2d = cnvSource.getContext('2d');
	//sourceC2d = cnvSource.getContext('2d', {colorSpace: "display-p3", storageFormat: 'float16'});
	sourceC2d = cnvSource.getContext('2d', {alpha: false});
	//sourceC2d.globalAlpha = 1;
	//sourceC2d.imageSmoothingEnabled = false;

	sourceC2d.drawImage(image, 0, 0);
	imgSourceData = sourceC2d.getImageData(0, 0, sw, sh);

	scalePixels = [];
	//scalePixels.push(new Float32Array()); //question: change push() for unshift() (reverses the array order)?
	const b8ToFloatScale = 1 / 255;
	scalePixels.push({
		h: sh, 
		w: sw, 
		dataFloat: Float32Array.from(imgSourceData.data, x => x * b8ToFloatScale)
	}); //question: change push() for unshift() (reverses the array order)?
	//question: subtract 0.5 from color values? (currently no)

	const tNow = performance.now();
	const h2 = Math.ceil(factorInv * sh), w2 = Math.ceil(factorInv * sw);
	/* const i = */ scalePixels.push({
		h: h2, 
		w: w2, 
		dataFloat: encodeFrame(scalePixels[0].dataFloat, sh, sw, h2, w2)
	});
	transformPerf.encode = performance.now() - tNow;

	compDecode(sh, sw, cnvOutput, outputC2d);
	outMediaEncodeT.innerText = transformPerf.encode.toFixed(2);
	outMediaDecodeT.innerText = transformPerf.decode.toFixed(2);
}

function decodeFrame(scalePixels, sh, sw) {
	const bufOut = new Float32Array(scalePixels[0].dataFloat.length), bufIn = scalePixels[1].dataFloat;
	const h2 = Math.ceil(factorInv * sh), w2 = Math.ceil(factorInv * sw);
	/*for(let sy = 0, sx; sy < sh; sy++) {
		const yRow = sw * sy;
		const y2 = w2 * ((sy * factorInv)|0);
		for(sx = 0; sx < sw; sx++) {
			const x2 = 4 * (y2 + (sx * factorInv)|0);
			const sx2 = 4 * (yRow + sx);
			bufOut[sx2] = bufIn[x2];
			bufOut[sx2 + 1] = bufIn[x2 + 1];
			bufOut[sx2 + 2] = bufIn[x2 + 2];
			bufOut[sx2 + 3] = bufIn[x2 + 3];
		}
	}*/
	for(let y = 0, x; y < h2; y++) {
		const yRow = w2 * y;
		const syRow = sw * y * factor;
		for(x = 0; x < w2; x++) {
			const x2 = 4 * (yRow + x);
			const sx2 = 4 * (syRow + x * factor);
			for(let dy = -sinc_r * factor, dx; dy < (1 + sinc_r) * factor; dy++) {
				const fy = sinc_filter1Float[dy + sinc_r * factor];
				for(dx = -sinc_r * factor; dx < (1 + sinc_r) * factor; dx++) {
					const fx = fy * sinc_filter1Float[dx + sinc_r * factor];
					const sx3 = sx2 + 4 * (sw * dy + dx);
					bufOut[sx3] += bufIn[x2] * fx;
					bufOut[sx3 + 1] += bufIn[x2 + 1] * fx;
					bufOut[sx3 + 2] += bufIn[x2 + 2] * fx;
					bufOut[sx3 + 3] += bufIn[x2 + 3] * fx;
				}
			}
		}
	}

	return bufOut;
}
function compDecode(sh, sw, cnvOutput, outputC2d) {
	ch = sh;
	cw = sw;
	cnvOutput.height = ch;
	cnvOutput.width = cw;
	imageScaleUpdate(cbxSourceScale, cnvOutput);
	//canvasSizeUpdate();

	const tNow = performance.now();
	scalePixels[0].dataFloat = decodeFrame(scalePixels, sh, sw);
	transformPerf.decode = performance.now() - tNow;

	//imgData = outputC2d.createImageData(cw, ch);
	const imgArray = Uint8ClampedArray.from(scalePixels[0].dataFloat, x => x * 255);
	//var imgArray = new Uint8ClampedArray(4 * ch * cw);
	imgData = new ImageData(imgArray, cw, ch);
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
	imgSource.src = txtImgURL.value;
}
function chkShrinkChanged(event) {
	const elem = event.target;
	if(!elem || !elem.dataset) return;
	const id = elem.dataset.image;
	if(!id) return;
	const image = document.getElementById(id);
	const parent = image.parentElement;
	if(elem.checked) {
		image.classList.add("shrink");
		//parent.style.;
	} else {
		image.classList.remove("shrink");
	}
}

function pageReady() {
	if(cnvOutput.getContext) {
		outputC2d = cnvOutput.getContext('2d');
		//outputC2d = cnvOutput.getContext('2d', {colorSpace: "display-p3", storageFormat: 'float16'});
		//outputC2d = cnvOutput.getContext('2d', {alpha: false});
		//outputC2d.globalAlpha = 1;
		//outputC2d.imageSmoothingEnabled = false;

		ch = cnvOutput.height;
		cw = cnvOutput.width;

		//imageScaleUpdate(cbxSourceScale, imgSource);
		//imageScaleUpdate(cbxOutputScale, cnvOutput);
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
function transformClick(event) {
	compEncode(imgSource);
}
function pageLoaded() {
	for(const s of document.querySelectorAll('[id]'))
		window[s.id] = s;

	inImage.addEventListener("change", inImageChange);
	btnImgLoad.addEventListener("click", loadURL);
	imgSource.addEventListener("load", imgSourceLoaded);
	cbxSourceScale.addEventListener("change", cbxScaleChanged);
	chkSourceShrink.addEventListener("change", chkShrinkChanged);

	btnTransform.addEventListener("click", transformClick);

	const evt = new Event("change");
	chkSourceShrink.dispatchEvent(evt);
}

//window.addEventListener("DOMContentLoaded", pageLoaded);
if(document.readyState === "loading")
	document.addEventListener("DOMContentLoaded", pageLoaded);
else //DOMContentLoaded has already fired
	pageLoaded();
window.addEventListener("load", pageReady);
