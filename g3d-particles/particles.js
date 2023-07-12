"use strict";

var particles;
var partPosLocal;

function initParticles() {
	particles = {
		count: 2,
		r: new Float32Array([3.0 / 64.0 *  worldRes[0], 2.0 / 64.0 *  worldRes[0]]),
		pos: new Float32Array([
			0.5 * worldRes[0], 0.5 * worldRes[1], 0.5 * worldRes[2], 0.0,
			0.4375 * worldRes[0], 0.5 * worldRes[1], 0.5 * worldRes[2], 0.0
		]),
		emission: new Float32Array([
			1.0, 1.0, 1.0, 0.0,
			1.0, 0.5, 0.0, 0.0
		]),
		alpha: new Float32Array([ //to do: review name convention (transparency vs. opacity vs. alpha)
			1.0, 1.0, 1.0, 0.0,
			2.0, 2.0, 2.0, 0.0
		])
	};
}
function initParticles_random() {
	const particleCount = 256;
	//const particleCount = 1024;
	//const particleCount = 4096;
	//const particleCount = 16384;
	//const particleCount = 65536;
	//const particleCount = 262144;
	//const particleCount = 1048576;
	particles = {
		count: particleCount,
		r: new Float32Array(particleCount),
		pos: new Float32Array(4 * particleCount),
		emission: new Float32Array(4 * particleCount),
		alpha: new Float32Array(4 * particleCount)
	};
	for(let i = 0; i < particleCount; i++) {
		particles.r[i] = 2.0 ** (5.0 * Math.random() - 3.0);
		particles.pos[4 * i    ] = worldRes[0] * Math.random();
		particles.pos[4 * i + 1] = worldRes[1] * Math.random();
		particles.pos[4 * i + 2] = worldRes[2] * Math.random();
		particles.emission[4 * i    ] = Math.random();
		particles.emission[4 * i + 1] = Math.random();
		particles.emission[4 * i + 2] = Math.random();
		particles.alpha[4 * i    ] = 2.0 ** (6.0 * Math.random() - 5.0);
		particles.alpha[4 * i + 1] = 2.0 ** (6.0 * Math.random() - 5.0);
		particles.alpha[4 * i + 2] = 2.0 ** (6.0 * Math.random() - 5.0);
	}
	partPosLocal = new Float32Array(4 * particles.count);
}

const particlesZSorted = [];
function alignParticles() {
	particlesZSorted.length = 0;
	if(!partPosLocal) partPosLocal = new Float32Array(4 * particles.count);
	for(let i = 0; i < particles.count; i++) {
		//const r = particles.r[i];
		//const pos = particles.pos.subarray(4 * i, 4 * i + 3);
		const pos = [particles.pos[4 * i] - clientPos[0], particles.pos[4 * i + 1] - clientPos[1], particles.pos[4 * i + 2] - clientPos[2]];
		const posAligned = vectorTransform_3(clientSpcTransfInv, pos);
		partPosLocal.set(posAligned, 4 * i);
		//const dist = Math.hypot(posAligned[0], posAligned[1], posAligned[2]);
		const dist = posAligned[2];
		if(dist > -particles.r[i])
			particlesZSorted.push({i: i, z: dist});
	}
	particlesZSorted.sort((a, b) => (a.z - b.z));
}
