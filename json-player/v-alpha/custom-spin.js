"use strict";

const spinInterval = 250; //milliseconds.
function spinEditTimer(spinEdit, pointerId) {
	//console.log("spinEditTimer", spinEdit, pointerId);
	if(!spinEdit) {
		console.info("spinEditTimer(): parameter spinEdit is empty. Returning.");
		return false;
	}
	const buttonsArea = spinEdit.querySelector(".buttons-area");
	if(!buttonsArea) {
		console.info("spinEditTimer(): descendant element .buttons-area not found. Returning.");
		return false;
	}
	buttonsArea.deltaTimer = 0;
	/* if(!buttonsArea.matches(":active") && !buttonsArea.querySelector(":active")) {
		console.info("spinEditTimer(): clicked element not found. Returning.");
		return false;
	} */
	if(!buttonsArea.hasPointerCapture(pointerId)) {
		console.info("spinEditTimer(): pointerId parameter is not captured now. Returning.");
		return false;
	}
	/* let force = 1.0;
	if(buttonsArea.lastPointerEvent) {
		if(buttonsArea.lastPointerEvent.pointerType === "mouse")
			force = 1.0;
		else
			force = 64.0 * buttonsArea.lastPointerEvent.pressure * buttonsArea.lastPointerEvent.width * buttonsArea.lastPointerEvent.height;
		if(force === 0.0) force = 1.0;
	}
	document.getElementById("outPressure").innerText = ((buttonsArea?.lastPointerEvent?.pointerType ?? "") + " " + force.toString() + " " + (buttonsArea?.lastPointerEvent?.webkitForce ?? "")).trim();
	force *= Math.pow(2.0, Math.abs(buttonsArea.currentDelta) / 16.0);
	const iterations = Math.round(1 * force); */
	//const iterations = 1;

	const txtControl = spinEdit.querySelector("input");
	if(buttonsArea.hoverElem) {
		if(buttonsArea.hoverElem.classList.contains("dec")) {
			//if(txtControl) txtControl.valueAsNumber -= txtControl.step;
			if(txtControl) {
				//for(let rept = 0; rept < iterations; rept++)
					txtControl.stepDown();
				txtControl.dispatchEvent(new Event("input"));
			}
			//buttonsArea.currentDelta--;
		} else if(buttonsArea.hoverElem.classList.contains("inc")) {
			//if(txtControl) txtControl.valueAsNumber += txtControl.step;
			if(txtControl) {
				//for(let rept = 0; rept < iterations; rept++)
					txtControl.stepUp();
				txtControl.dispatchEvent(new Event("input"));
			}
			//buttonsArea.currentDelta++;
		}
	}
	const currentDelta = (txtControl?.valueAsNumber - buttonsArea.initialValue) / (txtControl?.step ?? 1);

	let nextInterval = spinInterval;
	if(txtControl && !txtControl.classList.contains("exp"))
		nextInterval = spinInterval * Math.pow(0.5, Math.abs(currentDelta) / 16.0);
	buttonsArea.deltaTimer = globalThis.setTimeout(spinEditTimer, nextInterval, spinEdit, pointerId);
	//buttonsArea.deltaTimer = globalThis.setTimeout(spinEditTimer, 0.25 * spinInterval, spinEdit, pointerId);
	return true;
}

