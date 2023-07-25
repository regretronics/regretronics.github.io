"use strict";

//virtual matricial field context
//const worldSize = 16;
//const worldSize = 32;
//const worldSize = 64;
//const worldSize = 96;
//const worldSize = 128;
//const worldSize = 192;
//const worldSize = 256;
//const worldSize = 384;
var worldSize = 64;
//var worldRes =
//var worldRes = new Int8Array(
//var worldRes = new Uint8Array(
var worldRes = new Int32Array(
//var worldRes = new Float32Array(
	[worldSize, worldSize, worldSize]);

//--
//virtual vectorial client context
//basically done.
//var clientPos = new Float32Array(3), clientRot = new Float32Array(9);
//var clientPos = new Float32Array([0.5 * worldRes[0] + 0.5, 0.5 * worldRes[1] + 0.5, 0.375 * worldRes[2] + 0.5, 0.0]);
var clientPos = new Float32Array([0.5 * worldRes[0] + 4.5, 0.5 * worldRes[1] + 4.5, 0.375 * worldRes[2] + 0.5, 0.0]);
var clientSpcTransf = new Float32Array([
	1, 0, 0,
	0, 1, 0,
	0, 0, 1]);
var clientSpcTransfInv = new Float32Array([
	1, 0, 0,
	0, 1, 0,
	0, 0, 1]);
var clientFoVH = 1;
var rayDirsCol, rayDirsRow;
var rowNormals, colNormals;
//var texNormalsCol, texNormalsRow;
var texRayDirs, texRayDirsSign;

const opacityFactor = -128 * Math.LN2 / 256;
//const opacityFactor = -128 / 256;

