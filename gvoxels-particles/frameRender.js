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
var fieldMap;

const mazeSize = new Int32Array(
	[16, 16, 16]);
const mazeFillThres = new Float32Array( //maze voxel fill probability by sum of odnesses
	[15.0 / 16.0, 11.0 / 16.0, 5.0 / 16.0, 1.0 / 16.0]);

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
var clientFoVH = 1;
var rayDirsCol, rayDirsRow;
var texRayDirs, texRayDirsSign;

const opacityFactor = -128 * Math.LN2 / 256;
//const opacityFactor = -128 / 256;

var generalKernels, fieldKernels, rcKernels0, rcKernels1;
function registerKernels() { //to do: Delete?
	generalKernels = registerGeneralKernels(gpu);
	fieldKernels = registerFieldKernels(gpu);
	/* rcKernels0 = registerRayCastingKernels(gpu, newKernels);
	rcKernels1 = registerRayCastingKernels(gpu, newKernels); */
	/* rcKernels0 = registerRayCastingKernelMap(gpu);
	rcKernels1 = registerRayCastingKernelMap(gpu); */
	rcKernels0 = registerRayCastingKernelMono(gpu);
}
function registerGeneralKernels(gpu) {
	let newKernels = {};
	newKernels.rayDirs2d = gpu.createKernel(function(rayDirsCol, rayDirsRow) {
		let ray = [
			rayDirsCol[4 * this.thread.y + 0] + rayDirsRow[4 * this.thread.x + 0],
			rayDirsCol[4 * this.thread.y + 1] + rayDirsRow[4 * this.thread.x + 1],
			rayDirsCol[4 * this.thread.y + 2] + rayDirsRow[4 * this.thread.x + 2],
			0.0];
		ray[3] = this.constants.opacityFactor * Math.sqrt(ray[0] * ray[0] + ray[1] * ray[1] + ray[2] * ray[2]);
		return ray;
	}, {
		constants: { opacityFactor: opacityFactor },
		returnType: 'Array(4)',
		output: [cw, ch],
		//immutable: true,
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true
	});
	newKernels.rayDirsSigns = gpu.createKernel(function(rayDirs) {
		let ray = rayDirs[this.thread.y][this.thread.x];
		return [Math.sign(ray[0]), Math.sign(ray[1]), Math.sign(ray[2]), 0.0];
	}, {
		returnType: 'Array(4)',
		output: [cw, ch],
		//immutable: true,
		dynamicOutput: true,
		dynamicArguments: true,
		pipeline: true
	});

	/* newKernels.resetRayAlive = gpu.createKernel(function() {
		//return 1;
		return [1.0, 0.0, 0.0, 0.0];
	}, {
		//returnType: 'Integer',
		//returnType: 'Float',
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	});
	newKernels.resetRayCrossingPoints = gpu.createKernel(function(x, y, z) {
		return [x, y, z, 0.0];
	//resetRayCrossingPoints = gpu.createKernel(function(viewerOrigin) {
	//	return viewerOrigin;
	}, {
		//constants: {},
		argumentTypes: { x: 'Float', y: 'Float', z: 'Float' },
		//argumentTypes: { viewerOrigin: 'Array(4)' },
		returnType: 'Array(4)',
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
		//graphical: true
	}); */
	/* newKernels.resetAccumBufferEmission = gpu.createKernel(function() {
		return [0.0, 0.0, 0.0, 0.0];
	}, {
		returnType: 'Array(4)',
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	});
	newKernels.resetAccumBufferTransp = gpu.createKernel(function() {
		return [1.0, 1.0, 1.0, 1.0];
	}, {
		returnType: 'Array(4)',
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	}); */

	/* newKernels.renderAccum = gpu.createKernel(function(accumBufferEmission, accumBufferTransp) {
		let accumEmission = accumBufferEmission[this.thread.y][this.thread.x];
		//let color = accumEmission;

		let color = [0.5, 0.5, 0.5];
		//let color = [0.5, 0.5, 0.5, 0.0];
		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		let alphaNew = [1.0 - accumTransp[0], 1.0 - accumTransp[1], 1.0 - accumTransp[2]];
		if(alphaNew[0] > 0) color[0] = accumEmission[0] / alphaNew[0];
		if(alphaNew[1] > 0) color[1] = accumEmission[1] / alphaNew[1];
		if(alphaNew[2] > 0) color[2] = accumEmission[2] / alphaNew[2];

		this.color(color[0], color[1], color[2]);
	}, {
		argumentTypes: {accumBufferEmission: "Array(4)", accumBufferTransp: "Array(4)"},
		//argumentTypes: {accumBufferEmission: "TextureArray(4)", accumBufferTransp: "TextureArray(4)"},
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		graphical: true
		//to do: precision
	}); */
	return newKernels;
}
function registerFieldKernels(gpu) {
	let newKernels = {};
	newKernels.mapField_particles = gpu.createKernelMap({
		alpha: function fieldAlpha(vecColor) {
			return vecColor;
		}
	}, function(particleCount, particleR, particlePos, particleEmission, particleAlpha) {
		let myPos = [this.thread.x, this.thread.y, this.thread.z]; //gpu.js bug: this.thread.x + 0.5 is not a float.
		myPos = [myPos[0] + 0.5, myPos[1] + 0.5, myPos[2] + 0.5];
		//let accumAlpha = [0.0, 0.0, 0.0/* , 0.0 */];
		let accumColor = [0.0, 0.0, 0.0/* , 0.0 */];
		let accumAlpha = [0.0625, 0.0625, 0.0625/* , 0.0 */];
		//let accumColor = [accumAlpha[0] * Math.random(), accumAlpha[1] * Math.random(), accumAlpha[2] * Math.random()/* , 0.0 */];

		for (let i = 0; i < particleCount; i++) {
			const r = particleR[i];
			const i4 = 4 * i;
			const partPos = [particlePos[i4 + 0], particlePos[i4 + 1], particlePos[i4 + 2]];
			const dPos = [myPos[0] - partPos[0] + 0.5, myPos[1] - partPos[1] + 0.5, myPos[2] - partPos[2] + 0.5];

			/* if(dPos[0] <= -r || dPos[0] >= r || dPos[1] <= -r || dPos[1] >= r || dPos[2] <= -r || dPos[2] >= r) continue;
			let dr = r - Math.sqrt(dPos[0] * dPos[0] + dPos[1] * dPos[1] + dPos[2] * dPos[2]);
			if(dr <= 0.0) continue; */ //gpu.js bug: continue command seems to be interpreted as break.
			if(dPos[0] > -r && dPos[0] < r && dPos[1] > -r && dPos[1] < r && dPos[2] > -r && dPos[2] < r) {
				const dr = r - Math.sqrt(dPos[0] * dPos[0] + dPos[1] * dPos[1] + dPos[2] * dPos[2]);
				if(dr > 0.0) {
					const fgAlpha = [particleAlpha[i4 + 0], particleAlpha[i4 + 1], particleAlpha[i4 + 2]/* , 0.0 */];
					const fgColor = [particleEmission[i4 + 0] * fgAlpha[0], particleEmission[i4 + 1] * fgAlpha[1], particleEmission[i4 + 2] * fgAlpha[2]/* , 0.0 */];
					if(dr >= 1.0) {
						accumColor[0] += fgColor[0];
						accumColor[1] += fgColor[1];
						accumColor[2] += fgColor[2];
						accumAlpha[0] += fgAlpha[0];
						accumAlpha[1] += fgAlpha[1];
						accumAlpha[2] += fgAlpha[2];
					} else {
						accumColor[0] += dr * fgColor[0];
						accumColor[1] += dr * fgColor[1];
						accumColor[2] += dr * fgColor[2];
						accumAlpha[0] += dr * fgAlpha[0];
						accumAlpha[1] += dr * fgAlpha[1];
						accumAlpha[2] += dr * fgAlpha[2];
					}
				}
			}
		}
		let fgColor = [0.0, 0.0, 0.0/* , 0.0 */];
		if(accumAlpha[0] > 0.0) fgColor[0] = accumColor[0] / accumAlpha[0];
		if(accumAlpha[1] > 0.0) fgColor[1] = accumColor[1] / accumAlpha[1];
		if(accumAlpha[2] > 0.0) fgColor[2] = accumColor[2] / accumAlpha[2];
		fieldAlpha(accumAlpha);
		return fgColor;
	}, {
		//constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2] },
		//returnType: 'Array(4)',
		returnType: 'Array(3)',
		output: [worldRes[0], worldRes[1], worldRes[2]],
		//immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		//loopMaxIterations: 10,
		pipeline: true,
		graphical: false
	});
	newKernels.createMaze = gpu.createKernel(function(/* mazeSize, */ mazeFillThres) {
		//let myPos = [this.thread.x, this.thread.y, this.thread.z]; //gpu.js bug: this.thread.x + 0.5 is not a float.
		let oddity = (this.thread.x % 2) + (this.thread.y % 2) + (this.thread.z % 2);
		//let oddity = 1;

		return ((Math.random() < mazeFillThres[oddity]) ? 1 : 0);
	}, {
		//constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2] },
		//argumentTypes: { /* mazeSize: "Array(3)", */ mazeFillThres: "Array(4)" },
		returnType: 'Integer',
		//returnType: 'Array(4)',
		//output: mazeSize, //to do: check use of typed array
		output: [mazeSize[0], mazeSize[1], mazeSize[2]],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		//loopMaxIterations: 10,
		pipeline: true,
		graphical: false
	});
	newKernels.mapField_maze = gpu.createKernelMap({
		alpha: function fieldAlpha(vecColor) {
			return vecColor;
		}
	}, function(mazeMap) {
		let myPos = [Math.floor(this.thread.x / 8), Math.floor(this.thread.y / 8), Math.floor(this.thread.z / 8)];
		let cell = mazeMap[(myPos[2] * this.constants.mapSize1 + myPos[1]) * this.constants.mapSize0 + myPos[0]];
		const fill = [Math.random(), Math.random(), Math.random()/* , 0.0 */];
		//const fill = [1.0, 1.0, 1.0, 0.0];

		//let gain = (cell >= 1 ? 0.9375 : 0.0625);
		let gain = (cell >= 1 ? 1.0 : 0.125);
		let alpha = (cell >= 1 ? 0.5 : 0.25);

		fieldAlpha([alpha, alpha, alpha/* , 0.0 */]);
		return [gain * fill[0], gain * fill[1], gain * fill[2]/* , 0.0 */];
	}, {
		constants: { mapSize0: mazeSize[0], mapSize1: mazeSize[1], mapSize2: mazeSize[2] },
		returnType: 'Array(3)',
		output: [worldRes[0], worldRes[1], worldRes[2]],
		//immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		//loopMaxIterations: 10,
		pipeline: true,
		graphical: false
	});
	return newKernels;
}

