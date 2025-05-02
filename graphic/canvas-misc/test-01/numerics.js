"use strict";

//arctan look-up table.
//const requires ECMAScript 6/2015.
const atanLUTScale = 256, atanLUTSize = atanLUTScale + 1;
const Tau = 2 * Math.PI, Tau_4 = 0.25 * Tau, Tau_8 = 0.125 * Tau;
var atanLUT = new Float32Array(atanLUTSize);

function atanLUTInit() {
	for(let i = 0; i < atanLUTSize; i++) {
		atanLUT[i] = Math.atan(i / atanLUTScale);
	}
}
atanLUTInit();

function atan2_LUT_0(y, x) {
	let ang = 0;
	if(Math.abs(y) > Math.abs(x)) {
		let y2 = -x;
		x = y;
		y = y2;
		ang = Tau_4;
	}
	if(x < 0) {
		ang += Math.PI;
		x = -x;
		y = -y;
	}
	//let ang2 = Math.atan(Math.abs(y) / x);
	//No interpolation at the moment.
	let ang2 = atanLUT[(atanLUTScale * Math.abs(y) / x)|0];
	//ang += Math.atan(y / x);
	//Math.sign requires ECMAScript 6/2015.
	ang += ang2 * Math.sign(y);
	//if(ang < 0) {ang += Tau;}
	return ang;
}

function atan2_LUT(y, x) {
	//Math.sign requires ECMAScript 6/2015.
	let ang = 0, ySgn = Math.sign(y), xSgn = Math.sign(x);
	if(ySgn == 0) {ySgn = 1;}
	y = Math.abs(y);
	if(xSgn != 1) {
		//x not positive: rotate a straight angle back.
		let y2 = -x;
		x = y;
		y = y2;
		ang = Tau_4;
	}
	if(y > x) {
		//more than 45 degrees: rotate 45 degrees back.
		let y2 = Math.SQRT1_2 * y, x2 = Math.SQRT1_2 * x;
		y = y2 - x2;
		x = y2 + x2;
		ang += Tau_8;
	}
	//No interpolation at the moment.
	ang += atanLUT[(atanLUTScale * y / x)|0];

	return ySgn * ang;
}

function atan2_LUT_Test() {
	let status = true;
	/*status &= (atan2_LUT(0, 1) / Tau) == 0;
	status &= (atan2_LUT(0, -1) / Tau) == 0.5;
	status &= (atan2_LUT(1, 0) / Tau) == 0.25;
	status &= (atan2_LUT(-1, 0) / Tau) == 0.75;
	status &= (atan2_LUT(1, 1) / Tau) == 0.125;
	status &= (atan2_LUT(1, -1) / Tau) == 0.375;
	status &= (atan2_LUT(-1, -1) / Tau) == 0.625;
	status &= (atan2_LUT(-1, 1) / Tau) == -0.125;*/

	//to do: tolerance (fuzzy?)
	status &= (atan2_LUT(0, 1) / Tau) == 0;
	status &= (atan2_LUT(0, -1) / Tau) == 0.5;
	status &= (atan2_LUT(1, 0) / Tau) == 0.25;
	status &= (atan2_LUT(-1, 0) / Tau) == -0.25;
	status &= (atan2_LUT(1, 1) / Tau) == 0.125;
	status &= (atan2_LUT(1, -1) / Tau) == 0.375;
	status &= (atan2_LUT(-1, -1) / Tau) == -0.375;
	status &= (atan2_LUT(-1, 1) / Tau) == -0.125;
	return status;
}
//--

//log2 look-up table.
const log2LUTScale = 256, log2LUTSize = atanLUTScale;
var log2LUT = new Float32Array(log2LUTSize);
//1 << 31 already gives a negative number.
const _2to30 = 1 << 30, _2toNeg30 = 1 / _2to30;

function log2LUTInit() {
	for(let i = 0; i < log2LUTSize; i++) {
		//Math.log2 requires ECMAScript 6/2015.
		log2LUT[i] = Math.log2((i + log2LUTScale) / log2LUTScale);
	}
}
log2LUTInit();

function log2_LUT(x) {
	//if(x <= 0) {return NaN;}
	let logI = 0;
	//Remember clz32 only works with 32-bit integers. This below extends the range a little.
	if(x >= _2to30) {
		x *= _2toNeg30;
		logI = 30;
	} else {
		if(x < 1) {
			x *= _2to30;
			logI = -30;
		}
	}
	//Math.clz32 requires ECMAScript 6/2015.
	let logI2 = 31 - Math.clz32(x), pow = 1 << logI2;
	//No interpolation at the moment.
	x = ((x / pow - 1) * log2LUTScale)|0;
	x = log2LUT[x];
	return logI + logI2 + x;
}