var generalKernels/* , fieldKernels, rcKernels0, rcKernels1 */;
function registerKernels() { //to do: Delete?
	generalKernels = registerGeneralKernels(gpu);
}
function registerGeneralKernels(gpu) {
	let newKernels = {};

	newKernels.alignParticles = gpu.createKernel(function(partPos, clientPos, clientSpcMatrix) {
		const p = 4 * this.thread.x;
		const pos = [partPos[p], partPos[p + 1], partPos[p + 2]];
		const local = [pos[0] - clientPos[0], pos[1] - clientPos[1], pos[2] - clientPos[2]];

		return [
			local[0] * clientSpcMatrix[0] + local[1] * clientSpcMatrix[3] + local[2] * clientSpcMatrix[6],
			local[0] * clientSpcMatrix[1] + local[1] * clientSpcMatrix[4] + local[2] * clientSpcMatrix[7],
			local[0] * clientSpcMatrix[2] + local[1] * clientSpcMatrix[5] + local[2] * clientSpcMatrix[8]];
	}, {
		//constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold, cw: cw},
		//argumentTypes: {arr: "Array"},
		returnType: 'Array(3)',
		//output: [cw, ch, 4],
		//optimizeFloatMemory: true,
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true,
		//to do: precision
	});

	newKernels.uploadArr4to3 = gpu.createKernel(function(arr) {
		const p = 4 * this.thread.x;
		return [arr[p], arr[p + 1], arr[p + 2]];
	}, {
		argumentTypes: {arr: "Array"},
		returnType: 'Array(3)',
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true
	});
	newKernels.uploadArr4 = gpu.createKernel(function(arr) {
		const p = 4 * this.thread.x;
		return [arr[p], arr[p + 1], arr[p + 2], arr[p + 3]];
	}, {
		argumentTypes: {arr: "Array"},
		returnType: 'Array(4)',
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true
	});

	newKernels.getPartBounds = gpu.createKernel(function(partPosLocal, partR) {
		//const p = 4 * this.thread.x;
		const pos = partPosLocal[this.thread.x];
		const r = partR[this.thread.x];
		const d2 = pos[2] * pos[2] - r * r;
		const distExtr = [Math.sqrt(pos[0] * pos[0] + d2), Math.sqrt(pos[1] * pos[1] + d2)];
		const zr = pos[2] * r;
		return [
			(pos[0] * distExtr[0] - zr) / (pos[2] * distExtr[0] + pos[0] * r),
			(pos[1] * distExtr[1] - zr) / (pos[2] * distExtr[1] + pos[1] * r),
			(pos[0] * distExtr[0] + zr) / (pos[2] * distExtr[0] - pos[0] * r),
			(pos[1] * distExtr[1] + zr) / (pos[2] * distExtr[1] - pos[1] * r)];
	}, {
		//constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold, cw: cw},
		argumentTypes: {partPosLocal: "Array(3)", partR: "Array"},
		returnType: 'Array(4)',
		//output: [cw, ch, 4],
		//optimizeFloatMemory: true,
		immutable: true,
		//pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true,
		//to do: precision
	});

	newKernels.particlesPerRay = gpu.createKernel(function(partPosLocal, colNormals, rayDirsRow, rayDirsCol, partCountArr, partByRowBlock, indices, remainders) {
		if(this.thread.x >= partCountArr[this.thread.z]) return [-1.0, 6e20, 0.0];
		//if(this.thread.z >= partCountArr[this.thread.y]) return [0.0, 6.0, 0.0];
		const p = indices[this.thread.z * partByRowBlock + this.thread.x];
		const rem = remainders[this.thread.z * partByRowBlock + this.thread.x];
		const p2 = 4 * p;
		const x2 = 4 * this.thread.y;
		const pos = [partPosLocal[p2], partPosLocal[p2 + 1], partPosLocal[p2 + 2]];
		const colNormal = [colNormals[x2], colNormals[x2 + 1], colNormals[x2 + 2]];
		const d = pos[0] * colNormal[0] + pos[1] * colNormal[1] + pos[2] * colNormal[2];
		const d2 = rem - d * d;
		if(d2 > 0.0) {
			const rem2 = Math.sqrt(d2);
			const y2 = 4 * this.thread.z;
			const rayDir = [rayDirsRow[x2], rayDirsCol[y2 + 1], rayDirsCol[y2 + 2]];
			//const rayDirFactor = 1.0 / Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
			const rayDirFactor = 1.0 / Math.sqrt(rayDirsRow[x2 + 3] + rayDirsCol[y2 + 3]);
			const z = rayDirFactor * (rayDir[0] * pos[0] + rayDir[1] * pos[1] + rayDir[2] * pos[2]);
			return [p, z, rem2];
		} else
			return [-1.0, 6e20, 0.0];
			//return [0.0, 6.0, 0.0];
	}, {
		//constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold, cw: cw},
		argumentTypes: {partPosLocal: "Array", colNormals: "Array", rayDirsRow: "Array", rayDirsCol: "Array", partCountArr: "Array", partByRowBlock: "Integer", indices: "Array", remainders: "Array"},
		returnType: 'Array(3)',
		//output: [cw, ch, 4],
		//optimizeFloatMemory: true,
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true,
		//to do: precision
	});
	
	newKernels.makeStopList = gpu.createKernel(function(particlesPerRay) {
		//particlesInRay.push({i: p, z: z - rem2, st: true}); //st = start of sphere
		//particlesInRay.push({i: p, z: z + rem2, st: false});
		//const z = this.thread.z;
		const z = this.thread.x;
		const odd = z % 2;
		//const z2 = z >> 1;
		//const z2 = (z - odd) * 0.5;
		const z2 = (z - odd) / 2;
		//const part = particlesPerRay[z2][this.thread.y][this.thread.x];
		const part = particlesPerRay[this.thread.z][this.thread.y][z2];
		if(part[0] == -1 || part[2] <= 0.0) return [-1, 6e20, 0];
		const odd2 = 2 * odd - 1;
		return [part[0], part[1] - odd2 * part[2], odd2];
	}, {
		//constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold, cw: cw},
		argumentTypes: {particlesPerRay: "Array(3)"},
		returnType: 'Array(3)',
		//output: [cw, ch, 8],
		//optimizeFloatMemory: true,
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true,
		//to do: precision
	});

	newKernels.sortBitonic = gpu.createKernel(function(stopsArr, depth, odd) {
		//const n = this.thread.z;
		const n = this.thread.x;
		if(n >= depth) return [-1, 6e20, 0.0];
		//const val0 = stopsArr[n][this.thread.y][this.thread.x];
		const val0 = stopsArr[this.thread.z][this.thread.y][n];
		if(n == 0 && odd == 1 || n == (depth - 1) && odd != n % 1)
			return val0;

		const partner = ((n + odd) ^ 1) - odd;
		if(partner >= depth) return val0;
		
		//const val = [stopsArr[n][this.thread.y][this.thread.x], stopsArr[partner][this.thread.y][this.thread.x]];
		//const val1 = stopsArr[partner][this.thread.y][this.thread.x];
		const val1 = stopsArr[this.thread.z][this.thread.y][partner];
		
		//const c1 = (val[0][1] < val[1][1] ? 1 : 0);
		const c1 = (val0[1] < val1[1] ? 1 : 0);
		const c2 = (n < partner ? 1 : 0);
		const c3 = c1 ^ c2;
		return c3 == 0 ? val0 : val1;
	}, {
		argumentTypes: {stopsArr: "Array(3)", depth: "Integer", odd: "Integer"},
		returnType: 'Array(3)',
		//optimizeFloatMemory: true,
		//output: [cw, ch, 8],
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true,
		immutable: true
	});
	//Based on code from https://github.com/Bekbolatov/SortingNetworks/blob/master/src/main/scala/com/sparkydots/sort/network/PartnerOddEven.scala
	newKernels.sortBatcherOddEven = gpu.createKernel(function(stopsArr, depth, /* l, */ p, expL, expP) {
		//const n = this.thread.z;
		const n = this.thread.x;
		if(n >= depth) return [-1, 6e20, 0.0];
		//const val0 = stopsArr[n][this.thread.y][this.thread.x];
		const val0 = stopsArr[this.thread.z][this.thread.y][n];
		//let partner = n ^ (1 << (l - 1));
		let partner = n ^ (0.5 * expL);
		if(p != 1) {
			//const scale = 1 << (l - p), box = 1 << p;
			//let sn = Math.floor(n / scale) - (Math.floor(n / scale / box)) * box;
			const sn = Math.floor(n * expP / expL) - (Math.floor(n / expL)) * expP;
			if(sn == 0 || sn == expP - 1)
				//partner = n;
				return val0;
			else {
				//if(sn % 2 == 0) partner = n - scale; else partner = n + scale;
				const scale = expL / expP;
				if(sn % 2 == 0) partner = n - scale; else partner = n + scale;
			}
		}
		if(partner >= depth) return val0;
		
		//const val1 = stopsArr[partner][this.thread.y][this.thread.x];
		const val1 = stopsArr[this.thread.z][this.thread.y][partner];
		
		//const c1 = (val[0][1] < val[1][1] ? 1 : 0);
		const c1 = (val0[1] < val1[1] ? 1 : 0);
		const c2 = (n < partner ? 1 : 0);
		const c3 = c1 ^ c2;
		return c3 == 0 ? val0 : val1;
	}, {
		argumentTypes: {stopsArr: "Array(3)", depth: "Integer", /* l: "Integer", */ p: "Integer", expL: "Float", expP: "Float"},
		returnType: 'Array(3)',
		//optimizeFloatMemory: true,
		//output: [cw, ch, 8],
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true,
		immutable: true
	});
	newKernels.sortBatcherOddEven2 = gpu.createKernel(function(stopList, stopEntryPoints, /* l, */ p, expL, expP, maxX) {
		const x = this.thread.x;
		//if(x >= maxX) return [0.0, 0.0, 0.0, 0.0];
		const val0 = stopList[x], i = val0[3];
		//return val0;
		const p1 = stopEntryPoints[i];//, p2 = stopEntryPoints[i + 1];
		const n = x - p1;//, size = p2 - p1;
		let partner = n ^ (0.5 * expL);
		if(p != 1) {
			const sn = Math.floor(n * expP / expL) - Math.floor(n / expL) * expP;
			if(sn == 0 || sn == expP - 1)
				//partner = n;
				return val0;
			else {
				const scale = expL / expP;
				if(sn % 2 == 0) partner = n - scale; else partner = n + scale;
			}
		}
		//if(partner >= size) return val0;
		
		const val1 = stopList[p1 + partner];
		if(i != val1[3]) return val0;
		
		const c1 = (val0[1] < val1[1] ? 1 : 0);
		const c2 = (n < partner ? 1 : 0);
		const c3 = c1 ^ c2;
		return (c3 == 0) ? val0 : val1;
	}, {
		//argumentTypes: {stopList: "Array(4)", stopEntryPoints: "Array", /* l: "Integer", */ p: "Float", expL: "Float", expP: "Float", maxX: "Float"},
		argumentTypes: {stopList: "Array(4)", stopEntryPoints: "Array", /* l: "Integer", */ p: "Integer", expL: "Integer", expP: "Integer", maxX: "Integer"},
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		//output: [cw, ch, 8],
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true,
		immutable: true
		//precision: "single",
		//tactic: "precision"
	});

	newKernels.rayCast3 = gpu.createKernel(function(partAlpha, partEmission, stopEntryPoints, stopBuf, cw) {
		//Render particles by segment sections as they cross the ray
		let em = [0.0, 0.0, 0.0/* , 0.0 */];
		let alpha = [1.0, 1.0, 1.0/* , 1.0 */];

		let chordEm = [0.0, 0.0, 0.0/* , 0.0 */];
		let chordAlpha = [0.0, 0.0, 0.0/* , 0.0 */];

		/* const p = this.thread.y * cw + this.thread.x;
		const p1 = stopEntryPoints[3 * p];
		const p2 = ((p == this.output.y * cw + this.output.x) ?  : stopEntryPoints[3 * p + 1]); */
		const p = this.thread.y * cw + this.thread.x;
		const p1 = stopEntryPoints[p], p2 = stopEntryPoints[p + 1];
		//const stops = p2 - p1;

		let j = p1, z = 0.0, z2 = 0.0;
		let crossingParticles = 0;
		//const pPixel = this.thread.y * this.constants.cw + this.thread.x;
		//const pPixel2 = pPixel * arrDepth;
		while(j < p2) {
			//break;
			for(; j < p2; j++) {
				//const stop = stopList[j][this.thread.y][this.thread.x];
				//const stop = stopBuf[3 * (p1 + j)];
				//const stop = [stopBuf[4 * j], stopBuf[4 * j + 1], stopBuf[4 * j + 2]];
				const stop = stopBuf[j];
				//z2 = depths[pPixel][j];
				z2 = stop[1];
				//if(z2 > 1e20) break;
				if(z2 > z) break;
				//if(stop[0] == -1) break;

				//const i = 4 * indices[pPixel][j];
				//const i = 4 * stop[0];
				const i = stop[0];
				//const sign = Math.sign(stop[2]);
				const sign = stop[2];
				//const sign = 0.25 * stop[2]; //?
				//const sign = (stop[2] > 0 ? 1 : (stop[2] < 0 ? -1 : 0));
				const partAlpha1 = partAlpha[i];
				const partAlpha2 = [sign * partAlpha1[0], sign * partAlpha1[1], sign * partAlpha1[2]/* , 0.0 */];
				const partEmission1 = partEmission[i];
				
				//Accumulate (sum) colors of particles present in the segment
				crossingParticles += sign;
				//const partAlpha = [alphaArr[i], alphaArr[i + 1], alphaArr[i + 2]/* , 0.0 */];
				if(sign > 0) { //Accumulate (sum) colors of particles present in the segment
					chordAlpha = [
						chordAlpha[0] + partAlpha2[0],
						chordAlpha[1] + partAlpha2[1],
						chordAlpha[2] + partAlpha2[2]];
					chordEm = [
						chordEm[0] + partAlpha2[0] * partEmission1[0],
						chordEm[1] + partAlpha2[1] * partEmission1[1],
						chordEm[2] + partAlpha2[2] * partEmission1[2]];
				} else {
					chordAlpha = [
						chordAlpha[0] + partAlpha2[0],
						chordAlpha[1] + partAlpha2[1],
						chordAlpha[2] + partAlpha2[2]];
					chordEm = [
						chordEm[0] + partAlpha2[0] * partEmission1[0],
						chordEm[1] + partAlpha2[1] * partEmission1[1],
						chordEm[2] + partAlpha2[2] * partEmission1[2]];
				}
			}
			//if(z2 > 1e20) break;
			if(z2 > z) {
				let localEm = [0.0, 0.0, 0.0/* , 0.0 */];
				//let localAlpha = [0.0, 0.0, 0.0/* , 0.0 */];
				let localAlpha = chordAlpha;
				if(crossingParticles > 0) {
					//localAlpha = chordAlpha;
					localEm[0] = chordEm[0] / localAlpha[0];
					localEm[1] = chordEm[1] / localAlpha[1];
					localEm[2] = chordEm[2] / localAlpha[2];
				} else {
					//Empty -> fog
					//localEm = [0.0, 0.0, 0.0/* , 0.0 */];
					localAlpha = [0.0625, 0.0625, 0.0625/* , 0.0 */];
				}

				//Render ray segment into fragment (order-sensitive alpha blend)
				const factor = this.constants.opacityFactor * (z2 - z);
				const segAlpha = [
					Math.exp(factor * localAlpha[0]),
					Math.exp(factor * localAlpha[1]),
					Math.exp(factor * localAlpha[2])];
				em[0] += alpha[0] * localEm[0] * (1.0 - segAlpha[0]);
				em[1] += alpha[1] * localEm[1] * (1.0 - segAlpha[1]);
				em[2] += alpha[2] * localEm[2] * (1.0 - segAlpha[2]);
				alpha[0] *= segAlpha[0];
				alpha[1] *= segAlpha[1];
				alpha[2] *= segAlpha[2];
				if(alpha[0] < this.constants.rayTranspThreshold
					&& alpha[1] < this.constants.rayTranspThreshold
					&& alpha[2] < this.constants.rayTranspThreshold)
					break;
			}
			z = z2;
		}
		//return em;
		//return [0.0, 0.5, 1.0, 0.0];
		this.color(em[0], em[1], em[2]);
		//this.color(0.0, 0.5, 1.0);
	}, {
		//argumentTypes: {partAlpha: "Array", partEmission: "Array", stopList: "Array(3)", particlesByRowMax: "Float"}, //Not supported in graphical kernels?
		constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold},
		output: [cw, ch],
		//optimizeFloatMemory: true,
		immutable: true,
		//pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true,
		graphical: true
		//to do: precision
	});

	newKernels.rayCast2 = gpu.createKernel(function(partAlpha, partEmission, stopList, particlesByRowMax) {
		//Render particles by segment sections as they cross the ray
		let em = [0.0, 0.0, 0.0/* , 0.0 */];
		let alpha = [1.0, 1.0, 1.0/* , 1.0 */];

		let chordEm = [0.0, 0.0, 0.0/* , 0.0 */];
		let chordAlpha = [0.0, 0.0, 0.0/* , 0.0 */];

		let j = 0, z = 0.0, z2 = 0.0;
		let crossingParticles = 0;
		//const pPixel = this.thread.y * this.constants.cw + this.thread.x;
		//const pPixel2 = pPixel * arrDepth;
		while(j < particlesByRowMax) {
			//break;
			for(; j < particlesByRowMax; j++) {
				//const stop = stopList[j][this.thread.y][this.thread.x];
				const stop = stopList[this.thread.y][this.thread.x][j];
				//z2 = depths[pPixel][j];
				z2 = stop[1];
				//if(z2 > 1e20) break;
				if(z2 > z) break;
				if(stop[0] == -1) break;

				//const i = 4 * indices[pPixel][j];
				//const i = 4 * stop[0];
				const i = stop[0];
				//const sign = Math.sign(stop[2]);
				const sign = stop[2];
				//const sign = 0.25 * stop[2]; //?
				//const sign = (stop[2] > 0 ? 1 : (stop[2] < 0 ? -1 : 0));
				const partAlpha1 = partAlpha[i];
				const partAlpha2 = [sign * partAlpha1[0], sign * partAlpha1[1], sign * partAlpha1[2]/* , 0.0 */];
				const partEmission1 = partEmission[i];
				
				//Accumulate (sum) colors of particles present in the segment
				/* chordAlpha[0] += sign * partAlpha[0];
				chordAlpha[1] += sign * partAlpha[1];
				chordAlpha[2] += sign * partAlpha[2];
				chordEm[0] += sign * partAlpha[0] * partEmission[i];
				chordEm[1] += sign * partAlpha[1] * partEmission[i + 1];
				chordEm[2] += sign * partAlpha[2] * partEmission[i + 2]; */
				/* chordAlpha = [chordAlpha[0] - partAlpha2[0],
					chordAlpha[1] - partAlpha2[1],
					chordAlpha[2] - partAlpha2[2]];
				chordEm = [chordEm[0] - partAlpha2[0] * partEmission[i],
					chordEm[1] - partAlpha2[1] * partEmission[i + 1],
					chordEm[2] - partAlpha2[2] * partEmission[i + 2]];
				//if(stop[2] >= 0) crossingParticles++; else crossingParticles--; */
				crossingParticles += sign;
				//const partAlpha = [alphaArr[i], alphaArr[i + 1], alphaArr[i + 2]/* , 0.0 */];
				//if(extremes[pPixel][j] > 0) { //Accumulate (sum) colors of particles present in the segment
				if(sign > 0) {
					/* chordAlpha[0] += partAlpha2[0];
					chordAlpha[1] += partAlpha2[1];
					chordAlpha[2] += partAlpha2[2];
					chordEm[0] += partAlpha2[0] * partEmission1[0];
					chordEm[1] += partAlpha2[1] * partEmission1[1];
					chordEm[2] += partAlpha2[2] * partEmission1[2]; */
					chordAlpha = [chordAlpha[0] + partAlpha2[0],
						chordAlpha[1] + partAlpha2[1],
						chordAlpha[2] + partAlpha2[2]];
					chordEm = [chordEm[0] + partAlpha2[0] * partEmission1[0],
						chordEm[1] + partAlpha2[1] * partEmission1[1],
						chordEm[2] + partAlpha2[2] * partEmission1[2]];
					//crossingParticles++;
				} else {
					/* chordAlpha[0] += partAlpha2[0];
					chordAlpha[1] += partAlpha2[1];
					chordAlpha[2] += partAlpha2[2];
					chordEm[0] += partAlpha2[0] * partEmission1[0];
					chordEm[1] += partAlpha2[1] * partEmission1[1];
					chordEm[2] += partAlpha2[2] * partEmission1[2]; */
					chordAlpha = [chordAlpha[0] + partAlpha2[0],
						chordAlpha[1] + partAlpha2[1],
						chordAlpha[2] + partAlpha2[2]];
					chordEm = [chordEm[0] + partAlpha2[0] * partEmission1[0],
						chordEm[1] + partAlpha2[1] * partEmission1[1],
						chordEm[2] + partAlpha2[2] * partEmission1[2]];
					//crossingParticles--;
				}
			}
			if(z2 > 1e20) break;
			if(z2 > z) {
				let localEm = [0.0, 0.0, 0.0/* , 0.0 */];
				//let localAlpha = [0.0, 0.0, 0.0/* , 0.0 */];
				let localAlpha = chordAlpha;
				if(crossingParticles > 0) {
					//localAlpha = chordAlpha;
					localEm[0] = chordEm[0] / localAlpha[0];
					localEm[1] = chordEm[1] / localAlpha[1];
					localEm[2] = chordEm[2] / localAlpha[2];
				} else {
					//Empty -> fog
					//localEm = [0.0, 0.0, 0.0/* , 0.0 */];
					localAlpha = [0.0625, 0.0625, 0.0625/* , 0.0 */];
				}

				//Render ray segment into fragment (order-sensitive alpha blend)
				const factor = this.constants.opacityFactor * (z2 - z);
				/* const segAlpha0 = Math.exp(factor * localAlpha[0]);
				const segAlpha1 = Math.exp(factor * localAlpha[1]);
				const segAlpha2 = Math.exp(factor * localAlpha[2]); */
				const segAlpha = [Math.exp(factor * localAlpha[0]),
					Math.exp(factor * localAlpha[1]),
					Math.exp(factor * localAlpha[2])];
				em[0] += alpha[0] * localEm[0] * (1.0 - segAlpha[0]);
				em[1] += alpha[1] * localEm[1] * (1.0 - segAlpha[1]);
				em[2] += alpha[2] * localEm[2] * (1.0 - segAlpha[2]);
				alpha[0] *= segAlpha[0];
				alpha[1] *= segAlpha[1];
				alpha[2] *= segAlpha[2];
				if(alpha[0] < this.constants.rayTranspThreshold
					&& alpha[1] < this.constants.rayTranspThreshold
					&& alpha[2] < this.constants.rayTranspThreshold)
					break;
			}
			//if(z2 > 1e20) break;
			z = z2;
		}
		//return em;
		//return [0.0, 0.5, 1.0, 0.0];
		this.color(em[0], em[1], em[2]);
		//this.color(0.0, 0.5, 1.0);
	}, {
		//argumentTypes: {partAlpha: "Array", partEmission: "Array", stopList: "Array(3)", particlesByRowMax: "Float"}, //Not supported in graphical kernels?
		constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold, cw: cw},
		output: [cw, ch],
		//optimizeFloatMemory: true,
		immutable: true,
		//pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true,
		graphical: true
		//to do: precision
	});

	/* newKernels.rayCastCombo = gpu.combineKernels(newKernels.particlesPerRay, newKernels.makeStopList, newKernels.sortBatcherOddEven, newKernels.rayCast2,
		function(partPosLocal, colNormals, rayDirsRow, rayDirsCol, partCountByRow, particlesByRowMax, rowIndices, rowRemainders, cw, ch, partAlphaGPU, partEmissionGPU) {
			//newKernels.particlesPerRay.setOutput([cw, ch, particlesByRowMax]);
			const partPerRayUnsorted = newKernels.particlesPerRay(partPosLocal, colNormals, rayDirsRow, rayDirsCol, partCountByRow, particlesByRowMax, rowIndices, rowRemainders);

			//newKernels.makeStopList.setOutput([cw, ch, 2 * particlesByRowMax]);
			let stopList = newKernels.makeStopList(partPerRayUnsorted);
			partPerRayUnsorted.delete();
			
			//newKernels.sortBatcherOddEven.setOutput([cw, ch, 2 * particlesByRowMax]);
			//stopList = newKernels.sortBatcherOddEven(stopList, 1, 1);
			const d = Math.ceil(Math.log2(2 * particlesByRowMax));
			for(let l = 1; l <= d; l++)
				for(let p = 1; p <= l; p++) {
					const stopList2 = newKernels.sortBatcherOddEven(stopList, 2 * particlesByRowMax, l, p);
					stopList.delete?.();
					stopList = stopList2;
				}

			//newKernels.rayCast2.setOutput([cw, ch]);
			//mainCanvas.height = ch;
			//mainCanvas.width = cw;
			newKernels.rayCast2(partAlphaGPU, partEmissionGPU, stopList, 2 * particlesByRowMax);
			stopList.delete();
			return 0;
	}); */
	
	newKernels.rayCast1 = gpu.createKernel(function(alphaArr, emissionArr, stopCount, indices, depths, extremes, arrDepth) {
		//Render particles by segment sections as they cross the ray
		let em = [0.0, 0.0, 0.0, 0.0];
		let alpha = [1.0, 1.0, 1.0/* , 1.0 */];

		let chordEm = [0.0, 0.0, 0.0/* , 0.0 */];
		let chordAlpha = [0.0, 0.0, 0.0/* , 0.0 */];

		let j = 0, z = 0.0, z2 = 0.0;
		let crossingParticles = 0;
		const pPixel = this.thread.y * this.constants.cw + this.thread.x;
		const pPixel2 = pPixel * arrDepth;
		while(j < stopCount[pPixel] && j < arrDepth) {
			for(; j < stopCount[pPixel] && j < arrDepth; j++) {
				//z2 = depths[pPixel][j];
				z2 = depths[pPixel2 + j];
				if(z2 > z) break;

				//const i = 4 * indices[pPixel][j];
				const i = 4 * indices[pPixel2 + j];
				const partAlpha = [alphaArr[i], alphaArr[i + 1], alphaArr[i + 2]/* , 0.0 */];
				//if(extremes[pPixel][j] > 0) { //Accumulate (sum) colors of particles present in the segment
				if(extremes[pPixel2 + j] > 0) { //Accumulate (sum) colors of particles present in the segment
					chordAlpha[0] += partAlpha[0];
					chordAlpha[1] += partAlpha[1];
					chordAlpha[2] += partAlpha[2];
					chordEm[0] += partAlpha[0] * emissionArr[i];
					chordEm[1] += partAlpha[1] * emissionArr[i + 1];
					chordEm[2] += partAlpha[2] * emissionArr[i + 2];
					crossingParticles++;
				} else {
					chordAlpha[0] -= partAlpha[0];
					chordAlpha[1] -= partAlpha[1];
					chordAlpha[2] -= partAlpha[2];
					chordEm[0] -= partAlpha[0] * emissionArr[i];
					chordEm[1] -= partAlpha[1] * emissionArr[i + 1];
					chordEm[2] -= partAlpha[2] * emissionArr[i + 2];
					crossingParticles--;
				}
			}
			if(z2 > z) {
				let localEm = [0.0, 0.0, 0.0/* , 0.0 */];
				//let localAlpha = [0.0, 0.0, 0.0/* , 0.0 */];
				let localAlpha = chordAlpha;
				if(crossingParticles == 0) {
					//Empty -> fog
					//localEm = [0.0, 0.0, 0.0/* , 0.0 */];
					localAlpha = [0.0625, 0.0625, 0.0625/* , 0.0 */];
				} else {
					//localAlpha = chordAlpha;
					localEm[0] = chordEm[0] / localAlpha[0];
					localEm[1] = chordEm[1] / localAlpha[1];
					localEm[2] = chordEm[2] / localAlpha[2];
				}

				//Render ray segment into fragment (order-sensitive alpha blend)
				const factor = this.constants.opacityFactor * (z2 - z);
				/* const segAlpha0 = Math.exp(factor * localAlpha[0]);
				const segAlpha1 = Math.exp(factor * localAlpha[1]);
				const segAlpha2 = Math.exp(factor * localAlpha[2]); */
				const segAlpha = [Math.exp(factor * localAlpha[0]),
					Math.exp(factor * localAlpha[1]),
					Math.exp(factor * localAlpha[2])];
				em[0] += alpha[0] * localEm[0] * (1.0 - segAlpha[0]);
				em[1] += alpha[1] * localEm[1] * (1.0 - segAlpha[1]);
				em[2] += alpha[2] * localEm[2] * (1.0 - segAlpha[2]);
				alpha[0] *= segAlpha[0];
				alpha[1] *= segAlpha[1];
				alpha[2] *= segAlpha[2];
				if(alpha[0] < this.constants.rayTranspThreshold && alpha[1] < this.constants.rayTranspThreshold && alpha[2] < this.constants.rayTranspThreshold) break;
			}
			z = z2;
		}
		//return em;
		//return [0.0, 0.5, 1.0, 0.0];
		this.color(em[0], em[1], em[2]);
	}, {
		constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold, cw: cw},
		output: [cw, ch],
		//optimizeFloatMemory: true,
		//immutable: true,
		//pipeline: true,
		//dynamicOutput: true,
		dynamicArguments: true,
		graphical: true
		//to do: precision
	});

	newKernels.drawPixels = gpu.createKernel(function(/* buf, */ cw, ch) {
		//const pPixel = 4 * (this.thread.y * cw + this.thread.x);
		//this.color(buf[pPixel], buf[pPixel + 1], buf[pPixel + 2]);
		this.color(1.0, 0.5, 0.0);
	}, {
		argumentTypes: {/* buf: "Array", */ cw: "Integer", ch: "Integer"},
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		graphical: true
		//to do: precision
	});
	return newKernels;
}

