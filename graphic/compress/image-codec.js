"use strict";

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
function encodeFrame_chromaPosterize(imgObj, quantStep1, quantStep2) {
	const resOldH = imgObj.h, resOldW = imgObj.w;
	const bufIn = imgObj.dataFloat, bufOut = new Float32Array(4 * resOldH * resOldW);
	const quantStepInv1 = 1 / quantStep1, quantStepInv2 = 1 / quantStep2;

	for(let i = 0; i < 4 * resOldH * resOldW; i += 4) {
		bufOut[i] = bufIn[i];
		bufOut[i + 1] = quantStep1 * Math.round(quantStepInv1 * bufIn[i + 1]);
		bufOut[i + 2] = quantStep2 * Math.round(quantStepInv2 * bufIn[i + 2]);
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