function registerRayCastingKernels(gpu, generalKernels) {
	let newKernels = {};
	newKernels.getDRay = gpu.createKernel(function(rayAlive, rayCrossingPoints, rayDirs, rayDirsSign) {
	//getDRay = gpu.createKernel(function(rayAlive, rayCrossingPoints, rayDirsCol, rayDirsRow) {
		if(rayAlive[this.thread.y][this.thread.x] < 1) return [0.0, 0.0, 0.0, 0.0];
		
		let crossingPoint = rayCrossingPoints[this.thread.y][this.thread.x];
		let coordProjection = [0.0, 0.0, 0.0/* , 0.0 */];
		let rayDirSign = rayDirsSign[this.thread.y][this.thread.x];
		/* let rayDir = [
			rayDirsCol[4 * this.thread.y + 0] + rayDirsRow[4 * this.thread.x + 0],
			rayDirsCol[4 * this.thread.y + 1] + rayDirsRow[4 * this.thread.x + 1],
			rayDirsCol[4 * this.thread.y + 2] + rayDirsRow[4 * this.thread.x + 2],
			0.0];
			rayDir[3] = this.constants.opacityFactor * Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]);
		let rayDirSign = [Math.sign(rayDir[0]), Math.sign(rayDir[1]), Math.sign(rayDir[2]), 0.0]; */
		coordProjection[0] = Math.floor(rayDirSign[0] * crossingPoint[0] + 1.0);
		coordProjection[1] = Math.floor(rayDirSign[1] * crossingPoint[1] + 1.0);
		coordProjection[2] = Math.floor(rayDirSign[2] * crossingPoint[2] + 1.0);
		
		let crossing = [0.0, 0.0, 0.0/* , 0.0 */];
		let rayDir = rayDirs[this.thread.y][this.thread.x];
		crossing[0] = (rayDirSign[0] * coordProjection[0] - crossingPoint[0]) / rayDir[0];
		crossing[1] = (rayDirSign[1] * coordProjection[1] - crossingPoint[1]) / rayDir[1];
		crossing[2] = (rayDirSign[2] * coordProjection[2] - crossingPoint[2]) / rayDir[2];

		let firstCrossing = 65504.0; //IEEE 754 half-precision maximum
		//let firstCrossing = 65536.0;
		if(rayDir[0] != 0.0)
			firstCrossing = crossing[0];
		if(rayDir[1] != 0.0 && crossing[1] < firstCrossing)
			firstCrossing = crossing[1];
		if(rayDir[2] != 0.0 && crossing[2] < firstCrossing)
			firstCrossing = crossing[2];

		/* let firstCrossing = 65536.0;
		if(rayDir[0] != 0.0)
			firstCrossing = (rayDirSign[0] * coordProjection[0] - crossingPoint[0]) / rayDir[0];
		if(rayDir[1] != 0.0) {
			let rayCoordCrossing = (rayDirSign[1] * coordProjection[1] - crossingPoint[1]) / rayDir[1];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		}
		if(rayDir[2] != 0.0) {
			let rayCoordCrossing = (rayDirSign[2] * coordProjection[2] - crossingPoint[2]) / rayDir[2];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		} */

		/* let firstCrossing = 65504.0; //IEEE 754 half-precision maximum
		if(rayDir[0] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[0] * crossingPoint[0] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[0] * crossingPoint[0]) + 1;
			firstCrossing = (rayDirSign[0] * coordProjection - crossingPoint[0]) / rayDir[0];
		}
		if(rayDir[1] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[1] * crossingPoint[1] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[1] * crossingPoint[1]) + 1;
			let rayCoordCrossing = (rayDirSign[1] * coordProjection - crossingPoint[1]) / rayDir[1];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		}
		if(rayDir[2] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[2] * crossingPoint[2] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[2] * crossingPoint[2]) + 1;
			let rayCoordCrossing = (rayDirSign[2] * coordProjection - crossingPoint[2]) / rayDir[2];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		} */

		return [firstCrossing * rayDir[0], firstCrossing * rayDir[1], firstCrossing * rayDir[2], firstCrossing * rayDir[3]];
	}, {
		//constants: { opacityFactor: opacityFactor },
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", rayDirs: "Array(4)", rayDirsSign: "Array(4)" },
		returnType: 'Array(4)',
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	newKernels.nextCrossingPoints = gpu.createKernel(function(rayAlive, rayCrossingPoints, dRays) {
		//if(rayAlive[this.thread.y][this.thread.x] < 1) return [-1.0, -1.0, -1.0, -1.0];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return [0.0, 0.0, 0.0, 0.0];
		
		let crossingPoint = rayCrossingPoints[this.thread.y][this.thread.x];
		let dRay = dRays[this.thread.y][this.thread.x];
		return [
			crossingPoint[0] + dRay[0],
			crossingPoint[1] + dRay[1],
			crossingPoint[2] + dRay[2],
			0.0];
	}, {
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", dRays: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	newKernels.pVoxel = gpu.createKernel(function(rayAlive, rayCrossingPoints, dRays) {
		//if(rayAlive[this.thread.y][this.thread.x] < 1) return [-1, -1, -1, -1];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return -1;
		
		let crossingPoint = rayCrossingPoints[this.thread.y][this.thread.x];
		let dRay = dRays[this.thread.y][this.thread.x];
		let discreteCube = [
			Math.floor(crossingPoint[0] + 0.5 * dRay[0]),
			Math.floor(crossingPoint[1] + 0.5 * dRay[1]),
			Math.floor(crossingPoint[2] + 0.5 * dRay[2]),
			0];

		if(discreteCube[0] >= 0 && discreteCube[0] < this.constants.worldRes0 &&
			discreteCube[1] >= 0 && discreteCube[1] < this.constants.worldRes1 &&
			discreteCube[2] >= 0 && discreteCube[2] < this.constants.worldRes2)
			//return discreteCube;
			return (discreteCube[2] * this.constants.worldRes1 + discreteCube[1]) * this.constants.worldRes0 + discreteCube[0];
		else
			//return [-1, -1, -1, -1];
			return -1;
	}, {
		constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2] },
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", dRays: "Array(4)" },
		returnType: 'Integer',
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	newKernels.segTransp = gpu.createKernel(function(rayAlive, discreteCube, worldScanTransp, dRays) {
		//if(rayAlive < 1) return [0.0, 0.0, 0.0, 0.0];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return [1.0, 1.0, 1.0, 1.0];
		
		let vxTransp = [0.5, 0.5, 0.5, 0.0];
		let offset = discreteCube[this.thread.y][this.thread.x];
		if(offset >= 0) vxTransp = worldScanTransp[offset];
		/* else {
			//to do: special code that fills the remaining transparency and kills the ray
		} */

		let dRay = dRays[this.thread.y][this.thread.x], rayLen = dRay[3];
		return [
			Math.exp(rayLen * vxTransp[0]),
			Math.exp(rayLen * vxTransp[1]),
			Math.exp(rayLen * vxTransp[2]),
			0.0];
		/* return [
			2 ** (rayLen * vxTransp[0]),
			2 ** (rayLen * vxTransp[1]),
			2 ** (rayLen * vxTransp[2]),
			0.0]; */
	}, {
		argumentTypes: { rayAlive: "Integer", discreteCube: "Integer", worldScanTransp: "Array", dRays: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	newKernels.nextAccumEmission = gpu.createKernel(function(rayAlive, discreteCube, worldScanEmission, alphaNew, accumBufferEmission, accumBufferTransp) {
		let accumEmission = accumBufferEmission[this.thread.y][this.thread.x];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return accumEmission;
		
		let vxEmission = [0.0, 0.5, 1.0, 0.0];
		let offset = discreteCube[this.thread.y][this.thread.x];
		if(offset >= 0) vxEmission = worldScanEmission[offset];
		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		let alpha = alphaNew[this.thread.y][this.thread.x];
		return [
			accumEmission[0] + accumTransp[0] * (1.0 - alpha[0]) * vxEmission[0],
			accumEmission[1] + accumTransp[1] * (1.0 - alpha[1]) * vxEmission[1],
			accumEmission[2] + accumTransp[2] * (1.0 - alpha[2]) * vxEmission[2],
			0.0];
	}, {
		argumentTypes: { rayAlive: "Integer", discreteCube: "Integer", worldScanEmission: "Array", alphaNew: "Array(4)", accumBufferEmission: "Array(4)", accumBufferTransp: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	newKernels.nextAccumTransp = gpu.createKernel(function(rayAlive, alphaNew, accumBufferTransp) {
		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		if(rayAlive[this.thread.y][this.thread.x] < 1) return accumTransp;
		let alpha = alphaNew[this.thread.y][this.thread.x];
		return [
			accumTransp[0] * alpha[0],
			accumTransp[1] * alpha[1],
			accumTransp[2] * alpha[2],
			0.0];
	}, {
		argumentTypes: { rayAlive: "Integer", alphaNew: "Array(4)", accumBufferTransp: "Array(4)" },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	newKernels.nextRayAlive = gpu.createKernel(function(rayAlive, accumBufferTransp) {
		if(rayAlive[this.thread.y][this.thread.x] < 1) return 0;

		let accumTransp = accumBufferTransp[this.thread.y][this.thread.x];
		if(accumTransp[0] <= this.constants.rayTranspThreshold &&
			accumTransp[1] <= this.constants.rayTranspThreshold &&
			accumTransp[2] <= this.constants.rayTranspThreshold)
			return 0;
		else
			return 1;
	}, {
		constants: { rayTranspThreshold: rayTranspThreshold },
		argumentTypes: { rayAlive: "Integer", accumBufferTransp: "Array(4)" },
		returnType: 'Integer',
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	
	//to do: move resetState to registerKernels?
	generalKernels.resetState = gpu.combineKernels(generalKernels.resetAccumBufferEmission, generalKernels.resetAccumBufferTransp, generalKernels.resetRayAlive, generalKernels.resetRayCrossingPoints,
		//function(viewerOrigin) {
		function(x, y, z) {
			//return [resetRayAlive(), resetRayCrossingPoints(viewerOrigin), resetAccumBufferEmission(), resetAccumBufferTransp()];
			return [generalKernels.resetRayAlive(), generalKernels.resetRayCrossingPoints(x, y, z), generalKernels.resetAccumBufferEmission(), generalKernels.resetAccumBufferTransp()];
		}
	);
	newKernels.rayCastingCycle = gpu.combineKernels(
		newKernels.getDRay, newKernels.nextCrossingPoints, newKernels.pVoxel, newKernels.segTransp, newKernels.nextAccumEmission, newKernels.nextAccumTransp, newKernels.nextRayAlive,
		//function(texRayAlive, texCrossingPoints, texRayDirs, texRayDirsSign, texWorldScanTransp, texWorldScanEmission, texAccumBufferEmission, texAccumBufferTransp) {
		function(texState, texRayDirs, texRayDirsSign, texWorldScanTransp, texWorldScanEmission) {
			let texRayAlive = texState[0];
			let texCrossingPoints = texState[1];
			let texAccumBufferEmission = texState[2];
			let texAccumBufferTransp = texState[3];
			let texDRays = newKernels.getDRay(texRayAlive, texCrossingPoints, texRayDirs, texRayDirsSign);
			//texDRays = newKernels.getDRay(texRayAlive, texCrossingPoints, rayDirsCol, rayDirsRow);
			let newCrossingPoints = newKernels.nextCrossingPoints(texRayAlive, texCrossingPoints, texDRays);
			let texPVoxels = newKernels.pVoxel(texRayAlive, texCrossingPoints, texDRays);
			texCrossingPoints.delete();
			let texSegTransps = newKernels.segTransp(texRayAlive, texPVoxels, texWorldScanTransp, texDRays);
			texDRays.delete();
			let newAccumEmission = newKernels.nextAccumEmission(texRayAlive, texPVoxels, texWorldScanEmission, texSegTransps, texAccumBufferEmission, texAccumBufferTransp);
			texAccumBufferEmission.delete();
			texPVoxels.delete();
			let newAccumTransp = newKernels.nextAccumTransp(texRayAlive, texSegTransps, texAccumBufferTransp);
			texAccumBufferTransp.delete();
			texSegTransps.delete();
			let newRayAlive = newKernels.nextRayAlive(texRayAlive, newAccumTransp);
			texRayAlive.delete();
			return [newRayAlive, newCrossingPoints, newAccumEmission, newAccumTransp];
	});
	return newKernels;
}
function registerRayCastingKernelMono() {
	let rayCaster = gpu.createKernel(function(layerCount, viewerOrigin, texRayDirs, texRayDirsSign, texWorldScanEmission, texWorldScanTransp) {
		//let vecCrossingPoint = viewerOrigin;
		let vecCrossingPoint = [viewerOrigin[0], viewerOrigin[1], viewerOrigin[2]/* , 0.0 */];
		let vecAccumEmission = [0.0, 0.0, 0.0/* , 0.0 */];
		let vecAccumTransp = [1.0, 1.0, 1.0/* , 1.0 */];
		let vecRayDir = texRayDirs[this.thread.y][this.thread.x];
		let vecRayDirSign = texRayDirsSign[this.thread.y][this.thread.x];
		//let asdf = [0.0, 0.0, 0.0, 0.0];
		//let asdf = [[0.0, 0.0], [0.0, 0.0]];
		//let asdf = [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0]];
		//let asdf = [[0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 0.0]];

		//for (let i = 0; i < this.constants.iterations; i++) {
		for (let i = 0; i < layerCount; i++) {
			//let vecDRay = getDRay(vecCrossingPoint, vecRayDir, vecRayDirSign);
			let firstCrossing = getFirstCrossing(vecCrossingPoint, vecRayDir, vecRayDirSign);
			let vecDRay = [
				firstCrossing * vecRayDir[0],
				firstCrossing * vecRayDir[1],
				firstCrossing * vecRayDir[2],
				firstCrossing * vecRayDir[3]];
			let discreteCube = [
				Math.floor(vecCrossingPoint[0] + 0.5 * vecDRay[0]),
				Math.floor(vecCrossingPoint[1] + 0.5 * vecDRay[1]),
				Math.floor(vecCrossingPoint[2] + 0.5 * vecDRay[2])
				/* 0 */];

			let offset = pVoxel(discreteCube);
			let vxTransp = [0.125, 0.125, 0.125/* , 0.0 */];
			//let vxTransp = [0.0, 0.0, 0.0, 0.0];
			//let vxTransp = [1.0, 1.0, 1.0, 0.0];
			//let vxEmission = [0.0, 0.5, 1.0, 0.0];
			let vxEmission = [0.25, 0.25, 0.25/* , 0.0 */];
			if(offset >= 0) {
				vxTransp = texWorldScanTransp[offset];
				vxEmission = texWorldScanEmission[offset];
			}
			/* else {
				//to do: special code that fills the remaining transparency and kills the ray
			} */
			let rayLen = vecDRay[3];
			let vecSegTransp = [
				Math.exp(rayLen * vxTransp[0]),
				Math.exp(rayLen * vxTransp[1]),
				Math.exp(rayLen * vxTransp[2])
				/* 0.0 */];
	
			vecAccumEmission = [
				vecAccumEmission[0] + vecAccumTransp[0] * (1.0 - vecSegTransp[0]) * vxEmission[0],
				vecAccumEmission[1] + vecAccumTransp[1] * (1.0 - vecSegTransp[1]) * vxEmission[1],
				vecAccumEmission[2] + vecAccumTransp[2] * (1.0 - vecSegTransp[2]) * vxEmission[2]
				/* 0.0 */];
			vecAccumTransp = [
				vecAccumTransp[0] * vecSegTransp[0],
				vecAccumTransp[1] * vecSegTransp[1],
				vecAccumTransp[2] * vecSegTransp[2]
				/* 0.0 */];

			//to do: where to break? loop header? loop end?
			/* if(newAccumTransp[0] <= this.constants.rayTranspThreshold &&
				newAccumTransp[1] <= this.constants.rayTranspThreshold &&
				newAccumTransp[2] <= this.constants.rayTranspThreshold) */
			if(vecAccumTransp[0] <= vecAccumEmission[0] * this.constants.rayTranspThreshold &&
				vecAccumTransp[1] <= vecAccumEmission[1] * this.constants.rayTranspThreshold &&
				vecAccumTransp[2] <= vecAccumEmission[2] * this.constants.rayTranspThreshold)
				break;
			else
				vecCrossingPoint = [
					vecCrossingPoint[0] + vecDRay[0],
					vecCrossingPoint[1] + vecDRay[1],
					vecCrossingPoint[2] + vecDRay[2]
					/* 0.0 */];
		}

		//let color = vecAccumEmission;
		let color = [0.5, 0.5, 0.5/* , 0.0 */];
		let alphaNew = [1.0 - vecAccumTransp[0], 1.0 - vecAccumTransp[1], 1.0 - vecAccumTransp[2]];
		if(alphaNew[0] > 0.0) color[0] = vecAccumEmission[0] / alphaNew[0];
		if(alphaNew[1] > 0.0) color[1] = vecAccumEmission[1] / alphaNew[1];
		if(alphaNew[2] > 0.0) color[2] = vecAccumEmission[2] / alphaNew[2];

		this.color(color[0], color[1], color[2]);
		//return color;
	}, {
		constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2],
			opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold/* , iterations: frameMaxLayers */ },
		//constants: { opacityFactor: opacityFactor },
		//argumentTypes: { rayCrossingPoints: "Array(4)", rayDirs: "Array(4)", rayDirsSign: "Array(4)" },
		//returnType: 'Array(3)',
		output: [cw, ch],
		//immutable: true, //?
		dynamicOutput: true,
		//dynamicArguments: true,
		//pipeline: true, //?
		graphical: true
	});
	/* let renderTex = gpu.createKernel(function(tex) {
		let color = tex[this.thread.y][this.thread.x];
		this.color(color[0], color[1], color[2]);
	}, {
		argumentTypes: { tex: "TextureArray(3)" },
		output: [cw, ch],
		dynamicOutput: true,
		dynamicArguments: true,
		graphical: true
	}); */

	//rayCaster.addFunction(function getDRay(crossingPoint, rayDir, rayDirSign) {
	rayCaster.addFunction(function getFirstCrossing(crossingPoint, rayDir, rayDirSign) {
	//rayCaster.addFunction(function getDRay(crossingPoint, rayDirsCol, rayDirsRow) {
		/* let rayDir = [
			rayDirsCol[4 * this.thread.y + 0] + rayDirsRow[4 * this.thread.x + 0],
			rayDirsCol[4 * this.thread.y + 1] + rayDirsRow[4 * this.thread.x + 1],
			rayDirsCol[4 * this.thread.y + 2] + rayDirsRow[4 * this.thread.x + 2],
			0.0];
		rayDir[3] = this.constants.opacityFactor * Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * //rayDir[2]);
		let rayDirSign = [Math.sign(rayDir[0]), Math.sign(rayDir[1]), Math.sign(rayDir[2]), 0.0]; */
		let coordProjection = [
			Math.floor(rayDirSign[0] * crossingPoint[0] + 1.0),
			Math.floor(rayDirSign[1] * crossingPoint[1] + 1.0),
			Math.floor(rayDirSign[2] * crossingPoint[2] + 1.0)
			/* , 0.0 */];
		
		let crossing = [
			(rayDirSign[0] * coordProjection[0] - crossingPoint[0]) / rayDir[0],
			(rayDirSign[1] * coordProjection[1] - crossingPoint[1]) / rayDir[1],
			(rayDirSign[2] * coordProjection[2] - crossingPoint[2]) / rayDir[2]
			/* , 0.0 */];

		let firstCrossing = 65504.0; //IEEE 754 half-precision maximum
		if(rayDir[0] != 0.0)
			firstCrossing = crossing[0];
		if(rayDir[1] != 0.0 && crossing[1] < firstCrossing)
			firstCrossing = crossing[1];
		if(rayDir[2] != 0.0 && crossing[2] < firstCrossing)
			firstCrossing = crossing[2];

		/* let firstCrossing = 65536.0;
		if(rayDir[0] != 0.0)
			firstCrossing = (rayDirSign[0] * coordProjection[0] - crossingPoint[0]) / rayDir[0];
		if(rayDir[1] != 0.0) {
			let rayCoordCrossing = (rayDirSign[1] * coordProjection[1] - crossingPoint[1]) / rayDir[1];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		}
		if(rayDir[2] != 0.0) {
			let rayCoordCrossing = (rayDirSign[2] * coordProjection[2] - crossingPoint[2]) / rayDir[2];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		} */

		/* let firstCrossing = 65504.0; //IEEE 754 half-precision maximum
		if(rayDir[0] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[0] * crossingPoint[0] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[0] * crossingPoint[0]) + 1;
			firstCrossing = (rayDirSign[0] * coordProjection - crossingPoint[0]) / rayDir[0];
		}
		if(rayDir[1] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[1] * crossingPoint[1] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[1] * crossingPoint[1]) + 1;
			let rayCoordCrossing = (rayDirSign[1] * coordProjection - crossingPoint[1]) / rayDir[1];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		}
		if(rayDir[2] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[2] * crossingPoint[2] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[2] * crossingPoint[2]) + 1;
			let rayCoordCrossing = (rayDirSign[2] * coordProjection - crossingPoint[2]) / rayDir[2];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		} */

		return firstCrossing;
		//return [firstCrossing * rayDir[0], firstCrossing * rayDir[1], firstCrossing * rayDir[2], firstCrossing * rayDir[3]];
	});
	//, {
		//constants: { opacityFactor: opacityFactor },
		//argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", rayDirs: "Array(4)", rayDirsSign: "Array(4)" },
		//returnType: 'Array(4)',
		//optimizeFloatMemory: true,
	//});

	rayCaster.addFunction(function pVoxel(discreteCube) {
		if(discreteCube[0] >= 0 && discreteCube[0] < this.constants.worldRes0 &&
			discreteCube[1] >= 0 && discreteCube[1] < this.constants.worldRes1 &&
			discreteCube[2] >= 0 && discreteCube[2] < this.constants.worldRes2)
			//return discreteCube;
			return (discreteCube[2] * this.constants.worldRes1 + discreteCube[1]) * this.constants.worldRes0 + discreteCube[0];
		else
			//return [-1, -1, -1, -1];
			return -1;
	});/* , {
		//constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2] },
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", dRays: "Array(4)" },
		returnType: 'Integer', */
	//});

	return { rayCaster: rayCaster/* , renderTex: renderTex */ };
}
function registerRayCastingKernelMap(gpu) {
	let rayCastingCycle = gpu.createKernelMap({
		crossingPoints: function nextCrossingPoints(rayAlive, rayCrossingPoints, dRays) {
			//if(rayAlive < 1) return [0.0, 0.0, 0.0, 0.0];
			if(rayAlive < 1) return dRays;
			return [
				rayCrossingPoints[0] + dRays[0],
				rayCrossingPoints[1] + dRays[1],
				rayCrossingPoints[2] + dRays[2],
				0.0];
		},
		accumEmission: function nextAccumEmission(rayAlive, offset, texWorldScanEmission, segTransp, accumEmission, accumTransp) {
			if(rayAlive < 1) return accumEmission;
			
			let vxEmission = [0.0, 0.5, 1.0, 0.0];
			if(offset >= 0) vxEmission = texWorldScanEmission[offset];
			return [
				accumEmission[0] + accumTransp[0] * (1.0 - segTransp[0]) * vxEmission[0],
				accumEmission[1] + accumTransp[1] * (1.0 - segTransp[1]) * vxEmission[1],
				accumEmission[2] + accumTransp[2] * (1.0 - segTransp[2]) * vxEmission[2],
				0.0];
		},
		accumTransp: function nextAccumTransp(rayAlive, segTransp, accumTransp) {
			if(rayAlive < 1) return accumTransp;
			return [
				accumTransp[0] * segTransp[0],
				accumTransp[1] * segTransp[1],
				accumTransp[2] * segTransp[2],
				0.0];
		},
	}, function(texRayAlive, texCrossingPoints, texAccumBufferEmission, texAccumBufferTransp, 
		texRayDirs, texRayDirsSign, texWorldScanEmission, texWorldScanTransp) {
		let vecRayAlive = texRayAlive[this.thread.y][this.thread.x];
		//let rayAlive2 = vecRayAlive;
		let rayAlive2 = vecRayAlive[0];
		let vecAccumEmission = texAccumBufferEmission[this.thread.y][this.thread.x];
		let vecAccumTransp = texAccumBufferTransp[this.thread.y][this.thread.x];
		let vecZero = [0.0, 0.0, 0.0, 0.0];
		
		if(rayAlive2 < 1.0) {
			nextCrossingPoints(rayAlive2, vecZero, vecZero);
			nextAccumEmission(rayAlive2, -1, texWorldScanEmission, vecZero, vecAccumEmission, vecZero);
			nextAccumTransp(rayAlive2, vecZero, vecAccumTransp);
			//return 0;
			return vecZero;
		}
		
		let vecRayDir = texRayDirs[this.thread.y][this.thread.x];
		let vecRayDirSign = texRayDirsSign[this.thread.y][this.thread.x];
		let vecCrossingPoint = texCrossingPoints[this.thread.y][this.thread.x];
		let vecDRay = getDRay(vecCrossingPoint, vecRayDir, vecRayDirSign);
		nextCrossingPoints(rayAlive2, vecCrossingPoint, vecDRay);
		let pVoxel = pVoxel(vecCrossingPoint, vecDRay);
		let vecSegTransp = segTransp(pVoxel, texWorldScanTransp, vecDRay);
		nextAccumEmission(rayAlive2, pVoxel, texWorldScanEmission, vecSegTransp, vecAccumEmission, vecAccumTransp);
		let newAccumTransp = nextAccumTransp(rayAlive2, vecSegTransp, vecAccumTransp);
		if(newAccumTransp[0] <= this.constants.rayTranspThreshold &&
			newAccumTransp[1] <= this.constants.rayTranspThreshold &&
			newAccumTransp[2] <= this.constants.rayTranspThreshold)
			//return 0;
			return vecZero;
		else
			//return 1;
			return [1.0, 0.0, 0.0, 0.0];
		//let newRayAlive = nextRayAlive(rayAlive2, newAccumTransp);
		//return newRayAlive;
		//return [newRayAlive, 0.0, 0.0, 0.0];
	}, {
		constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2],
			opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold },
		//argumentTypes: { x: 'Float', y: 'Float', z: 'Float' },
		//argumentTypes: { viewerOrigin: 'Array(4)' },
		returnType: 'Array(4)',
		//optimizeFloatMemory: true,
		output: [cw, ch],
		//immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
		//graphical: true
	});
	
	rayCastingCycle.addFunction(function getDRay(crossingPoint, rayDir, rayDirSign) {
	//rayCastingCycle.addFunction(function getDRay(crossingPoint, rayDirsCol, rayDirsRow) {
		let coordProjection = [0.0, 0.0, 0.0/* , 0.0 */];
		/* let rayDir = [
			rayDirsCol[4 * this.thread.y + 0] + rayDirsRow[4 * this.thread.x + 0],
			rayDirsCol[4 * this.thread.y + 1] + rayDirsRow[4 * this.thread.x + 1],
			rayDirsCol[4 * this.thread.y + 2] + rayDirsRow[4 * this.thread.x + 2],
			0.0];
			rayDir[3] = this.constants.opacityFactor * Math.sqrt(rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * //rayDir[2]);
		let rayDirSign = [Math.sign(rayDir[0]), Math.sign(rayDir[1]), Math.sign(rayDir[2]), 0.0]; */
		coordProjection[0] = Math.floor(rayDirSign[0] * crossingPoint[0] + 1.0);
		coordProjection[1] = Math.floor(rayDirSign[1] * crossingPoint[1] + 1.0);
		coordProjection[2] = Math.floor(rayDirSign[2] * crossingPoint[2] + 1.0);
		
		let crossing = [0.0, 0.0, 0.0/* , 0.0 */];
		crossing[0] = (rayDirSign[0] * coordProjection[0] - crossingPoint[0]) / rayDir[0];
		crossing[1] = (rayDirSign[1] * coordProjection[1] - crossingPoint[1]) / rayDir[1];
		crossing[2] = (rayDirSign[2] * coordProjection[2] - crossingPoint[2]) / rayDir[2];

		let firstCrossing = 65504.0; //IEEE 754 half-precision maximum
		if(rayDir[0] != 0.0)
			firstCrossing = crossing[0];
		if(rayDir[1] != 0.0 && crossing[1] < firstCrossing)
			firstCrossing = crossing[1];
		if(rayDir[2] != 0.0 && crossing[2] < firstCrossing)
			firstCrossing = crossing[2];

		/* let firstCrossing = 65536.0;
		if(rayDir[0] != 0.0)
			firstCrossing = (rayDirSign[0] * coordProjection[0] - crossingPoint[0]) / rayDir[0];
		if(rayDir[1] != 0.0) {
			let rayCoordCrossing = (rayDirSign[1] * coordProjection[1] - crossingPoint[1]) / rayDir[1];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		}
		if(rayDir[2] != 0.0) {
			let rayCoordCrossing = (rayDirSign[2] * coordProjection[2] - crossingPoint[2]) / rayDir[2];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		} */

		/* let firstCrossing = 65504.0; //IEEE 754 half-precision maximum
		if(rayDir[0] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[0] * crossingPoint[0] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[0] * crossingPoint[0]) + 1;
			firstCrossing = (rayDirSign[0] * coordProjection - crossingPoint[0]) / rayDir[0];
		}
		if(rayDir[1] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[1] * crossingPoint[1] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[1] * crossingPoint[1]) + 1;
			let rayCoordCrossing = (rayDirSign[1] * coordProjection - crossingPoint[1]) / rayDir[1];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		}
		if(rayDir[2] != 0.0) {
			let coordProjection = Math.floor(rayDirSign[2] * crossingPoint[2] + 1.0);
			//let coordProjection = Math.floor(rayDirSign[2] * crossingPoint[2]) + 1;
			let rayCoordCrossing = (rayDirSign[2] * coordProjection - crossingPoint[2]) / rayDir[2];
			if(rayCoordCrossing < firstCrossing) firstCrossing = rayCoordCrossing;
		} */

		return [firstCrossing * rayDir[0], firstCrossing * rayDir[1], firstCrossing * rayDir[2], firstCrossing * rayDir[3]];
	});
	//, {
		//constants: { opacityFactor: opacityFactor },
		//argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", rayDirs: "Array(4)", rayDirsSign: "Array(4)" },
		//returnType: 'Array(4)',
		//optimizeFloatMemory: true,
	//});
	rayCastingCycle.addFunction(function pVoxel(crossingPoint, dRay) {
		let discreteCube = [
			Math.floor(crossingPoint[0] + 0.5 * dRay[0]),
			Math.floor(crossingPoint[1] + 0.5 * dRay[1]),
			Math.floor(crossingPoint[2] + 0.5 * dRay[2]),
			0];

		if(discreteCube[0] >= 0 && discreteCube[0] < this.constants.worldRes0 &&
			discreteCube[1] >= 0 && discreteCube[1] < this.constants.worldRes1 &&
			discreteCube[2] >= 0 && discreteCube[2] < this.constants.worldRes2)
			//return discreteCube;
			return (discreteCube[2] * this.constants.worldRes1 + discreteCube[1]) * this.constants.worldRes0 + discreteCube[0];
		else
			//return [-1, -1, -1, -1];
			return -1;
	});/* , {
		//constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2] },
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", dRays: "Array(4)" },
		returnType: 'Integer', */
	//});
	rayCastingCycle.addFunction(function segTransp(offset, texWorldScanTransp, dRay) {
		let vxTransp = [0.5, 0.5, 0.5, 0.0];
		//let vxTransp = [0.0, 0.0, 0.0, 0.0];
		//let vxTransp = [1.0, 1.0, 1.0, 0.0];
		if(offset >= 0) vxTransp = texWorldScanTransp[offset];
		/* else {
			//to do: special code that fills the remaining transparency and kills the ray
		} */

		let rayLen = dRay[3];
		return [
			Math.exp(rayLen * vxTransp[0]),
			Math.exp(rayLen * vxTransp[1]),
			Math.exp(rayLen * vxTransp[2]),
			0.0];
	}, {
		argumentTypes: { rayAlive: "Integer", discreteCube: "Integer", worldScanTransp: "Array", dRays: "Array(4)" },
		returnType: 'Array(4)'
	});
	return { rayCastingCycle: rayCastingCycle };
}

function canvasSizeChange(newCW, newCH) {
	ch = newCH;
	cw = newCW;

	releaseCanvasResources(); //Dispose canvas-related kernels, etc.

	//Recreate kernels, except field-related ones
	generalKernels = registerGeneralKernels(gpu);
	/* rcKernels0 = registerRayCastingKernels(gpu, newKernels);
	rcKernels1 = registerRayCastingKernels(gpu, newKernels); */
	/* rcKernels0 = registerRayCastingKernelMap(gpu);
	rcKernels1 = registerRayCastingKernelMap(gpu); */
	rcKernels0 = registerRayCastingKernelMono(gpu);

	//From registerKernels
	/* generalKernels.rayDirs2d.setOutput([cw, ch]);
	generalKernels.rayDirsSigns.setOutput([cw, ch]); */
	/* generalKernels.resetRayAlive.setOutput([cw, ch]);
	generalKernels.resetRayCrossingPoints.setOutput([cw, ch]);
	generalKernels.resetAccumBufferEmission.setOutput([cw, ch]);
	generalKernels.resetAccumBufferTransp.setOutput([cw, ch]);
	generalKernels.renderAccum.setOutput([cw, ch]); */

	//rcKernelsSetDimensions(rcKernels0);
	//rcKernelsSetDimensions(rcKernels1);

	viewRayDirsCompute_Rectilinear(ch, cw);
	//texBuffer0 = {};
	//texBuffer1 = {};

	//force-compile
	//frameRenderRaycasting(ch, cw, 0);
	//frameRenderRaycasting(ch, cw, 0);
	//frameRenderRaycasting_kernelMap(0);
	//frameRenderRaycasting_kernelMap(0);
	frameRenderRaycasting_mono(1);
	/* frameRenderRaycasting_combinedKernel(0);
	frameRenderRaycasting_combinedKernel(0); */

	mainCanvas.height = ch;
	mainCanvas.width = cw;
}
function rcKernelsSetDimensions(rcKernels) {
	//From registerRayCastingKernels
	/* rcKernels.getDRay.setOutput([cw, ch]);
	rcKernels.nextCrossingPoints.setOutput([cw, ch]);
	rcKernels.pVoxel.setOutput([cw, ch]);
	rcKernels.segTransp.setOutput([cw, ch]);
	rcKernels.nextAccumEmission.setOutput([cw, ch]);
	rcKernels.nextAccumTransp.setOutput([cw, ch]);
	rcKernels.nextRayAlive.setOutput([cw, ch]); */

	//From registerRayCastingKernelMono
	rcKernels.rayCaster.setOutput([cw, ch]);
	//rcKernels.renderTex.setOutput([cw, ch]);

	//From registerRayCastingKernelMap
	//rcKernels.rayCastingCycle.setOutput([cw, ch]);
}

function viewRayDirsCompute_Rectilinear(ch, cw) {
	let chInv = 1 / ch;
	
	rayDirsCol = new Float32Array(ch * 4);
	let x, xf;
	for(x = 0; x < ch; x++) {
		xf = clientFoVH * (2.0 * (x + 0.5) * chInv - 1.0);
		rayDirsCol[4 * x    ] = clientSpcTransf[6] + clientSpcTransf[3] * xf;
		rayDirsCol[4 * x + 1] = clientSpcTransf[7] + clientSpcTransf[4] * xf;
		rayDirsCol[4 * x + 2] = clientSpcTransf[8] + clientSpcTransf[5] * xf;
	}
	
	rayDirsRow = new Float32Array(cw * 4);
	for(x = 0; x < cw; x++) {
		xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;
		rayDirsRow[4 * x    ] = clientSpcTransf[0] * xf;
		rayDirsRow[4 * x + 1] = clientSpcTransf[1] * xf;
		rayDirsRow[4 * x + 2] = clientSpcTransf[2] * xf;
	}

	texRayDirs = generalKernels.rayDirs2d(rayDirsCol, rayDirsRow);
	texRayDirsSign = generalKernels.rayDirsSigns(texRayDirs);
}

//var frameMaxLayers = 96;
//var frameMaxLayers = 64;
//var frameMaxLayers = 48;
//var frameMaxLayers = 32;
//var frameMaxLayers = 24;
//var frameMaxLayers = 16;
//const rayTranspThreshold = 1.0 / 96.0;
const rayTranspThreshold = 1.0 / 128.0;

//var texState;
//var texRayAlive, texCrossingPoints, texAccumBufferEmission, texAccumBufferTransp;
//var isBufferSecond = false, texBuffer0, texBuffer1;

//function frameRenderRaycasting(canvas, timeout) {
function frameRenderRaycasting(/* bufH, bufW, */ timeout) {
	//let bufH = canvas.height|0, bufW = canvas.width|0;
	let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	if(timeoutEnabled) tStart = performance.now();
	
	//Some initialization
	let newBuffer, prevBuffer;
	prevBuffer = (isBufferSecond ? texBuffer0 : texBuffer1);
	prevBuffer.rayAlive = generalKernels.resetRayAlive();
	prevBuffer.crossingPoints = generalKernels.resetRayCrossingPoints(clientPos[0], clientPos[1], clientPos[2]);
	//let texCrossingPoints = generalKernels.resetRayCrossingPoints(new Float32Array(clientPos));
	prevBuffer.accumEmission = generalKernels.resetAccumBufferEmission();
	prevBuffer.accumTransp = generalKernels.resetAccumBufferTransp();

	//fieldMap?.result?.clear();
	//fieldMap?.alpha?.clear();
	//fieldMap?.result?.delete();
	//fieldMap?.alpha?.delete();
	let fieldMap = generalKernels.mapField(particles.count, particles.r, particles.pos, particles.emission, particles.alpha);

	//segmentCount = 0;
	//layerCount = 0;
	//let z = 0;
	for(let z = 0; z < frameMaxLayers; z = layerCount) {
		newBuffer = (isBufferSecond ? texBuffer1 : texBuffer0);
		prevBuffer = (isBufferSecond ? texBuffer0 : texBuffer1);
		let newKernel = (isBufferSecond ? rcKernels1 : rcKernels0);

		//to do: try removing ray life control
		let texDRays, texPVoxels, texSegTransps;
		texDRays = rcKernels0.getDRay(prevBuffer.rayAlive, prevBuffer.crossingPoints, texRayDirs, texRayDirsSign);
		//dRays = rcKernels0.getDRay(prevBuffer.rayAlive, prevBuffer.crossingPoints, rayDirsCol, rayDirsRow);
		newBuffer.crossingPoints = newKernel.nextCrossingPoints(prevBuffer.rayAlive, prevBuffer.crossingPoints, texDRays);
		texPVoxels = rcKernels0.pVoxel(prevBuffer.rayAlive, prevBuffer.crossingPoints, texDRays);
		texSegTransps = rcKernels0.segTransp(prevBuffer.rayAlive, texPVoxels, fieldMap.alpha, texDRays);
		texDRays.delete();
		newBuffer.accumEmission = newKernel.nextAccumEmission(prevBuffer.rayAlive, texPVoxels, fieldMap.result, texSegTransps, prevBuffer.accumEmission, prevBuffer.accumTransp);
		texPVoxels.delete();
		newBuffer.accumTransp = newKernel.nextAccumTransp(prevBuffer.rayAlive, texSegTransps, prevBuffer.accumTransp);
		texSegTransps.delete();
		newBuffer.rayAlive = newKernel.nextRayAlive(prevBuffer.rayAlive, newBuffer.accumTransp);
		/* dRays.clear();
		pVoxels.clear();
		newAlphas.clear(); */

		/* newBuffer?.rayAlive?.clear();
		newBuffer?.crossingPoints?.clear();
		newBuffer?.accumEmission?.clear();
		newBuffer?.accumTransp?.clear(); */
		/* prevBuffer?.rayAlive?.clear();
		prevBuffer?.crossingPoints?.clear();
		prevBuffer?.accumEmission?.clear();
		prevBuffer?.accumTransp?.clear(); */
		prevBuffer?.rayAlive?.delete();
		prevBuffer?.crossingPoints?.delete();
		prevBuffer?.accumEmission?.delete();
		prevBuffer?.accumTransp?.delete();

		isBufferSecond = !isBufferSecond;
		layerCount = z + 1;
		if(timeoutEnabled && (performance.now() - tStart) * (layerCount + 1) / layerCount > timeout) break;
	}
	newBuffer.rayAlive.delete();
	newBuffer.crossingPoints.delete();

	generalKernels.renderAccum(newBuffer.accumEmission, newBuffer.accumTransp);
	newBuffer.accumEmission.delete();
	newBuffer.accumTransp.delete();
	//releaseKernelCollection(newBuffer);

	/* fieldMap.result.clear();
	fieldMap.alpha.clear(); */
	fieldMap.result.delete();
	fieldMap.alpha.delete();
}
function frameRenderRaycasting_mono(/* bufH, bufW, */ /* timeout */ layerCount) {
	/* let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	if(timeoutEnabled) tStart = performance.now(); */
	
	//prevBuffer.crossingPoints = generalKernels.resetRayCrossingPoints(clientPos[0], clientPos[1], clientPos[2]);
	//let texCrossingPoints = generalKernels.resetRayCrossingPoints(new Float32Array(clientPos));

	//fieldMap?.result?.clear();
	//fieldMap?.alpha?.clear();
	//fieldMap?.result?.delete();
	//fieldMap?.alpha?.delete();
	let fieldMap = fieldKernels.mapField_particles(particles.count, particles.r, particles.pos, particles.emission, particles.alpha);

	rcKernels0.rayCaster(layerCount, new Float32Array(clientPos), texRayDirs, texRayDirsSign, fieldMap.result, fieldMap.alpha);
	//return rcKernels0.rayCaster.exec(layerCount, new Float32Array(clientPos), texRayDirs, texRayDirsSign, fieldMap.result, fieldMap.alpha);
	/* let texOut = rcKernels0.rayCaster(layerCount, new Float32Array(clientPos), texRayDirs, texRayDirsSign, fieldMap.result, fieldMap.alpha);
	rcKernels0.renderTex(texOut);
	texOut.delete(); */

	/* fieldMap.result.clear();
	fieldMap.alpha.clear(); */
	/* fieldMap.result.delete();
	fieldMap.alpha.delete(); */
}
function frameRenderRaycasting_kernelMap(/* bufH, bufW, */ timeout) {
	let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	if(timeoutEnabled) tStart = performance.now();
	
	//Some initialization
	let newBuffer, prevBuffer;
	prevBuffer = (isBufferSecond ? texBuffer0 : texBuffer1);
	prevBuffer.rayAlive = generalKernels.resetRayAlive();
	prevBuffer.crossingPoints = generalKernels.resetRayCrossingPoints(clientPos[0], clientPos[1], clientPos[2]);
	//let texCrossingPoints = generalKernels.resetRayCrossingPoints(new Float32Array(clientPos));
	prevBuffer.accumEmission = generalKernels.resetAccumBufferEmission();
	prevBuffer.accumTransp = generalKernels.resetAccumBufferTransp();

	//fieldMap?.result?.clear();
	//fieldMap?.alpha?.clear();
	//fieldMap?.result?.delete();
	//fieldMap?.alpha?.delete();
	let fieldMap = generalKernels.mapField(particles.count, particles.r, particles.pos, particles.emission, particles.alpha);

	for(let z = 0; z < frameMaxLayers; z = layerCount) {
		newBuffer = (isBufferSecond ? texBuffer1 : texBuffer0);
		prevBuffer = (isBufferSecond ? texBuffer0 : texBuffer1);
		let newKernel = (isBufferSecond ? rcKernels1 : rcKernels0);
		//let newKernel = rcKernels0;

		//to do: try removing ray life control
		/* newBuffer?.rayAlive?.clear();
		newBuffer?.crossingPoints?.clear();
		newBuffer?.accumEmission?.clear();
		newBuffer?.accumTransp?.clear(); */
		if(!prevBuffer) break;
		let newState = newKernel.rayCastingCycle(prevBuffer.rayAlive, prevBuffer.crossingPoints, prevBuffer.accumEmission, prevBuffer.accumTransp, texRayDirs, texRayDirsSign, fieldMap.result, fieldMap.alpha);
		/* prevBuffer?.rayAlive?.clear();
		prevBuffer?.crossingPoints?.clear();
		prevBuffer?.accumEmission?.clear();
		prevBuffer?.accumTransp?.clear(); */
		/* prevBuffer.rayAlive.texture._refs--;
		prevBuffer.crossingPoints.texture._refs--;
		prevBuffer.accumEmission.texture._refs--;
		prevBuffer.accumTransp.texture._refs--; */
		/* prevBuffer.rayAlive?.delete();
		prevBuffer.crossingPoints?.delete();
		prevBuffer.accumEmission?.delete();
		prevBuffer.accumTransp?.delete(); */
		/* gpu.context.deleteTexture(prevBuffer.rayAlive?.texture);
		gpu.context.deleteTexture(prevBuffer.crossingPoints?.texture);
		gpu.context.deleteTexture(prevBuffer.accumEmission?.texture);
		gpu.context.deleteTexture(prevBuffer.accumTransp?.texture); */
		/* prevBuffer.rayAlive = null;
		prevBuffer.crossingPoints = null;
		prevBuffer.accumEmission = null;
		prevBuffer.accumTransp = null; */

		newBuffer.rayAlive = newState.result;
		newBuffer.crossingPoints = newState.crossingPoints;
		newBuffer.accumEmission = newState.accumEmission;
		newBuffer.accumTransp = newState.accumTransp;

		isBufferSecond = !isBufferSecond;
		layerCount = z + 1;
		if(timeoutEnabled && (performance.now() - tStart) * (layerCount + 1) / layerCount > timeout) break;
	}
	/* newBuffer.rayAlive.texture._refs--;
	newBuffer.crossingPoints.texture._refs--; */
	/* newBuffer.rayAlive.delete();
	newBuffer.crossingPoints.delete(); */
	/* gpu.context.deleteTexture(newBuffer.rayAlive?.texture);
	gpu.context.deleteTexture(newBuffer.crossingPoints?.texture); */
	
	generalKernels.renderAccum(newBuffer.accumEmission, newBuffer.accumTransp);
	/* newBuffer.accumEmission.texture._refs--;
	newBuffer.accumTransp.texture._refs--; */
	/* newBuffer.accumEmission.delete();
	newBuffer.accumTransp.delete(); */
	/* gpu.context.deleteTexture(newBuffer.accumEmission?.texture);
	gpu.context.deleteTexture(newBuffer.accumTransp?.texture); */
	//releaseKernelCollection(newBuffer);
	/* newBuffer.rayAlive = null;
	newBuffer.crossingPoints = null;
	newBuffer.accumEmission = null;
	newBuffer.accumTransp = null; */
	
	/* fieldMap.result.clear();
	fieldMap.alpha.clear(); */
	/* fieldMap.result.texture._refs--;
	fieldMap.alpha.texture._refs--; */
	fieldMap.result.delete();
	fieldMap.alpha.delete();
	/* gpu.context.deleteTexture(fieldMap.result?.texture);
	gpu.context.deleteTexture(fieldMap.alpha?.texture); */
	/* fieldMap.result = null;
	fieldMap.alpha = null; */
}
function frameRenderRaycasting_combinedKernel(timeout) {
	let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	if(timeoutEnabled) tStart = performance.now();
	
	//Some initialization
	//let texState = generalKernels.resetState(new Float32Array(clientPos));
	let texState = generalKernels.resetState(clientPos[0], clientPos[1], clientPos[2]);

	//fieldMap.result?.clear();
	//fieldMap.alpha?.clear();
	//fieldMap.result?.delete();
	//fieldMap.alpha?.delete();
	let fieldMap = generalKernels.mapField(particles.count, particles.r, particles.pos, particles.emission, particles.alpha);

	for(let z = 0; z < frameMaxLayers; z = layerCount) {
		let newKernel = (isBufferSecond ? rcKernels1 : rcKernels0);

		//to do: try removing ray life control
		//let newState = newKernel.rayCastingCycle(texState, texRayDirs, texRayDirsSign, fieldMap.alpha, fieldMap.result);
		texState = newKernel.rayCastingCycle(texState, texRayDirs, texRayDirsSign, fieldMap.alpha, fieldMap.result);
		/* texState[0].delete();
		texState[1].delete();
		texState[2].delete();
		texState[3].delete();
		texState = newState; */

		isBufferSecond = !isBufferSecond;
		layerCount = z + 1;
		if(timeoutEnabled && (performance.now() - tStart) * (layerCount + 1) / layerCount > timeout) break;
	}
	texState[0].delete();
	texState[1].delete();
	generalKernels.renderAccum(texState[2], texState[3]);
	texState[2].delete();
	texState[3].delete();
	//releaseKernelCollection(newBuffer);

	/* fieldMap.result.clear();
	fieldMap.alpha.clear(); */
	fieldMap.result.delete();
	fieldMap.alpha.delete();
}