function canvasSizeChange(newCW, newCH) {
	ch = newCH;
	cw = newCW;

	releaseCanvasResources(); //Dispose canvas-related kernels, etc.

	//Recreate kernels, except field-related ones
	generalKernels = registerGeneralKernels(gpu);

	//From registerKernels
	/* generalKernels.rayDirs2d.setOutput([cw, ch]);
	generalKernels.rayDirsSigns.setOutput([cw, ch]); */

	rcKernelsSetDimensions(generalKernels);
	//rcKernelsSetDimensions(rcKernels0);

	viewRayDirsCompute_Rectilinear(ch, cw);
	//texBuffer0 = {};
	//texBuffer1 = {};

	//force-compile
	//frameRenderRaycasting(1);
	//frameRenderRaycasting2(1);
	//frameRenderRaycasting3(1);

	/* mainCanvas.height = ch;
	mainCanvas.width = cw; */
}
function rcKernelsSetDimensions(rcKernels) {
	rcKernels.rayCast2.setOutput([cw, ch]);

	//From registerRayCastingKernels
	/* rcKernels.getDRay.setOutput([cw, ch]);
	rcKernels.nextCrossingPoints.setOutput([cw, ch]);
	rcKernels.pVoxel.setOutput([cw, ch]);
	rcKernels.segTransp.setOutput([cw, ch]);
	rcKernels.nextAccumEmission.setOutput([cw, ch]);
	rcKernels.nextAccumTransp.setOutput([cw, ch]);
	rcKernels.nextRayAlive.setOutput([cw, ch]); */

	//From registerRayCastingKernelMono
	//rcKernels.rayCaster.setOutput([cw, ch]);
	//rcKernels.renderTex.setOutput([cw, ch]);

	//From registerRayCastingKernelMap
	//rcKernels.rayCastingCycle.setOutput([cw, ch]);
}

