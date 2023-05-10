"use strict";

//virtual vectorial world context
//var worldRes = new Int8Array([32, 32, 32]);
//var worldRes = new Float32Array([16, 16, 16]);
//var worldRes = [16, 16, 16];
var worldRes = new Uint8Array([32, 32, 32]);
//var worldRes = new Int32Array([16, 16, 16]);

/* var worldScanEmission = new Float32Array(worldRes[0] * worldRes[1] * worldRes[2] * 4);
var worldScanTransp = new Float32Array(worldRes[0] * worldRes[1] * worldRes[2] * 4); */
var texWorldScanEmission, texWorldScanTransp;

function worldVoxelsInit() {
	/* for(let i = 0; i < worldRes[0] * worldRes[1] * worldRes[2] * 4; i++) {
		worldScanEmission[i] = Math.random();
		worldScanTransp[i] = Math.random();
	} */
	
	/*for(let z = 0; z < worldRes[0]; z++) {
		for(let y = 0; y < worldRes[1]; y++) {
			for(let x = 0; x < worldRes[2]; x++) {
				//
			}
		}
	}*/

	//texWorldScanEmission = worldScanEmission;
	//texWorldScanTransp = worldScanTransp;

	texWorldScanEmission = initWorldScanEmission();
	texWorldScanTransp = initWorldScanTransp();
}

//--
//virtual vectorial client context
//basically done.
//var clientPos = new Float32Array(3), clientRot = new Float32Array(9);
var clientPos = new Float32Array([0.5 * worldRes[0] + 0.5, 0.5 * worldRes[1] + 0.5, 0.5 * worldRes[2] + 0.5]);
var clientSpcTransf = new Float32Array([
 1, 0, 0,
 0, 1, 0,
 0, 0, 1]);
var clientFoVH = 1;
var rayDirsCol, rayDirsRow;
var texRayDirs, texRayDirsSign;
//var texRayAlive, texCrossingPoints, texAccumBufferEmission, texAccumBufferTransp;

function clientUpdateSpcTransf() {
	//to do
}

const opacityFactor = -128 * Math.LN2 / 256;
//const opacityFactor = -128 / 256;

