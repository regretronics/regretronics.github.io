"use strict";

//exp2 look-up table acceleration.
var exp2LUT;
const _2to30 = 1 << 30, _2toNeg30 = 1 / _2to30;

function exp2_LUT_old(x) {
	if(typeof(x) === "boolean") x = Number(x);
	if(typeof(x) !== "number") return NaN;
	if(x < -30) return 0;
	if(x > 30) return Infinity;

	let xInt = Math.floor(x);
	let powOf2 = (xInt >= 0 ? (1 << xInt) : (1 / (1 << (-xInt))));
	return powOf2 * exp2LUT[Math.floor((x - xInt) * exp2LUTSize)];
}
function exp2_LUT_old2(x) {
	if(typeof(x) === "boolean") x = Number(x);
	if(typeof(x) !== "number") return NaN;
	if(x === -Infinity) return 0;
	if(x === Infinity) return Infinity;

	let powOf2 = 1;
	if(x > 30)
		do {
			powOf2 *= _2to30;
			x += -30;
		} while(x > 30);
	else
		while(x < -30) {
			powOf2 *= _2toNeg30;
			x += 30;
		}

	let xInt = Math.floor(x);
	powOf2 *= (xInt >= 0 ? (1 << xInt) : (1 / (1 << (-xInt))));
	return powOf2 * exp2LUT[Math.floor((x - xInt) * exp2LUTSize)];
}
function exp2_LUT_old3(x) {
	if(typeof(x) === "boolean") x = Number(x);
	if(typeof(x) !== "number") return NaN;
	if(x === -Infinity) return 0;
	if(x === Infinity) return Infinity;
	let isNeg = x < 0;
	x = Math.abs(x);

	let exp = 1;
	while(x > 30) {
		exp *= _2to30;
		x += -30;
	}

	let xInt = Math.floor(x);
	exp *= (1 << xInt) * exp2LUT[Math.floor((x - xInt) * exp2LUTSize)];
	if(isNeg) exp = 1 / exp;
	return exp;
}
function exp2_LUT(x) {
	let isNeg = x < 0;
	x = Math.abs(x);

	let xInt = Math.floor(x);
	//let exp = (1 << xInt) * exp2LUT[Math.floor((x - xInt) * exp2LUTSize)];
	let exp = (1 << xInt) * exp2LUT[((x - xInt) * exp2LUTSize)|0];
	if(isNeg) exp = 1 / exp;
	return exp;
}

var exp_short2 = (x) => 1 + x + x * x / 2.0;
var exp_short3 = (x) => 1 + x + x * x / 2.0 + x * x * x / 6.0;
var exp_short4 = (x) => 1 + x + x * x / 2.0 + x * x * x / 6.0 + x * x * x * x / 24.0;
var exp_short5 = (x) => 1 + x + x * x / 2.0 + x * x * x / 6.0 + x * x * x * x / 24.0 + x * x * x * x * x / 120.0;
function exp2_fast_old(x) {
	let isNeg = x < 0;
	x = Math.abs(x);

	let xInt = Math.round(x);
	let exp = (1 << xInt) * exp_short3((x - xInt) * Math.LN2);
	if(isNeg) exp = 1 / exp;
	return exp;
}
function exp2_fast(x) {
	let isNeg = x < 0;
	x = Math.abs(x);

	let xInt = Math.round(x), xf = (x - xInt) * Math.LN2;
	let xf2 = xf * xf;
	//let exp = (1 << xInt) * (1 + xf + 0.5 * xf2 + xf2 * xf / 6.0);
	let exp = (1 << xInt) * (1 + xf + xf2 * (0.5 + xf / 6.0));
	if(isNeg) exp = 1 / exp;
	return exp;
}