function viewRayDirsCompute_Rectilinear(ch, cw) {
	let chInv = 1.0 / ch;
	
	rayDirsCol = new Float32Array(ch * 4);
	rowNormals = new Float32Array(ch * 4);
	let x, xf/* , lenInv */;
	for(x = 0; x < ch; x++) {
		xf = clientFoVH * (2.0 * (x + 0.5) * chInv - 1.0);
		rayDirsCol[4 * x    ] = 0.0;
		rayDirsCol[4 * x + 1] = xf;
		rayDirsCol[4 * x + 2] = 1.0;
		rayDirsCol[4 * x + 3] = 1.0 + xf * xf; //Partial sum of squares
		
		//lenInv = 1.0 /* / Math.sqrt(1.0 + xf * xf) */;
		rowNormals[4 * x    ] = 0.0;
		rowNormals[4 * x + 1] = -1.0 /* * lenInv */;
		rowNormals[4 * x + 2] = xf /* * lenInv */;
	}
	
	rayDirsRow = new Float32Array(cw * 4);
	colNormals = new Float32Array(cw * 4);
	for(x = 0; x < cw; x++) {
		xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;
		rayDirsRow[4 * x    ] = xf;
		rayDirsRow[4 * x + 1] = 0.0;
		rayDirsRow[4 * x + 2] = 0.0;
		rayDirsRow[4 * x + 3] = xf * xf; //Partial sum of squares
		
		//lenInv = 1.0 /* / Math.sqrt(1.0 + xf * xf) */;
		colNormals[4 * x    ] = -1.0 /* * lenInv */;
		colNormals[4 * x + 1] = 0.0;
		colNormals[4 * x + 2] = xf /* * lenInv */;
	}

	//texRayDirs = generalKernels.rayDirs2d(rayDirsCol, rayDirsRow);
	//texNormalsCol = gpu.input(normalsCol, [normalsCol.length]); //to do: check case
	//texNormalsRow = gpu.input(normalsRow, [normalsRow.length]); //to do: check case
}

//var frameMaxLayers = 96;
//var frameMaxLayers = 64;
//var frameMaxLayers = 48;
//var frameMaxLayers = 32;
//var frameMaxLayers = 24;
//var frameMaxLayers = 16;
//const rayTranspThreshold = 1.0 / 96.0;
const rayTranspThreshold = 1.0 / 128.0;
var partEmissionGPU, partAlphaGPU;
var partBounds;