var initWorldScanEmission, initWorldScanTransp;
var rayDirs2d, rayDirsSigns;
var resetAccumBufferEmission, resetAccumBufferTransp, resetRayAlive, resetRayCrossingPoints;
var renderAccum;
function registerKernels() {
	initWorldScanEmission = gpu.createKernel(function() {
		return [Math.random(), Math.random(), Math.random(), 0.0];
	}, {
		returnType: 'Array(4)',
		output: [worldRes[0] * worldRes[1] * worldRes[2]],
		//output: [worldRes[0] * worldRes[1], worldRes[2]],
		//output: [worldRes[0], worldRes[1] * worldRes[2]],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true,
		graphical: false
	});
	initWorldScanTransp = gpu.createKernel(function() {
		return [Math.random(), Math.random(), Math.random(), 0.0];
	}, {
		returnType: 'Array(4)',
		output: [worldRes[0] * worldRes[1] * worldRes[2]],
		//output: [worldRes[0] * worldRes[1], worldRes[2]],
		//output: [worldRes[0], worldRes[1] * worldRes[2]],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true,
		graphical: false
	});

	rayDirs2d = gpu.createKernel(function(rayDirsCol, rayDirsRow) {
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
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	rayDirsSigns = gpu.createKernel(function(rayDirs) {
		let ray = rayDirs[this.thread.y][this.thread.x];
		return [Math.sign(ray[0]), Math.sign(ray[1]), Math.sign(ray[2]), 0.0];
	}, {
		returnType: 'Array(4)',
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});

	resetRayAlive = gpu.createKernel(function() {
		return 1;
		//return [1.0, 0.0, 0.0, 0.0];
	}, {
		returnType: 'Integer',
		//returnType: 'Float',
		//precision: "unsigned",
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	});
	resetRayCrossingPoints = gpu.createKernel(function(x, y, z) {
		return [x, y, z, 0.0];
	/* resetRayCrossingPoints = gpu.createKernel(function(viewerOrigin) {
		return viewerOrigin; */
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
	});
	resetAccumBufferEmission = gpu.createKernel(function() {
		return [0.0, 0.0, 0.0, 0.0];
	}, {
		returnType: 'Array(4)',
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	});
	resetAccumBufferTransp = gpu.createKernel(function() {
		return [1.0, 1.0, 1.0, 1.0];
	}, {
		returnType: 'Array(4)',
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		pipeline: true
	});

	registerRayCastingKernels(gpu);
	//registerRayCastingKernelMap(gpu);
	renderAccum = gpu.createKernel(function(accumBufferEmission, accumBufferTransp) {
		let accumEmission = accumBufferEmission[this.thread.y][this.thread.x];
		//let color = accumEmission;

		let color = [0.5, 0.5, 0.5/* , 0.0 */];
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
	});
}

var getDRay, nextCrossingPoints, pVoxel, segTransp, nextAccumEmission, nextAccumTransp, nextRayAlive;
var resetState, rayCastingLoop;
function registerRayCastingKernels(gpu) {
	getDRay = gpu.createKernel(function(rayAlive, rayCrossingPoints, rayDirs, rayDirsSign) {
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
		//optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
	});
	nextCrossingPoints = gpu.createKernel(function(rayAlive, rayCrossingPoints, dRays) {
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
	pVoxel = gpu.createKernel(function(rayAlive, rayCrossingPoints, dRays) {
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
			//to do: check dimension order
			return (discreteCube[0] * this.constants.worldRes1 + discreteCube[1]) * this.constants.worldRes2 + discreteCube[2];
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
	segTransp = gpu.createKernel(function(rayAlive, discreteCube, worldScanTransp, dRays) {
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
	nextAccumEmission = gpu.createKernel(function(rayAlive, discreteCube, worldScanEmission, alphaNew, accumBufferEmission, accumBufferTransp) {
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
	nextAccumTransp = gpu.createKernel(function(rayAlive, alphaNew, accumBufferTransp) {
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
	nextRayAlive = gpu.createKernel(function(rayAlive, accumBufferTransp) {
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
	
	/* resetState = gpu.combineKernels(resetAccumBufferEmission, resetAccumBufferTransp, resetRayAlive, resetRayCrossingPoints,
		//function(viewerOrigin) {
		function(x, y, z) {
			//return [resetRayAlive(), resetRayCrossingPoints(viewerOrigin), resetAccumBufferEmission(), resetAccumBufferTransp()];
			return [resetRayAlive(), resetRayCrossingPoints(x, y, z), resetAccumBufferEmission(), resetAccumBufferTransp()];
		}
	);
	rayCastingLoop = gpu.combineKernels(
		getDRay, nextCrossingPoints, pVoxel, segTransp, nextAccumEmission, nextAccumTransp, nextRayAlive,
		//function(texRayAlive, texCrossingPoints, texRayDirs, texRayDirsSign, texWorldScanTransp, texWorldScanEmission, texAccumBufferEmission, texAccumBufferTransp) {
		function(texState, texRayDirs, texRayDirsSign, texWorldScanTransp, texWorldScanEmission) {
			let texRayAlive = texState[0];
			let texCrossingPoints = texState[1];
			let texAccumBufferEmission = texState[2];
			let texAccumBufferTransp = texState[3];
			let texDRays = getDRay(texRayAlive, texCrossingPoints, texRayDirs, texRayDirsSign);
			//texDRays = getDRay(texRayAlive, texCrossingPoints, rayDirsCol, rayDirsRow);
			let newCrossingPoints = nextCrossingPoints(texRayAlive, texCrossingPoints, texDRays);
			let texPVoxels = pVoxel(texRayAlive, texCrossingPoints, texDRays);
			let texSegTransps = segTransp(texRayAlive, texPVoxels, texWorldScanTransp, texDRays);
			let newAccumEmission = nextAccumEmission(texRayAlive, texPVoxels, texWorldScanEmission, texSegTransps, texAccumBufferEmission, texAccumBufferTransp);
			let newAccumTransp = nextAccumTransp(texRayAlive, texSegTransps, texAccumBufferTransp);
			let newRayAlive = nextRayAlive(texRayAlive, newAccumTransp);
			texDRays.delete();
			texPVoxels.delete();
			texSegTransps.delete();
			return [newRayAlive, newCrossingPoints, newAccumEmission, newAccumTransp];
	}); */
}

//var rayCastingLoop;
function registerRayCastingKernelMap(gpu) {
	rayCastingLoop = gpu.createKernelMap({
		nextCrossingPointsRes: function nextCrossingPoints(rayAlive, rayCrossingPoints, dRays) {
			//if(rayAlive < 1) return [-1.0, -1.0, -1.0, -1.0];
			//if(rayAlive < 1) return [0.0, 0.0, 0.0, 0.0];
			if(rayAlive < 1) return dRays;
			return [
				rayCrossingPoints[0] + dRays[0],
				rayCrossingPoints[1] + dRays[1],
				rayCrossingPoints[2] + dRays[2],
				0.0];
		},
		nextAccumEmissionRes: function nextAccumEmission(rayAlive, offset, texWorldScanEmission, segTransp, accumEmission, accumTransp) {
			if(rayAlive < 1) return accumEmission;
			
			let vxEmission = [0.0, 0.5, 1.0, 0.0];
			if(offset >= 0) vxEmission = texWorldScanEmission[offset];
			return [
				accumEmission[0] + accumTransp[0] * (1.0 - segTransp[0]) * vxEmission[0],
				accumEmission[1] + accumTransp[1] * (1.0 - segTransp[1]) * vxEmission[1],
				accumEmission[2] + accumTransp[2] * (1.0 - segTransp[2]) * vxEmission[2],
				0.0];
		},
		nextAccumTranspRes: function nextAccumTransp(rayAlive, segTransp, accumTransp) {
			if(rayAlive < 1) return accumTransp;
			return [
				accumTransp[0] * segTransp[0],
				accumTransp[1] * segTransp[1],
				accumTransp[2] * segTransp[2],
				0.0];
		},
	}, function(texRayAlive, texCrossingPoints, texAccumBufferEmission, texAccumBufferTransp, 
		texRayDirs, texRayDirsSign, texWorldScanEmission, texWorldScanTransp) {
		let rayAlive = texRayAlive[this.thread.y][this.thread.x];
		let rayAlive2 = rayAlive[0];
		let accumEmission = texAccumBufferEmission[this.thread.y][this.thread.x];
		let accumTransp = texAccumBufferTransp[this.thread.y][this.thread.x];
		let rayDirs = texRayDirs[this.thread.y][this.thread.x];
		let rayDirsSign = texRayDirsSign[this.thread.y][this.thread.x];
		let zero = [0.0, 0.0, 0.0, 0.0];
		
		if(rayAlive2 < 1.0) {
			nextCrossingPoints(rayAlive2, zero, zero);
			nextAccumEmission(rayAlive2, -1, texWorldScanEmission, zero, accumEmission, zero);
			nextAccumTransp(rayAlive2, zero, accumTransp);
			return zero;
		}
		
		let crossingPoints = texCrossingPoints[this.thread.y][this.thread.x];
		let dRays = getDRay(crossingPoints, rayDirs, rayDirsSign);
		nextCrossingPoints(rayAlive2, crossingPoints, dRays);
		let pVoxels = pVoxel(crossingPoints, dRays);
		let newAlphas = segTransp(pVoxels, texWorldScanTransp, dRays);
		nextAccumEmission(rayAlive2, pVoxels, texWorldScanEmission, newAlphas, accumEmission, accumTransp);
		let newAccumTransp = nextAccumTransp(rayAlive2, newAlphas, accumTransp);
		if(newAccumTransp[0] <= this.constants.rayTranspThreshold &&
			newAccumTransp[1] <= this.constants.rayTranspThreshold &&
			newAccumTransp[2] <= this.constants.rayTranspThreshold)
			return zero;
		else
			return [1.0, 0.0, 0.0, 0.0];
		//let newRayAlive = nextRayAlive(rayAlive2, newAccumTransp);
		//return newRayAlive;
		//return [newRayAlive, 0.0, 0.0, 0.0];
	}, {
		constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2],
			opacityFactor: opacityFactor, rayTranspThreshold: rayTranspThreshold },
		//argumentTypes: { x: 'Float', y: 'Float', z: 'Float' },
		//argumentTypes: { viewerOrigin: 'Array2D(4)' },
		//returnType: 'Array2D',
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true
		//graphical: true
	});
	
	rayCastingLoop.addFunction(function getDRay(crossingPoint, rayDir, rayDirSign) {
	//rayCastingLoop.addFunction(function getDRay(crossingPoint, rayDirsCol, rayDirsRow) {
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
		/* output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true */
	//});
	rayCastingLoop.addFunction(function pVoxel(crossingPoint, dRay) {
		let discreteCube = [
			Math.floor(crossingPoint[0] + 0.5 * dRay[0]),
			Math.floor(crossingPoint[1] + 0.5 * dRay[1]),
			Math.floor(crossingPoint[2] + 0.5 * dRay[2]),
			0];

		if(discreteCube[0] >= 0 && discreteCube[0] < this.constants.worldRes0 &&
			discreteCube[1] >= 0 && discreteCube[1] < this.constants.worldRes1 &&
			discreteCube[2] >= 0 && discreteCube[2] < this.constants.worldRes2)
			//return discreteCube;
			//to do: check dimension order
			return (discreteCube[0] * this.constants.worldRes1 + discreteCube[1]) * this.constants.worldRes2 + discreteCube[2];
		else
			//return [-1, -1, -1, -1];
			return -1;
	});/* , {
		//constants: { worldRes0: worldRes[0], worldRes1: worldRes[1], worldRes2: worldRes[2] },
		argumentTypes: { rayAlive: "Integer", rayCrossingPoints: "Array(4)", dRays: "Array(4)" },
		returnType: 'Integer', */
		/* //optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true */
	//});
	rayCastingLoop.addFunction(function segTransp(offset, texWorldScanTransp, dRay) {
		let vxTransp = [0.5, 0.5, 0.5, 0.0];
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
	});
	/* , {
		argumentTypes: { rayAlive: "Integer", discreteCube: "Integer", worldScanTransp: "Array", dRays: "Array(4)" },
		returnType: 'Array(4)', */
		/* //optimizeFloatMemory: true,
		output: [cw, ch],
		immutable: true,
		//dynamicOutput: true,
		//dynamicArguments: true,
		pipeline: true */
	//});
}

function viewRayDirsCompute_Rectilinear(ch, cw) {
	let chInv = 1 / ch;
	
	rayDirsRow = new Float32Array(cw * 4);
	let x, xf;
	for(x = 0; x < cw; x++) {
		xf = (clientFoVH * 2.0 * (x + 0.5 - 0.5 * cw)) * chInv;
		rayDirsRow[4 * x    ] = clientSpcTransf[0] * xf;
		rayDirsRow[4 * x + 1] = clientSpcTransf[1] * xf;
		rayDirsRow[4 * x + 2] = clientSpcTransf[2] * xf;
	}

	rayDirsCol = new Float32Array(ch * 4);
	for(x = 0; x < ch; x++) {
		xf = clientFoVH * (2.0 * (x + 0.5) * chInv - 1.0);
		rayDirsCol[4 * x    ] = clientSpcTransf[6] + clientSpcTransf[3] * xf;
		rayDirsCol[4 * x + 1] = clientSpcTransf[7] + clientSpcTransf[4] * xf;
		rayDirsCol[4 * x + 2] = clientSpcTransf[8] + clientSpcTransf[5] * xf;
	}
	
	texRayDirs = rayDirs2d(rayDirsCol, rayDirsRow);
	texRayDirsSign = rayDirsSigns(texRayDirs);
}

//var frameMaxLayers = 96;
var frameMaxLayers = 24;
//var frameMaxLayers = 16;
const rayTranspThreshold = 1 / 96;
//var texState;

//function frameRenderRaycasting(canvas, timeout) {
function frameRenderRaycasting(bufH, bufW, timeout) {
	//let bufH = canvas.height|0, bufW = canvas.width|0;
	let timeoutEnabled = (typeof(timeout) === "number"), tStart;
	if(timeoutEnabled) tStart = performance.now();
	
	//Some initialization
	let texRayAlive = resetRayAlive();
	let texCrossingPoints = resetRayCrossingPoints(clientPos[0], clientPos[1], clientPos[2]);
	//let texCrossingPoints = resetRayCrossingPoints(new Float32Array(clientPos));
	let texAccumBufferEmission = resetAccumBufferEmission();
	let texAccumBufferTransp = resetAccumBufferTransp();
	//let texState = resetState(new Float32Array(clientPos));
	//let texState = resetState(clientPos[0], clientPos[1], clientPos[2]);

	//texWorldScanEmission = initWorldScanEmission();
	//texWorldScanTransp = initWorldScanTransp();

	let texDRays, texPVoxels, texSegTransps;
	//segmentCount = 0;
	//layerCount = 0;
	//let z = 0;
	for(let z = 0; z < frameMaxLayers; z = layerCount) {
		//to do: try removing ray life control
		texDRays = getDRay(texRayAlive, texCrossingPoints, texRayDirs, texRayDirsSign);
		//dRays = getDRay(texRayAlive, texCrossingPoints, rayDirsCol, rayDirsRow);
		let newCrossingPoints = nextCrossingPoints(texRayAlive, texCrossingPoints, texDRays);
		texPVoxels = pVoxel(texRayAlive, texCrossingPoints, texDRays);
		texSegTransps = segTransp(texRayAlive, texPVoxels, texWorldScanTransp, texDRays);
		let newAccumEmission = nextAccumEmission(texRayAlive, texPVoxels, texWorldScanEmission, texSegTransps, texAccumBufferEmission, texAccumBufferTransp);
		let newAccumTransp = nextAccumTransp(texRayAlive, texSegTransps, texAccumBufferTransp);
		let newRayAlive = nextRayAlive(texRayAlive, newAccumTransp);
		texDRays.delete();
		texPVoxels.delete();
		texSegTransps.delete();
		/* dRays.clear();
		pVoxels.clear();
		newAlphas.clear(); */

		/* let newState = rayCastingLoop(texRayAlive, texCrossingPoints, texAccumBufferEmission, texAccumBufferTransp, 
			texRayDirs, texRayDirsSign, texWorldScanEmission, texWorldScanTransp); */

		/* texCrossingPoints.clear();
		texAccumBufferEmission.clear();
		texAccumBufferTransp.clear();
		texRayAlive.clear(); */
		texRayAlive.delete();
		texCrossingPoints.delete();
		texAccumBufferEmission.delete();
		texAccumBufferTransp.delete();

		texRayAlive = newRayAlive;
		texCrossingPoints = newCrossingPoints;
		texAccumBufferEmission = newAccumEmission;
		texAccumBufferTransp = newAccumTransp;
		/* texRayAlive = newState.result;
		texCrossingPoints = newState.nextCrossingPointsRes;
		texAccumBufferEmission = newState.nextAccumEmissionRes;
		texAccumBufferTransp = newState.nextAccumTranspRes; */

		/* let newState = rayCastingLoop(texState, texRayDirs, texRayDirsSign, texWorldScanTransp, texWorldScanEmission);
		texState[0].delete();
		texState[1].delete();
		texState[2].delete();
		texState[3].delete();
		texState = newState; */

		//let rayAliveArr = texState[0].toArray(), frameSegCount = 0;
		/* let rayAliveArr = texRayAlive.toArray(), frameSegCount = 0;
		for(let y = 0, x; y < bufH; y++) {
			const row = rayAliveArr[y];
			for(x = 0; x < bufW; x++)
				frameSegCount += row[x];
		}
		segmentCount += frameSegCount;
		if(frameSegCount === 0) break; */
		layerCount = z + 1;
		if(timeoutEnabled && (performance.now() - tStart) * (layerCount + 1) / layerCount > timeout) break;
	}
	texCrossingPoints.delete();
	texRayAlive.delete();

	renderAccum(texAccumBufferEmission, texAccumBufferTransp);
	texAccumBufferEmission.delete();
	texAccumBufferTransp.delete();

	/* texState[0].delete();
	texState[1].delete();
	renderAccum(texState[2], texState[3]);
	texState[2].delete();
	texState[3].delete(); */
}
