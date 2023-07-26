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
		//optimizeFloatMemory: true,
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true
	});

	newKernels.uploadArr3 = gpu.createKernel(function(arr) {
		const p = 3 * this.thread.x;
		return [arr[p], arr[p + 1], arr[p + 2]];
	}, {
		argumentTypes: {arr: "Array"},
		returnType: 'Array(3)',
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true
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
		//optimizeFloatMemory: true,
		immutable: true,
		//pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true
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
		//optimizeFloatMemory: true,
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true
	});
	
	newKernels.makeStopList2 = gpu.createKernel(function(particlesPerRay) {
		//particlesInRay.push({i: p, z: z - rem2, st: true}); //st = start of sphere
		//particlesInRay.push({i: p, z: z + rem2, st: false});
		const z = this.thread.x;
		const odd = z % 2;
		//const zHalf = z >> 1;
		//const zHalf = (z - odd) * 0.5;
		const zHalf = (z - odd) / 2, p = 4 * zHalf;
		const part = [particlesPerRay[p], particlesPerRay[p + 1], particlesPerRay[p + 2], particlesPerRay[p + 3]];
		if(part[0] == -1 || part[2] <= 0.0) return [-1, 6e20, 0, 0];
		const odd2 = 2 * odd - 1;
		return [part[0], part[1] + odd2 * part[2], -odd2, part[3]];
	}, {
		//constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold, cw: cw},
		argumentTypes: {particlesPerRay: "Array"},
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		immutable: true,
		pipeline: true,
		dynamicOutput: true,
		dynamicArguments: true
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
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true,
		immutable: true
	});
	//Based on code from https://github.com/Bekbolatov/SortingNetworks/blob/master/src/main/scala/com/sparkydots/sort/network/PartnerOddEven.scala
	newKernels.sortBatcherOddEven2 = gpu.createKernel(function(stopList, stopEntryPoints, /* l, */ p, expL, expP, maxX) {
		const x = this.thread.x;
		//if(x >= maxX) return [0.0, 0.0, 0.0, 0.0];
		const val0 = stopList[x], i = val0[3];
		//return val0;
		const p1 = 2 * stopEntryPoints[i];//, p2 = 2 * stopEntryPoints[i + 1];
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
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true,
		immutable: true
		//precision: "single",
		//tactic: "precision"
	});

	newKernels.rayCast3 = gpu.createKernel(function(partAlpha, partEmission, stopEntryPoints, stopBuf, cw) {
		//Render particles by segment sections (chords) as they cross the ray
		let em = [0.0, 0.0, 0.0/* , 0.0 */];
		let alpha = [1.0, 1.0, 1.0/* , 1.0 */];

		let chordEm = [0.0, 0.0, 0.0/* , 0.0 */];
		let chordAlpha = [0.0, 0.0, 0.0/* , 0.0 */];

		const p = this.thread.y * cw + this.thread.x;
		const p1 = 2 * stopEntryPoints[p], p2 = 2 * stopEntryPoints[p + 1];
		//const stops = p2 - p1;

		let j = p1, z = 0.0, z2 = 0.0;
		let crossingParticles = 0;
		while(j < p2) {
			//break;
			for(; j < p2; j++) {
				const stop = stopBuf[j];
				z2 = stop[1];
				//if(z2 > 1e20) break;
				if(z2 > z) break;
				
				const i = stop[0];
				if(i == -1) break;
				const sign = stop[2];
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
		this.color(em[0], em[1], em[2]);
		//this.color(0.0, 0.5, 1.0);
	}, {
		//argumentTypes: {partAlpha: "Array", partEmission: "Array", stopList: "Array(3)", particlesByRowMax: "Float"}, //Not supported in graphical kernels?
		constants: {opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold},
		//output: [cw, ch],
		//optimizeFloatMemory: true,
		immutable: false,
		dynamicOutput: true,
		dynamicArguments: true,
		graphical: true
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

	//rcKernelsSetDimensions(generalKernels);
	//rcKernelsSetDimensions(rcKernels0);

	viewRayDirsCompute_Rectilinear(ch, cw);
	//texBuffer0 = {};
	//texBuffer1 = {};

	//force-compile
	frameRenderRaycasting3(1);

	/* mainCanvas.height = ch;
	mainCanvas.width = cw; */
}
function rcKernelsSetDimensions(rcKernels) {
	//rcKernels.rayCast2.setOutput([cw, ch]);

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
	
		const posSq = [pos[0] * pos[0], pos[1] * pos[1], pos[2] * pos[2]];
		const d2 = posSq[2] - r * r;
		const extremeLen = [Math.sqrt(posSq[0] + d2), Math.sqrt(posSq[1] + d2)];
		let bounds = [0, 0, cw, ch];
		if(!isNaN(extremeLen[0]) && !isNaN(extremeLen[1]) && (posSq[0] + posSq[1] + d2) > 0) {
			const rx = pos[0] * r, ry = pos[1] * r, rz = pos[2] * r;
			//const rx = pos[0] * r, ry = pos[1] * r, rz = Math.abs(pos[2]) * r;
			const aux1x = pos[0] * extremeLen[0], aux1y = pos[1] * extremeLen[1];
			const aux2zx = pos[2] * extremeLen[0], aux2zy = pos[2] * extremeLen[1];

			const auxDivX1 = aux2zx + rx, auxDivX2 = aux2zx - rx;
			if(auxDivX1 != 0 && auxDivX2 != 0) {
				bounds[0] = (aux1x - rz) / auxDivX1;
				bounds[2] = (aux1x + rz) / auxDivX2;
				bounds[0] = Math.max(0, Math.floor(bounds[0] * chHalf * fovInv + cwHalf - 0.5));
				bounds[2] = Math.min(cw, Math.ceil(bounds[2] * chHalf * fovInv + cwHalf - 0.5));
			}
			const auxDivY1 = aux2zy + ry, auxDivY2 = aux2zy - ry;
			if(auxDivY1 != 0 && auxDivY2 != 0) {
				bounds[1] = (aux1y - rz) / auxDivY1;
				bounds[3] = (aux1y + rz) / auxDivY2;
				bounds[1] = Math.max(0, Math.floor((bounds[1] * fovInv + 1.0) * chHalf - 0.5));
				bounds[3] = Math.min(ch, Math.ceil((bounds[3] * fovInv + 1.0) * chHalf - 0.5));
			}
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
				if(d1 <= 0.0) continue;

				for(let x = bounds[0]; x < bounds[2]; x++) {
					//const colNormal = [colNormals[4 * x], colNormals[4 * x + 1], colNormals[4 * x + 2]];
					//const d = pos[0] * colNormal[0] + pos[1] * colNormal[1] + pos[2] * colNormal[2]; //to do: optimize by moving to an array
					//const d2 = d1 - d * d;
					const d2 = d1 - dxArr[x - bounds[0]];
					if(d2 <= 0.0) continue;
					
					const rem2 = Math.sqrt(d2);
					//const rayDir = [rayDirsCol[4 * y] + rayDirsRow[4 * x], rayDirsCol[4 * y + 1] + rayDirsRow[4 * x + 1], rayDirsCol[4 * y + 2] + rayDirsRow[4 * x + 2]];
					const rayDir = [rayDirsRow[4 * x], rayDirsCol[4 * y + 1], rayDirsCol[4 * y + 2]];
					//const rayDirFactor = 1.0 / Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
					const rayDirFactor = 1.0 / Math.sqrt(rayDirsRow[4 * x + 3] + rayDirsCol[4 * y + 3]);
					const z = rayDirFactor * (rayDir[0] * pos[0] + rayDir[1] * pos[1] + rayDir[2] * pos[2]);
					const arr = partStopFrame[y * cw + x];
					//arr.push([j, z - rem2, 1]); //particle index, surface distance, sign of surface to ball
					//arr.push([j, z + rem2, -1]);
					arr.push([j, z, rem2]); //This entry will later be expanded into 2 stops (for start and end of sphere chord in a ray).
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
	const layerFragmentCount = p;
	stopEntryPoints[cw * ch] = layerFragmentCount;
	//console.log(`maxStopCount ${maxStopCount}`);

	//Load stop list into typed array.
	/* const gpuBlock = 1, bufSize = gpuBlock * Math.ceil(Math.max(3 * layerFragmentCount, 1) / gpuBlock);
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
	const gpuBlock = 1, bufSize = gpuBlock * Math.ceil(4 * Math.max(layerFragmentCount, 1) / gpuBlock);
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
	generalKernels.makeStopList2.setOutput([2 * layerFragmentCount]);
	let stopList = generalKernels.makeStopList2(stopBuf);
	//partPerRayUnsorted.delete?.();
	
	/* generalKernels.sortBitonic.setOutput([2 * particlesByRowMax, cw, ch]);
	for(let i = 0; i < 2 * particlesByRowMax; i++) {
		const stopList2 = generalKernels.sortBitonic(stopList, 2 * particlesByRowMax, i % 2);
		stopList.delete?.();
		stopList = stopList2;
	} */

	//generalKernels.uploadArr4.setOutput([stopEntryPoints[cw * ch]]);
	//generalKernels.uploadArr4.setOutput([bufSize / 4]);
	//let stopList = generalKernels.uploadArr4(stopBuf);

	//stopList = generalKernels.sortBatcherOddEven(stopList, 1, 1);
	const d = Math.ceil(Math.log2(2 * maxStopCount));
	for(let l = 1; l <= d; l++)
		for(let p = 1; p <= l; p++) {
			generalKernels.sortBatcherOddEven2.setOutput([2 * layerFragmentCount]);
			const stopList2 = generalKernels.sortBatcherOddEven2(stopList, stopEntryPoints, p, 1 << l, 1 << p, 2 * layerFragmentCount);
			stopList.delete?.();
			stopList = stopList2;
		}

	if(!partEmissionGPU) {
		generalKernels.uploadArr3.setOutput([particles.count]);
		partEmissionGPU = generalKernels.uploadArr3(particles.emission);
	}
	if(!partAlphaGPU) {
		generalKernels.uploadArr3.setOutput([particles.count]);
		partAlphaGPU = generalKernels.uploadArr3(particles.alpha);
	}

	generalKernels.rayCast3.setOutput([cw, ch]);
	mainCanvas.height = ch;
	mainCanvas.width = cw;
	generalKernels.rayCast3(partAlphaGPU, partEmissionGPU, stopEntryPoints, stopList, cw);
	stopList.delete?.();

	//generalKernels.drawPixels(/* null, */ cw, ch);
}