//to do: frustum culling
function getZSortedParticles() {
	//const particlesZSorted = [];
	//particlesZSorted.length = 0; //Clear array
	if(!partPosLocal) partPosLocal = new Float32Array(4 * particles.count); //Aligned particles
	//if(!partBounds) partBounds = new Float32Array(4 * particles.count);
	//if(!partBounds) partBounds = [];
	for(let i = 0; i < particles.count; i++) {
		//const pos = particles.pos.subarray(4 * i, 4 * i + 3);
		const pos = [particles.pos[4 * i] - clientPos[0], particles.pos[4 * i + 1] - clientPos[1], particles.pos[4 * i + 2] - clientPos[2]];
		const posAligned = vectorTransform_3(clientSpcTransfInv, pos);
		partPosLocal.set(posAligned, 4 * i);

		/* const r = particles.r[i];
		const d2 = posAligned[2] * posAligned[2] - r * r;
		const distExtr = [Math.sqrt(posAligned[0] * posAligned[0] + d2), Math.sqrt(posAligned[1] * posAligned[1] + d2)];
		const zr = posAligned[2] * r;
		const bounds =  [
			(posAligned[0] * distExtr[0] - zr) / (posAligned[2] * distExtr[0] + posAligned[0] * r),
			(posAligned[1] * distExtr[1] - zr) / (posAligned[2] * distExtr[1] + posAligned[1] * r),
			(posAligned[0] * distExtr[0] + zr) / (posAligned[2] * distExtr[0] - posAligned[0] * r),
			(posAligned[1] * distExtr[1] + zr) / (posAligned[2] * distExtr[1] - posAligned[1] * r)];
		//partBounds.set(bounds, 4 * i);
		partBounds[i] = bounds; */

		//const dist = Math.hypot(posAligned[0], posAligned[1], posAligned[2]);
		/* const dist = posAligned[2];
		//if(dist > -particles.r[i]) //Particles in front of viewer, perhaps partially
		if(dist > -r) //Particles in front of viewer, perhaps partially
			particlesZSorted.push({i: i, z: dist}); */
	}
	/* particlesZSorted.sort((a, b) => (a.z - b.z));
	return particlesZSorted; */
}

function frameRenderRaycasting(/* bufH, bufW, */ /* timeout */ layerCount) {
	/* let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	if(timeoutEnabled) tStart = performance.now(); */
	
	const particlesZSorted = getZSortedParticles();
	if(!partEmissionGPU) partEmissionGPU = GPUClass.input(particles.emission, [particles.emission.length]);
	if(!partAlphaGPU) partAlphaGPU = GPUClass.input(particles.alpha, [particles.alpha.length]);

	//to do: use gpu.input?
	//const imgArr = new Float32Array(4 * cw * ch);
	//const frameRows = [];
	const stopCountArr = new Int32Array(cw * ch);
	const indices = [], depths = [], extremes = [];
	let maxStopCount = 0;
	for(let y = 0; y < ch; y++) {
		//Filter particles that cross a row
		const particlesInRow = [];
		for(let j = 0; j < particlesZSorted.length; j++) {
			const p = particlesZSorted[j].i;
			const rowNormal = [rowNormals[4 * y], rowNormals[4 * y + 1], rowNormals[4 * y + 2]];
			const d = Math.abs(partPosLocal[4 * p] * rowNormal[0] + partPosLocal[4 * p + 1] * rowNormal[1] + partPosLocal[4 * p + 2] * rowNormal[2]);
			const r = particles.r[p]; //Particle -> ball
			if(d < r)
				particlesInRow.push({i: p, rem: r * r - d * d}); //Remainder = other catheti squared
		}
		//console.debug(`frameRenderRaycasting, row ${y}: ${particlesInRow.length} particles`);

		//const particlesInRays = [];
		//const rowStopCount = [];
		//const rowStopCount = new Float32Array(cw);
		//const rowIndices = [], rowDepths = [], rowExtremes = [];
		//let maxStopCount = 0;
		for(let x = 0; x < cw; x++) {
			//Further filter to particles that cross a column
			const particlesInRay = [];
			for(let j = 0; j < particlesInRow.length; j++) {
				const particleRec = particlesInRow[j];
				const p = particleRec.i;
				const pos = [partPosLocal[4 * p], partPosLocal[4 * p + 1], partPosLocal[4 * p + 2]];
				const colNormal = [colNormals[4 * x], colNormals[4 * x + 1], colNormals[4 * x + 2]];
				const d = pos[0] * colNormal[0] + pos[1] * colNormal[1] + pos[2] * colNormal[2];
				const d2 = particleRec.rem - d * d;
				if(d2 > 0.0) {
					const rem2 = Math.sqrt(d2);
					//const rayDir = [rayDirsCol[4 * y] + rayDirsRow[4 * x], rayDirsCol[4 * y + 1] + rayDirsRow[4 * x + 1], rayDirsCol[4 * y + 2] + rayDirsRow[4 * x + 2]];
					const rayDir = [rayDirsRow[4 * x], rayDirsCol[4 * y + 1], rayDirsCol[4 * y + 2]];
					//const rayDirFactor = 1.0 / Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
					const rayDirFactor = 1.0 / Math.sqrt(rayDirsRow[4 * x + 3] + rayDirsCol[4 * y + 3]);
					const z = rayDirFactor * (rayDir[0] * pos[0] + rayDir[1] * pos[1] + rayDir[2] * pos[2]);
					particlesInRay.push({i: p, z: z - rem2, st: true}); //st = start of sphere
					particlesInRay.push({i: p, z: z + rem2, st: false});
				}
			}
			particlesInRay.sort((a, b) => (a.z - b.z));
			/* const rayIndices = [], rayDepths = [], rayExtremes = [];
			for(const part of particlesInRay) { //to do: try map()
				rayIndices.push(part.i);
				rayDepths.push(part.z);
				rayExtremes.push(part.st);
			} */
			const rayIndices = particlesInRay.map(p => p.i), rayDepths = particlesInRay.map(p => p.z), rayExtremes = particlesInRay.map(p => p.st);
			maxStopCount = Math.max(maxStopCount, particlesInRay.length);
			//rowStopCount.push(particlesInRay.length);
			//stopCount[x] = particlesInRay.length;
			stopCountArr[y * cw + x] = particlesInRay.length;
			indices.push(rayIndices);
			depths.push(rayDepths);
			extremes.push(rayExtremes);
			
			/* //Render particles by segment sections as they cross the ray
			let em0 = 0.0, em1 = 0.0, em2 = 0.0;
			let alpha0 = 1.0, alpha1 = 1.0, alpha2 = 1.0;

			const localParticleSet = new Set();
			let j = 0, z = 0.0, z2 = 0.0; */
			/* while(j < particlesInRay.length) {
				for(; j < particlesInRay.length; j++) {
					const elem = particlesInRay[j];
					z2 = elem.z;
					if(z2 > z) break;
					if(elem.st)
						localParticleSet.add(elem.i);
					else
						localParticleSet.delete(elem.i);
				}
				if(z2 > z) {
					let localEm0 = 0.0, localEm1 = 0.0, localEm2 = 0.0;
					let localAlpha0 = 0.0, localAlpha1 = 0.0, localAlpha2 = 0.0;
					if(localParticleSet.size > 0) {
						//Accumulate (sum) colors of particles present in the segment
						for(const i of localParticleSet) {
							const pPart = 4 * i;
							const segAlpha0 = particles.alpha[pPart    ];
							const segAlpha1 = particles.alpha[pPart + 1];
							const segAlpha2 = particles.alpha[pPart + 2];
							localEm0 += particles.emission[pPart    ] * segAlpha0;
							localEm1 += particles.emission[pPart + 1] * segAlpha1;
							localEm2 += particles.emission[pPart + 2] * segAlpha2;
							localAlpha0 += segAlpha0;
							localAlpha1 += segAlpha1;
							localAlpha2 += segAlpha2;
						}
						localEm0 /= localAlpha0;
						localEm1 /= localAlpha1;
						localEm2 /= localAlpha2;
					} else {
						//Fog
						localAlpha0 = 0.0625;
						localAlpha1 = 0.0625;
						localAlpha2 = 0.0625;
						localEm0 = 0.0;
						localEm1 = 0.0;
						localEm2 = 0.0;
					}
					//Render ray segment into fragment (order-sensitive alpha blend)
					const factor = opacityFactor * (z2 - z);
					const segAlpha0 = Math.exp(factor * localAlpha0);
					const segAlpha1 = Math.exp(factor * localAlpha1);
					const segAlpha2 = Math.exp(factor * localAlpha2);
					em0 += alpha0 * localEm0 * (1.0 - segAlpha0);
					em1 += alpha1 * localEm1 * (1.0 - segAlpha1);
					em2 += alpha2 * localEm2 * (1.0 - segAlpha2);
					alpha0 *= segAlpha0;
					alpha1 *= segAlpha1;
					alpha2 *= segAlpha2;
					if(alpha0 < rayTranspThreshold && alpha1 < rayTranspThreshold && alpha2 < rayTranspThreshold) break;
				}
				z = z2;
			} */

			//particlesInRays.push(particlesInRay);
			/* if(alpha0 === 1.0) em0 = 0.0; else em0 /= (1.0 - alpha0);
			if(alpha1 === 1.0) em1 = 0.0; else em1 /= (1.0 - alpha1);
			if(alpha2 === 1.0) em2 = 0.0; else em2 /= (1.0 - alpha2); */
			/* if(alpha0 !== 1.0) em0 /= (1.0 - alpha0);
			if(alpha1 !== 1.0) em1 /= (1.0 - alpha1);
			if(alpha2 !== 1.0) em2 /= (1.0 - alpha2); */
			/* em0 += 0.0 * alpha0;
			em1 += 0.0 * alpha1;
			em2 += 0.0 * alpha2; */
			/* const pPixel = 4 * (y * cw + x);
			imgArr[pPixel    ] = em0;
			imgArr[pPixel + 1] = em1;
			imgArr[pPixel + 2] = em2; */
			/* imgArr[pPixel    ] = alpha0;
			imgArr[pPixel + 1] = alpha1;
			imgArr[pPixel + 2] = alpha2; */
		}
		//texParticles = gpu.input(particlesZSortedArr, [particlesZSortedArr.length]); //to do: check case
		
		/* maxStopCount = 16;
		const rowIndicesArr = new Float32Array(cw * maxStopCount), rowDepthsArr = new Float32Array(cw * maxStopCount), rowExtremesArr = new Float32Array(cw * maxStopCount);
		for(let x = 0; x < cw; x++) {
			for(let i = 0; i < maxStopCount; i++) {
				rowIndicesArr[x * maxStopCount + i] = rowIndices[x][i] || 0;
				rowDepthsArr[x * maxStopCount + i] = rowDepths[x][i] || 0;
				rowExtremesArr[x * maxStopCount + i] = rowExtremes[x][i] || 0; */
				/* rowIndicesArr[i * cw + x] = rowIndices[x][i] || 0;
				rowDepthsArr[i * cw + x] = rowDepths[x][i] || 0;
				rowExtremesArr[i * cw + x] = rowExtremes[x][i] || 0; */
			/* }
		} */

		//frameRows.push(generalKernels.rayCastRow(particles.alpha, particles.emission, rowStopCount, rowIndices, rowDepths, rowExtremes));
		//frameRows.push(generalKernels.rayCastRow(particles.alpha, particles.emission, rowStopCount, rowIndicesArr, rowDepthsArr, rowExtremesArr, maxStopCount));
		/* frameRows.push(generalKernels.rayCastRow(particles.alpha, particles.emission,
			rowStopCount,
			GPUClass.input(rowIndicesArr, [maxStopCount, cw]),
			GPUClass.input(rowDepthsArr, [maxStopCount, cw]),
			GPUClass.input(rowExtremesArr, [maxStopCount, cw]), maxStopCount)); */
		/* frameRows.push(generalKernels.rayCastRow(particles.alpha, particles.emission,
			rowStopCount,
			GPUClass.input(rowIndicesArr, [cw, maxStopCount]),
			GPUClass.input(rowDepthsArr, [cw, maxStopCount]),
			GPUClass.input(rowExtremesArr, [cw, maxStopCount]), maxStopCount)); */
	}
	//generalKernels.drawPixels(imgArr, cw, ch);
	//generalKernels.drawPixels(frameRows, cw, ch);

	console.debug(`frameRenderRaycasting, maxStopCount: ${maxStopCount}`);
	//maxStopCount = 4;
	maxStopCount = Math.max(4, maxStopCount);
	const indicesArr = new Int32Array(cw * ch * maxStopCount), depthsArr = new Float32Array(cw * ch * maxStopCount), extremesArr = new Int32Array(cw * ch * maxStopCount);
	for(let x = 0; x < cw * ch; x++) {
		indicesArr.set(indices[x], x * maxStopCount);
		depthsArr.set(depths[x], x * maxStopCount);
		extremesArr.set(extremes[x], x * maxStopCount);
	}
	//generalKernels.rayCast1(particles.alpha, particles.emission, stopCount, indicesArr, depthsArr, extremesArr, maxStopCount, cw);
	generalKernels.rayCast1(
		partAlphaGPU, //GPUClass.input(particles.alpha, [particles.alpha.length]),
		partEmissionGPU, //GPUClass.input(particles.emission, [particles.emission.length]),
		GPUClass.input(stopCountArr, [stopCountArr.length]),
		GPUClass.input(indicesArr, [indicesArr.length]),
		GPUClass.input(depthsArr, [depthsArr.length]),
		GPUClass.input(extremesArr, [extremesArr.length]),
		maxStopCount);
}

