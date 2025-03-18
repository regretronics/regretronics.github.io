"use strict";

const spinInterval = 250; //milliseconds.
function spinEditTimer(spinEdit, pointerId) {
	//console.log("spinEditTimer", spinEdit, pointerId);
	if(!spinEdit) return;
	const buttonsArea = spinEdit.querySelector(".buttons-area");
	if(!buttonsArea) return;
	buttonsArea.deltaTimer = 0;
	//if(!buttonsArea.matches(":active") && !buttonsArea.querySelector(":active")) return;
	if(!buttonsArea.hasPointerCapture(pointerId)) return;
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
				//for(let i = 0; i < iterations; i++)
					txtControl.stepDown();
				txtControl.dispatchEvent(new Event("input"));
			}
			//buttonsArea.currentDelta--;
		} else if(buttonsArea.hoverElem.classList.contains("inc")) {
			//if(txtControl) txtControl.valueAsNumber += txtControl.step;
			if(txtControl) {
				//for(let i = 0; i < iterations; i++)
					txtControl.stepUp();
				txtControl.dispatchEvent(new Event("input"));
			};
			//buttonsArea.currentDelta++;
		}
	}
	const currentDelta = (txtControl?.valueAsNumber - buttonsArea.initialValue) / (txtControl?.step ?? 1);

	let nextInterval = spinInterval;
	if(txtControl && !txtControl.classList.contains("exp"))
		nextInterval = spinInterval * Math.pow(0.5, Math.abs(currentDelta) / 16.0);
	buttonsArea.deltaTimer = window.setTimeout(spinEditTimer, nextInterval, spinEdit, pointerId);
	//buttonsArea.deltaTimer = window.setTimeout(spinEditTimer, 0.25 * spinInterval, spinEdit, pointerId);
}

function spinEditPointerDown(event) {
	if(!event?.target) return;
	if(event.button != 0) return;
	const buttonsArea = event.currentTarget; //to do: try event.target.closest(".buttons-area") ?
	if(!buttonsArea) return;

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
	if(!event) return;
	const buttonsArea = event.target;
	if(!buttonsArea) return;

	if(!buttonsArea.hasPointerCapture(event.pointerId)) return;
	buttonsArea.lastPointerEvent = event;
	let hit = document.elementFromPoint(event.clientX, event.clientY);
	if(!buttonsArea.contains(hit)) hit = null;
	if(buttonsArea.hoverElem && buttonsArea.hoverElem !== hit)
		buttonsArea.hoverElem.classList.remove("hover");
	if(hit) hit.classList.add("hover");
	buttonsArea.hoverElem = hit;
}
function spinEditPointerUp(event) {
	if(!event?.srcElement) return;
	const buttonsArea = event.srcElement;
	//buttonsArea.pointerDown = false;

	if(buttonsArea.hoverElem) buttonsArea.hoverElem.classList.remove("hover");
	buttonsArea.hoverElem = null;

	window.clearTimeout(buttonsArea.deltaTimer);
	buttonsArea.deltaTimer = undefined;

	buttonsArea.releasePointerCapture(event.pointerId);
	buttonsArea.removeEventListener("pointermove", spinEditPointerMove, true);
}
function spinEditPointerLeave(event) {
	if(!event?.srcElement) return;
	const buttonsArea = event.srcElement;

	if(buttonsArea.hoverElem) buttonsArea.hoverElem.classList.remove("hover");
	buttonsArea.hoverElem = null;
}
function spinEditPointerCancel(event) {
	if(!event?.srcElement) return;
	const buttonsArea = event.srcElement;
	//buttonsArea.pointerDown = false;

	window.clearTimeout(buttonsArea.deltaTimer);
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
