"use strict";

async function loadModules() {
	let loadRemote = location.protocol != "https:";
	if(!loadRemote) {
		try {
			window.THREE = await import('./three.module.js');
			console.log("three.js imported locally"/* , THREE */);
		} catch(error) {
			console.log(error);
			loadRemote = true;
		}
	}
	if(loadRemote) {
		window.THREE = await import('https://threejs.org/build/three.module.js');
		console.log("three.js imported remotely"/* , THREE */);
	}
	if(window.modulesLoaded) modulesLoaded();
}
loadModules();
/* import('./three.module.js').then((value) => {
	console.log("import promise 1 then fulfilled", value);
	window.THREE = value;
}, (reason) => {
	console.log("import promise 1 then rejected", reason);
	return import('https://threejs.org/build/three.module.js');
	//return await import('https://threejs.org/build/three.module.js');
}).then((value) => {
	console.log("import promise 2 then fulfilled", value);
	window.THREE = value;
}, (reason) => {
	console.log("import promise 2 then rejected", reason);
}).catch((reason) => {
	console.log("import promise catch", reason);
}); */

function loadedBasic(event) {
	//console.log("Starting function 'loadedBasic'", event);
	//console.log("THREE: ", THREE);
	window.canvas = document.getElementById("cnvMainOutput");
	window.renderer = new THREE.WebGLRenderer({/* antialias: true, */ depth: true, canvas});
	//renderer.setTransparentSort(null);
	window.canvasAspectRatio = canvas.width / canvas.height;
	canvas.parentElement.style.aspectRatio = canvasAspectRatio;
}

function resizeRendererToDisplaySize(renderer) {
	const body = document.body;
	if(body.clientWidth / body.clientHeight > canvasAspectRatio) {
		body.classList.add("layout-horizontal");
		body.classList.remove("layout-vertical");
	} else {
		body.classList.add("layout-vertical");
		body.classList.remove("layout-horizontal");
	}

	const canvas = renderer.domElement;

	canvas.parentElement.style.zoom = 1 / devicePixelRatio;
	const widthAvailable = canvas.parentElement.clientWidth, heightAvailable = canvas.parentElement.clientHeight;
	//canvas.style.zoom = 1 / devicePixelRatio;
	//const widthAvailable = canvas.clientWidth, heightAvailable = canvas.clientHeight;

	/* const width = widthAvailable * devicePixelRatio;
	const height = heightAvailable * devicePixelRatio; */
	/* const width = Math.trunc(widthAvailable * devicePixelRatio);
	const height = Math.trunc(heightAvailable * devicePixelRatio); */
	const width = Math.trunc(Math.min(widthAvailable, heightAvailable * canvasAspectRatio));
	const height = Math.trunc(Math.min(heightAvailable, widthAvailable / canvasAspectRatio));
	const needResize = canvas.width !== width || canvas.height !== height;
	if(needResize) {
		renderer.setSize(width, height, false);
		//renderer.setDrawingBufferSize(width, height, 1);
		target0.setSize(width, height);
	}
	return needResize;
}

//window.addEventListener("load", loaded);
//loaded();