function frameRenderRaycasting2(layerCount) {
	//const particlesZSorted = getZSortedParticles();
	//getZSortedParticles();
	//generalKernels.alignParticles.setOutput([particles.count]);
	//const alignedPos = generalKernels.alignParticles(particles.pos, clientPos, clientSpcTransfInv);
	//const alignedPosArr = alignedPos.toArray();

	//generalKernels.getPartBounds.setOutput([particles.count]);
	//const partBounds = generalKernels.getPartBounds(alignedPos, particles.r); //Particle -> ball

	const fovInv = 1.0 / clientFoVH, cwHalf = 0.5 * cw, chHalf = 0.5 * ch;
	const partStopFrame = [];
	partStopFrame.length = cw * ch;
	for(let j = 0; j < cw * ch; j++) {
		//partStopFrame.push([]);
		partStopFrame[j] = [];
	}

	for(let j = 0; j < particles.count; j++) {
		const r = particles.r[j];
		const posLocal = [particles.pos[4 * j] - clientPos[0], particles.pos[4 * j + 1] - clientPos[1], particles.pos[4 * j + 2] - clientPos[2]];
		const pos = vectorTransform_3(clientSpcTransfInv, posLocal);

		//const pos = [partPosLocal[4 * j], partPosLocal[4 * j + 1], partPosLocal[4 * j + 2]];
		if(pos[2] <= -r) continue;
	
		const d2 = pos[2] * pos[2] - r * r;
		const extremeLen = [Math.sqrt(pos[0] * pos[0] + d2), Math.sqrt(pos[1] * pos[1] + d2)];
		const boundsFrame = [0, 0, cw, ch];
		let bounds;
		if(isNaN(extremeLen[0]) || isNaN(extremeLen[1]))
			bounds = boundsFrame;
		else {
			const rx = pos[0] * r, ry = pos[1] * r, rz = pos[2] * r;
			const aux1x = pos[0] * extremeLen[0], aux1y = pos[1] * extremeLen[1];
			const aux2zx = pos[2] * extremeLen[0], aux2zy = pos[2] * extremeLen[1];
			bounds =  [
				(aux1x - rz) / (aux2zx + rx), (aux1y - rz) / (aux2zy + ry),
				(aux1x + rz) / (aux2zx - rx), (aux1y + rz) / (aux2zy - ry)];
			//let bounds = partBounds[j];
			//let bounds = new Array(4);
			if(isFinite(bounds[0]))
				bounds[0] = Math.max(0, Math.floor(bounds[0] * chHalf * fovInv + cwHalf - 0.5));
			else
				bounds[0] = boundsFrame[0];
			if(isFinite(bounds[1]))
				bounds[1] = Math.max(0, Math.floor((bounds[1] * fovInv + 1.0) * chHalf - 0.5));
			else
				bounds[1] = boundsFrame[1];
			if(isFinite(bounds[2]))
				bounds[2] = Math.min(cw, Math.ceil(bounds[2] * chHalf * fovInv + cwHalf - 0.5));
			else
				bounds[2] = boundsFrame[2];
			if(isFinite(bounds[3]))
				bounds[3] = Math.min(ch, Math.ceil((bounds[3] * fovInv + 1.0) * chHalf - 0.5));
			else
				bounds[3] = boundsFrame[3];
			/* bounds[0] = Math.max(0, Math.floor(partBounds[4 * j] * ch * 0.5 / clientFoVH + 0.5 * cw - 0.5));
			bounds[1] = Math.max(0, Math.floor((partBounds[4 * j + 1] / clientFoVH + 1.0) * ch * 0.5 - 0.5));
			bounds[2] = Math.min(cw - 1, Math.ceil(partBounds[4 * j + 2] * ch * 0.5 / clientFoVH + 0.5 * cw - 0.5));
			bounds[3] = Math.min(ch - 1, Math.ceil((partBounds[4 * j + 3] / clientFoVH + 1.0) * ch * 0.5 - 0.5)); */
		}
		if(bounds[2] > bounds[0] && bounds[3] > bounds[1]) {
			const dxArr = new Float32Array(bounds[2] - bounds[0]);
			for(let x = bounds[0]; x < bounds[2]; x++) {
				const x2 = 4 * x;
				const d = pos[0] * colNormals[x2] + pos[1] * colNormals[x2 + 1] + pos[2] * colNormals[x2 + 2];
				dxArr[x - bounds[0]] = d * d;
			}

			for(let y = bounds[1]; y < bounds[3]; y++) {
				const dy = Math.abs(pos[0] * rowNormals[4 * y] + pos[1] * rowNormals[4 * y + 1] + pos[2] * rowNormals[4 * y + 2]);
				const d1 = r * r - dy * dy;
				for(let x = bounds[0]; x < bounds[2]; x++) {
					//const colNormal = [colNormals[4 * x], colNormals[4 * x + 1], colNormals[4 * x + 2]];
					//const d = pos[0] * colNormal[0] + pos[1] * colNormal[1] + pos[2] * colNormal[2]; //to do: optimize by moving to an array
					//const d2 = d1 - d * d;
					const d2 = d1 - dxArr[x - bounds[0]];
					if(d2 > 0.0) {
						const rem2 = Math.sqrt(d2);
						//const rayDir = [rayDirsCol[4 * y] + rayDirsRow[4 * x], rayDirsCol[4 * y + 1] + rayDirsRow[4 * x + 1], rayDirsCol[4 * y + 2] + rayDirsRow[4 * x + 2]];
						const rayDir = [rayDirsRow[4 * x], rayDirsCol[4 * y + 1], rayDirsCol[4 * y + 2]];
						//const rayDirFactor = 1.0 / Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
						const rayDirFactor = 1.0 / Math.sqrt(rayDirsRow[4 * x + 3] + rayDirsCol[4 * y + 3]);
						const z = rayDirFactor * (rayDir[0] * pos[0] + rayDir[1] * pos[1] + rayDir[2] * pos[2]);
						const arr = partStopFrame[y * cw + x];
						arr.push([j, z - rem2, 1]); //particle index, surface distance, sign of surface to ball
						arr.push([j, z + rem2, -1]);
					}
				}
			}
		}
	}
	
	const stopEntryPoints = new Int32Array(cw * ch + 1);
	//const stopEntryPoints = new Int32Array(cw * ch + 64);
	let p = 0;
	for(let j = 0; j < cw * ch; j++) {
		stopEntryPoints[j] = p;
		const arr = partStopFrame[j];
		p += arr.length;
		arr.sort((a, b) => (a[1] - b[1]));
	}
	stopEntryPoints[cw * ch] = p;

	//Load stop list into typed array.
	const gpuBlock = 1, bufSize = gpuBlock * Math.ceil(Math.max(3 * p, 1) / gpuBlock);
	const stopBuf = new Float32Array(bufSize);
	p = 0;
	for(let j = 0; j < cw * ch; j++) {
		const arr = partStopFrame[j];
		for(let k = 0; k < arr.length; k++) {
			//stopBuf.set(arr[k], 3 * (p + k));
			stopBuf.set(arr[k], p);
			p += 3;
		}
		//p += arr.length;
	}

	/* const partIndicesByRow = [];//, partRemByRow = [];
	let partByRowMax = 1;
	//let partByRowMax = 4;
	//to do: Int32Array or Float32Array for partCountByRow?
	const partCountByRow = new Int32Array(ch);
	for(let y = 0; y < ch; y++) {
		const yf = clientFoVH * (2.0 * (y + 0.5) / ch - 1.0);
		//Filter particles that cross a row
		const partIndicesInRow = [];//, partRemInRow = [];
		for(let j = 0; j < particles.count; j++) {
			const bounds = partBounds[j];
			if(yf >= bounds[1] && yf <= bounds[3]) {
				partIndicesInRow.push(j);
				const r = particles.r[j];
				const d = Math.abs(partPosLocal[4 * j] * rowNormals[4 * y] + partPosLocal[4 * j + 1] * rowNormals[4 * y + 1] + partPosLocal[4 * j + 2] * rowNormals[4 * y + 2]);
				partRemInRow.push(r * r - d * d); //Remainder = other catheti squared
			}
		}
		//console.debug(`frameRenderRaycasting, row ${y}: ${particlesInRow.length} particles`);

		partCountByRow[y] = partIndicesInRow.length;
		partByRowMax = Math.max(partByRowMax, partIndicesInRow.length);
		partIndicesByRow.push(partIndicesInRow);
		//partRemByRow.push(partRemInRow);
	} */

	//alignedPos.delete?.();
	//partBounds.delete?.();

	//console.debug(`frameRenderRaycasting2, particlesByRowMax: ${particlesByRowMax}`);
	//particlesByRowMax = Math.max(4, particlesByRowMax);
	//particlesByRowMax = 4;
	/* let partByRowBlock = 64 * Math.ceil(partByRowMax / 64);
	//to do: Int32Array or Float32Array for rowIndices?
	const rowIndices = new Int32Array(ch * partByRowBlock), rowRemainders = new Float32Array(ch * partByRowBlock);
	for(let y = 0; y < ch; y++) {
		rowIndices.set(partIndicesByRow[y], y * partByRowBlock);
		rowRemainders.set(partRemByRow[y], y * partByRowBlock);
	} */

	/* generalKernels.particlesPerRay.setOutput([cw, ch, particlesByRowMax]);
	generalKernels.makeStopList.setOutput([cw, ch, 2 * particlesByRowMax]);
	generalKernels.sortBatcherOddEven.setOutput([cw, ch, 2 * particlesByRowMax]);
	generalKernels.rayCast2.setOutput([cw, ch]);
	generalKernels.rayCastCombo(partPosLocal, colNormals, rayDirsRow, rayDirsCol, partCountByRow, particlesByRowMax, rowIndices, rowRemainders, cw, ch, partAlphaGPU, partEmissionGPU); */
	
	//generalKernels.particlesPerRay.setOutput([cw, ch, particlesByRowMax]);
	/* generalKernels.particlesPerRay.setOutput([partByRowBlock, cw, ch]);
	const partPerRayUnsorted = generalKernels.particlesPerRay(partPosLocal, colNormals, rayDirsRow, rayDirsCol, partCountByRow, partByRowBlock, rowIndices, rowRemainders);

	//generalKernels.makeStopList.setOutput([cw, ch, 2 * particlesByRowMax]);
	generalKernels.makeStopList.setOutput([2 * partByRowBlock, cw, ch]);
	let stopList = generalKernels.makeStopList(partPerRayUnsorted);
	partPerRayUnsorted.delete?.(); */
	
	/* generalKernels.sortBitonic.setOutput([2 * particlesByRowMax, cw, ch]);
	for(let i = 0; i < 2 * particlesByRowMax; i++) {
		const stopList2 = generalKernels.sortBitonic(stopList, 2 * particlesByRowMax, i % 2);
		stopList.delete?.();
		stopList = stopList2;
	} */

	//generalKernels.sortBatcherOddEven.setOutput([cw, ch, 2 * particlesByRowMax]);
	/* generalKernels.sortBatcherOddEven.setOutput([2 * partByRowBlock, cw, ch]);
	//stopList = generalKernels.sortBatcherOddEven(stopList, 1, 1);
	const d = Math.ceil(Math.log2(2 * partByRowMax));
	for(let l = 1; l <= d; l++)
		for(let p = 1; p <= l; p++) {
			const stopList2 = generalKernels.sortBatcherOddEven(stopList, 2 * partByRowMax, p, 1 << l, 1 << p);
			stopList.delete?.();
			stopList = stopList2;
		} */

	//if(!partEmissionGPU) partEmissionGPU = GPUClass.input(particles.emission, [particles.emission.length]);
	//if(!partAlphaGPU) partAlphaGPU = GPUClass.input(particles.alpha, [particles.alpha.length]);
	if(!partEmissionGPU) {
		generalKernels.partAlphaToGPU.setOutput([particles.emission.length]);
		partEmissionGPU = generalKernels.partAlphaToGPU(particles.emission);
	}
	if(!partAlphaGPU) {
		generalKernels.partAlphaToGPU.setOutput([particles.alpha.length]);
		partAlphaGPU = generalKernels.partAlphaToGPU(particles.alpha);
	}

	//generalKernels.rayCast2.setOutput([cw, ch]);
	mainCanvas.height = ch;
	mainCanvas.width = cw;
	//generalKernels.rayCast2(partAlphaGPU, partEmissionGPU, stopList, 2 * partByRowMax);
	generalKernels.rayCast3(partAlphaGPU, partEmissionGPU, stopEntryPoints, stopBuf, cw);
	//stopList.delete?.();

	//generalKernels.drawPixels(/* null, */ cw, ch);
}