function spinEditPointerDown(event) {
	if(!event?.target) {
		console.info("spinEditPointerDown(): parameter event.target is empty. Returning.");
		return false;
	}
	if(event.button != 0) return false;
	const buttonsArea = event.currentTarget; //to do: try event.target.closest(".buttons-area") ?
	if(!buttonsArea) {
		console.info("spinEditPointerDown(): parameter event.currentTarget is empty. Returning.");
		return false;
	}

	buttonsArea.classList.add("active");
	buttonsArea.lastPointerEvent = event;
	//buttonsArea.pointerDown = true;
	//buttonsArea.hoverElem = event.target;
	let hit = document.elementFromPoint(event?.clientX, event?.clientY);
	if(!buttonsArea.contains(hit)) hit = null;
	if(hit) hit.classList.add("hover");
	buttonsArea.hoverElem = hit;
	buttonsArea.initialValue = buttonsArea.parentElement.querySelector("input").valueAsNumber;

	buttonsArea.setPointerCapture(event.pointerId);
	buttonsArea.addEventListener("pointermove", spinEditPointerMove, true);
	spinEditTimer(buttonsArea.parentElement, event.pointerId);
}
function spinEditPointerMove(event) {
	if(!event) {
		console.info("spinEditPointerMove(): parameter event is empty. Returning.");
		return false;
	}
	const buttonsArea = event.target;
	if(!buttonsArea) {
		console.info("spinEditPointerMove(): parameter event.target is empty. Returning.");
		return false;
	}

	if(!buttonsArea.hasPointerCapture(event.pointerId)) {
		console.info("spinEditPointerMove(): event.pointerId parameter is not captured now. Returning.");
		return false;
	}
	buttonsArea.lastPointerEvent = event;
	let hit = document.elementFromPoint(event.clientX, event.clientY);
	if(!buttonsArea.contains(hit)) hit = null;
	if(buttonsArea.hoverElem && buttonsArea.hoverElem !== hit)
		buttonsArea.hoverElem.classList.remove("hover");
	if(hit) hit.classList.add("hover");
	buttonsArea.hoverElem = hit;
}
function spinEditPointerUp(event) {
	if(!event?.srcElement) {
		console.info("spinEditPointerUp(): parameter event.srcElement is empty. Returning.");
		return false;
	}
	const buttonsArea = event.srcElement;
	//buttonsArea.pointerDown = false;

	buttonsArea.classList.remove("active");
	if(buttonsArea.hoverElem) buttonsArea.hoverElem.classList.remove("hover");
	buttonsArea.hoverElem = null;

	globalThis.clearTimeout(buttonsArea.deltaTimer);
	buttonsArea.deltaTimer = undefined;

	buttonsArea.releasePointerCapture(event.pointerId);
	buttonsArea.removeEventListener("pointermove", spinEditPointerMove, true);
}
function spinEditPointerLeave(event) {
	if(!event?.srcElement) {
		console.info("spinEditPointerLeave(): parameter event.srcElement is empty. Returning.");
		return false;
	}
	const buttonsArea = event.srcElement;

	if(buttonsArea.hoverElem) buttonsArea.hoverElem.classList.remove("hover");
	buttonsArea.hoverElem = null;
}
function spinEditPointerCancel(event) {
	if(!event?.srcElement) {
		console.info("spinEditPointerCancel(): parameter event.srcElement is empty. Returning.");
		return false;
	}
	const buttonsArea = event.srcElement;
	//buttonsArea.pointerDown = false;

	globalThis.clearTimeout(buttonsArea.deltaTimer);
	buttonsArea.deltaTimer = undefined;

	buttonsArea.releasePointerCapture(event.pointerId);
	buttonsArea.removeEventListener("pointermove", spinEditPointerMove, true);
}

function initSpinControls() {
	for(const txtControl of document.querySelectorAll(".custom-spin")) {
		if(!txtControl) continue;
		if(txtControl.step === "") txtControl.step = 1;
		let spinEdit = txtControl.closest(".spin-edit");
		if(!spinEdit) {
			spinEdit = document.createElement("span");
			spinEdit.classList.add("spin-edit");
			//spinEdit.dir = "ltr";
			txtControl.parentElement.insertBefore(spinEdit, txtControl);
			spinEdit.insertBefore(txtControl, null);
		}
		spinEdit.translate = false;

		let buttonsArea = spinEdit.querySelector(".buttons-area");
		if(!buttonsArea) {
			buttonsArea = document.createElement("span");
			buttonsArea.classList.add("buttons-area");
			spinEdit.insertBefore(buttonsArea, null);
		}
		//buttonsArea.translate = false;

		let btnDec = spinEdit.querySelector(".dec");
		if(!btnDec) {
			btnDec = document.createElement("span");
			btnDec.classList.add("btn");
			btnDec.classList.add("dec");
			btnDec.innerHTML = "&minus;";
			buttonsArea.insertBefore(btnDec, null);
		}
		let btnInc = spinEdit.querySelector(".inc");
		if(!btnInc) {
			let btnInc = document.createElement("span");
			btnInc.classList.add("btn");
			btnInc.classList.add("inc");
			btnInc.innerHTML = "&plus;";
			buttonsArea.insertBefore(btnInc, null);
		}

		buttonsArea.addEventListener("pointerdown" , spinEditPointerDown);
		//buttonsArea.addEventListener("pointermove" , spinEditPointerMove);
		buttonsArea.addEventListener("pointerup"   , spinEditPointerUp);
		buttonsArea.addEventListener("pointerleave", spinEditPointerLeave);
		buttonsArea.addEventListener("pointercancel", spinEditPointerCancel);
	}
}