function frameRenderRaycasting3(layerCount) {
	//generalKernels.alignParticles.setOutput([particles.count]);
	//const alignedPos = generalKernels.alignParticles(particles.pos, clientPos, clientSpcTransfInv);
	//const alignedPosArr = alignedPos.toArray();

	//generalKernels.getPartBounds.setOutput([particles.count]);
	//const partBounds = generalKernels.getPartBounds(alignedPos, particles.r); //Particle -> ball

	const fovInv = 1.0 / clientFoVH, cwHalf = 0.5 * cw, chHalf = 0.5 * ch;
	const partStopFrame = [];
	partStopFrame.length = cw * ch;
	for(let j = 0; j < cw * ch; j++) {
		partStopFrame[j] = [];
	}

	for(let j = 0; j < particles.count; j++) {
		const r = particles.r[j];
		const posLocal = [particles.pos[4 * j] - clientPos[0], particles.pos[4 * j + 1] - clientPos[1], particles.pos[4 * j + 2] - clientPos[2]];
		const pos = vectorTransform_3(clientSpcTransfInv, posLocal);

		if(pos[2] <= -r) continue;
	
		const d2 = pos[2] * pos[2] - r * r;
		const extremeLen = [Math.sqrt(pos[0] * pos[0] + d2), Math.sqrt(pos[1] * pos[1] + d2)];
		const boundsFrame = [0, 0, cw, ch];
		let bounds;
		if(isNaN(extremeLen[0]) || isNaN(extremeLen[1]))
			bounds = boundsFrame;
		else {
			const rx = pos[0] * r, ry = pos[1] * r, rz = pos[2] * r;
			const aux1x = pos[0] * extremeLen[0], aux1y = pos[1] * extremeLen[1];
			const aux2zx = pos[2] * extremeLen[0], aux2zy = pos[2] * extremeLen[1];
			bounds =  [
				(aux1x - rz) / (aux2zx + rx), (aux1y - rz) / (aux2zy + ry),
				(aux1x + rz) / (aux2zx - rx), (aux1y + rz) / (aux2zy - ry)];
			//let bounds = partBounds[j];
			//let bounds = new Array(4);
			if(isFinite(bounds[0]))
				bounds[0] = Math.max(0, Math.floor(bounds[0] * chHalf * fovInv + cwHalf - 0.5));
			else
				bounds[0] = boundsFrame[0];
			if(isFinite(bounds[1]))
				bounds[1] = Math.max(0, Math.floor((bounds[1] * fovInv + 1.0) * chHalf - 0.5));
			else
				bounds[1] = boundsFrame[1];
			if(isFinite(bounds[2]))
				bounds[2] = Math.min(cw, Math.ceil(bounds[2] * chHalf * fovInv + cwHalf - 0.5));
			else
				bounds[2] = boundsFrame[2];
			if(isFinite(bounds[3]))
				bounds[3] = Math.min(ch, Math.ceil((bounds[3] * fovInv + 1.0) * chHalf - 0.5));
			else
				bounds[3] = boundsFrame[3];
			/* bounds[0] = Math.max(0, Math.floor(partBounds[4 * j] * ch * 0.5 / clientFoVH + 0.5 * cw - 0.5));
			bounds[1] = Math.max(0, Math.floor((partBounds[4 * j + 1] / clientFoVH + 1.0) * ch * 0.5 - 0.5));
			bounds[2] = Math.min(cw - 1, Math.ceil(partBounds[4 * j + 2] * ch * 0.5 / clientFoVH + 0.5 * cw - 0.5));
			bounds[3] = Math.min(ch - 1, Math.ceil((partBounds[4 * j + 3] / clientFoVH + 1.0) * ch * 0.5 - 0.5)); */
		}
		if(bounds[2] > bounds[0] && bounds[3] > bounds[1]) {
			const dxArr = new Float32Array(bounds[2] - bounds[0]);
			for(let x = bounds[0]; x < bounds[2]; x++) {
				const x2 = 4 * x;
				const d = pos[0] * colNormals[x2] + pos[1] * colNormals[x2 + 1] + pos[2] * colNormals[x2 + 2];
				dxArr[x - bounds[0]] = d * d;
			}

			for(let y = bounds[1]; y < bounds[3]; y++) {
				const dy = Math.abs(pos[0] * rowNormals[4 * y] + pos[1] * rowNormals[4 * y + 1] + pos[2] * rowNormals[4 * y + 2]);
				const d1 = r * r - dy * dy;
				for(let x = bounds[0]; x < bounds[2]; x++) {
					//const colNormal = [colNormals[4 * x], colNormals[4 * x + 1], colNormals[4 * x + 2]];
					//const d = pos[0] * colNormal[0] + pos[1] * colNormal[1] + pos[2] * colNormal[2]; //to do: optimize by moving to an array
					//const d2 = d1 - d * d;
					const d2 = d1 - dxArr[x - bounds[0]];
					if(d2 > 0.0) {
						const rem2 = Math.sqrt(d2);
						//const rayDir = [rayDirsCol[4 * y] + rayDirsRow[4 * x], rayDirsCol[4 * y + 1] + rayDirsRow[4 * x + 1], rayDirsCol[4 * y + 2] + rayDirsRow[4 * x + 2]];
						const rayDir = [rayDirsRow[4 * x], rayDirsCol[4 * y + 1], rayDirsCol[4 * y + 2]];
						//const rayDirFactor = 1.0 / Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
						const rayDirFactor = 1.0 / Math.sqrt(rayDirsRow[4 * x + 3] + rayDirsCol[4 * y + 3]);
						const z = rayDirFactor * (rayDir[0] * pos[0] + rayDir[1] * pos[1] + rayDir[2] * pos[2]);
						const arr = partStopFrame[y * cw + x];
						arr.push([j, z - rem2, 1]); //particle index, surface distance, sign of surface to ball
						arr.push([j, z + rem2, -1]);
					}
				}
			}
		}
	}
	
	let maxStopCount = 1;
	const stopEntryPoints = new Int32Array(cw * ch + 1);
	//const stopEntryPoints = new Float32Array(cw * ch + 1);
	//const stopEntryPoints = new Int32Array(cw * ch + 64);
	let p = 0;
	for(let j = 0; j < cw * ch; j++) {
		stopEntryPoints[j] = p;
		const arr = partStopFrame[j];
		//while(arr.length < 16) arr.push([0, 6e20, 0]);
		p += arr.length;
		maxStopCount = Math.max(maxStopCount, arr.length);
		//arr.sort((a, b) => (a[1] - b[1]));
	}
	stopEntryPoints[cw * ch] = p;
	//console.log(`maxStopCount ${maxStopCount}`);

	//Load stop list into typed array.
	/* const gpuBlock = 1, bufSize = gpuBlock * Math.ceil(Math.max(3 * p, 1) / gpuBlock);
	const stopBuf = new Float32Array(bufSize);
	p = 0;
	for(let j = 0; j < cw * ch; j++) {
		const arr = partStopFrame[j];
		for(let k = 0; k < arr.length; k++) {
			//stopBuf.set(arr[k], 3 * (p + k));
			stopBuf.set(arr[k], p);
			p += 3;
		}
	} */
	//Load stop list into typed array.
	const gpuBlock = 1, bufSize = gpuBlock * Math.ceil(Math.max(4 * p, 1) / gpuBlock);
	const stopBuf = new Float32Array(bufSize);
	p = 0;
	for(let j = 0; j < cw * ch; j++) {
		const arr = partStopFrame[j];
		for(let k = 0; k < arr.length; k++) {
			stopBuf.set(arr[k], p);
			stopBuf[p + 3] = j;
			p += 4;
		}
	}

	//alignedPos.delete?.();
	//partBounds.delete?.();
	
	//generalKernels.makeStopList.setOutput([cw, ch, 2 * particlesByRowMax]);
	/* generalKernels.makeStopList.setOutput([2 * partByRowBlock, cw, ch]);
	let stopList = generalKernels.makeStopList(partPerRayUnsorted);
	partPerRayUnsorted.delete?.(); */
	
	/* generalKernels.sortBitonic.setOutput([2 * particlesByRowMax, cw, ch]);
	for(let i = 0; i < 2 * particlesByRowMax; i++) {
		const stopList2 = generalKernels.sortBitonic(stopList, 2 * particlesByRowMax, i % 2);
		stopList.delete?.();
		stopList = stopList2;
	} */

	//generalKernels.uploadArr4.setOutput([stopEntryPoints[cw * ch]]);
	generalKernels.uploadArr4.setOutput([bufSize / 4]);
	let stopList = generalKernels.uploadArr4(stopBuf);

	//generalKernels.sortBatcherOddEven.setOutput([cw, ch, 2 * particlesByRowMax]);
	//generalKernels.sortBatcherOddEven2.setOutput([stopEntryPoints[cw * ch]]);
	//generalKernels.sortBatcherOddEven2.setOutput([bufSize / 4]);
	//let stopList = GPUClass.input(stopBuf, [4, stopEntryPoints[cw * ch]]);
	//stopList = generalKernels.sortBatcherOddEven(stopList, 1, 1);
	const d = Math.ceil(Math.log2(maxStopCount));
	for(let l = 1; l <= d; l++)
		for(let p = 1; p <= l; p++) {
			generalKernels.sortBatcherOddEven2.setOutput([bufSize / 4]);
			const stopList2 = generalKernels.sortBatcherOddEven2(stopList, stopEntryPoints, p, 1 << l, 1 << p, stopEntryPoints[cw * ch]);
			stopList.delete?.();
			stopList = stopList2;
		}

	//if(!partEmissionGPU) partEmissionGPU = GPUClass.input(particles.emission, [particles.emission.length]);
	//if(!partAlphaGPU) partAlphaGPU = GPUClass.input(particles.alpha, [particles.alpha.length]);
	if(!partEmissionGPU) {
		generalKernels.uploadArr4to3.setOutput([particles.emission.length]);
		partEmissionGPU = generalKernels.uploadArr4to3(particles.emission);
	}
	if(!partAlphaGPU) {
		generalKernels.uploadArr4to3.setOutput([particles.alpha.length]);
		partAlphaGPU = generalKernels.uploadArr4to3(particles.alpha);
	}

	//generalKernels.rayCast3.setOutput([cw, ch]);
	mainCanvas.height = ch;
	mainCanvas.width = cw;
	//generalKernels.rayCast3(partAlphaGPU, partEmissionGPU, stopEntryPoints, stopBuf, cw);
	generalKernels.rayCast3(partAlphaGPU, partEmissionGPU, stopEntryPoints, stopList, cw);
	stopList.delete?.();

	//generalKernels.drawPixels(/* null, */ cw, ch);
}
